#!/usr/bin/env python3
"""Builds the AMBS sub-pages from content fragments.
   content/<section>/<slug>.html = <!--META {json} --> + article body.  Output goes to ../site/."""
import json, os, re, html, sys, datetime, urllib.parse
SRC=os.path.dirname(os.path.abspath(__file__))
# Output goes to the website root: the folder above site-src when it holds the site (this repository), otherwise ../site
_up=os.path.dirname(SRC)
OUT=os.environ.get('AMBS_OUT') or (_up if os.path.exists(os.path.join(_up,'index.html')) else os.path.join(_up,'site'))
GUIDE_ART=json.load(open(os.path.join(SRC,'guide_art.json'),encoding='utf8'))
BASE='https://ambs.co.nz'; TODAY='2026-10-04'

ICON={
 'auto':'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
 'map':'<path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0 1 18.5 10c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
 'clean':'<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/><path d="M5.5 15l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z"/>',
 'law':'<path d="M12 4v16M8 20h8M5 7h14"/><path d="M5 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/><path d="M19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
 'web':'<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.5h18"/><circle cx="12" cy="14.3" r="3.4"/>',
 'cafe':'<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
 'trades':'<path d="M14.5 5.5l4 4-9.5 9.5H5v-4z"/><path d="M12.5 7.5l4 4"/>',
 'clinic':'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
 'retail':'<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
 'adviser':'<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
 'transport':'<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
 'guide':'<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z"/><path d="M9 8h6M9 12h6"/>',
 'shield':'<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
 'chart':'<path d="M4 4v16h16"/><path d="M4 14l4-3 4 2 7-6"/>',
 'chat':'<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h9A2.5 2.5 0 0 1 18 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V15A2 2 0 0 1 4 13z"/>',
 'cal':'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
 'link':'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M10 6.5h5.5a2 2 0 0 1 2 2V14"/>',
 'invoice':'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h4"/>',
 'book':'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/>',
 'target':'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
}
# pages, hub page wording and the service cards live in content/pages.json, which the website editor changes
SITE=json.load(open(os.path.join(SRC,'content','pages.json'),encoding='utf8'))
# Google Analytics: the measurement ID is in site-src/content/site.json ("analytics_id"), editable in the website editor (Business details)
GA_ID=json.load(open(os.path.join(SRC,'content','site.json'),encoding='utf8')).get('analytics_id','').strip()
# Social profiles (Instagram, TikTok…) Google links to the business: "profiles" in site.json, editable in the website editor (Business details)
PROFILES=[u.strip() for u in json.load(open(os.path.join(SRC,'content','site.json'),encoding='utf8')).get('profiles',[]) if u.strip().startswith('https://')]

SOC_PATH={"instagram": "M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077", "tiktok": "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z", "facebook": "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z", "linkedin": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z", "youtube": "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z", "x": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"}
SOC_NAME={'instagram':'Instagram','tiktok':'TikTok','facebook':'Facebook','linkedin':'LinkedIn','youtube':'YouTube','x':'X'}
def _count_label(lab,n):
    if n!=1: return lab
    return lab[:-3]+'y' if lab.endswith('ies') else lab[:-1] if lab.endswith('s') else lab

SOC_APP={'instagram':'com.instagram.android','tiktok':'com.zhiliaoapp.musically','facebook':'com.facebook.katana','linkedin':'com.linkedin.android','youtube':'com.google.android.youtube','x':'com.twitter.android'}
def social_html():
    """the social profile icons in the footer, from "profiles" in site.json"""
    out=[]
    for u in PROFILES:
        host=urllib.parse.urlparse(u).netloc.lower().replace('www.','')
        k=next((k for k in SOC_PATH if host.startswith(k+'.') or (k=='x' and host in ('x.com','twitter.com')) or (k=='facebook' and host=='fb.com')),None)
        if not k: continue
        app=f' data-app="{SOC_APP[k]}"' if k in SOC_APP else ''
        out.append(f'<a href="{e(u)}"{app} target="_blank" rel="noopener me" aria-label="Ambs Solutions on {SOC_NAME[k]}" title="{SOC_NAME[k]}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="{SOC_PATH[k]}"/></svg></a>')
    # on phones the icons open the Instagram or TikTok app: same tab on iPhone (the app's own link takes over),
    # an Android app link that falls back to the website when the app isn't installed
    js=('<script>(function(){var u=navigator.userAgent,a=/Android/i.test(u),i=/iPhone|iPad|iPod/i.test(u)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);'
        'if(!a&&!i)return;document.querySelectorAll(".f2-social a[data-app]").forEach(function(l){l.removeAttribute("target");if(!a)return;'
        'var w=new URL(l.href),p=w.pathname;if(/instagram/.test(w.host))p="/_u"+p;'
        'l.href="intent://"+w.host+p+"#Intent;scheme=https;package="+l.dataset.app+";S.browser_fallback_url="+encodeURIComponent(w.href)+";end"})})();</script>')
    return f'<div class="f2-social">{"".join(out)}</div>{js}' if out else ''
# the two site fonts are served from /assets/fonts (downloaded from Google Fonts: latin and latin-ext, which has the
# te reo macrons) and preloaded, so they arrive with the page instead of making the browser lay it out again later
FONT_HEAD='<!--fonts--><link rel="preload" href="/assets/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin>\n<link rel="preload" href="/assets/fonts/instrument-sans-latin.woff2" as="font" type="font/woff2" crossorigin>\n<style>@font-face {font-family: \'Bricolage Grotesque\'; font-style: normal; font-weight: 500 800; font-stretch: 100%; font-display: swap; src: url(/assets/fonts/bricolage-grotesque-latin-ext.woff2) format(\'woff2\'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;}@font-face {font-family: \'Bricolage Grotesque\'; font-style: normal; font-weight: 500 800; font-stretch: 100%; font-display: swap; src: url(/assets/fonts/bricolage-grotesque-latin.woff2) format(\'woff2\'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;}@font-face {font-family: \'Instrument Sans\'; font-style: normal; font-weight: 400 700; font-stretch: 100%; font-display: swap; src: url(/assets/fonts/instrument-sans-latin-ext.woff2) format(\'woff2\'); unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;}@font-face {font-family: \'Instrument Sans\'; font-style: normal; font-weight: 400 700; font-stretch: 100%; font-display: swap; src: url(/assets/fonts/instrument-sans-latin.woff2) format(\'woff2\'); unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;}</style><!--/fonts-->'
def ga_snippet():
    # sends page views plus the actions that matter: booking clicks, phone and email taps, booking confirmed
    if not re.match(r'^G-[A-Z0-9]{4,}$',GA_ID): return ''
    # the tag itself loads after the page has finished loading (it is 180 KB and held phones back for a third of a second);
    # page views and clicks before then wait in dataLayer and are sent when it arrives
    return ('<!--ga--><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());'
      f'(function(){{var go=function(){{var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id={GA_ID}";document.head.appendChild(s)}};'
      'if(document.readyState==="complete")setTimeout(go,1500);else addEventListener("load",function(){setTimeout(go,1500)})})();'
      f'gtag("config","{GA_ID}");'
      'document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(!a)return;var h=a.getAttribute("href")||"";'
      'if(/#book$/.test(h)||/zohobookings/.test(h))gtag("event","book_click",{link_text:(a.textContent||"").trim().slice(0,60)});'
      'else if(h.indexOf("tel:")===0)gtag("event","phone_click");else if(h.indexOf("mailto:")===0)gtag("event","email_click")},true);'
      'if(location.pathname.indexOf("/booking-confirmed")===0)gtag("event","booking_confirmed");</script><!--/ga-->')
def stamp_ga(path):
    if not os.path.exists(path): return
    h=open(path,encoding='utf8').read();h=re.sub(r'<!--ga-->.*?<!--/ga-->\n?','',h,flags=re.S)
    s=ga_snippet()
    if s: h=h.replace('</head>',s+'\n</head>',1)
    open(path,'w',encoding='utf8').write(h)
# section, slug, card title, card blurb, category, icon
# pages saved as drafts in the editor are not published; a scheduled draft goes live once its time
# (New Zealand time, "publish_at") has come. A GitHub workflow rebuilds every hour to publish them.
import zoneinfo
NOW=os.environ.get('AMBS_NOW') or datetime.datetime.now(zoneinfo.ZoneInfo('Pacific/Auckland')).strftime('%Y-%m-%dT%H:%M')
def is_live(d): return not d.get('draft') or bool(d.get('publish_at') and d['publish_at']<=NOW)
PAGES=[(p['section'],p['slug'],p['title'],p['blurb'],p['category'],p['icon']) for p in SITE['pages'] if is_live(p)]
PHOTO={(p['section'],p['slug']):p['photo'] for p in SITE['pages'] if p.get('photo')}
SECTION={'services':('Services','What we build'),'industries':('Industries','Who we help'),'guides':('Guides','Knowledge hub'),'news':('News','Latest news'),'locations':('Locations','Where we work')}
HUB=SITE['hubs']
HUB.setdefault('locations',dict(title='Where We Work in New Zealand | Ambs Solutions',h1='Where we work',lead='AI automation, websites and portals for businesses across New Zealand. Pick your area.',desc='Ambs Solutions helps businesses across New Zealand with AI automation, websites, portals and dashboards. See what we do in your area.'))
HUB.setdefault('news',dict(title='News | Ambs Solutions',h1='News',lead='The latest from Ambs Solutions.',desc='News and updates from Ambs Solutions, AI automation and digital solutions for New Zealand businesses.'))

