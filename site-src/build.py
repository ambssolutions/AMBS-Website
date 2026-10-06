#!/usr/bin/env python3
"""Builds the AMBS sub-pages from content fragments.
   content/<section>/<slug>.html = <!--META {json} --> + article body.  Output goes to ../site/."""
import json, os, re, html, sys, datetime
SRC=os.path.dirname(os.path.abspath(__file__))
# Output goes to the website root: the folder above site-src when it holds the site (this repository), otherwise ../site
_up=os.path.dirname(SRC)
OUT=os.environ.get('AMBS_OUT') or (_up if os.path.exists(os.path.join(_up,'index.html')) else os.path.join(_up,'site'))
GUIDE_ART=json.load(open(os.path.join(SRC,'guide_art.json'),encoding='utf8'))
BASE='https://ambs.co.nz'; TODAY='2026-10-04'

ICON={
 'auto':'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
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
# section, slug, card title, card blurb, category, icon
PAGES=[
 ('services','ai-automation','AI automation','Quotes, replies, bookings, data and reporting that run themselves, built around the tools you already use.','Services','auto'),
 ('services','websites-and-portals','Websites, portals and dashboards','Fast multilingual websites, staff and customer portals, and live dashboards you own.','Services','web'),
 ('industries','cafes-and-takeaways','Cafés and takeaways','Rosters, supplier orders and review replies, handled.','Hospitality','cafe'),
 ('industries','trades-and-building','Trades and building','Quotes from site notes, invoices into your accounts, late payments chased.','Trades','trades'),
 ('industries','clinics-and-salons','Clinics and salons','Reminders and rebooking, client forms and missed-call follow-ups.','Health and beauty','clinic'),
 ('industries','shops-and-dairies','Shops and dairies','Stock counts, price updates and a daily sales summary.','Retail','retail'),
 ('industries','advisers-and-accountants','Advisers and accountants','Document chasing, file notes from calls and compliance records.','Professional services','adviser'),
 ('industries','transport-and-delivery','Transport and delivery','Run sheets, proof of delivery and fuel and mileage logs.','Transport','transport'),
 ('guides','how-to-choose-what-to-automate-first','How to choose what to automate first','A simple way to find the task likely to give you the most hours back.','Getting started','target'),
 ('guides','automate-quotes-and-invoices','Automate quotes and invoices','From site notes to a priced quote, and from an approved job to an invoice in your accounts.','Automation','invoice'),
 ('guides','reduce-no-shows-with-booking-reminders','Reduce no-shows with booking reminders','Confirmations, reminders and rebooking messages that run without anyone chasing.','Automation','cal'),
 ('guides','ai-customer-replies-for-small-business','AI customer replies for small business','Answer the same questions quickly, in your customer\'s language, while a person handles the rest.','Automation','chat'),
 ('guides','connect-your-business-apps','Connect your business apps','Stop retyping the same job into three systems. How app connections work and where to start.','Automation','link'),
 ('guides','weekly-business-numbers-dashboard','Your business numbers, every week','What to track, where the numbers come from, and how to get them on your phone every Monday.','Digital tools','chart'),
 ('guides','privacy-act-2020-and-automation','The Privacy Act 2020 and automation','What New Zealand businesses should check before automating anything that touches personal information.','Compliance','shield'),
 ('guides','websites-that-turn-visitors-into-calls','Websites that turn visitors into calls','What makes a small-business website earn enquiries, from speed to languages to the contact form.','Digital tools','web'),
 ('guides','automation-glossary','Automation glossary','Plain-English meanings of the automation and AI terms you will hear.','Getting started','book'),
]
SECTION={'services':('Services','What we build'),'industries':('Industries','Who we help'),'guides':('Guides','Knowledge hub')}
HUB={
 'services':dict(title='Services: AI automation and digital solutions in New Zealand | Ambs Solutions',h1='Automation and digital tools, built around your business',
   lead='Two ways we help New Zealand businesses: automations that clear the repetitive work, and digital tools that make the business easier to run and easier to find.',
   desc='AI automation, websites, staff and customer portals and live dashboards for New Zealand small businesses. Built around the tools you already use.'),
 'industries':dict(title='Industries we help with automation in New Zealand | Ambs Solutions',h1='Automation for the way your industry actually works',
   lead='Every industry has its own repetitive work. Pick yours to see the tasks we usually take off first, the tools we connect, and typical estimates of the time involved.',
   desc='Automation for New Zealand cafés, trades, clinics and salons, shops and dairies, advisers and accountants, and transport and delivery businesses.'),
 'guides':dict(title='Guides: automation and digital tools for NZ businesses | Ambs Solutions',h1='Practical guides to automation for New Zealand businesses',
   lead='Practical guides on what to automate, how it works, what it takes and what to watch for. Written for owners, not engineers.',
   desc='Practical guides for NZ small businesses: what to automate first, invoicing, booking reminders, AI replies, app connections, dashboards and privacy.'),
}
def e(x): return html.escape(x, quote=True)
def url(sec,slug=None): return f'/{sec}' + (f'/{slug}' if slug else '')
def card(p,tag=None):
    sec,slug,t,d,cat,ic=p
    return (f'<a class="card" href="{url(sec,slug)}" data-cat="{e(cat)}"><span class="card-ico"><svg viewBox="0 0 24 24" aria-hidden="true">{ICON[ic]}</svg></span>'
            f'<span class="tag">{e(tag or cat)}</span><h3>{e(t)}</h3><p>{e(d)}</p><span class="go">{ "Read the guide" if sec=="guides" else "Learn more"}</span></a>')
def find(path):
    sec,slug=path.split('/'); return next(p for p in PAGES if p[0]==sec and p[1]==slug)

import hashlib
def _v(name):
    return hashlib.md5(open(os.path.join(SRC,'assets',name),'rb').read()).hexdigest()[:8]
CSSV=_v('pages.css');JSV=_v('pages.js')
THEME="""<script>(function(){var t=null;try{t=sessionStorage.getItem("ambs:theme")}catch(e){}if(t!=="dark"&&t!=="light"){t=(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light"}document.documentElement.dataset.theme=t})();</script>"""
def head(title,desc,canon,ld,ogtype='website'):
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Instrument+Sans:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/pages.css?v={CSSV}">
<script type="application/ld+json">{json.dumps(ld,ensure_ascii=False)}</script>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
'''
def header(active):
    ico_mail='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="17" rx="2.6"/><path d="M3 5.2L12 12.8l9-7.6"/></svg>'
    ico_call='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>'
    cur={'services':'services','industries':'industries','guides':'guides'}.get(active,'')
    def a(href,label,key): return f'<a href="{href}"' + (' aria-current="page"' if key==cur else '') + f'>{label}</a>'
    main=[('/#automate','What we do','automate'),('/#about','About us','about'),('/#how','How it works','how'),('/services','Services','services'),('/guides','Guides','guides'),('/#faq','Questions','faq')]
    drawer=[('/#automate','What we do','automate'),('/#about','About us','about'),('/#why','Why us','why'),('/#how','How it works','how'),('/services','Services','services'),('/guides','Guides','guides'),('/industries','Industries','industries'),('/#faq','Questions','faq')]
    return f'''<header class="hdr"><div class="sh-bar">
  <a class="sh-mark" href="/" aria-label="Ambs Solutions home"><picture><source srcset="/logo-400.webp" type="image/webp"><img src="/logo-400.png" width="613" height="224" alt="Ambs Solutions"></picture></a>
  <div class="sh-right">
    <button class="sh-ico sh-theme" id="themeBtn" type="button" aria-label="Switch light or dark mode"></button>
    <span class="langwrap"><select class="langselect" id="langselect" aria-label="Language"><option value="en" selected>English</option><option value="zh">中文</option><option value="hi">हिन्दी</option><option value="mi">Te Reo Māori</option><option value="pa">ਪੰਜਾਬੀ</option></select><span class="langcaret" aria-hidden="true"><svg viewBox="0 0 12 8" fill="none"><path d="M1.5 1.5L6 6l4.5-4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span></span>
    <nav class="sh-nav" aria-label="Main">{''.join(a(*m) for m in main)}</nav>
    <a class="sh-btn sh-book" href="/#book">Book a call</a>
    <a class="sh-btn sh-contact" href="#contact">Contact us</a>
    <a class="sh-ico sh-sm sh-call" href="tel:+64220999578" aria-label="Call us">{ico_call}</a>
    <button class="sh-menu" id="menuBtn" type="button" aria-expanded="false" aria-controls="siteNav" aria-label="Menu"><span></span></button>
  </div>
  <nav class="sh-drawer" id="siteNav" aria-label="Menu">
    {''.join(a(*m) for m in drawer)}
    <a class="sh-btn sh-contact sh-wide" href="#contact">Contact us</a>
    <div class="sh-pair" role="group" aria-label="Light or dark mode"><button type="button" data-settheme="light" aria-pressed="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.5M12 18.9v2.5M2.6 12h2.5M18.9 12h2.5M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg><span>Light</span></button><button type="button" data-settheme="dark" aria-pressed="false"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg><span>Dark</span></button></div>
  </nav>
</div></header>
'''
def footer():
    col=lambda sec:''.join(f'<li><a href="{url(p[0],p[1])}">{e(p[2])}</a></li>' for p in PAGES if p[0]==sec)
    return f'''<nav class="qbar" aria-label="Quick actions"><a class="qb-call" href="tel:+64220999578"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg><span>Call</span></a><a class="qb-book" href="/#book"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M9 15l2 2 4-4"/></svg><span>Book</span></a></nav>
<footer class="ftr f2"><div class="wrap">
  <div class="f2-grid">
    <div class="f2-brand"><a class="f2-logo" href="/" aria-label="Ambs Solutions home"><picture><source srcset="/logo-400.webp" type="image/webp"><img src="/logo-400.png" width="613" height="224" alt="Ambs Solutions" loading="lazy"></picture></a>
      <p>AI automation and digital solutions for New Zealand businesses. Built in Auckland, working nationwide.</p></div>
    <nav class="f2-col" aria-label="Company"><p class="f2-h">Company</p><a href="/#automate">What we do</a><a href="/#about">About us</a><a href="/#why">Why us</a><a href="/#how">How it works</a></nav>
    <nav class="f2-col" aria-label="Explore"><p class="f2-h">Explore</p><a href="/services">Services</a><a href="/industries">Industries</a><a href="/guides">Guides</a><a href="/#faq">Questions</a></nav>
    <div class="f2-col" id="contact"><p class="f2-h">Contact us</p><a href="/#book">Book a call</a><a href="mailto:hello@ambs.co.nz">hello@ambs.co.nz</a><a href="tel:+64220999578">+64 22 099 9578</a><span>Auckland, NZ</span></div>
  </div>
  <div class="f2-bottom"><p class="f2-copy">© 2026 Ambs Solutions. All rights reserved.</p><nav class="f2-legal" aria-label="Legal"><a href="/privacy">Privacy</a><a href="/terms">Terms of use</a></nav></div>
</div></footer>
<script src="/assets/pages.js?v={JSV}" defer></script>
</body>
</html>
'''
def calc():
    return '''<section class="g-calc" aria-labelledby="calcH"><p class="g-calc-k">Try it with your own numbers</p><h2 id="calcH" class="g-calc-h">Work out your hours back</h2>
<p class="g-calc-sub">Pick one repetitive task. Move the sliders to match a normal week.</p>
<div class="g-calc-in">
<label>How many times a week<output id="cTimes">20</output><input type="range" id="rTimes" min="1" max="150" value="20"></label>
<label>Minutes each time<output id="cMins">10</output><input type="range" id="rMins" min="1" max="60" value="10"></label>
<label>How much could be automated<output id="cShare">50%</output><input type="range" id="rShare" min="10" max="90" step="10" value="50"></label>
</div>
<div class="g-calc-out"><div><b id="cNow">3.3</b><span>hours a week on this task now</span></div><div class="g-calc-big"><b id="cYear">87</b><span>hours a year back</span></div></div>
<p class="g-calc-note">An estimate from your own numbers, not a promise. In a free session we work out a proper estimate together. <a href="/#book">Book a free session &#8594;</a></p>
</section>'''
def cta():
    return '''<section class="cta"><div><h2>See what you could hand over</h2><p>Book a free session. We look at how your work really happens and leave you with a written plan and an hours estimate, yours to keep.</p></div>
  <div class="btns"><a class="btn btn--go" href="/#book">Book a free session</a><a class="btn btn--ghost" href="tel:+64220999578">Call +64 22 099 9578</a></div></section>'''
def crumbs(items):
    lis=''.join((f'<li><a href="{h}">{e(t)}</a></li>' if h else f'<li aria-current="page">{e(t)}</li>') for t,h in items)
    ld={'@type':'BreadcrumbList','itemListElement':[{'@type':'ListItem','position':i+1,'name':t,'item':BASE+(h or items[-1][1] or '')} for i,(t,h) in enumerate(items)]}
    return f'<nav class="crumbs" aria-label="Breadcrumb"><ol>{lis}</ol></nav>', ld
ORG={'@type':'ProfessionalService','@id':BASE+'/#business','name':'Ambs Solutions','url':BASE+'/','telephone':'+64 22 099 9578','email':'hello@ambs.co.nz',
     'areaServed':{'@type':'Country','name':'New Zealand'},'address':{'@type':'PostalAddress','addressLocality':'Auckland','addressCountry':'NZ'},'logo':BASE+'/logo.png'}

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
    if sec=='guides':
        graph.append({'@type':'Article','headline':meta['h1'],'description':meta['description'],'datePublished':meta.get('published',TODAY),'dateModified':meta.get('updated',TODAY),
          'inLanguage':'en-NZ','wordCount':words,'author':{'@type':'Organization','name':'Ambs Solutions','url':BASE+'/'},'publisher':{'@id':BASE+'/#business'},
          'mainEntityOfPage':BASE+canon,'image':BASE+'/logo.png','articleSection':cat})
    else:
        graph.append({'@type':'Service','name':meta['h1'],'serviceType':meta.get('serviceType',ctitle),'description':meta['description'],'provider':{'@id':BASE+'/#business'},
          'areaServed':{'@type':'Country','name':'New Zealand'},'url':BASE+canon})
    if meta.get('faq'):
        graph.append({'@type':'FAQPage','mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}} for q,a in meta['faq']]})
    ld={'@context':'https://schema.org','@graph':graph}
    tk=''.join(f'<li>{e(x)}</li>' for x in meta.get('takeaways',[]))
    takeaways=f'<div class="takeaways"><b>In short</b><ul>{tk}</ul></div>' if tk else ''
    faq=''
    if meta.get('faq'):
        faq='<h2 id="questions">Common questions</h2><div class="faq">'+''.join(f'<details><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q,a in meta['faq'])+'</div>'
    rel=[find(r) for r in meta.get('related',[])][:3]
    related=(f'<section class="section"><div class="section-h"><h2>Keep reading</h2><a href="/guides">All guides →</a></div><div class="cards">{"".join(card(r) for r in rel)}</div></section>') if rel else ''
    pills=[f'<span>{e(meta.get("eyebrow",cat))}</span>']
    if sec=='guides': pills+= [f'<span>{mins} min read</span>',f'<span>Updated {datetime.date.fromisoformat(meta.get("updated",TODAY)).strftime("%-d %B %Y")}</span>']
    else: pills+= ['<span>New Zealand-wide</span>','<span>Free first session</span>']
    art=f'<div class="g-art" aria-hidden="true">{GUIDE_ART[slug]}</div>' if sec=='guides' and slug in GUIDE_ART else ''
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
  <aside class="toc" aria-label="On this page"><div class="toc-box"><b>On this page</b><ol id="tocList"></ol></div></aside>
</div>
<div class="wrap">{related}{cta()}</div>
</main>
'''+footer()
    os.makedirs(os.path.join(OUT,sec),exist_ok=True)
    open(os.path.join(OUT,sec,slug+'.html'),'w',encoding='utf8').write(out)
    return words


SVC=[
 dict(slug='ai-automation',ic='auto',k='Automation',t='AI automation',c1='#1877E0',c2='#7B4DFF',
      d='The jobs your team does the same way every week, done for you. Built around the tools you already use.',
      inc=[('invoice','Quotes and invoices'),('chat','Customer replies'),('cal','Bookings and reminders'),('link','Moving data between apps'),('chart','The numbers, weekly'),('shield','Records you can show')],
      go='Explore AI automation'),
 dict(slug='websites-and-portals',ic='web',k='Digital solutions',t='Websites, portals and dashboards',c1='#0F9D58',c2='#0E8FB5',
      d='Fast, multilingual websites that turn visitors into calls, plus your own apps for staff, customers and live numbers.',
      inc=[('web','Websites that win trust'),('chat','Multilingual by design'),('clinic','Staff and customer portals'),('chart','Live dashboards'),('shield','Yours to own'),('target','Built to turn visits into calls')],
      go='Explore websites and portals'),
]
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
    steps=[('1','Free first session','We look at how your work really happens and leave you with a written plan and an hours estimate.'),
           ('2','Built in one to two weeks','One task first, built in your own accounts and tested on your real jobs before it goes live.'),
           ('3','30 days of free support','Fixes and tweaks are free for the first 30 days. After that, a monthly plan or pay as you go.')]
    out+='<section class="section svc-how"><div class="section-h"><h2>How every project runs</h2></div><ol class="svc-steps">'+''.join(
        f'<li><span class="svc-n">{n}</span><b>{e(t)}</b><p>{e(d)}</p></li>' for k,(n,t,d) in enumerate(steps))+'</ol></section>'
    return out

def build_hub(sec):
    h=HUB[sec]; canon=url(sec)
    cr_html,cr_ld=crumbs([('Home','/'),(SECTION[sec][0],None)]); cr_ld['itemListElement'][-1]['item']=BASE+canon
    items=[p for p in PAGES if p[0]==sec]
    ld={'@context':'https://schema.org','@graph':[cr_ld,ORG,{'@type':'CollectionPage','name':h['h1'],'description':h['desc'],'url':BASE+canon,
        'mainEntity':{'@type':'ItemList','itemListElement':[{'@type':'ListItem','position':i+1,'url':BASE+url(p[0],p[1]),'name':p[2]} for i,p in enumerate(items)]}}]}
    cats=[]; [cats.append(p[4]) for p in items if p[4] not in cats]
    filt=''
    if sec=='guides':
        filt='<div class="filters" data-for="hubGrid" role="group" aria-label="Filter guides"><button type="button" data-f="all" aria-pressed="true">All</button>'+''.join(f'<button type="button" data-f="{e(c)}" aria-pressed="false">{e(c)}</button>' for c in cats)+'</div>'
    extra=''
    if sec!='guides':
        extra='<section class="section"><div class="section-h"><h2>Popular guides</h2><a href="/guides">All guides →</a></div><div class="cards">'+''.join(card(p) for p in PAGES if p[0]=='guides')[:0]+''.join(card(find(x)) for x in ['guides/how-to-choose-what-to-automate-first','guides/connect-your-business-apps','guides/privacy-act-2020-and-automation'])+'</div></section>'
    else:
        extra='<section class="section"><div class="section-h"><h2>Guides by industry</h2><a href="/industries">All industries →</a></div><div class="cards">'+''.join(card(p) for p in PAGES if p[0]=='industries')+'</div></section>'
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
  <div class="pmeta"><span>{len(items)} {SECTION[sec][0].lower()}</span><span>New Zealand-wide</span><span>Free first session</span></div>
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
  <p class="eyebrow">Error 404</p>
  <h1>Page not found</h1>
  <p class="plead">The page you were looking for is not here. It may have moved, or the link may have a typo. These will get you back on track.</p>
  <div class="pmeta"><a class="btn btn--go" href="/">Go to the home page</a><a class="btn btn--ghost" href="/guides">Browse the guides</a></div>
</div></section>
<div class="wrap"><section class="section"><div class="cards">{"".join(card(find(x)) for x in ["services/ai-automation","services/websites-and-portals","industries/trades-and-building","guides/how-to-choose-what-to-automate-first"])}</div></section></div>
</main>
'''+footer()
    open(os.path.join(OUT,'404.html'),'w',encoding='utf8').write(out)

def build_booked():
    ld={'@context':'https://schema.org','@type':'WebPage','name':'Booking confirmed'}
    out=head('Booking confirmed | Ambs Solutions','Your Discovery Call with Ambs Solutions is booked.','/booking-confirmed',ld).replace('index,follow,max-image-preview:large','noindex')
    # Zoho Bookings redirects here inside the booking frame on the home page; take over the whole window
    out=out.replace('<head>','<head>\n<script>if(window.top!==window.self){try{window.top.location.replace(location.href)}catch(e){}}</script>',1)
    out+=header('')+'''<main id="main">
<section class="phero"><div class="wrap">
  <p class="eyebrow">Booking confirmed</p>
  <h1 id="bkH">You are booked in</h1>
  <div class="bk-card">
    <dl>
      <div><dt>Meeting</dt><dd id="bkSvc">Discovery Call</dd></div>
      <div id="bkDateRow" hidden><dt>Date</dt><dd id="bkDate"></dd></div>
      <div id="bkTimeRow" hidden><dt>Time</dt><dd id="bkTime"></dd></div>
      <div><dt>Length</dt><dd>30 minutes</dd></div>
      <div><dt>With</dt><dd>Ambs Solutions</dd></div>
    </dl>
  </div>
  <p class="plead" id="bkMail"><span id="bkMailTxt">We have emailed you the details and a calendar invite.</span> To change the time, use the link in that email or call <a href="tel:+64220999578">+64 22 099 9578</a>.</p>
  <div class="pmeta"><a class="btn btn--go" href="/">Back to the home page</a></div>
</div></section>
</main>
<script>
(function(){try{
  var q=new URLSearchParams(location.search),g=function(k){return (q.get(k)||"").trim();};
  var set=function(id,v){var el=document.getElementById(id);if(el&&v)el.textContent=v;};
  var show=function(id){var el=document.getElementById(id);if(el)el.hidden=false;};
  var first=g("customer_first_name")||g("customer_name").split(" ")[0];
  if(first)set("bkH","You are booked in, "+first);
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
  if(em)set("bkMailTxt","We have emailed the details and a calendar invite to "+em+".");
  /* the link carries the visitor's name and email; take them out of the address bar and history */
  if(location.search&&history.replaceState)history.replaceState(null,"",location.pathname);
}catch(e){}})();
</script>
'''+footer()
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
  <div class="pmeta"><span>Auckland, New Zealand</span><span>Last updated {e(meta["updated"])}</span></div>
</div></section>
<div class="wrap layout">
  <article class="prose legal">
{body}
  </article>
  <aside class="toc" aria-label="On this page"><div class="toc-box"><b>On this page</b><ol id="tocList"></ol></div></aside>
</div>
</main>
'''+footer()
    open(os.path.join(OUT,slug+'.html'),'w',encoding='utf8').write(out)

def build_sitemap():
    rows=[('/', '1.0','weekly')]+[(url(s),'0.8','weekly') for s in ('services','industries','guides')]+[(url(p[0],p[1]),'0.7' if p[0]!='guides' else '0.6','monthly') for p in PAGES]+[('/privacy','0.3','yearly'),('/terms','0.3','yearly')]
    x='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join(f'  <url>\n    <loc>{BASE}{u if u!="/" else "/"}</loc>\n    <lastmod>{TODAY}</lastmod>\n    <changefreq>{f}</changefreq>\n    <priority>{pr}</priority>\n  </url>\n' for u,pr,f in rows)+'</urlset>\n'
    open(os.path.join(OUT,'sitemap.xml'),'w').write(x)

def stamp_home():
    """The home page keeps its styles, scripts and extra languages in site-src/assets (home.css, home.js, i18n/*.json).
       Copy them to the site and stamp index.html with content hashes so browsers and the offline worker fetch new copies after a change."""
    names=['home.css','home.js']
    i18n_dir=os.path.join(SRC,'assets','i18n')
    langs=sorted(f for f in os.listdir(i18n_dir) if f.endswith('.json')) if os.path.isdir(i18n_dir) else []
    for f in names: open(os.path.join(OUT,'assets',f),'w',encoding='utf8').write(open(os.path.join(SRC,'assets',f),encoding='utf8').read())
    if langs:
        os.makedirs(os.path.join(OUT,'assets','i18n'),exist_ok=True)
        for f in langs: open(os.path.join(OUT,'assets','i18n',f),'w',encoding='utf8').write(open(os.path.join(i18n_dir,f),encoding='utf8').read())
    idx=os.path.join(OUT,'index.html')
    if not os.path.exists(idx): return
    h=open(idx,encoding='utf8').read()
    h=re.sub(r'home\.css\?v=[A-Za-z0-9]+','home.css?v='+_v('home.css'),h)
    h=re.sub(r'home\.js\?v=[A-Za-z0-9]+','home.js?v='+_v('home.js'),h)
    if langs:
        lv=hashlib.md5(b''.join(open(os.path.join(i18n_dir,f),'rb').read() for f in langs)).hexdigest()[:8]
        h=re.sub(r'data-i18nv="[A-Za-z0-9]*"','data-i18nv="'+lv+'"',h)
    open(idx,'w',encoding='utf8').write(h)

if __name__=='__main__':
    os.makedirs(os.path.join(OUT,'assets'),exist_ok=True)
    for f in ('pages.css','pages.js'): open(os.path.join(OUT,'assets',f),'w').write(open(os.path.join(SRC,'assets',f)).read())
    stamp_home()
    only=sys.argv[1:]
    total=0
    for p in PAGES:
        path=os.path.join(SRC,'content',p[0],p[1]+'.html')
        if os.path.exists(path) and (not only or p[0]+'/'+p[1] in only):
            w=build_page(p); total+=w; print(f'{p[0]}/{p[1]}: {w} words')
        elif not os.path.exists(path): print(f'MISSING {p[0]}/{p[1]}')
    for s in ('services','industries','guides'): build_hub(s)
    build_404(); build_booked(); build_legal('privacy'); build_legal('terms'); build_sitemap(); print('done, total words',total)
