# Writing brief: Ambs Solutions sub-pages

You are writing content fragments for new SEO pages on https://ambs.co.nz (Ambs Solutions, an Auckland business that builds AI automation and digital solutions — websites, staff/customer portals, live dashboards — for New Zealand small businesses).

## Files
- Build system: `build.py` (DO NOT EDIT). Page list with exact slugs, titles and categories is the `PAGES` list in build.py.
- Example fragment to copy the format, depth and tone from: `content/guides/how-to-choose-what-to-automate-first.html`. Read it fully first.
- The home page's existing wording (what the business says it does, its process, its FAQ answers, typical tasks and the hour estimates it uses): `site-wording.txt`. Stay consistent with it.
- Write each page to `content/<section>/<slug>.html`. After writing, run `python3 build.py <section>/<slug>` from this folder to check it builds (it prints the word count).

## Fragment format (exactly)
```
<!--META
{"title":"... | Ambs Solutions", "description":"140–160 characters", "eyebrow":"short label", "h1":"...", "lead":"1–2 sentences",
 "takeaways":["3–5 short bullets"], "faq":[["question","answer"], ... 3–5 pairs], "related":["section/slug", "section/slug", "section/slug"],
 "serviceType":"(services and industries pages only) e.g. Business process automation"}
-->
<h2>...</h2> ... body HTML ...
```
- META must be valid JSON (double quotes, escape inner quotes, no trailing commas). `related` must use slugs that exist in PAGES (3 of them, not the page itself).
- Title: put the main search phrase first, include "NZ" or "New Zealand" where natural, end with " | Ambs Solutions", ideally under 65 characters before the suffix.
- Do NOT include an h1, the takeaways, the FAQ, a CTA, related links or a table of contents in the body — the build adds those. The FAQ in META is rendered as visible questions AND Google FAQ data, so answers must be complete sentences.
- Body: start with an `<h2>`. 6–9 `<h2>` sections, `<h3>` where useful. Allowed elements/classes only: p, ul, ol, li, strong, em, a, table/thead/tbody/tr/th/td, blockquote, h2, h3,
  `<div class="callout callout--tip|callout--note|callout--warn"><p>...</p></div>`, `<ol class="steps-list"><li><strong>..</strong> ...</li></ol>`,
  `<div class="task-grid"><div class="task"><b>Title</b><span>short label</span><p>one sentence</p></div>...</div>`,
  and for the glossary only: `<dl class="gloss"><dt>Term</dt><dd>Meaning</dd></dl>`. No inline styles, no scripts, no images.
- Length: guides 1,100–1,600 words of body; industry pages 900–1,300; service pages 1,100–1,500; glossary 35–45 terms.
- Internal links: 3–6 natural in-text links to other pages in PAGES (e.g. `<a href="/guides/connect-your-business-apps">`), plus `/#book` at most once in the body. Link text should describe the target, never "click here".

## Voice
- New Zealand English (organise, colour, programme, enrol, licence/license as NZ uses them). Plain, warm, direct, owner-to-owner. Short paragraphs. No hype words ("revolutionise", "unlock", "game-changer", "seamless", "leverage", "cutting-edge"). No exclamation marks.
- Write for a busy owner who is not technical. Explain any jargon in passing.
- Be genuinely useful: concrete steps, examples, what to watch out for, what it costs in effort. The reader should learn something even if they never hire us.

## Accuracy rules (important — this is a real business)
- NEVER invent statistics, survey results, percentages, client names, case studies, testimonials, awards, prices, guarantees or timeframes beyond those below.
- Facts you may use: Ambs Solutions is based in Auckland and works nationwide, mostly remotely. Free first session where they watch the work and leave a written plan and an hours estimate the client keeps, even if they don't hire. One automation first, built in two to three weeks, run on real jobs before going live. Client owns the systems and logins, team trained in the language they prefer (the site is in English, Chinese, Hindi, te reo Māori and Punjabi), named contact reachable in NZ hours. Data handled under the Privacy Act 2020, hosted in New Zealand or Australia, never used to train anyone's AI model. Scope and price agreed in writing before work starts. Tools they connect include Xero, MYOB, Zoho, Shopify, Gmail, Outlook 365, Lightspeed, WhatsApp, Excel, Google Sheets, Hubdoc and Squarespace.
- Hour figures: only the per-task weekly estimates in site-wording.txt / build data (e.g. cafés: rosters 3.0 h, supplier orders 2.5 h, reviews 1.5 h), always described as "typical estimates" — never as results or guarantees.
- General NZ facts are fine when accurate and stated generally: GST is 15%; businesses must generally keep business records for 7 years (IRD); the Privacy Act 2020 has 13 information privacy principles and requires notifying the Privacy Commissioner and affected people about privacy breaches that cause or are likely to cause serious harm; the Privacy Commissioner's office is the regulator. Do not quote other laws, rules, dates or figures unless you are certain. Avoid legal or tax advice — say "check with your accountant/adviser" where relevant, and the Privacy Act guide must say it is general information, not legal advice.
- Do not claim specific product features you are not sure of (e.g. exact menu names in Xero). Describe generally ("most accounting software can…").
- Do not promise outcomes. Use "can", "usually", "often", "typically".

## Industry pages — required sections (adapt wording)
1. What the repetitive work looks like in this industry (day-to-day picture).
2. The three tasks we usually take off first — use the industry's three tasks from site-wording.txt as a `task-grid`, each with its typical weekly hours from the build data, then an h3 per task explaining how the automation works step by step.
3. Other tasks worth automating (4–6 more, as a list).
4. Tools we usually connect for this industry (from the allowed tool list; only plausible ones).
5. Digital tools that help (website, portal, dashboard — relevant to the industry).
6. What working with us looks like (the 3-step process, short).
7. Getting started checklist.
Hours data: cafe 3.0/2.5/1.5; trades 4.0/2.5/2.0; clinic 3.5/2.5/1.5; retail 3.0/2.0/1.5; adviser 3.5/3.0/2.5; transport 3.0/2.0/1.5.

## Service pages — required sections
ai-automation: what AI automation means in plain English; the six automation areas from the home page (quotes and invoices, customer replies, bookings and reminders, moving data between apps, the numbers weekly, records you can show) each as an h3 with how it works and an example; where AI helps vs plain automation; tools; data and privacy; process; what it doesn't do (honest limits).
websites-and-portals: websites that win trust (speed, multilingual, mobile, contact forms that reach you, SEO basics), staff and customer portals (job tracking, photos, invoices, approvals), live dashboards; ownership and hosting; process; how these connect with automation.