def _load(name,default):
    f=os.path.join(SRC,'content',name)
    return json.load(open(f,encoding='utf8')) if os.path.exists(f) else default
# English wording of the homepage, used for menu labels
_HJS=open(os.path.join(SRC,'assets','home.js'),encoding='utf8').read()
_a=_HJS.index('const I18N = {\nen:{')+len('const I18N = {\nen:{')
EN={m.group(1):json.loads(m.group(2)) for m in re.finditer(r'"([A-Za-z0-9_.-]+)":("(?:[^"\\]|\\.)*")',_HJS[_a:_HJS.index('\n}',_a)])}
# menus and footer links, edited in the website editor
MENUS=_load('menus.json',{})
# homepage section order, hidden sections and sections made of blocks
HOMESEC=_load('home-sections.json',{'order':[],'hidden':[],'custom':{}})
# pages at their own address, made of blocks
CUSTOM={}
_cdir=os.path.join(SRC,'content','custom')
if os.path.isdir(_cdir):
    for _f in sorted(os.listdir(_cdir)):
        if _f.endswith('.json'):
            _d=json.load(open(os.path.join(_cdir,_f),encoding='utf8'))
            if is_live(_d): CUSTOM[_f[:-5]]=_d
# fixed wording used on every page (bottom booking box, footer, page labels, 404 and booking pages):
# site-src/content/site-text.json, edited in the website editor (Business details tab). Missing keys use these defaults.
SITE_TEXT_DEFAULTS={
 'hdr.book':'Book a call','hdr.contact':'Contact us','qb.call':'Call','qb.book':'Book',
 'foot.tag':'AI automation and digital solutions for New Zealand businesses. Built in Auckland, working nationwide.',
 'foot.company':'Company','foot.explore':'Explore','foot.contact':'Contact us','foot.book':'Book a call',
 'foot.copy':'© 2026 Ambs Solutions. All rights reserved.','foot.privacy':'Privacy','foot.terms':'Terms of use',
 'cta.h':'See what you could hand over','cta.p':'Book a free session. We look at how your work really happens and leave you with a written plan and an hours estimate, yours to keep.',
 'cta.btn':'Book a free session','cta.call':'Call +64 22 099 9578',
 'calc.k':'Try it with your own numbers','calc.h':'Work out your hours back','calc.sub':'Pick one repetitive task. Move the sliders to match a normal week.',
 'calc.times':'How many times a week','calc.mins':'Minutes each time','calc.share':'How much could be automated',
 'calc.now':'hours a week on this task now','calc.year':'hours a year back',
 'calc.note':'An estimate from your own numbers, not a promise. In a free session we work out a proper estimate together.','calc.link':'Book a free session →',
 'pg.inshort':'In short','pg.questions':'Common questions','pg.onpage':'On this page','pg.keep':'Keep reading',
 'pg.allguides':'All guides →','pg.allind':'All industries →','pg.popular':'Popular guides','pg.byind':'Guides by industry','pg.svchow':'How every project runs',
 'pg.minread':'min read','pg.updated':'Updated','pg.nz':'New Zealand-wide','pg.free':'Free first session',
 'pg.readguide':'Read the guide','pg.learn':'Learn more','pg.readmore':'Read more','pg.post':'post','pg.posts':'posts',
 'pg.legalwhere':'Auckland, New Zealand','pg.lastupdated':'Last updated',
 'nf.eyebrow':'Error 404','nf.h1':'Page not found','nf.lead':'The page you were looking for is not here. It may have moved, or the link may have a typo. These will get you back on track.',
 'nf.home':'Go to the home page','nf.guides':'Browse the guides',
 'bk.eyebrow':'Booking confirmed','bk.h1':'You are booked in','bk.meeting':'Meeting','bk.service':'Discovery Call','bk.date':'Date','bk.time':'Time',
 'bk.length':'Length','bk.lengthv':'30 minutes','bk.with':'With','bk.withv':'Ambs Solutions',
 'bk.mail':'We have emailed you the details and a calendar invite.','bk.mailto':'We have emailed the details and a calendar invite to',
 'bk.change':'To change the time, use the link in that email or call','bk.back':'Back to the home page',
}
SITE_TEXT=dict(SITE_TEXT_DEFAULTS,**{k:v for k,v in _load('site-text.json',{}).items() if k in SITE_TEXT_DEFAULTS and isinstance(v,str)})
def T(k): return SITE_TEXT[k]
def TE(k): return html.escape(SITE_TEXT[k],quote=False)
def menu_label(it): return EN.get(it.get('key',''),'') or it.get('label','')
def menu_key(it): return it['key'] if it.get('key') in EN else 'ed.menu.'+it.get('id','x')
def sub_href(h): return '/'+h if h.startswith('#') else h
def e(x): return html.escape(x, quote=True)
def url(sec,slug=None): return f'/{sec}' + (f'/{slug}' if slug else '')
def card(p,tag=None):
    sec,slug,t,d,cat,ic=p
    ph=PHOTO.get((sec,slug))
    if ph: return (f'<a class="card card--photo" href="{url(sec,slug)}" data-cat="{e(cat)}"><img class="card-photo" src="{e(ph)}" alt="" loading="lazy" decoding="async">'
            f'<span class="tag">{e(tag or cat)}</span><h3>{e(t)}</h3><p>{e(d)}</p><span class="go">{TE("pg.readmore")}</span></a>')
    return (f'<a class="card" href="{url(sec,slug)}" data-cat="{e(cat)}"><span class="card-ico"><svg viewBox="0 0 24 24" aria-hidden="true">{ICON[ic]}</svg></span>'
            f'<span class="tag">{e(tag or cat)}</span><h3>{e(t)}</h3><p>{e(d)}</p><span class="go">{TE("pg.readguide") if sec=="guides" else TE("pg.learn")}</span></a>')
def find(path):
    sec,slug=path.split('/'); return next((p for p in PAGES if p[0]==sec and p[1]==slug),None)

import hashlib
def _v(name):
    return hashlib.md5(open(os.path.join(SRC,'assets',name),'rb').read()).hexdigest()[:8]
