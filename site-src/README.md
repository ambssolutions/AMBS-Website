# Page generator for ambs.co.nz sub-pages

This folder builds the Services, Industries and Guides pages, the Privacy and Terms pages, the 404 page and `sitemap.xml`.
It is not published on the website (see `.vercelignore` in the repository root).

The home page (`index.html`) is edited directly and is **not** built from here.

## Edit a page

- Page text lives in `content/<section>/<slug>.html`: a `<!--META {json} -->` block (title, description, headline, intro, "In short" points, questions and related pages), then the page body.
- The list of pages, their card titles, blurbs and icons is the `PAGES` list near the top of `build.py`.
- Shared styles and scripts for these pages: `assets/pages.css` and `assets/pages.js`.
- The moving picture at the top of each guide: `guide_art.json`.
- Writing brief and the home page wording to stay consistent with: `SPEC.md` and `site-wording.txt`.

## Build

```
python3 site-src/build.py
```

It writes the finished pages into the repository root (`services/`, `industries/`, `guides/`, the hub pages, `privacy.html`, `terms.html`, `404.html`, `sitemap.xml` and `assets/pages.css`/`pages.js`), and prints each page's word count. Commit the source change and the rebuilt pages together.

Stylesheet and script links carry a content hash (`?v=…`) so visitors always get the current version after an update.

When you change page content, also bump `"build"` in `version.json` so the installed app offers the update.
