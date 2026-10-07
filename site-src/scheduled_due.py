#!/usr/bin/env python3
"""Used by the hourly GitHub workflow: prints "yes" when a page scheduled in the website editor
   has reached its time (New Zealand time) and is not on the website yet, otherwise "no"."""
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
print('yes' if any(not os.path.exists(x) for x in out) else 'no')