CSSV=_v('pages.css');JSV=_v('pages.js');BLV=_v('blocks.css');FMV=_v('forms.js')
FORMS_JS=f'<script src="/assets/forms.js?v={FMV}" defer></script>'
THEME="""<script>(function(){var t=null;try{t=sessionStorage.getItem("ambs:theme")}catch(e){}if(t!=="dark"&&t!=="light"){t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"}document.documentElement.dataset.theme=t})();</script>"""
def head(title,desc,canon,ld,ogtype='website',blocks=False):
    return f'''<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<script>
/* a refresh always starts fresh: top of the same page, with no leftover #section */
(function(){{try{{
  var nav=performance.getEntriesByType&&performance.getEntriesByType("navigation")[0];
  var reload=nav?nav.type==="reload":!!(performance.navigation&&performance.navigation.type===1);
  if(!reload)return;
  var app=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  if("scrollRestoration" in history)history.scrollRestoration="manual";
  if(location.hash||location.search)history.replaceState(null,"",location.pathname);
  window.scrollTo({{top:0,behavior:"instant"}});addEventListener("load",function(){{window.scrollTo({{top:0,behavior:"instant"}});}});
}}catch(e){{}}}})();
</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="{BASE}{canon}">
<meta property="og:type" content="{ogtype}">
<meta property="og:site_name" content="Ambs Solutions">
<meta property="og:url" content="{BASE}{canon}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{BASE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_NZ">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F4F7FC" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1428" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-dark.png" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-light.png" media="(prefers-color-scheme: light)">
<link rel="apple-touch-icon" href="/apple-touch-icon-v4.png">
<link rel="manifest" href="/manifest.webmanifest">
{THEME}
{FONT_HEAD}
<link rel="stylesheet" href="/assets/pages.css?v={CSSV}">{chr(10)+'<link rel="stylesheet" href="/assets/blocks.css?v='+BLV+'">' if blocks else ''}
<script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script>
{ga_snippet()}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
'''
def header(active):
    ico_mail='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="17" rx="2.6"/><path d="M3 5.2L12 12.8l9-7.6"/></svg>'
    ico_call='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'
    cur=active or ''
    def a(href,label,key): return f'<a href="{href}"' + (' aria-current="page"' if key and key==cur else '') + f'>{label}</a>'
    akey=lambda h:h.strip('/').split('/')[0] if h.startswith('/') and not h.startswith('/#') else ''
    main=[(sub_href(it['href']),e(menu_label(it)),akey(sub_href(it['href']))) for it in MENUS.get('main',[])]
    drawer=[(sub_href(it['href']),e(menu_label(it)),akey(sub_href(it['href']))) for it in MENUS.get('drawer',[])]
    return f'''<header class="hdr"><div class="sh-bar">
  <a class="sh-mark" href="/" aria-label="Ambs Solutions home"><picture><source srcset="/logo-400.webp" type="image/webp"><img src="/logo-400.png" width="613" height="224" alt="Ambs Solutions"></picture></a>
  <div class="sh-right">
    <button class="sh-ico sh-theme" id="themeBtn" type="button" aria-label="Switch light or dark mode"></button>
    <span class="langwrap"><select class="langselect" id="langselect" aria-label="Language"><option value="en" selected>English</option><option value="zh">中文</option><option value="hi">हिन्दी</option><option value="mi">Te Reo Māori</option><option value="pa">ਪੰਜਾਬੀ</option></select><span class="langcaret" aria-hidden="true"><svg viewBox="0 0 12 8" fill="none"><path d="M1.5 1.5L6 6l4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span>
    <nav class="sh-nav" aria-label="Main">{''.join(a(*m) for m in main)}</nav>
    <a class="sh-btn sh-book" href="/#book">{TE("hdr.book")}</a>
    <a class="sh-btn sh-contact" href="#contact">{TE("hdr.contact")}</a>
    <a class="sh-ico sh-sm sh-call" href="tel:+64220999578" aria-label="Call us">{ico_call}</a>
    <button class="sh-menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Menu"><span></span></button>
  </div>
  <nav class="sh-drawer" id="siteNav" aria-label="Menu">
    {''.join(a(*m) for m in drawer)}
    <a class="sh-btn sh-contact sh-wide" href="#contact">{TE("hdr.contact")}</a>
    <div class="sh-pair" role="group" aria-label="Light or dark mode"><button type="button" data-settheme="light" aria-pressed="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.5M12 18.9v2.5M2.6 12h2.5M18.9 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg><span>Light</span></button><button type="button" data-settheme="dark" aria-pressed="false"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg><span>Dark</span></button></div>
  </nav>
</div></header>
'''
def fcol(name): return ''.join(f'<a href="{e(sub_href(it["href"]))}">{e(menu_label(it))}</a>' for it in MENUS.get(name,[]))
def footer():
    col=lambda sec:''.join(f'<li><a href="{url(p[0],p[1])}">{e(p[2])}</a></li>' for p in PAGES if p[0]==sec)
    return f'''<nav class="qbar" aria-label="Quick actions"><a class="qb-call" href="tel:+64220999578"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg><span>{TE("qb.call")}</span></a><a class="qb-book" href="/#book"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4"/></svg><span>{TE("qb.book")}</span></a></nav>
<footer class="ftr f2"><div class="wrap">
  <div class="f2-grid">
    <div class="f2-brand"><a class="f2-logo" href="/" aria-label="Ambs Solutions home"><picture><source srcset="/logo-400.webp" type="image/webp"><img src="/logo-400.png" width="613" height="224" alt="Ambs Solutions" loading="lazy"></picture></a>
      <p>{TE("foot.tag")}</p>{social_html()}</div>
    <nav class="f2-col" aria-label="Company"><p class="f2-h">{TE("foot.company")}</p>{fcol('company')}</nav>
    <nav class="f2-col" aria-label="Explore"><p class="f2-h">{TE("foot.explore")}</p>{fcol('explore')}</nav>
    <div class="f2-col" id="contact"><p class="f2-h">{TE("foot.contact")}</p><a href="/#book">{TE("foot.book")}</a><a href="mailto:hello@ambs.co.nz">hello@ambs.co.nz</a><a href="tel:+64220999578">+64 22 099 9578</a><span>Auckland, NZ</span></div>
  </div>
  <div class="f2-bottom"><p class="f2-copy">{TE("foot.copy")}</p><nav class="f2-legal" aria-label="Legal"><a href="/privacy">{TE("foot.privacy")}</a><a href="/terms">{TE("foot.terms")}</a></nav></div>
</div></footer>
<script src="/assets/pages.js?v={JSV}" defer></script>
</body>
</html>
'''
def calc():
    return f'''<section class="g-calc" aria-labelledby="calcH"><p class="g-calc-k">{TE("calc.k")}</p><h2 id="calcH" class="g-calc-h">{TE("calc.h")}</h2>
<p class="g-calc-sub">{TE("calc.sub")}</p>
<div class="g-calc-in">
<label>{TE("calc.times")}<output id="cTimes">20</output><input type="range" id="rTimes" min="1" max="150" value="20"></label>
<label>{TE("calc.mins")}<output id="cMins">10</output><input type="range" id="rMins" min="1" max="60" value="10"></label>
<label>{TE("calc.share")}<output id="cShare">50%</output><input type="range" id="rShare" min="10" max="90" step="10" value="50"></label>
</div>
<div class="g-calc-out"><div><b id="cNow">3.3</b><span>{TE("calc.now")}</span></div><div class="g-calc-big"><b id="cYear">87</b><span>{TE("calc.year")}</span></div></div>
<p class="g-calc-note">{TE("calc.note")} <a href="/#book">{TE("calc.link")}</a></p>
</section>'''
def cta():
    return f'''<section class="cta"><div><h2>{TE("cta.h")}</h2><p>{TE("cta.p")}</p></div>
  <div class="btns"><a class="btn btn--go" href="/#book">{TE("cta.btn")}</a><a class="btn btn--ghost" href="tel:+64220999578">{TE("cta.call")}</a></div></section>'''
def crumbs(items):
    lis=''.join((f'<li><a href="{h}">{e(t)}</a></li>' if h else f'<li aria-current="page">{e(t)}</li>') for t,h in items)
    ld={'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':i+1,'name':t,'item':BASE+(h or items[-1][1] or '')} for i,(t,h) in enumerate(items)]}
    return f'<nav class="crumbs" aria-label="Breadcrumb"><ol>{lis}</ol></nav>', ld
ORG={'@type':'ProfessionalService','@id':BASE+'/#business','name':'Ambs Solutions','url':BASE+'/','telephone':'+64 22 099 9578','email':'hello@ambs.co.nz',
     'areaServed':{'@type':'Country','name':'New Zealand'},'address':{'@type':'PostalAddress','addressLocality':'Auckland','addressCountry':'NZ'},'logo':BASE+'/logo.png','sameAs':PROFILES}

