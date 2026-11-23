#!/usr/bin/env python3
"""Deterministically render the original Apps Script HTML templates as static pages.

The CSS, layout, markup, and original UI functions remain intact; only the GAS
bootstrap and google.script.run transport are adapted to our Worker bridge.
"""
import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'apps-script' / 'RSAGP_Project'
SITE = ROOT / 'site'


def asset(name, file):
    content = (SRC / file).read_text()
    m = re.search(r'const\s+' + re.escape(name) + r"\s*=\s*'data:image/png;base64,([^']+)'", content)
    if not m:
        raise RuntimeError(f'Asset {name} missing from {file}')
    data = base64.b64decode(m.group(1), validate=True)
    if not data.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError(f'{name} must be a PNG')
    out = SITE / 'assets' / (name.lower() + '.png')
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    return f'assets/{out.name}'


coat = asset('SA_COAT_SRC_', 'BrandAssets.gs')
flag = asset('SA_FLAG_SRC_', 'BrandAssets.gs')
asset('GOV_SEAL_SRC_', 'Branding.gs')

PAGES = [
    ('Index.html', SITE / 'index.html', 'cabinet', ''),
    ('CareersPortal.html', SITE / 'careers' / 'index.html', 'careers', '../'),
    ('CitizenPortal.html', SITE / 'citizenship' / 'index.html', 'citizenship', '../'),
]
for filename, output, view, prefix in PAGES:
    html = (SRC / filename).read_text()
    values = {
        'coatSrc': prefix + coat,
        'flagSrc': prefix + flag,
        'bootstrapJson': "window.RSAGPBridge.bootstrap('%s')" % view,
        'careersJson': '[]',  # loaded from *real* public backend on each visit
        'careersCount': 'Loading current vacancies…',
        'careersMarkup': '<div class="empty" style="grid-column:1/-1">Checking currently available vacancies…</div>',
        'careersLoginHref': '#',
    }
    for key, value in values.items():
        html = re.sub(r'<\?!=\s*' + key + r'\s*\?>', lambda _: value, html)
    if re.search(r'<\?!=?|\?>', html):
        raise RuntimeError(f'Unresolved template marker in {filename}')
    insert = '<script src="' + prefix + 'config.js"></script>\n<script src="' + prefix + 'js/bridge.js"></script>\n'
    # Bootstrap before any inline JS (the first script may be the main UI script)
    html = html.replace('</head>', insert + '</head>', 1) if '</head>' in html else html.replace('</HEAD>', insert + '</HEAD>', 1)
    if 'js/bridge.js' not in html:
        raise RuntimeError(f'Missing bridge injection in {filename}')
    if view == 'cabinet':
        old = '''async function api(name,...args){
  if(window.MZ_DEMO)return Promise.resolve(window.MZ_DEMO(name,...args));
  return new Promise((resolve,reject)=>{
    if(!window.google||!google.script||!google.script.run)return reject(new Error('Open this page from your deployed Google Apps Script web app.'));
    google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e?.message||String(e))))[name](...args);
  });
}'''
        new = '''async function api(name,...args){return window.RSAGPBridge.call(name,args);}'''
    elif view == 'careers':
        old = '''function call(name,...args){return new Promise((resolve,reject)=>{
 if(!window.google?.script?.run)return reject(new Error('Please open the deployed RSAGP Apps Script web app.'));
 google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e?.message||String(e))))[name](...args);
});}'''
        new = '''function call(name,...args){return window.RSAGPBridge.call(name,args);}'''
    else:
        old = '''function call(name,...args){if(window.MZ_DEMO)return Promise.resolve(window.MZ_DEMO(name,...args));return new Promise((resolve,reject)=>{
  if(!window.google||!google.script||!google.script.run)return reject(new Error('Open the deployed Google Apps Script web app.'));
  google.script.run.withSuccessHandler(resolve).withFailureHandler(e=>reject(new Error(e?.message||String(e))))[name](...args);
});}'''
        new = '''function call(name,...args){return window.RSAGPBridge.call(name,args);}'''
    if html.count(old) != 1:
        raise RuntimeError(f'Cannot find original transport for {filename}')
    html = html.replace(old,new)
    if view == 'careers':
        # Do not mistake a failed data load for zero vacancies. Do not block login
        # while waiting for Google Sheets to return the public vacancy list.
        html = html.replace('let JOBS=[];', 'let JOBS=[];')  # Initial JS comes from template.
        init_line = 'if(!Array.isArray(JOBS))JOBS=[];'
        assert html.count(init_line) == 1
        html = html.replace(init_line, init_line + '\nlet JOBS_LOADING=true;')
        renderer = 'function jobsRender(){'
        assert html.count(renderer) == 1
        html = html.replace(renderer, renderer + '\n if(JOBS_LOADING)return;')
        old = " $('loginButton').href=BOOT.loginUrl||'#';\n jobsRender();\n if(!session)"
        new = """ $('loginButton').href=BOOT.loginUrl||'#';
 // Load public positions asynchronously, without holding up the login button.
 call('getCareerPositions').then(positions=>{
   JOBS=Array.isArray(positions)?positions:[];JOBS_LOADING=false;jobsRender();
 }).catch(e=>{
   const box=$('careersLoadMessage');
   if(box){box.hidden=false;box.textContent=e.message;}
   $('jobs').innerHTML='<div class="empty" style="grid-column:1/-1">Current vacancies are temporarily unavailable. Please try again later.</div>';
   $('positionCount').textContent='Vacancies unavailable';
 });
 if(!session)"""
        if html.count(old) != 1:
            raise RuntimeError('Cannot locate public Careers loader')
        html=html.replace(old,new)
    if re.search(r'google\.script\.run|<\?!=?', html):
        raise RuntimeError(f'Apps Script calls/template remain in {filename}')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(html)
    print('Created',output.relative_to(ROOT),len(html),'chars')
