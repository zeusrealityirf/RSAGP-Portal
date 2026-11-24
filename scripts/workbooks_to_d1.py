#!/usr/bin/env python3
"""Private migration: 9 RSAGP .xlsx workbooks -> Cloudflare D1 SQL.

NEVER COMMIT OUTPUT SQL. Inputs/SQL contain private applicant, citizenship and audit data.
Uses artifact_tool to read workbook values; preserves original tab column order.
The converter fails if required schema columns differ. Missing accessRoles/accessUsers
are permitted only because the uploaded export predates those permissions tabs.
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import shutil
import tempfile
import zipfile
from collections import Counter
from artifact_tool import Blob, SpreadsheetFile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = json.loads((ROOT / 'docs' / 'database-schema.json').read_text(encoding='utf-8'))


def quote(value):
    return "'" + str(value).replace("'", "''") + "'"


def convert(value, header):
    if value is None:
        return ''
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat(timespec='seconds') + ('Z' if isinstance(value, dt.datetime) else '')
    if isinstance(value, float) and (' At' in header or header in ('Date', 'Due Date', 'Timestamp', 'Release Date')):
        return (dt.datetime(1899,12,30,tzinfo=dt.timezone.utc) + dt.timedelta(days=value)).isoformat().replace('+00:00', 'Z') if ' At' in header or header=='Timestamp' else (dt.datetime(1899,12,30) + dt.timedelta(days=value)).date().isoformat()
    if isinstance(value, float) and header=='Time' and 0<=value<1:
        seconds=round(value*86400);return f'{seconds//3600:02d}:{(seconds//60)%60:02d}'
    if 'Discord' in header or header in ('Owner ID','Author ID','Actor ID','Recorder ID','Reviewer Discord ID','Signatory Discord ID','Updated By','Created By','Reviewed By','Verified By','Recorded By'):
        if isinstance(value,(float,int)) and abs(value)>10**15:
            raise ValueError('A long Discord ID was converted to a number by Excel; restore the text value from a reliable backup.')
        return str(value)
    if isinstance(value, float) and value.is_integer() and not ('score' in header.lower()):
        return int(value)
    return value


def emit(path, output):
    counters=Counter();missing=[];seq=0
    with output.open('w',encoding='utf-8') as sql:
        sql.write('-- PRIVATE RSAGP record import. NEVER upload this file to GitHub or GitHub Pages.\n')
        sql.write('-- Run only against the target D1 database after an independent backup.\n')
        for group,details in SCHEMA['groups'].items():
            filename=details['workbook']
            candidates=list(path.rglob(filename))
            if len(candidates)!=1:
                raise ValueError(f'Expected exactly one {filename}, found {len(candidates)}.')
            book=SpreadsheetFile.import_xlsx(Blob.load(str(candidates[0])))
            listing=book.inspect({'kind':'sheet','include':'id,name'}).ndjson
            actual={json.loads(line)['name'] for line in listing.splitlines() if line.strip()}
            expected=set(details['tabs'])
            extra=actual-expected
            absent=expected-actual
            if extra:
                raise ValueError('Unexpected tabs in '+filename+': '+', '.join(sorted(extra)))
            if absent:
                if not (group=='core' and absent=={'accessRoles','accessUsers'}):
                    raise ValueError('Missing required tabs in '+filename+': '+', '.join(sorted(absent)))
                missing.extend(sorted(absent))
            for tab,headings in details['tabs'].items():
                if tab not in actual:continue
                sheet=book.worksheets.get_item(tab)
                rows=sheet.get_range('A1').get_current_region().values
                if not rows:raise ValueError('Empty tab: '+tab)
                observed=list(rows[0])
                if observed!=headings:
                    raise ValueError('Header mismatch in '+tab+'. Expected schema has '+str(len(headings))+' columns; actual has '+str(len(observed))+'.')
                for values in rows[1:]:
                    if not any(v is not None and v!='' for v in values):continue
                    seq+=1
                    data=[convert(v,headings[i]) for i,v in enumerate(values)]
                    if len(data)!=len(headings):raise ValueError('Wrong row width in '+tab)
                    primary=str(data[0]) if tab!='audit' else f'AUDIT-{seq:012d}'
                    if not primary:raise ValueError('Missing first-column record ID in '+tab)
                    content=json.dumps(data,ensure_ascii=False,separators=(',',':'),default=str)
                    sql.write('INSERT INTO records(bucket,record_id,payload,seq) VALUES ('+','.join([quote(tab),quote(primary),quote(content),str(seq)])+');\n')
                    counters[tab]+=1
        sql.write("INSERT INTO migration_meta(key,value) VALUES ('workbook_import_version','1');\n")
    return {'sourceWorkbooks':len(SCHEMA['groups']),'records':sum(counters.values()),'perTabCounts':dict(counters),'tabsAbsentFromExport':missing,'containsPrivateRecords':True}


def main():
    p=argparse.ArgumentParser();p.add_argument('input',help='RSAGP Sheets ZIP or extracted directory');p.add_argument('--output',required=True,help='PRIVATE output SQL path; do not put under GitHub repository');a=p.parse_args()
    source=pathlib.Path(a.input).expanduser().resolve();out=pathlib.Path(a.output).expanduser().resolve()
    if not source.exists():raise SystemExit('Input file does not exist.')
    if out.is_relative_to(ROOT):raise SystemExit('Refusing to place PRIVATE SQL inside the GitHub repository.')
    out.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='rsagp-private-') as temp:
        path=pathlib.Path(temp)
        if source.is_dir():path=source
        else:
            with zipfile.ZipFile(source) as z:
                for member in z.infolist():
                    target=(path/member.filename).resolve()
                    if not target.is_relative_to(path):raise SystemExit('Unsafe ZIP entry path.')
                    if member.is_dir():continue
                    if not member.filename.lower().endswith('.xlsx'):continue
                    target.parent.mkdir(parents=True,exist_ok=True)
                    with z.open(member) as source_stream,target.open('wb') as target_stream:shutil.copyfileobj(source_stream,target_stream)
        try:summary=emit(path,out)
        except Exception:
            out.unlink(missing_ok=True)
            raise
    print(json.dumps(summary,indent=2))
    print('Private SQL prepared; do not commit/upload it to GitHub.')
if __name__=='__main__':main()