def build_page(p):
    sec,slug,ctitle,cdesc,cat,ic=p
    raw=open(os.path.join(SRC,'content',sec,slug+'.html'),encoding='utf8').read()
    m=re.match(r'\s*<!--META\s*(\{.*?\})\s*-->\s*(.*)',raw,re.S); meta=json.loads(m.group(1)); body=m.group(2).strip()
    words=len(re.sub(r'<[^>]+>',' ',body).split())+sum(len((q+' '+a).split()) for q,a in meta.get('faq',[]))
    mins=max(2,round(words/220))
    canon=url(sec,slug); stitle=SECTION[sec][0]
    cr_html,cr_ld=crumbs([('Home','/'),(stitle,url(sec)),(meta['h1'],None)])
    cr_ld['itemListElement'][-1]['item']=BASE+canon
    graph=[cr_ld,ORG]
    if sec in ('guides','news'):
        graph.append({'@type':'Article' if sec=='guides' else 'NewsArticle','headline':meta['h1'],'description':meta['description'],'datePublished':meta.get('published',TODAY),'dateModified':meta.get('updated',TODAY),
          'inLanguage':'en-NZ','wordCount':words,'author':{'@type':'Organization','name':'Ambs Solutions','url':BASE+'/'},'publisher':{'@id':BASE+'/#business'},
          'mainEntityOfPage':BASE+canon,'image':BASE+'/logo.png','articleSection':cat})
    else:
        graph.append({'@type':'Service','name':meta['h1'],'serviceType':meta.get('serviceType',ctitle),'description':meta['description'],'provider':{'@id':BASE+'/#business'},
          'areaServed':({'@type':'City','name':meta.get('city') or ctitle} if sec=='locations' else {'@type':'Country','name':'New Zealand'}),'url':BASE+canon})
    if meta.get('faq'):
        graph.append({'@type':'FAQPage','mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}} for q,a in meta['faq']]})
    ld={'@context':'https://schema.org','@graph':graph}
    tk=''.join(f'<li>{e(x)}</li>' for x in meta.get('takeaways',[]))
    takeaways=f'<div class="takeaways"><b>{TE("pg.inshort")}</b><ul>{tk}</ul></div>' if tk else ''
    faq=''
    if meta.get('faq'):
        faq='<h2 id="questions">'+TE("pg.questions")+'</h2><div class="faq">'+''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q,a in meta['faq'])+'</div>'
    rel=[x for x in (find(r) for r in meta.get('related',[])) if x][:3]
    related=(f'<section class="section"><div class="section-h"><h2>{TE("pg.keep")}</h2><a href="/guides">{TE("pg.allguides")}</a></div><div class="cards">{"".join(card(r) for r in rel)}</div></section>') if rel else ''
    pills=[f'<span>{e(meta.get("eyebrow",cat))}</span>']
    if sec=='guides': pills+= [f'<span>{mins} {TE("pg.minread")}</span>',f'<span>{TE("pg.updated")} {datetime.date.fromisoformat(meta.get("updated",TODAY)).strftime("%-d %B %Y")}</span>']
    elif sec=='news':
        if cat and cat!='News': pills.append(f'<a class="pcat" href="/news?c={urllib.parse.quote(cat)}">{e(cat)}</a>')
        pills+= [f'<span>{datetime.date.fromisoformat(meta.get("published",TODAY)).strftime("%-d %B %Y")}</span>',f'<span>{mins} {TE("pg.minread")}</span>']
    else: pills+= ['<span>'+TE("pg.nz")+'</span>','<span>'+TE("pg.free")+'</span>']
    art=f'<div class="g-art" aria-hidden="true">{GUIDE_ART[slug]}</div>' if sec=='guides' and slug in GUIDE_ART else ''
    if sec=='news' and PHOTO.get((sec,slug)): art=f'<figure class="news-hero"><img src="{e(PHOTO[(sec,slug)])}" alt="" decoding="async"></figure>'
    if sec=='guides' and slug not in ('automation-glossary','privacy-act-2020-and-automation'): faq=calc()+faq
    out=head(meta['title'],meta['description'],canon,ld,'article' if sec=='guides' else 'website')+header(sec)+f'''<main id="main">
<div class="wrap">{cr_html}</div>
<section class="phero"><div class="wrap">
  <p class="eyebrow">{e(meta.get("eyebrow",cat))}</p>
  <h1>{e(meta["h1"])}</h1>
  <p class="plead">{e(meta["lead"])}</p>
  <div class="pmeta">{"".join(pills)}</div>
  {art}
</div></section>
<div class="wrap layout">
  <article class="prose">
{takeaways}
{body}
{faq}
  </article>
  <aside class="toc" aria-label="On this page"><div class="toc-box"><b>{TE("pg.onpage")}</b><ol id="tocList"></ol></div></aside>
</div>
<div class="wrap">{related}{cta()}</div>
</main>
'''+footer()
    os.makedirs(os.path.join(OUT,sec),exist_ok=True)
    open(os.path.join(OUT,sec,slug+'.html'),'w',encoding='utf8').write(out)
    return words


SVC=[dict(slug=x['slug'],ic=x['icon'],k=x['label'],t=x['title'],c1=x['colour1'],c2=x['colour2'],d=x['text'],inc=[(i['icon'],i['text']) for i in x['includes']],go=x['button']) for x in SITE['service_cards']]
def services_feature():
    out='<section class="section svc-sec"><div class="svc-grid">'
    for i,s in enumerate(SVC):
        lis=''.join(f'<li style="--i:{k}"><span class="svc-li-ico"><svg viewBox="0 0 24 24" aria-hidden="true">{ICON[ic]}</svg></span>{e(t)}</li>' for k,(ic,t) in enumerate(s['inc']))
        out+=(f'<a class="svc-card" href="/services/{s["slug"]}" style="--c1:{s["c1"]};--c2:{s["c2"]}">'
              f'<span class="svc-glow" aria-hidden="true"></span>'
              f'<span class="svc-ico"><svg viewBox="0 0 24 24" aria-hidden="true">{ICON[s["ic"]]}</svg></span>'
              f'<span class="svc-k">{e(s["k"])}</span><h2 class="svc-t">{e(s["t"])}</h2><p class="svc-d">{e(s["d"])}</p>'
              f'<ul class="svc-inc">{lis}</ul><span class="svc-go">{e(s["go"])} <span aria-hidden="true">&#8594;</span></span></a>')
    out+='</div></section>'
    steps=[(str(i+1),x['title'],x['text']) for i,x in enumerate(SITE['service_steps'])]
    out+='<section class="section svc-how"><div class="section-h"><h2>'+TE("pg.svchow")+'</h2></div><ol class="svc-steps">'+''.join(
        f'<li><span class="svc-n">{n}</span><b>{e(t)}</b><p>{e(d)}</p></li>' for k,(n,t,d) in enumerate(steps))+'</ol></section>'
    return out

def page_meta(p):
    raw=open(os.path.join(SRC,'content',p[0],p[1]+'.html'),encoding='utf8').read()
    m=re.match(r'\s*<!--META\s*(\{.*?\})\s*-->',raw,re.S); return json.loads(m.group(1)) if m else {}
def build_hub(sec):
    h=HUB[sec]; canon=url(sec)
    cr_html,cr_ld=crumbs([('Home','/'),(SECTION[sec][0],None)]); cr_ld['itemListElement'][-1]['item']=BASE+canon
    items=[p for p in PAGES if p[0]==sec]
    if sec=='news': items.sort(key=lambda p:page_meta(p).get('published',''),reverse=True)
    ld={'@context':'https://schema.org','@graph':[cr_ld,ORG,{'@type':'CollectionPage','name':h['h1'],'description':h['desc'],'url':BASE+canon,
        'mainEntity':{'@type':'ItemList','itemListElement':[{'@type':'ListItem','position':i+1,'url':BASE+url(p[0],p[1]),'name':p[2]} for i,p in enumerate(items)]}}]}
    cats=[]; [cats.append(p[4]) for p in items if p[4] not in cats]
    filt=''
    if sec in ('guides','news'):
        # a search box, and category buttons when there is more than one category
        word=SECTION[sec][0].lower()
        filt=(f'<div class="hub-tools"><label class="hub-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>'
              f'<input type="search" data-for="hubGrid" placeholder="Search {word}" aria-label="Search {word}" autocomplete="off"></label></div>')
        if len(cats)>1 or sec=='guides':
            filt+=f'<div class="filters" data-for="hubGrid" role="group" aria-label="Filter {word}"><button type="button" data-f="all" aria-pressed="true">All</button>'+''.join(f'<button type="button" data-f="{e(c)}" aria-pressed="false">{e(c)}</button>' for c in cats)+'</div>'
        filt+=f'<p class="hub-none" id="hubNone" hidden>No {word} match that search.</p>'
    extra=''
    if sec!='guides':
        extra='<section class="section"><div class="section-h"><h2>'+TE("pg.popular")+'</h2><a href="/guides">'+TE("pg.allguides")+'</a></div><div class="cards">'+''.join(card(p) for p in PAGES if p[0]=='guides')[:0]+''.join(card(p) for p in (find(x) for x in ['guides/how-to-choose-what-to-automate-first','guides/connect-your-business-apps','guides/privacy-act-2020-and-automation']) if p)+'</div></section>'
    else:
        extra='<section class="section"><div class="section-h"><h2>'+TE("pg.byind")+'</h2><a href="/industries">'+TE("pg.allind")+'</a></div><div class="cards">'+''.join(card(p) for p in PAGES if p[0]=='industries')+'</div></section>'
    main_grid=f'<section class="section">{filt}<div class="cards" id="hubGrid">{"".join(card(p) for p in items)}</div></section>'
    hero_cls='phero'
    if sec=='services':
        main_grid=services_feature(); hero_cls='phero phero--svc'
    out=head(h['title'],h['desc'],canon,ld)+header(sec)+f'''<main id="main">
<div class="wrap">{cr_html}</div>
<section class="{hero_cls}"><div class="wrap">
  <p class="eyebrow">{e(SECTION[sec][1])}</p>
  <h1>{e(h["h1"])}</h1>
  <p class="plead">{e(h["lead"])}</p>
  <div class="pmeta"><span>{len(items)} {(T('pg.post') if len(items)==1 else T('pg.posts')) if sec=='news' else _count_label(SECTION[sec][0].lower(),len(items))}</span><span>{TE("pg.nz")}</span><span>{TE("pg.free")}</span></div>
</div></section>
<div class="wrap">
  {main_grid}
  {extra}
  {cta()}
</div>
</main>
'''+footer()
    open(os.path.join(OUT,sec+'.html'),'w',encoding='utf8').write(out)

def build_404():
    ld={'@context':'https://schema.org','@type':'WebPage','name':'Page not found'}
    out=head('Page not found | Ambs Solutions','This page could not be found. Find our services, industries and guides here.','/404',ld).replace('index,follow,max-image-preview:large','noindex')+header('')+f'''<main id="main">
<section class="phero"><div class="wrap">
  <p class="eyebrow">{TE("nf.eyebrow")}</p>
  <h1>{TE("nf.h1")}</h1>
  <p class="plead">{TE("nf.lead")}</p>
  <div class="pmeta"><a class="btn btn--go" href="/">{TE("nf.home")}</a><a class="btn btn--ghost" href="/guides">{TE("nf.guides")}</a></div>
</div></section>
<div class="wrap"><section class="section"><div class="cards">{"".join(card(p) for p in (find(x) for x in ["services/ai-automation","services/websites-and-portals","industries/trades-and-building","guides/how-to-choose-what-to-automate-first"]) if p)}</div></section></div>
</main>
'''+footer()
    open(os.path.join(OUT,'404.html'),'w',encoding='utf8').write(out)

def build_booked():
    ld={'@context':'https://schema.org','@type':'WebPage','name':'Booking confirmed'}
    out=head('Booking confirmed | Ambs Solutions','Your Discovery Call with Ambs Solutions is booked.','/booking-confirmed',ld).replace('index,follow,max-image-preview:large','noindex')
    # Zoho Bookings redirects here inside the booking frame on the home page; take over the whole window
    out=out.replace('<head>','<head>\n<script>if(window.top!==window.self){try{window.top.location.replace(location.href)}catch(e){}}</script>',1)
    out+=header('')+f'''<main id="main">
<section class="phero"><div class="wrap">
  <p class="eyebrow">{TE("bk.eyebrow")}</p>
  <h1 id="bkH">{TE("bk.h1")}</h1>
  <div class="bk-card">
    <dl>
      <div><dt>{TE("bk.meeting")}</dt><dd id="bkSvc">{TE("bk.service")}</dd></div>
      <div id="bkDateRow" hidden><dt>{TE("bk.date")}</dt><dd id="bkDate"></dd></div>
      <div id="bkTimeRow" hidden><dt>{TE("bk.time")}</dt><dd id="bkTime"></dd></div>
      <div><dt>{TE("bk.length")}</dt><dd>{TE("bk.lengthv")}</dd></div>
      <div><dt>{TE("bk.with")}</dt><dd>{TE("bk.withv")}</dd></div>
    </dl>
  </div>
  <p class="plead" id="bkMail"><span id="bkMailTxt">{TE("bk.mail")}</span> {TE("bk.change")} <a href="tel:+64220999578">+64 22 099 9578</a>.</p>
  <div class="pmeta"><a class="btn btn--go" href="/">{TE("bk.back")}</a></div>
</div></section>
</main>
'''+'''<script>
(function(){try{
  var q=new URLSearchParams(location.search),g=function(k){return (q.get(k)||"").trim();};
  var set=function(id,v){var el=document.getElementById(id);if(el&&v)el.textContent=v;};
  var show=function(id){var el=document.getElementById(id);if(el)el.hidden=false;};
  var first=g("customer_first_name")||g("customer_name").split(" ")[0];
  if(first)set("bkH",__BKH__+", "+first);
  set("bkSvc",g("service_name"));
  var st=g("booking_start_time"),en=g("booking_end_time");
  if(st){var zoned=/(Z|[+-]\\d\\d:?\\d\\d)$/.test(st),d=new Date(st),e2=en?new Date(en):null;
    if(!isNaN(d)){
      var opt=zoned?{}:{timeZone:"UTC"};
      var day=d.toLocaleDateString("en-NZ",Object.assign({weekday:"long",day:"numeric",month:"long",year:"numeric"},opt));
      var tf=function(x){return x.toLocaleTimeString("en-NZ",Object.assign({hour:"numeric",minute:"2-digit"},opt));};
      var t=tf(d)+(e2&&!isNaN(e2)?" to "+tf(e2):"");
      if(zoned){try{var tz=d.toLocaleTimeString("en-NZ",{timeZoneName:"short"}).split(" ").pop();if(tz)t+=" "+tz;}catch(x){}}
      set("bkDate",day);show("bkDateRow");set("bkTime",t);show("bkTimeRow");}}
  var em=g("customer_email");
  if(em)set("bkMailTxt",__BKTO__+" "+em+".");
  /* the link carries the visitor's name and email; take them out of the address bar and history */
  if(location.search&&history.replaceState)history.replaceState(null,"",location.pathname);
}catch(e){}})();
</script>
'''.replace('__BKH__',json.dumps(T('bk.h1')).replace('</','<\\/')).replace('__BKTO__',json.dumps(T('bk.mailto')).replace('</','<\\/'))+footer()
    open(os.path.join(OUT,'booking-confirmed.html'),'w',encoding='utf8').write(out)

def build_legal(slug):
    raw=open(os.path.join(SRC,'content','legal',slug+'.html'),encoding='utf8').read()
    m=re.match(r'\s*<!--META\s*(\{.*?\})\s*-->\s*(.*)',raw,re.S); meta=json.loads(m.group(1)); body=m.group(2).strip()
    canon='/'+slug
    cr_html,cr_ld=crumbs([('Home','/'),(meta['h1'],None)])
    cr_ld['itemListElement'][-1]['item']=BASE+canon
    ld={'@context':'https://schema.org','@graph':[cr_ld,{'@type':'WebPage','name':meta['h1'],'url':BASE+canon,'inLanguage':'en-NZ','publisher':{'@id':BASE+'/#business'}},ORG]}
    out=head(meta['title'],meta['description'],canon,ld)+header('')+f'''<main id="main">
<div class="wrap">{cr_html}</div>
<section class="phero"><div class="wrap">
  <p class="eyebrow">Ambs Solutions</p>
  <h1>{e(meta["h1"])}</h1>
  <div class="pmeta"><span>{TE("pg.legalwhere")}</span><span>{TE("pg.lastupdated")} {e(meta["updated"])}</span></div>
</div></section>
<div class="wrap layout">
  <article class="prose legal">
{body}
  </article>
  <aside class="toc" aria-label="On this page"><div class="toc-box"><b>{TE("pg.onpage")}</b><ol id="tocList"></ol></div></aside>
</div>
</main>
'''+footer()
    open(os.path.join(OUT,slug+'.html'),'w',encoding='utf8').write(out)

def build_custom(slug,d,blocks_html):
    canon='/'+slug
    cr_html,cr_ld=crumbs([('Home','/'),(d.get('h1',slug),None)])
    cr_ld['itemListElement'][-1]['item']=BASE+canon
    ld={'@context':'https://schema.org','@graph':[cr_ld,{'@type':'WebPage','name':d.get('h1',slug),'url':BASE+canon,'inLanguage':'en-NZ','publisher':{'@id':BASE+'/#business'}},ORG]}
    eb=f'<p class="eyebrow">{e(d["eyebrow"])}</p>' if d.get('eyebrow') else ''
    lead=f'<p class="plead">{e(d["lead"])}</p>' if d.get('lead') else ''
    out=head(d.get('title') or d.get('h1',slug)+' | Ambs Solutions',d.get('description',''),canon,ld,blocks=True)+header(slug)+f'''<main id="main">
<div class="wrap">{cr_html}</div>
<section class="phero"><div class="wrap">
  {eb}
  <h1>{e(d.get("h1",slug))}</h1>
  {lead}
</div></section>
<div class="wrap edpage"><div class="blk-flow">
{blocks_html}
</div></div>
{'<div class="wrap">'+cta()+'</div>' if d.get('cta',True) else ''}
</main>
'''+footer()
    if 'data-blk-form' in blocks_html: out=out.replace('</body>',FORMS_JS+'\n</body>',1)
    open(os.path.join(OUT,slug+'.html'),'w',encoding='utf8').write(out)

def render_blocks(pages,sections):
    """Blocks are drawn by site-src/assets/blocks.mjs (the same code the editor's preview uses), through node."""
    if not pages and not sections: return {'pages':{},'sections':{},'strings':{}}
    import subprocess
    r=subprocess.run(['node',os.path.join(SRC,'blocks-cli.mjs')],input=json.dumps({'pages':pages,'sections':sections}),capture_output=True,text=True,check=True)
    return json.loads(r.stdout)

def build_sitemap():
    rows=[('/', '1.0','weekly')]+[(url(s),'0.8','weekly') for s in ('services','industries','guides')]+[(url(p[0],p[1]),'0.7' if p[0]!='guides' else '0.6','monthly') for p in PAGES]+[('/'+s_,'0.6','weekly') for s_ in ('news','locations') if any(p[0]==s_ for p in PAGES)]+[('/'+s_,'0.5','monthly') for s_ in CUSTOM]+[('/privacy','0.3','yearly'),('/terms','0.3','yearly')]
    x='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url>\n    <loc>{BASE}{u if u!="/" else "/"}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>{f}</changefreq>\n    <priority>{pr}</priority>\n  </url>\n' for u,pr,f in rows)+'</urlset>\n'
    open(os.path.join(OUT,'sitemap.xml'),'w').write(x)

