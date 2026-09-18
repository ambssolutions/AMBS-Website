# Ambs Solutions — ambs.co.nz

Marketing website for Ambs Solutions: AI automation and digital solutions for
New Zealand businesses. Auckland, Aotearoa.

## What's here

| File | Purpose |
|---|---|
| `index.html` | The site. Single page, all sections, inline critical CSS and JS |
| `privacy.html` | Privacy Policy (Privacy Act 2020) |
| `terms.html` | Website Terms of Use |
| `style.css` | Shared stylesheet for the two legal pages |
| `logo.png` / `logo.webp` | AMBS wordmark, used in headers and footers |
| `favicon-light.png` / `favicon-dark.png` | Browser tab icon, follows light/dark mode |
| `apple-touch-icon.png` | Home-screen icon on iOS |
| `icon-192.png` | PWA install icon, referenced by `manifest.webmanifest` |
| `manifest.webmanifest` | PWA metadata — name, icons, shortcuts |
| `sw.js` | Service worker: offline shell cache, keyed to `version.json`'s build number |
| `robots.txt` | Crawler policy, points to the sitemap |
| `sitemap.xml` | The three public pages |
| `version.json` | Single source of truth for the build number `sw.js` reads |
| `vercel.json` | `cleanUrls: true` — `/privacy.html` serves at `/privacy`, etc. |

## Features

- Five languages with browser auto-detection: English, 中文, हिन्दी, te reo Māori, ਪੰਜਾਬੀ
- Light and dark themes, following the device and manually switchable
- Living hero: the sky follows the visitor's local time and live weather, with an
  in-page switcher to preview every combination
- Canvas-drawn rain, pausing when off-screen or when the tab is hidden
- Interactive "pick your business" demo estimating hours saved per week
- Contact form (see setup below) and tap-to-call
- Responsive across phone, tablet, laptop and desktop

## Local preview

No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080
```

## Deploying

Static hosting; the repository root is the web root. On Vercel or Cloudflare
Pages, connect the repo and deploy with no build command and no output
directory. Every file must sit in the root, or the logo and stylesheet will
404.

## Contact form setup

Form submissions are delivered by web3forms. The `FORM_KEY` in `index.html`
is already set and live — no action needed. If it ever needs rotating, find:

```js
const FORM_KEY="";
```

## Editing notes

- Copy lives in the `I18N` object near the bottom of `index.html`, one block per
  language. Keys are shared; add a key to all five blocks or it will fall back
  to English.
- `data-i18n="some.key"` on an element makes its text translatable.
- The current version is recorded as an HTML comment near the end of the file.

## Still to do

- Create the hello@ambs.co.nz mailbox (referenced in the header, footer and both
  legal pages)
- After incorporation: restore "Limited" and add the NZBN to the footer
- Client engagement terms and a client-facing privacy policy (lawyer-reviewed)
  before the first paying client

© 2026 Ambs Solutions. All rights reserved.
