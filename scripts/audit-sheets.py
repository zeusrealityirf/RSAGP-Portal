#!/usr/bin/env python3
"""Compare RSAGP xlsx exports to Code.gs schema without reading or printing private record data.

No external dependencies. Run from repository root:
  python3 scripts/audit-sheets.py '/path/to/RSAGP Sheets.zip'
You can also pass a folder of nine .xlsx files.
"""
from __future__ import annotations
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'rel': 'http://schemas.openxmlformats.org/package/2006/relationships'}

def xlsx_tabs(raw: bytes):
    from io import BytesIO
    with zipfile.ZipFile(BytesIO(raw)) as archive:
        names=set(archive.namelist())
        book=ET.fromstring(archive.read('xl/workbook.xml'))
        rel=ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        targets={r.attrib['Id']:r.attrib['Target'] for r in rel}
        strings=[]
        if 'xl/sharedStrings.xml' in names:
            sst=ET.fromstring(archive.read('xl/sharedStrings.xml'))
            for si in sst.findall('m:si',NS):
                strings.append(''.join(x.text or '' for x in si.iter('{'+NS['m']+'}t')))
        out={}
        for sheet in book.findall('m:sheets/m:sheet',NS):
            name=sheet.attrib['name']
            target=targets.get(sheet.attrib.get('{'+NS['r']+'}id',''))
            if not target: continue
            loc=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
            if loc not in names: continue
            data=ET.fromstring(archive.read(loc))
            first=data.find('m:sheetData/m:row[@r="1"]',NS)
            header={}
            if first is not None:
                for cell in first.findall('m:c',NS):
                    ref=cell.attrib.get('r','')
                    match=re.match(r'^([A-Z]+)1$',ref)
                    if not match: continue
                    col=0
                    for ch in match.group(1):col=col*26+(ord(ch)-64)
                    value=cell.find('m:v',NS)
                    t=cell.attrib.get('t')
                    if t=='s' and value is not None:
                        try: text=strings[int(value.text)]
                        except (IndexError,ValueError,TypeError):text=''
                    elif t=='inlineStr':
                        text=''.join(x.text or '' for x in cell.iter('{'+NS['m']+'}t'))
                    else:text=value.text if value is not None and value.text else ''
                    header[col]=text
            out[name]=[header.get(i,'') for i in range(1,max(header,default=0)+1)]
        return out

def read_files(source:Path):
    if source.is_dir():
        for path in source.rglob('*.xlsx'):
            yield path.name,path.read_bytes()
    elif zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            for name in archive.namelist():
                if name.lower().endswith('.xlsx') and not name.startswith('__MACOSX/'):
                    yield Path(name).name,archive.read(name)
    else:raise ValueError('Provide a directory of .xlsx files or a ZIP containing them.')

def main():
    if len(sys.argv)!=2:
        print('Usage: python3 scripts/audit-sheets.py "/path/to/RSAGP Sheets.zip"')
        return 2
    expected=json.loads((ROOT/'docs/database-schema.json').read_text())['groups']
    files=dict(read_files(Path(sys.argv[1])))
    warnings=0
    for group,data in expected.items():
        name=data['workbook']
        print(f'[{group}] {name}')
        if name not in files:
            print('  MISSING WORKBOOK'); warnings+=1;continue
        try:actual=xlsx_tabs(files[name])
        except (zipfile.BadZipFile,ET.ParseError,KeyError) as exc:
            print('  INVALID WORKBOOK:',type(exc).__name__);warnings+=1;continue
        for tab,columns in data['tabs'].items():
            if tab not in actual:
                print(f'  MISSING TAB: {tab}');warnings+=1
            elif actual[tab]!=columns:
                print(f'  HEADER MISMATCH: {tab} (expected {len(columns)} columns, found {len(actual[tab])})');warnings+=1
            else:
                print(f'  OK: {tab} ({len(columns)} columns)')
        for unexpected in sorted(set(actual)-set(data['tabs'])):
            print(f'  EXTRA TAB (review manually): {unexpected}')
    print(f'\nSchema check complete: {warnings} issue(s). No record values were printed or uploaded.')
    return 1 if warnings else 0

if __name__=='__main__':sys.exit(main())