def build_llms():
    """llms.txt: a plain guide to the site for AI assistants (PageSpeed's "Agentic browsing" check). Made from the site's own content on every build, so editor changes keep it current."""
    biz=json.load(open(os.path.join(SRC,'content','site.json'),encoding='utf8'))
    ih=open(os.path.join(OUT,'index.html'),encoding='utf8').read()
    md=re.search(r'<meta name="description" content="([^"]*)"',ih)
    def unesc(t): return html.unescape(t) if t else ''
    L=['# Ambs Solutions','',f'> {unesc(md.group(1)) if md else HUB["services"]["desc"]}','']
    L.append(' · '.join(x for x in (biz.get('location',''),f"Phone {biz['phone']}" if biz.get('phone') else '',f"Email {biz['email']}" if biz.get('email') else '') if x)+'.')
    L+=['',f'- [Home]({BASE}/): what we do, how it works, common questions and the hours calculator',f'- [Book a free session]({BASE}/#book)']
    for sec in ('services','industries','guides','news','locations'):
        items=[p for p in PAGES if p[0]==sec]
        if not items: continue
        hub=HUB.get(sec,{})
        L+=['',f'## {SECTION[sec][0]}','']
        if hub.get('desc'): L.append(f'- [{SECTION[sec][0]}]({BASE}{url(sec)}): {hub["desc"]}')
        L+=[f'- [{t}]({BASE}{url(sc,sl)}): {b}' for sc,sl,t,b,*_ in items]
    L+=['','## Optional','',f'- [Privacy policy]({BASE}/privacy)',f'- [Terms]({BASE}/terms)',f'- [Sitemap]({BASE}/sitemap.xml)','']
    open(os.path.join(OUT,'llms.txt'),'w',encoding='utf8').write('\n'.join(L))

MENU_INDENT={'main':'      ','drawer':'    ','company':'        ','explore':'        '}
def home_menus(h):
    """Menu and footer links on the homepage, between <!--ed:menu:NAME--> markers."""
    for name,ind in MENU_INDENT.items():
        if name not in MENUS: continue
        body=''.join(f'{ind}<a href="{e(it["href"])}" data-i18n="{menu_key(it)}">{e(menu_label(it))}</a>\n' for it in MENUS[name])
        h=re.sub(r'(<!--ed:menu:'+name+r'-->\n)[\s\S]*?([ \t]*<!--/ed:menu:'+name+r'-->)',lambda m:m.group(1)+body+m.group(2),h)
    return h

