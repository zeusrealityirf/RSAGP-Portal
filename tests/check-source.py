#!/usr/bin/env python3
from pathlib import Path
import re
ROOT = Path(__file__).resolve().parents[1]
files=[ROOT/'site/index.html',ROOT/'site/citizenship/index.html',ROOT/'site/careers/index.html']
for file in files:
 s=file.read_text()
 assert '<!DOCTYPE html>' in s.upper() or '<!doctype html>' in s.lower()
 assert 'window.RSAGPBridge.bootstrap' in s
 assert 'js/bridge.js' in s
 assert 'google.script.run' not in s
 assert not re.search(r'<\?!=?\s*\w+\s*\?>', s)
 assert 'src="data:image/png;base64,' not in s, 'Brand image data should be extracted as assets.'
 print('OK',file.relative_to(ROOT),len(s),'bytes')
client='\n'.join(f.read_text() for f in files)
allowed=(ROOT/'apps-script/RSAGP_Project/GitHubPagesBridge.gs').read_text()
api_actions=set(re.findall(r"\b(?:api|call|mutate|runDoc)\('([A-Za-z]\w+)'",client))
server_actions=set(re.findall(r"'([A-Za-z]\w+)'",allowed.split(']);')[0]))
missing=api_actions-server_actions
assert not missing, f'Missing backend actions: {sorted(missing)}'
assert not {'setupPortal','migrateToSplitDatabases','setupAccessControl','advanceRSAGPMultiDatabaseMigration'}.intersection(server_actions)
print('OK API action list',len(server_actions),'actions; literal calls',len(api_actions))
