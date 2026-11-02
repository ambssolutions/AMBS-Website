#!/usr/bin/env python3
"""Used by the hourly GitHub workflow: prints "yes" when a page scheduled in the website editor
   has reached its time (New Zealand time) and is not on the website yet, or when the homepage wording changed
   since the chat helper's answers were last gathered; otherwise "no"."""
import json, os, datetime, zoneinfo
SRC=os.path.dirname(os.path.abspath(__file__)); ROOT=os.path.dirname(SRC)
now=os.environ.get('AMBS_NOW') or datetime.datetime.now(zoneinfo.ZoneInfo('Pacific/Auckland')).strftime('%Y-%m-%dT%H:%M')
due=lambda d: d.get('draft') and d.get('publish_at') and d['publish_at']<=now
out=[]
for p in json.load(open(os.path.join(SRC,'content','pages.json'),encoding='utf8'))['pages']:
    if due(p): out.append(os.path.join(ROOT,p['section'],p['slug']+'.html'))
cdir=os.path.join(SRC,'content','custom')
if os.path.isdir(cdir):
    for f in os.listdir(cdir):
        if f.endswith('.json') and due(json.load(open(os.path.join(cdir,f),encoding='utf8'))): out.append(os.path.join(ROOT,f[:-5]+'.html'))
# the chat helper answers from the homepage wording too; homepage edits publish without a rebuild, so check it here
import hashlib
stale=False
try:
    idx=json.load(open(os.path.join(ROOT,'assets','chat-index.json'),encoding='utf8'))
    stale=idx.get('src')!=hashlib.md5(open(os.path.join(SRC,'assets','home.js'),'rb').read()).hexdigest()[:8]
except Exception: pass
# the security policy allows each page's own small scripts by fingerprint (build.py csp_update); if a page changed
# without a rebuild, rebuild so the policy matches again
try:
    import importlib.util,sys
    spec=importlib.util.spec_from_file_location('b',os.path.join(SRC,'build.py'))
    src=open(os.path.join(SRC,'build.py'),encoding='utf8').read()
    i=src.index("# ---- Content Security Policy");j=src.index("\nif __name__=='__main__':")
    ns={'os':os,'re':__import__('re'),'json':json,'OUT':ROOT};exec(src[i:j],ns)
    v=json.load(open(os.path.join(ROOT,'vercel.json'),encoding='utf8'))
    cur=[h['value'] for b in v.get('headers',[]) if b.get('source')==ns['CSP_SRC'] for h in b['headers'] if h['key']=='Content-Security-Policy']
    if not cur or cur[0]!=ns['csp_value'](): stale=True
except Exception: pass
print('yes' if stale or any(not os.path.exists(x) for x in out) else 'no')