SEC_RE=re.compile(r'([\s\S]*?)(  <section\b[^>]*>[\s\S]*?\n  </section>\n)')
def home_sections(h,custom_html):
    """Homepage sections after the hero: put in the saved order, hidden ones kept but not shown, block sections added."""
    a=h.index('<!-- WHAT WE AUTOMATE: moving strip -->'); a=h.rindex('\n',0,a)+1
    z=h.index('</main>')
    mid=h[a:z]
    mid=re.sub(r'  <!--ed:sec:[^>]*-->[\s\S]*?<!--/ed:sec:[^>]*-->\n','',mid)
    units=[];pos=0
    for m in SEC_RE.finditer(mid):
        tag=re.match(r'  <section\b([^>]*)>',m.group(2)).group(1)
        sid=(re.search(r'\sid="([^"]+)"',tag) or re.search(r'class="([^" ]+)',tag)).group(1)
        units.append([sid,m.group(1)+m.group(2)]);pos=m.end()
    tail=mid[pos:]
    order=[x for x in HOMESEC.get('order',[]) if x in custom_html or any(u[0]==x for u in units)]
    order+= [u[0] for u in units if u[0] not in order]+[c for c in custom_html if c not in order]
    hidden=set(HOMESEC.get('hidden',[]))
    out=''
    for sid in order:
        u=next((u for u in units if u[0]==sid),None)
        if u:
            t=re.sub(r' data-ed-hidden hidden','',u[1])
            if sid in hidden: t=re.sub(r'(?m)^(  <(?:section\b|div class="auto-strip")[^>]*?)>',r'\1 data-ed-hidden hidden>',t)
            out+=t
        elif sid in custom_html and sid not in hidden:
            out+=f'  <!--ed:sec:{sid}-->\n  {custom_html[sid]}\n  <!--/ed:sec:{sid}-->\n'
    return h[:a]+out+tail+h[z:]

def sync_ed_strings(strings):
    """Wording added in the editor (keys starting "ed."): changed English clears that line's translations and queues it for Claude."""
    i18n_dir=os.path.join(SRC,'assets','i18n')
    langs=sorted(f[:-5] for f in os.listdir(i18n_dir) if f.endswith('.json'))
    stf=os.path.join(SRC,'content','translation-status.json')
    st=json.load(open(stf,encoding='utf8')) if os.path.exists(stf) else {}
    tr={l:json.load(open(os.path.join(i18n_dir,l+'.json'),encoding='utf8')) for l in langs}
    changed=False
    for k,v in strings.items():
        if st.get(k,{}).get('_en')!=v:
            st[k]=dict({l:'needs' for l in langs},_en=v); changed=True
            for l in langs: tr[l].pop(k,None)
    for k in [k for k in st if k.startswith('ed.') and k not in strings]:
        st.pop(k); changed=True
        for l in langs: tr[l].pop(k,None)
    open(os.path.join(SRC,'content','ed-strings.json'),'w',encoding='utf8').write(json.dumps(strings,ensure_ascii=False,indent=1,sort_keys=True)+'\n')
    if changed:
        open(stf,'w',encoding='utf8').write(json.dumps(st,ensure_ascii=False,indent=1)+'\n')
        for l in langs: open(os.path.join(i18n_dir,l+'.json'),'w',encoding='utf8').write(json.dumps(tr[l],ensure_ascii=False,separators=(',',':')))

def stamp_home(custom_html=None,strings=None):
    """The home page keeps its styles, scripts and extra languages in site-src/assets (home.css, home.js, i18n/*.json).
       Copy them to the site and stamp index.html with content hashes so browsers and the offline worker fetch new copies after a change."""
    names=['home.css','home.js']
    i18n_dir=os.path.join(SRC,'assets','i18n')
    custom_html=custom_html or {}
    menu_strings={menu_key(it):it.get('label','') for n in MENU_INDENT for it in MENUS.get(n,[]) if menu_key(it).startswith('ed.')}
    if os.path.isdir(i18n_dir): sync_ed_strings(dict(menu_strings,**(strings or {})))
    langs=sorted(f for f in os.listdir(i18n_dir) if f.endswith('.json')) if os.path.isdir(i18n_dir) else []
    for f in names: open(os.path.join(OUT,'assets',f),'w',encoding='utf8').write(open(os.path.join(SRC,'assets',f),encoding='utf8').read())
    if langs:
        os.makedirs(os.path.join(OUT,'assets','i18n'),exist_ok=True)
        for f in langs: open(os.path.join(OUT,'assets','i18n',f),'w',encoding='utf8').write(open(os.path.join(i18n_dir,f),encoding='utf8').read())
    idx=os.path.join(OUT,'index.html')
    if not os.path.exists(idx): return
    h=open(idx,encoding='utf8').read()
    h=home_menus(h)
    if HOMESEC.get('order') or HOMESEC.get('hidden') or custom_html or '<!--ed:sec:' in h: h=home_sections(h,custom_html)
    # the block styles are only loaded when the homepage has a section made of blocks
    h=re.sub(r'\n<link rel="stylesheet" href="/assets/blocks\.css\?v=[A-Za-z0-9]+">','',h)
    if custom_html: h=re.sub(r'(<link rel="stylesheet" href="/assets/home\.css\?v=[A-Za-z0-9]+">)',lambda m:m.group(1)+'\n<link rel="stylesheet" href="/assets/blocks.css?v='+BLV+'">',h)
    # contact forms in homepage sections need their script
    h=re.sub(r'<script src="/assets/forms\.js\?v=[A-Za-z0-9]+" defer></script>\n','',h)
    if any('data-blk-form' in x for x in custom_html.values()): h=h.replace('</body>',FORMS_JS+'\n</body>',1)
    h=re.sub(r'home\.css\?v=[A-Za-z0-9]+','home.css?v='+_v('home.css'),h)
    h=re.sub(r'home\.js\?v=[A-Za-z0-9]+','home.js?v='+_v('home.js'),h)
    if langs:
        lv=hashlib.md5(b''.join(open(os.path.join(i18n_dir,f),'rb').read() for f in langs)).hexdigest()[:8]
        h=re.sub(r'data-i18nv="[A-Za-z0-9]*"','data-i18nv="'+lv+'"',h)
    open(idx,'w',encoding='utf8').write(h)


# ---- website chat bot ----------------------------------------------------------------------------------------------
# A free, no-AI helper: the build collects the site's own wording (homepage, every live page and post, their questions,
# business details and the questions and answers in site-src/content/chatbot.json, edited in the website editor) into
# assets/chat-index.json, and assets/chat.js finds the best answer in the visitor's browser.
CHAT=_load('chatbot.json',{})
def _txt(h): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',h))).strip()
# page text for the chat: headings, list items and paragraphs end as sentences, so answers can be picked sentence by sentence
def _txts(h):
    parts=[_txt(x) for x in re.split(r'</(?:h[1-6]|li|p|td|dt|dd|blockquote)>|<br\s*/?>',h)]
    return ' '.join(x if re.search(r'[.!?:;。।]$',x) else x+'.' for x in parts if x)
def _block_text(x,out):
    if isinstance(x,dict):
        for k,v in x.items():
            if k in ('id','type','href','url','src','img','photo','image','icon','style','layout','align','kind','name') : continue
            _block_text(v,out)
    elif isinstance(x,list):
        for v in x: _block_text(v,out)
    elif isinstance(x,str):
        t=_txt(x)
        if len(t)>2 and not re.match(r'^(https?:|/|#|mailto:|tel:)',t): out.append(t)
def chat_strings():
    """The chat helper's own wording as translation keys ("ed.chat.*"): when the owner changes the English in the editor,
       that line's other languages are cleared and queued for Claude, like the rest of the editor's wording."""
    c=CHAT;out={}
    for k in ('greeting','not_found'):
        if c.get(k): out['ed.chat.'+k]=c[k]
    if (c.get('nudge') or {}).get('text'): out['ed.chat.nudge']=c['nudge']['text']
    for i,q in enumerate(c.get('suggestions',[])):
        if q: out[f'ed.chat.sugg.{i}']=q
    for k,v in (c.get('chat') or {}).items():
        if v: out['ed.chat.talk.'+k]=v
    for k,v in (c.get('labels') or {}).items():
        if v and k!='in_english': out['ed.chat.label.'+k]=v
    for it in c.get('qa',[]):
        if not (it.get('id') and it.get('q') and it.get('a')): continue
        for f,src in (('q','q'),('a','a'),('also','also'),('ll','link_label')):
            if it.get(src): out[f'ed.chat.qa.{it["id"]}.{f}']=it[src]
    return out
def _tr_files():
    d=os.path.join(SRC,'assets','i18n')
    return {f[:-5]:json.load(open(os.path.join(d,f),encoding='utf8')) for f in sorted(os.listdir(d)) if f.endswith('.json')} if os.path.isdir(d) else {}
