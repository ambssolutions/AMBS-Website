# AMBS Solutions website notes

These notes apply to this site and to any other AMBS Solutions website.

## First thing in every chat: check for waiting translations
- Run `git fetch origin main`, merge it, then run `python3 site-src/pending_translations.py`.
- If anything is waiting, tell the owner in one line, for example "3 editor changes are waiting for translation".
- When they say "translate the editor changes":
  1. Write the Chinese, Hindi, Punjabi and te reo Māori translations into a JSON file.
  2. Run `python3 site-src/pending_translations.py --apply <file>`, then `python3 site-src/build.py`.
  3. Show the translations and wait for "push live".

## Working style
- Make changes locally and show screenshots or a video first.
- Publish to the live site only when the owner says "push live".

## Design preferences
- Stacked card sections (like "How it works"): use native CSS `position: sticky` stacking.
  - Cards scroll normally and stick near the top, one under the next, each leaving its number row showing.
  - Then they release together.
  - Don't pin sections or move the cards with scroll-driven JavaScript. The owner wants the effortless, native feel.
- Expanding cards (like "What we do" on phones): unfold slowly and smoothly with a native CSS fold (`grid-template-rows` transition, about 1.3s), with the content fading in.
- Colours: use the logo's green for all greens, and brand blue and purple from the logo.
- Dark mode logos light up from grey to full colour with no glow or halo around them.

## Website editor (/admin)
- **What the owner can edit at ambs.co.nz/admin:**
  - all homepage wording
  - guide, industry, service and legal pages: details, article text, photos, questions and related pages
  - new and deleted pages
  - the section-page intros and the service cards
  - photos, the logo and the sharing picture
  - phone, email and location, changed site-wide
  - the hours calculator
  - adding and removing homepage items: questions, Why us rows, What we do points, About us letters, How it works steps, trust points, the tools strip
  - What we do cards: new cards with a photo, removal, and swapping a drawing for a photo (original drawings are kept in `site-src/content/wd-drawings.json` so they can come back)
  - the app and browser icons
  - every change can be previewed at phone, tablet and laptop size before publishing
  - menus and footer links (`site-src/content/menus.json`)
  - homepage section order, hiding sections, and new sections made of blocks (`site-src/content/home-sections.json`)
  - pages at any address made of blocks (`site-src/content/custom/<slug>.json`) and News posts (section `news` in `pages.json`)
  - drafts (commits starting "Editor draft:" are saved but not built or deployed) and History with undo
  - scheduled publishing: a draft with `publish_at` (New Zealand time) goes live once that time passes. `editor-rebuild.yml` runs hourly, and `site-src/scheduled_due.py` decides whether a build is needed
  - contact form blocks: `site-src/assets/forms.js` sends each message through Web3Forms (the same key as the homepage form) and to portal Leads
  - News and Guides pages have a search box and category filters, and `/news?c=Category` opens filtered
  - drag-and-drop ordering (the ⠿ handle) for blocks, form questions, list items, menus and homepage sections
- **Anything new added in a chat must be editable in /admin too.**
  - New pages, posts, sections or wording go into the editor's data files (`pages.json`, `custom/`, `home-sections.json`, `menus.json`, the English list in `home.js`), not hard-coded into the HTML.
  - A new kind of content (for example a Blog or Case studies section) also gets added to `SECTIONS`/`LISTED` in `api/pages.js`, `SECTION` in `build.py`, and the "New page" choices and `SEC` names in `admin.html`, so the owner can add more of it.
  - Say in the reply how the owner will edit it.
- **How the editor saves:** each save commits straight to `main`.
  - Homepage wording, photos, the logo and calculator commits start with "Website editor:" and deploy directly.
  - Page and business-detail commits start with "Editor source:". Vercel skips those (`ignoreCommand` in `vercel.json`), and `.github/workflows/editor-rebuild.yml` then runs `build.py`, bumps `version.json` and commits, which deploys once.
- **Where the content lives:**
  - The page list, hub intros and service cards are in `site-src/content/pages.json`.
  - Business details are in `site-src/content/site.json`.
  - Uploaded photos are in `assets/uploads/`.
- **Before any change:** run `git fetch origin main` and merge it normally. Never use `-X ours`, or the owner's edits get overwritten. If wording conflicts, keep main's version.
- **Translations:** when the owner changes English in the editor, that line's other languages are removed (visitors see the English) and marked "needs" in `translation-status.json`. Claude translates them in a chat, as described at the top of this file. The editor has no translation service of its own, so there's no API cost.
- **Blocks:** `site-src/assets/blocks.mjs` draws every block, for the build (through `site-src/blocks-cli.mjs`, so the build needs node) and for the editor's preview (published copy at `/assets/blocks.mjs`). Styles are in `blocks.css`. Homepage block wording uses `ed.*` translation keys. The build records their English in `site-src/content/ed-strings.json` and queues changed lines in `translation-status.json`.
- **Homepage structure code:** adding and removing items is in `api/_home.js`; new wording is added to the English list in `home.js` and marked "needs" for translation.
- **Server code:** it lives in `api/` (Vercel functions) and needs two Vercel environment variables: `GITHUB_TOKEN` (fine-grained, this repo only, Contents read and write) and `ADMIN_EMAILS` (`ADMIN_EMAIL` also works; the live project uses that name). Sign-in uses the AMBS Supabase project.