def build_chat_index():
    site=_load('site.json',{})
    TRL=_tr_files()
    docs=[]
    # i: the same answer in every language shares an id, so a question matched in English can be answered in the visitor's language
    def add(kind,title,text,u,q='',extra='',lang='',i=''):
        text=_txt(text);title=_txt(title)
        if text or q: docs.append({k:v for k,v in dict(k=kind,t=title,q=_txt(q),a=text,u=u,x=extra,g=lang,i=i).items() if v})
    # the owner's own answers, in English and in every language they have been translated into
    for it in CHAT.get('qa',[]):
        if not (it.get('q') and it.get('a')): continue
        docs.append({k:v for k,v in dict(k='qa',t=it['q'],q=it['q'],a=it['a'],u=it.get('link',''),l=it.get('link_label',''),x=it.get('also',''),i='qa.'+str(it.get('id',''))).items() if v})
        for lang,tr in TRL.items():
            key=f'ed.chat.qa.{it.get("id")}.'
            if tr.get(key+'q') and tr.get(key+'a'):
                docs.append({k:v for k,v in dict(k='qa',t=tr[key+'q'],q=tr[key+'q'],a=tr[key+'a'],u=it.get('link',''),l=tr.get(key+'ll') or it.get('link_label',''),x=tr.get(key+'also',''),g=lang,i='qa.'+str(it.get('id',''))).items() if v})
    # the homepage, in English and in each translated language
    def home(g,lang):
        A=lambda *a,**k:add(*a,lang=lang,**k)
        A('page',g('hero.h1'),g('hero.sub')+' '+g('hero.note'),'/',i='hero')
        for i in range(1,30):
            q,a=g(f'faq.q{i}'),g(f'faq.a{i}')
            if q and a: A('faq',q,a,'/#faq',q,i=f'faq{i}')
        for i in range(1,30):
            t,d=g(f'auto.c{i}t'),g(f'auto.c{i}d')
            if not t: continue
            pts=' '.join(x if re.search(r'[.!?。।]$',x) else x+'.' for x in (g(f'auto.c{i}p{j}') for j in range(1,8)) if x)
            A('home',t,d+' '+pts,'/services/websites-and-portals' if i>=7 else '/services/ai-automation','',g('auto.title'),i=f'auto{i}')
        steps=' '.join(f"{g(f'how.s{i}t')}: {g(f'how.s{i}d')}" for i in range(1,12) if g(f'how.s{i}t'))
        if steps: A('home',g('how.title'),steps,'/#how','','process steps how it works what happens next' if lang=='' else '',i='how')
        why=' '.join(g(f'why.n{i}')+'.' for i in range(1,12) if g(f'why.n{i}'))
        if why: A('home',g('why.t'),why,'/#why','','why choose you different' if lang=='' else '',i='why')
        about=' '.join(g(k) for k in EN if k.startswith('about.') and k!='about.title' and g(k))
        if about: A('home',g('about.title'),about,'/#about','','about who are you company team' if lang=='' else '',i='about')
        for i in range(1,12):
            t,d=g(f'trust.u{i}t'),g(f'trust.u{i}d')
            if t: A('home',t,d,'/#how',i=f'trust{i}')
        if g('trust.title'): A('home',g('trust.title'),g('trust.lead'),'/','','tools software apps' if lang=='' else '',i='tools')
        for b in ('cafe','trades','clinic','retail','adviser','transport','other'):
            tasks=[g(f't.{b}{j}') for j in range(1,8) if g(f't.{b}{j}')]
            if g('biz.'+b) and tasks:
                ind={'cafe':'cafes-and-takeaways','trades':'trades-and-building','clinic':'clinics-and-salons','retail':'shops-and-dairies','adviser':'advisers-and-accountants','transport':'transport-and-delivery'}.get(b)
                A('home',g('biz.'+b)+': '+g('card.handled'),'. '.join(tasks)+'.','/industries/'+ind if ind else '/#automate',i='biz.'+b)
        for k,v in HOMESEC.get('custom',{}).items():
            out=[];_block_text(v.get('blocks',[]),out)
            if lang=='': A('home',v.get('title') or v.get('name') or 'Ambs Solutions',' '.join(out),'/#'+k)
    home(lambda k:EN.get(k,''),'')
    for lang,tr in TRL.items(): home(lambda k,tr=tr:tr.get(k,''),lang)
    # every live page and post (written in English)
    for p in PAGES:
        f=os.path.join(SRC,'content',p[0],p[1]+'.html')
        if not os.path.exists(f): continue
        raw=open(f,encoding='utf8').read();m=re.match(r'\s*<!--META\s*(\{.*?\})\s*-->\s*(.*)',raw,re.S)
        if not m: continue
        meta=json.loads(m.group(1));body=m.group(2);u=url(p[0],p[1]);h1=meta.get('h1',p[2])
        add('page',h1,meta.get('lead','')+' '+' '.join(meta.get('takeaways',[])),u,'',p[2]+' '+p[4]+' '+p[3])
        for q,a in meta.get('faq',[]): add('faq',q,a,u,q,h1)
        for part in re.split(r'(?=<h2[\s>])',body):
            hm=re.match(r'<h2[^>]*>(.*?)</h2>',part,re.S)
            if hm: add('sec',h1+': '+_txt(hm.group(1)),_txts(part[hm.end():]),u,'',p[2])
    for slug in ('privacy','terms'):
        f=os.path.join(SRC,'content','legal',slug+'.html')
        if not os.path.exists(f): continue
        raw=open(f,encoding='utf8').read();m=re.match(r'\s*<!--META\s*(\{.*?\})\s*-->\s*(.*)',raw,re.S)
        meta=json.loads(m.group(1))
        for part in re.split(r'(?=<h2[\s>])',m.group(2)):
            hm=re.match(r'<h2[^>]*>(.*?)</h2>',part,re.S)
            add('sec',meta['h1']+(': '+_txt(hm.group(1)) if hm else ''),_txts(part[hm.end():] if hm else part),'/'+slug,'',slug)
    for slug,d in CUSTOM.items():
        out=[];_block_text(d.get('blocks',[]),out)
        add('page',d.get('title',slug),' '.join(out),'/'+slug)
    for sec in ('services','industries','guides','news','locations'):
        if sec in HUB and any(p[0]==sec for p in PAGES): add('page',HUB[sec].get('h1',sec),HUB[sec].get('lead',''),url(sec),'',sec)
    bot={k:v for k,v in CHAT.items() if k!='qa'}
    # the questions visitors type are kept in the AMBS Supabase project (table chat_questions) for /admin -> Chat helper -> Questions visitors asked
    bot.pop('log',None)
    if CHAT.get('log',True)!=False:
        bot['log']={'u':'https://onunconxcvkwowtgalxn.supabase.co/rest/v1/rpc/chat_log','k':'sb_publishable_xahs0OqyRaBptSTSvR3Vgg_ZtvsFX2U'}
    # the chat's wording in each language (only lines that have been translated)
    bot_tr={}
    for lang,tr in TRL.items():
        g=lambda k:tr.get('ed.chat.'+k,'')
        t={k:g(k) for k in ('greeting','not_found','nudge') if g(k)}
        sg=[g(f'sugg.{i}') or q for i,q in enumerate(CHAT.get('suggestions',[]))]
        if any(g(f'sugg.{i}') for i in range(len(sg))): t['suggestions']=sg
        ch={k:g('talk.'+k) for k in (CHAT.get('chat') or {}) if g('talk.'+k)}
        if ch: t['chat']=ch
        lb={k:g('label.'+k) for k in (CHAT.get('labels') or {}) if g('label.'+k)}
        if lb: t['labels']=lb
        if t: bot_tr[lang]=t
    # "how good are you?": the chat builds its reply from the homepage's Why us list and promises, in each language
    def why_for(g):
        return {'why':[g(f'why.n{i}') for i in range(1,12) if g(f'why.n{i}')],'trust':[[g(f'trust.u{i}t'),g(f'trust.u{i}d')] for i in range(1,12) if g(f'trust.u{i}t')]}
    why={'en':why_for(lambda k:EN.get(k,''))}
    for lang,tr in TRL.items():
        w=why_for(lambda k,tr=tr:tr.get(k,''))
        if w['why']: why[lang]=w
    data={'why':why,'src':hashlib.md5(open(os.path.join(SRC,'assets','home.js'),'rb').read()).hexdigest()[:8],'bot':bot,'bot_tr':bot_tr,'biz':{'phone':site.get('phone',''),'email':site.get('email',''),'location':site.get('location',''),'book':'/#book'},'docs':docs}
    js=json.dumps(data,ensure_ascii=False,separators=(',',':'))
    open(os.path.join(OUT,'assets','chat-index.json'),'w',encoding='utf8').write(js)
    return hashlib.md5(js.encode()).hexdigest()[:8],len(docs)
def chat_tag(iv):
    if not CHAT.get('enabled',True): return ''
    lab=(CHAT.get('labels') or {}).get('launcher','Ask us')
    nu=CHAT.get('nudge') or {}
    ntr={l:t['ed.chat.nudge'] for l,t in _tr_files().items() if t.get('ed.chat.nudge')}
    # the chat script is fetched only once the page has loaded, so it never competes with the first screen (Google's speed test counts everything fetched before it)
    at={'src':f'/assets/chat.js?v={_v("chat.js")}','data-index':f'/assets/chat-index.json?v={iv}','data-label':lab}
    if nu.get('enabled',True) and nu.get('text'):
        at.update({'data-nudge':nu.get('text',''),'data-nudge-after':str(int(nu.get('delay',15) or 15))})
        if nu.get('open',True): at['data-nudge-open']='1'
        if ntr: at['data-nudge-tr']=json.dumps(ntr,ensure_ascii=False)
    js=json.dumps(at,ensure_ascii=False).replace('</','<\\/')
    return '<!--chat--><script>(function(a){function go(){var s=document.createElement("script");for(var k in a)s.setAttribute(k,a[k]);document.body.appendChild(s)}if(document.readyState==="complete")go();else addEventListener("load",go)})('+js+')</script><!--/chat-->'
def stamp_chat(path,tag):
    if not os.path.exists(path): return
    h=open(path,encoding='utf8').read();h=re.sub(r'<!--chat-->.*?<!--/chat-->\n?','',h,flags=re.S)
    if tag: h=h.replace('</body>',tag+'\n</body>',1)
    open(path,'w',encoding='utf8').write(h)

# Legal pages keep their own "Last updated" date: when a page's wording changes (in the editor or by hand),
# the next build sets the date to that day (New Zealand time). The wording's fingerprint is kept in legal-state.json.
LEGAL_STATE=os.path.join(SRC,'content','legal-state.json')
def legal_dates():
    try: st=json.load(open(LEGAL_STATE,encoding='utf8'))
    except Exception: st={}
    old=dict(st)
    for slug in ('privacy','terms'):
        f=os.path.join(SRC,'content','legal',slug+'.html')
        if not os.path.exists(f): continue
        raw=open(f,encoding='utf8').read();m=re.match(r'\s*<!--META\s*(\{.*?\})\s*-->\s*(.*)',raw,re.S)
        meta=json.loads(m.group(1));fp=hashlib.sha1(re.sub(r'\s+',' ',m.group(2)).strip().encode()).hexdigest()
        if slug in st and st[slug]!=fp:
            d=datetime.date.fromisoformat(NOW[:10]).strftime('%-d %B %Y')
            if meta.get('updated')!=d:
                meta['updated']=d
                open(f,'w',encoding='utf8').write('<!--META '+json.dumps(meta,ensure_ascii=False)+'-->\n'+m.group(2))
                print(f'{slug}: wording changed, "Last updated" set to {d}')
        st[slug]=fp
    if st!=old: open(LEGAL_STATE,'w',encoding='utf8').write(json.dumps(st,indent=1)+'\n')

# Privacy check: every outside service a visitor's details or visit reach must be named in the privacy policy.
# The build finds the services the public pages load or send to and lists any the policy doesn't mention in
# privacy-check.json (shown in the editor on the Privacy Policy page and by pending_translations.py at the start of a chat).
# A service new to this list shows as its web address; add it here with the words the policy should use.
PRIVACY_SERVICES=[  # (part of the web address, name, words the policy must contain (any one))
    ('googletagmanager.com','Google Analytics',['Google Analytics']),
    ('google-analytics.com','Google Analytics',['Google Analytics']),
    ('fonts.googleapis.com','Google Fonts',['Google Fonts']),('fonts.gstatic.com','Google Fonts',['Google Fonts']),
    ('web3forms.com','Web3Forms (contact forms)',['Web3Forms']),
    ('portal.ambs.co.nz','your client system (enquiries saved as Leads)',['client system']),
    ('supabase.co','the chat question log',['Chat helper']),
    ('open-meteo.com','the weather lookup (open-meteo)',['open-meteo']),
    ('zohobookings.com','Zoho Bookings (the booking calendar)',['Zoho']),
    ('youtube','YouTube (videos on a page)',['YouTube']),('vimeo.com','Vimeo (videos on a page)',['Vimeo']),
]
PRIVACY_IGNORE=('ambs.co.nz','www.w3.org','schema.org')
PRIVACY_CHECK=os.path.join(SRC,'content','privacy-check.json')
def privacy_check():
    hosts={}
    def add(h,where):
        h=h.lower()
        if h=='ambs.co.nz' or h.endswith('.ambs.co.nz') and h!='portal.ambs.co.nz' or h in PRIVACY_IGNORE: return
        hosts.setdefault(h,where)
    for root,dirs,files in os.walk(OUT):
        dirs[:]=[d for d in dirs if d not in ('node_modules','site-src','api','assets','.git','.github','invoice')]
        for f in files:
            if not f.endswith('.html') or f in ('admin.html','email-signature.html') or f.startswith('zz'): continue
            s=open(os.path.join(root,f),encoding='utf8',errors='ignore').read();w=os.path.relpath(os.path.join(root,f),OUT)
            for m in re.finditer(r'<(?:script|iframe|link|img|source|video|audio|embed|form)\b[^>]*?(?:src|href|action)="https?://([^"/:]+)',s): add(m.group(1),w)
            for m in re.finditer(r'<script\b([^>]*)>(.*?)</script>',s,re.S):
                if 'ld+json' in m.group(1): continue  # Google's page data (social profile links), not something the page loads
                for h in re.findall(r'https?://([a-z0-9.-]+\.[a-z]{2,})',m.group(2)): add(h,w)
    # the scripts every public page runs, and what the server asks on a visitor's behalf
    for f in ('assets/home.js','assets/chat.js','assets/forms.js','assets/pages.js','assets/chat-index.json','api/weather.js'):
        fp=os.path.join(OUT,f)
        if os.path.exists(fp):
            for h in re.findall(r'https?://([a-z0-9.-]+\.[a-z]{2,})',open(fp,encoding='utf8',errors='ignore').read()): add(h,f)
    raw=open(os.path.join(SRC,'content','legal','privacy.html'),encoding='utf8').read().lower()
    missing=[]
    for h in sorted(hosts):
        known=[x for x in PRIVACY_SERVICES if x[0] in h]
        if known:
            if not any(k.lower() in raw for k in known[0][2]) and known[0][1] not in [x['name'] for x in missing]:
                missing.append({'name':known[0][1],'host':h,'where':hosts[h]})
        else: missing.append({'name':h,'host':h,'where':hosts[h],'unknown':True})
    out=json.dumps({'missing':missing},ensure_ascii=False,indent=1)+'\n'
    try: old=open(PRIVACY_CHECK,encoding='utf8').read()
    except Exception: old=''
    if out!=old: open(PRIVACY_CHECK,'w',encoding='utf8').write(out)
    for x in missing: print('PRIVACY POLICY doesn\'t mention:',x['name'],'('+x['host']+', used on '+x['where']+')')


if __name__=='__main__':
    legal_dates()
    os.makedirs(os.path.join(OUT,'assets'),exist_ok=True)
    for f in ('pages.css','pages.js','blocks.css','blocks.mjs','forms.js'): open(os.path.join(OUT,'assets',f),'w',encoding='utf8').write(open(os.path.join(SRC,'assets',f),encoding='utf8').read())
    secs={k:v for k,v in HOMESEC.get('custom',{}).items()}
    rb=render_blocks({k:v.get('blocks',[]) for k,v in CUSTOM.items()},secs)
    stamp_home(rb['sections'],dict(rb['strings'],**chat_strings()))
    only=sys.argv[1:]
    total=0
    for p in PAGES:
        path=os.path.join(SRC,'content',p[0],p[1]+'.html')
        if os.path.exists(path) and (not only or p[0]+'/'+p[1] in only):
            w=build_page(p); total+=w; print(f'{p[0]}/{p[1]}: {w} words')
        elif not os.path.exists(path): print(f'MISSING {p[0]}/{p[1]}')
    for s in ('services','industries','guides')+tuple(s_ for s_ in ('news','locations') if any(p[0]==s_ for p in PAGES)): build_hub(s)
    for slug,d in CUSTOM.items(): build_custom(slug,d,rb['pages'].get(slug,''))
    build_404(); build_booked(); build_legal('privacy'); build_legal('terms'); build_sitemap(); build_llms()
    for f in ('index.html','email-signature.html'): stamp_ga(os.path.join(OUT,f))
    _ip=os.path.join(OUT,'index.html');_ih=open(_ip,encoding='utf8').read()
    _ih2=re.sub(r'<!--fonts-->.*?<!--/fonts-->',lambda m:FONT_HEAD,_ih,flags=re.S)
    if _ih2!=_ih: open(_ip,'w',encoding='utf8').write(_ih2)
    # the homepage's business details for Google list the same social profiles
    idx=os.path.join(OUT,'index.html')
    if os.path.exists(idx):
        h=open(idx,encoding='utf8').read();h2=re.sub(r'"sameAs": \[[^\]]*\]','"sameAs": '+json.dumps(PROFILES),h,count=1)
        h2=re.sub(r'<!--soc-->.*?<!--/soc-->','<!--soc-->'+social_html()+'<!--/soc-->',h2,count=1,flags=re.S)
        if h2!=h: open(idx,'w',encoding='utf8').write(h2)
    open(os.path.join(OUT,'assets','chat.js'),'w',encoding='utf8').write(open(os.path.join(SRC,'assets','chat.js'),encoding='utf8').read())
    iv,nd=build_chat_index();tag=chat_tag(iv)
    # the chat helper goes on every public page (not the editor or the email signature builder)
    for root,dirs,files in os.walk(OUT):
        dirs[:]=[d for d in dirs if d not in ('node_modules','site-src','api','assets','.git','.github','invoice')]
        for f in files:
            if f.endswith('.html') and f not in ('admin.html','email-signature.html'): stamp_chat(os.path.join(root,f),tag)
    print('chat helper:',nd,'answers indexed')
    privacy_check()
    print('done, total words',total)
