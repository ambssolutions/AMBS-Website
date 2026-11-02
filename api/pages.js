/* POST /api/pages: every page except the homepage.
   { action: "list" }                                          every page, plus hub wording and service cards
   { action: "get", section, slug }                            one page
   { action: "save", section, slug, meta, body, card, sha, draft }
   { action: "create", section, title }                        section: guides | industries | services | news | page
   { action: "delete", section, slug }
   { action: "hubs", hubs, service_cards, service_steps }
   { action: "search", q }                                     every page, post, section intro, menu link and business detail containing q
   section "page" is a page at its own address (/slug) made of blocks, kept in site-src/content/custom/<slug>.json.
   Saves start "Editor source:" (a GitHub workflow rebuilds and publishes the pages) or, for drafts that
   are not on the website, "Editor draft:" (saved, nothing published). */
import { SITE_TEXT_JSON, SITE_TEXT_GROUPS } from "./_sitetext.js";
import { requireEditor, send, readBody, headSha, readFile, commitFiles, cleanBody, listPaths, readEnglish, nextVersion, can, NO_ACCESS } from "./_lib.js";
import { cleanBlocks } from "./_blocks.js";

const SECTIONS = ["guides", "industries", "services", "news", "locations", "legal"];
const LISTED = ["guides", "industries", "services", "news", "locations"];
const PAGES_JSON = "site-src/content/pages.json";
const ICONS = ["auto", "map", "clean", "law", "web", "cafe", "trades", "clinic", "retail", "adviser", "transport", "guide", "shield", "chart", "chat", "cal", "link", "invoice", "book", "target"];
/* addresses a page of its own can't take */
const RESERVED = new Set(["index", "admin", "api", "assets", "404", "booking-confirmed", "privacy", "terms", "services", "industries", "guides", "news", "locations", "invoice", "sitemap", "robots", "manifest", "sw", "version", "site-src", "logo", "favicon", "og-image"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
/* New Zealand time now, as "2026-10-07T09:00" */
const nowNZ = () => new Date().toLocaleString("sv-SE", { timeZone: "Pacific/Auckland" }).replace(" ", "T").slice(0, 16);
/* on the website: not a draft, or a scheduled draft whose time has come */
const isLive = (d) => !d.draft || !!(d.publish_at && d.publish_at <= nowNZ());
/* a time to publish: later than now and within a year */
function scheduleTime(v) {
  if (v == null || v === "") return "";
  const t = String(v).slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) throw Object.assign(new Error("Pick a date and time to publish"), { status: 400 });
  const now = nowNZ(), max = (parseInt(now.slice(0, 4)) + 1) + now.slice(4);
  if (t <= now) throw Object.assign(new Error("Pick a time in the future"), { status: 400 });
  if (t > max) throw Object.assign(new Error("Pick a time within the next year"), { status: 400 });
  return t;
}

function src(section, slug) {
  if (!SLUG.test(slug || "")) throw Object.assign(new Error("Unknown page"), { status: 400 });
  if (section === "page") return "site-src/content/custom/" + slug + ".json";
  if (!SECTIONS.includes(section)) throw Object.assign(new Error("Unknown page"), { status: 400 });
  return "site-src/content/" + section + "/" + slug + ".html";
}
const outPath = (section, slug) => (section === "page" ? slug + ".html" : section + "/" + slug + ".html");

function parse(raw) {
  const m = raw.match(/^\s*<!--META\s*(\{[\s\S]*?\})\s*-->\s*([\s\S]*)$/);
  if (!m) throw new Error("This page's file is not in the expected format");
  return { meta: JSON.parse(m[1]), body: m[2].trim() };
}
function serialise(meta, body) {
  return "<!--META\n" + JSON.stringify(meta, null, 1) + "\n-->\n" + body.trim() + "\n";
}
function slugify(t) {
  return String(t).toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70).replace(/-+$/, "") || "new-page";
}
function str(v, max = 2000) { return String(v ?? "").slice(0, max); }
const photoUrl = (v) => (/^\/[A-Za-z0-9/_.-]+\.(webp|png|jpe?g)$/i.test(String(v || "")) ? String(v) : "");

/* Keep only the page details the build understands, in a tidy order. */
function tidyMeta(section, meta, before) {
  const m = { ...before };
  for (const k of ["title", "description", "eyebrow", "h1", "lead"]) if (k in meta) m[k] = str(meta[k], k === "lead" ? 1500 : 400);
  if (section === "legal") { if ("updated" in meta) m.updated = str(meta.updated, 60); return m; }
  if ("takeaways" in meta) m.takeaways = (meta.takeaways || []).map((x) => str(x, 600)).filter((x) => x.trim());
  if ("faq" in meta) m.faq = (meta.faq || []).map((x) => [str(x[0], 400), str(x[1], 2000)]).filter((x) => x[0].trim() && x[1].trim());
  if ("related" in meta) m.related = (meta.related || []).map((x) => str(x, 120)).filter((x) => /^(guides|industries|services|news)\/[a-z0-9-]+$/.test(x)).slice(0, 3);
  if (section === "guides") m.updated = today();
  if (section === "news" && meta.published && /^\d{4}-\d{2}-\d{2}$/.test(meta.published)) m.published = meta.published;
  return m;
}
function tidyCustom(d, before) {
  return {
    ...(d.publish_at ? { publish_at: d.publish_at } : {}),
    h1: str(d.h1 ?? before.h1, 160), eyebrow: str(d.eyebrow ?? before.eyebrow, 60), lead: str(d.lead ?? before.lead, 600),
    title: str(d.title ?? before.title, 160), description: str(d.description ?? before.description, 300),
    cta: d.cta === undefined ? before.cta !== false : !!d.cta,
    blocks: cleanBlocks(d.blocks ?? before.blocks), draft: !!d.draft, updated: today(),
  };
}


/* Redirects live in vercel.json ("redirects"), so Vercel answers them before any page: an old address sends visitors and Google to the new one. */
const VERCEL_JSON = "vercel.json";
const RX_FROM = /^\/[A-Za-z0-9._~\-\/]*$/;
const RX_TO = /^(\/[A-Za-z0-9._~\-\/#?=&%]*|https:\/\/[^\s"<>]+)$/;
const BLOCKED = /^\/(admin|api|assets|site-src|invoice)(\/|$)/;
async function readVercel(head) { return JSON.parse((await readFile(VERCEL_JSON, head)).text); }
const redirectList = (v) => (v.redirects || []).map((r) => ({ from: r.source, to: r.destination, permanent: r.permanent !== false }));
function vercelWith(v, list) {
  const next = { ...v };
  if (list.length) next.redirects = list.map((r) => ({ source: r.from, destination: r.to, permanent: r.permanent !== false })); else delete next.redirects;
  return JSON.stringify(next, null, 2) + "\n";
}
const words0 = (body) => body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
const pagePath = (section, slug) => (section === "page" ? "/" + slug : "/" + section + "/" + slug);

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    const head = await headSha();
    const site = JSON.parse((await readFile(PAGES_JSON, head)).text);
    const by = " (" + who.email + ")";
    /* a new page at an address that has a redirect: drop the redirect so the page can show */
    const freeAddress = async (sec, slug) => {
      const v = await readVercel(head), list = redirectList(v), from = pagePath(sec, slug);
      return list.some((r) => r.from === from) ? { [VERCEL_JSON]: vercelWith(v, list.filter((r) => r.from !== from)) } : {};
    };
    const save = (files, what, publishes) => commitFiles(head, files, (publishes ? "Editor source: " : "Editor draft: ") + what + by);

    if (b.action === "list") {
      const legal = [];
      for (const slug of ["terms", "privacy"]) {
        const f = await readFile(src("legal", slug), head);
        if (f) legal.push({ section: "legal", slug, title: parse(f.text).meta.h1 });
      }
      const custom = [];
      for (const f of (await listPaths(head)).filter((x) => /^site-src\/content\/custom\/[a-z0-9-]+\.json$/.test(x.path))) {
        const d = JSON.parse((await readFile(f.path, head)).text);
        custom.push({ section: "page", slug: f.path.split("/").pop().replace(/\.json$/, ""), title: d.h1, draft: !!d.draft, ...(d.publish_at ? { publish_at: d.publish_at } : {}) });
      }
      let privacy_missing = [];
      try { privacy_missing = JSON.parse((await readFile("site-src/content/privacy-check.json", head)).text).missing || []; } catch (e) {}
      return send(res, 200, { now: nowNZ(), pages: site.pages, custom, legal, privacy_missing, hubs: site.hubs, service_cards: site.service_cards, service_steps: site.service_steps, icons: ICONS });
    }


    if (b.action === "redirects") {
      const v = await readVercel(head);
      return send(res, 200, { redirects: redirectList(v) });
    }

    if (b.action === "redirects-save" && !can(who, "layout")) return send(res, 403, { error: NO_ACCESS });
    if (b.action === "redirects-save") {
      const v = await readVercel(head);
      const live = new Set(["/", "/services", "/industries", "/guides", "/news", "/locations", "/privacy", "/terms", "/booking-confirmed", "/email-signature", "/404",
        ...site.pages.filter((p) => !p.draft).map((p) => pagePath(p.section, p.slug)),
        ...(await listPaths(head)).filter((x) => /^site-src\/content\/custom\/[a-z0-9-]+\.json$/.test(x.path)).map((x) => "/" + x.path.split("/").pop().replace(/\.json$/, ""))]);
      const seen = new Set(), list = [];
      for (const r of (Array.isArray(b.redirects) ? b.redirects : []).slice(0, 300)) {
        let from = String(r.from || "").trim(), to = String(r.to || "").trim();
        if (!from && !to) continue;
        from = from.replace(/^https?:\/\/(www\.)?ambs\.co\.nz/i, "") || "/";
        to = to.replace(/^https?:\/\/(www\.)?ambs\.co\.nz(?=\/|$)/i, "") || "/";
        if (!from.startsWith("/")) from = "/" + from;
        if (from.length > 1) from = from.replace(/\/+$/, "");
        if (!RX_FROM.test(from) || from === "/") return send(res, 400, { error: "“" + from + "” isn't an address on this website. Start it with /, like /old-page." });
        if (BLOCKED.test(from)) return send(res, 400, { error: "“" + from + "” is used by the website itself and can't be sent elsewhere." });
        if (live.has(from)) return send(res, 400, { error: "“" + from + "” is a live page. Take that page off the website first, or pick another old address." });
        if (!RX_TO.test(to)) return send(res, 400, { error: "Send “" + from + "” to a page on this website (like /services) or a full https:// address." });
        if (to === from) return send(res, 400, { error: "“" + from + "” can't send visitors to itself." });
        if (seen.has(from)) return send(res, 400, { error: "“" + from + "” is listed twice." });
        seen.add(from); list.push({ from, to, permanent: r.permanent !== false });
      }
      const text = vercelWith(v, list);
      if (text === JSON.stringify(v, null, 2) + "\n") return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [VERCEL_JSON]: text, "version.json": await nextVersion(head) }, "Website editor: redirects" + by);
      return send(res, 200, { ok: true, redirects: list });
    }

    if (b.action === "health") {
      const issues = [];
      /* every check, with how many pages it looked at and how many failed, and every page's own result */
      const CHECKS = { title: "Title in Google", desc: "Description in Google", dup: "Every page has its own title", photos: "Photos have a description", words: "Enough helpful words (300+)", links: "Links go to pages that exist", redirects: "Redirects go to pages that exist" };
      const tally = {}; Object.keys(CHECKS).forEach((k) => (tally[k] = { total: 0, failed: 0 }));
      const seenFail = {}, perPage = [];
      const tick = (k, ok, url) => { tally[k].total++; if (!ok && !seenFail[k + url]) { seenFail[k + url] = 1; tally[k].failed++; } };
      const add = (sev, page, what, fix) => issues.push({ sev, ...page, what, fix });
      const known = new Set(["/", "/services", "/industries", "/guides", "/news", "/locations", "/privacy", "/terms", "/booking-confirmed", "/email-signature"]);
      const all = [];
      for (const p of site.pages) { known.add(pagePath(p.section, p.slug)); all.push({ section: p.section, slug: p.slug, draft: !!p.draft }); }
      for (const f of (await listPaths(head)).filter((x) => /^site-src\/content\/custom\/[a-z0-9-]+\.json$/.test(x.path))) {
        const slug = f.path.split("/").pop().replace(/\.json$/, ""); known.add("/" + slug); all.push({ section: "page", slug, path: f.path });
      }
      all.push({ section: "legal", slug: "privacy" }, { section: "legal", slug: "terms" });
      const v = await readVercel(head);
      for (const r of redirectList(v)) known.add(r.from);
      const titles = {};
      await Promise.all(all.map(async (pg) => {
        const f = await readFile(pg.section === "page" ? pg.path : src(pg.section, pg.slug), head);
        if (!f) return;
        let meta, body;
        if (pg.section === "page") { const d = JSON.parse(f.text); meta = d; body = JSON.stringify(d.blocks || []); pg.draft = !!d.draft; }
        else ({ meta, body } = parse(f.text));
        if (pg.draft) return;
        const ref = { section: pg.section, slug: pg.slug, name: meta.h1 || pg.slug, url: pg.section === "legal" ? "/" + pg.slug : pagePath(pg.section, pg.slug) };
        perPage.push(ref);
        const t = String(meta.title || "").trim(), d = String(meta.description || "").trim();
        tick("title", t && t.length <= 65 && t.length >= 25, ref.url); tick("desc", d && d.length <= 165 && d.length >= 70, ref.url);
        if (!t) add("high", ref, "No title in Google", "Write a title of 30–60 characters with the main words people search for.");
        else if (t.length > 65) add("mid", ref, "Title in Google is " + t.length + " characters, so Google cuts it short", "Keep it under 60 characters.");
        else if (t.length < 25) add("low", ref, "Title in Google is short (" + t.length + " characters)", "Add the service and place, for example “… | Auckland NZ”.");
        if (t) (titles[t.toLowerCase()] = titles[t.toLowerCase()] || []).push(ref);
        if (!d) add("high", ref, "No description in Google", "Write 120–155 characters saying what the page offers and who it's for.");
        else if (d.length > 165) add("low", ref, "Description is " + d.length + " characters, so Google cuts it short", "Keep it under 155 characters.");
        else if (d.length < 70) add("mid", ref, "Description is short (" + d.length + " characters)", "Aim for 120–155 characters.");
        if (pg.section !== "page") {
          const imgs = body.match(/<img\b[^>]*>/gi) || [];
          const noAlt = imgs.filter((i) => !/\balt\s*=\s*"[^"]+"/i.test(i)).length;
          if (imgs.length) tick("photos", !noAlt, ref.url);
          if (pg.section !== "legal") tick("words", words0(body) >= 300, ref.url);
          if (noAlt) add("mid", ref, noAlt + (noAlt > 1 ? " photos have" : " photo has") + " no description", "Describe each photo in a few words. Google and screen readers use it.");
          const words = body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
          if (pg.section !== "legal" && words < 300) add("low", ref, "Only " + words + " words of article text", "Pages with 500+ helpful words usually rank better.");
        }
        const links = [...(pg.section === "page" ? body.matchAll(/"(\/[a-z0-9\-\/]*)(?:[#?][^"]*)?"/gi) : body.matchAll(/href="(\/[^"#?]*)/gi))].map((m) => m[1].replace(/\/+$/, "") || "/");
        const broken = [...new Set(links.filter((l) => !known.has(l) && !/^\/(assets|api)\//.test(l) && !/\.[a-z0-9]+$/i.test(l)))];
        tick("links", !broken.length, ref.url);
        if (broken.length) add("high", ref, "Link to a missing page: " + broken.slice(0, 3).join(", "), "Change the link, or add a redirect from that address in Redirects.");
      }));
      for (const list of Object.values(titles)) list.forEach((ref) => tick("dup", list.length < 2, ref.url));
      for (const list of Object.values(titles)) if (list.length > 1) list.forEach((ref) => add("mid", ref, "Same title in Google as " + list.filter((x) => x !== ref).map((x) => x.name).join(", "), "Give every page its own title."));
      for (const r of redirectList(v)) tick("redirects", !(r.to.startsWith("/") && !known.has(r.to.split(/[#?]/)[0].replace(/\/+$/, "") || "/")), r.from);
      for (const r of redirectList(v)) if (r.to.startsWith("/") && !known.has(r.to.split(/[#?]/)[0].replace(/\/+$/, "") || "/"))
        add("mid", { section: "redirects", slug: "", name: "Redirect " + r.from, url: r.from }, "Sends visitors to " + r.to + ", which doesn't exist", "Change where it goes in Redirects.");
      const order = { high: 0, mid: 1, low: 2 };
      issues.sort((a, b2) => order[a.sev] - order[b2.sev]);
      const pages = all.filter((p) => !p.draft).length;
      const pen = issues.reduce((n, i) => n + (i.sev === "high" ? 6 : i.sev === "mid" ? 3 : 1), 0);
      const score = Math.max(0, Math.min(100, Math.round(100 - pen * 20 / Math.max(pages, 1))));
      const checks = Object.keys(CHECKS).map((k) => ({ key: k, name: CHECKS[k], total: tally[k].total, failed: tally[k].failed }));
      perPage.forEach((r) => { const mine = issues.filter((i) => i.url === r.url); r.issues = mine.length; r.worst = mine.length ? mine[0].sev : ""; });
      perPage.sort((a, b2) => b2.issues - a.issues || a.name.localeCompare(b2.name));
      return send(res, 200, { score, pages, issues, checks, perPage, checked: new Date().toISOString() });
    }

    if (b.action === "search") {
      const q = str(b.q, 100).trim().toLowerCase();
      if (q.length < 2) return send(res, 200, { results: [] });
      const plain = (h) => String(h ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
      const results = [];
      /* one result per place a match is found, with a few words either side */
      const look = (base, where, text) => {
        const t = plain(text), i = t.toLowerCase().indexOf(q);
        if (i < 0 || results.filter((r) => r.key === base.key).length >= 3) return;
        const a = Math.max(0, i - 50), z = Math.min(t.length, i + q.length + 70);
        results.push({ ...base, where, snippet: (a ? "…" : "") + t.slice(a, z) + (z < t.length ? "…" : "") });
      };
      const strings = (v, out = []) => {
        if (typeof v === "string") out.push(v);
        else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
        else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (!["type", "photo", "link", "url", "style", "side", "icon"].includes(k)) strings(x, out);
        return out;
      };
      const pagesFound = await Promise.all(site.pages.map(async (p) => ({ p, f: await readFile(src(p.section, p.slug), head) })));
      for (const { p, f } of pagesFound) {
        const base = { kind: "page", section: p.section, slug: p.slug, title: p.title, key: p.section + "/" + p.slug };
        look(base, "Card", [p.title, p.blurb, p.category].join(" · "));
        if (!f) continue;
        const { meta, body } = parse(f.text);
        look(base, "Top of the page", [meta.eyebrow, meta.h1, meta.lead].filter(Boolean).join(" · "));
        look(base, "Key points", (meta.takeaways || []).join(" · "));
        look(base, "Article", body);
        look(base, "Questions", (meta.faq || []).map((x) => x.join(" ")).join(" · "));
        look(base, "On Google", [meta.title, meta.description].join(" · "));
      }
      for (const slug of ["terms", "privacy"]) {
        const f = await readFile(src("legal", slug), head);
        if (!f) continue;
        const { meta, body } = parse(f.text);
        const base = { kind: "page", section: "legal", slug, title: meta.h1, key: "legal/" + slug };
        look(base, "Heading", meta.h1);
        look(base, "Page text", body);
      }
      const customs = (await listPaths(head)).filter((x) => /^site-src\/content\/custom\/[a-z0-9-]+\.json$/.test(x.path));
      for (const x of await Promise.all(customs.map(async (c) => ({ c, f: await readFile(c.path, head) })))) {
        if (!x.f) continue;
        const d = JSON.parse(x.f.text), slug = x.c.path.split("/").pop().replace(/\.json$/, "");
        const base = { kind: "page", section: "page", slug, title: d.h1, key: "page/" + slug };
        look(base, "Top of the page", [d.eyebrow, d.h1, d.lead].filter(Boolean).join(" · "));
        look(base, "Page content", strings(d.blocks).join(" · "));
        look(base, "On Google", [d.title, d.description].join(" · "));
      }
      const hubBase = { kind: "hubs", title: "Section pages & service cards", key: "hubs" };
      for (const [sec, h] of Object.entries(site.hubs || {})) look(hubBase, sec.charAt(0).toUpperCase() + sec.slice(1) + " page intro", [h.h1, h.lead, h.desc].join(" · "));
      look(hubBase, "Service cards", strings(site.service_cards).join(" · "));
      look(hubBase, "How every project runs", strings(site.service_steps).join(" · "));
      const mf = await readFile("site-src/content/menus.json", head);
      if (mf) {
        const en = readEnglish((await readFile("site-src/assets/home.js", head)).text), m = JSON.parse(mf.text);
        const names = { main: "Top menu", drawer: "Phone menu", company: "Footer: Company", explore: "Footer: Explore" };
        for (const n of Object.keys(names)) look({ kind: "menus", title: "Menus", key: "menus" }, names[n], (m[n] || []).map((it) => ((it.key && en[it.key]) || it.label || "") + " " + it.href).join(" · "));
      }
      const tf = await readFile(SITE_TEXT_JSON, head);
      if (tf) {
        const t = JSON.parse(tf.text);
        for (const g of SITE_TEXT_GROUPS) for (const [k, label] of g.items) look({ kind: "sitetext", title: g.name, key: "sitetext:" + k }, "Wording on every page · " + label, t[k] || "");
      }
      const cf = await readFile("site-src/content/chatbot.json", head);
      if (cf) {
        const c = JSON.parse(cf.text), base = { kind: "chat", title: "Chat helper", key: "chat" };
        look(base, "Greeting and quick questions", [c.greeting, ...(c.suggestions || []), c.not_found].join(" · "));
        for (const x of c.qa || []) look(base, "Answer · " + x.q, [x.q, x.also, x.a].join(" · "));
        look(base, "Chat wording", Object.values(c.labels || {}).join(" · "));
        look(base, "Everyday conversation", Object.values(c.chat || {}).join(" · "));
      }
      const sf = await readFile("site-src/content/site.json", head);
      if (sf) look({ kind: "business", title: "Business details", key: "business" }, "Phone, email and location", Object.values(JSON.parse(sf.text)).join(" · "));
      return send(res, 200, { results: results.slice(0, 80) });
    }

    if (b.action === "get") {
      const f = await readFile(src(b.section, b.slug), head);
      if (!f) return send(res, 404, { error: "That page no longer exists." });
      if (b.section === "page") return send(res, 200, { custom: JSON.parse(f.text), sha: f.sha });
      const { meta, body } = parse(f.text);
      const card = site.pages.find((p) => p.section === b.section && p.slug === b.slug) || null;
      return send(res, 200, { meta, body, card, sha: f.sha });
    }

    if (b.action === "save") {
      const path = src(b.section, b.slug);
      const f = await readFile(path, head);
      if (!f) return send(res, 404, { error: "That page no longer exists." });
      if (b.sha && b.sha !== f.sha) return send(res, 409, { error: "Someone else saved this page since you opened it. Reopen it and make your change again." });
      /* a scheduled page is a draft until its time, then the hourly rebuild publishes it */
      const when = b.section === "legal" ? "" : scheduleTime(b.schedule);
      const draft = !!b.draft || !!when;
      const files = {};
      let wasLive;
      if (b.section === "page") {
        const before = JSON.parse(f.text);
        wasLive = isLive(before);
        if (when && wasLive) return send(res, 400, { error: "This page is already on the website." });
        files[path] = JSON.stringify(tidyCustom({ ...(b.custom || {}), draft, publish_at: when }, before), null, 1) + "\n";
      } else {
        const before = parse(f.text);
        const meta = { ...(b.meta || {}) };
        if (when && b.section === "news") meta.published = when.slice(0, 10);
        files[path] = serialise(tidyMeta(b.section, meta, before.meta), cleanBody(b.body ?? before.body));
        const i = site.pages.findIndex((p) => p.section === b.section && p.slug === b.slug);
        wasLive = b.section === "legal" || (i >= 0 && isLive(site.pages[i]));
        if (when && wasLive) return send(res, 400, { error: "This page is already on the website." });
        if (i >= 0) {
          const c = site.pages[i], k = b.card || {};
          site.pages[i] = { ...c, title: str(k.title ?? c.title, 120), blurb: str(k.blurb ?? c.blurb, 300), category: str(k.category ?? c.category, 60), icon: ICONS.includes(k.icon) ? k.icon : c.icon };
          if (b.section === "news" && "photo" in k) { const ph = photoUrl(k.photo); if (ph) site.pages[i].photo = ph; else delete site.pages[i].photo; }
          if (draft) site.pages[i].draft = true; else delete site.pages[i].draft;
          if (when) site.pages[i].publish_at = when; else delete site.pages[i].publish_at;
          files[PAGES_JSON] = JSON.stringify(site, null, 1) + "\n";
        }
      }
      /* taking a published page back to draft removes it from the website */
      if (draft && wasLive && b.section !== "legal") files[outPath(b.section, b.slug)] = null;
      await save(files, (when ? "schedule " : draft ? "draft " : "update ") + b.section + "/" + b.slug + (when ? " for " + when : ""), !draft || wasLive);
      return send(res, 200, { ok: true, live: !draft, scheduled: when || undefined });
    }

    if (b.action === "create") {
      const sec = b.section;
      if (![...LISTED, "page"].includes(sec)) return send(res, 400, { error: "Pick a kind of page" });
      const title = str(b.title, 120).trim();
      if (!title) return send(res, 400, { error: "Give the page a title" });
      let base = slugify(b.slug || title), slug = base, n = 2;
      const all = await listPaths(head);
      const taken = (s) => sec === "page"
        ? RESERVED.has(s) || all.some((x) => x.path === s + ".html" || x.path.startsWith(s + "/") || x.path === src("page", s))
        : site.pages.some((p) => p.section === sec && p.slug === s) || all.some((x) => x.path === src(sec, s));
      while (taken(slug)) slug = base + "-" + n++;
      if (sec === "page") {
        const d = { h1: title, eyebrow: "", lead: "", title: title + " | Ambs Solutions", description: "", cta: true, draft: true, updated: today(),
          blocks: [{ type: "text", heading: "", body: "<p>Start writing here.</p>" }] };
        /* "start from": a copy of another page's blocks */
        const copy = b.start && Array.isArray(b.start.blocks) ? cleanBlocks(b.start.blocks) : [];
        if (copy.length) d.blocks = copy;
        await save({ [src("page", slug)]: JSON.stringify(d, null, 1) + "\n", ...(await freeAddress("page", slug)) }, "new page /" + slug, false);
        return send(res, 200, { ok: true, section: sec, slug });
      }
      /* "start from a previous post": the editor sends the old post's shape with starter text in place of its words */
      const st = b.start && typeof b.start === "object" ? b.start : null;
      const meta = {
        title: title + " | Ambs Solutions", description: "",
        eyebrow: (st && str(st.eyebrow, 40).trim()) || { guides: "Guide", industries: "Industry", services: "Service", news: "News" }[sec],
        h1: title, lead: "", takeaways: [], faq: [], related: [],
      };
      if (st) {
        meta.takeaways = (Array.isArray(st.takeaways) ? st.takeaways : []).slice(0, 12).map((x) => str(x, 600)).filter((x) => x.trim());
        meta.faq = (Array.isArray(st.faq) ? st.faq : []).slice(0, 20).map((x) => [str(x?.[0], 400), str(x?.[1], 2000)]).filter((x) => x[0].trim() && x[1].trim());
        /* "Duplicate" sends the whole page, so its introduction and Google wording come along too */
        if (st.lead) meta.lead = str(st.lead, 1500);
        if (st.description) meta.description = str(st.description, 400);
        meta.related = (Array.isArray(st.related) ? st.related : []).map((x) => str(x, 120)).filter((x) => /^(guides|industries|services|news)\/[a-z0-9-]+$/.test(x)).slice(0, 3);
      }
      if (sec === "guides" || sec === "news") meta.published = meta.updated = today();
      const category = (st && str(st.category, 60).trim()) || (sec === "guides" ? "Getting started" : sec === "news" ? "News" : title);
      const icon = st && ICONS.includes(st.icon) ? st.icon : sec === "guides" || sec === "news" ? "guide" : sec === "locations" ? "map" : "target";
      site.pages.push({ section: sec, slug, title, blurb: "", category, icon, draft: true });
      const body = (st && cleanBody(str(st.body, 60000))) || "<h2>" + title.replace(/[<&>]/g, "") + "</h2>\n<p>Start writing here.</p>";
      await save({
        [src(sec, slug)]: serialise(meta, body),
        [PAGES_JSON]: JSON.stringify(site, null, 1) + "\n", ...(await freeAddress(sec, slug)),
      }, "new page " + sec + "/" + slug, false);
      return send(res, 200, { ok: true, section: sec, slug });
    }

    if (b.action === "delete") {
      if (![...LISTED, "page"].includes(b.section)) return send(res, 400, { error: "This page can't be deleted" });
      const path = src(b.section, b.slug);
      if (b.section === "services" && site.service_cards.some((c) => c.slug === b.slug)) {
        return send(res, 400, { error: "This service has its own card on the Services page. Remove the card there first." });
      }
      const files = { [path]: null, [outPath(b.section, b.slug)]: null };
      if (b.section !== "page") {
        site.pages = site.pages.filter((p) => !(p.section === b.section && p.slug === b.slug));
        files[PAGES_JSON] = JSON.stringify(site, null, 1) + "\n";
      }
      /* send the old address to the section page (or the homepage), so links and Google don't hit a missing page */
      if (b.redirect !== false) {
        const v = await readVercel(head), list = redirectList(v), from = pagePath(b.section, b.slug);
        const to = b.section === "page" ? "/" : "/" + b.section;
        if (!list.some((r) => r.from === from)) { list.push({ from, to, permanent: true }); files[VERCEL_JSON] = vercelWith(v, list); }
      }
      await save(files, "delete page " + b.section + "/" + b.slug, true);
      return send(res, 200, { ok: true });
    }

    if (b.action === "hubs") {
      for (const sec of ["services", "industries", "guides", "news", "locations"]) {
        const h = (b.hubs || {})[sec];
        if (h) site.hubs[sec] = { title: str(h.title, 300), h1: str(h.h1, 300), lead: str(h.lead, 1500), desc: str(h.desc, 400) };
      }
      if (Array.isArray(b.service_cards)) {
        site.service_cards = site.service_cards.map((c, i) => {
          const x = b.service_cards[i] || {};
          return { ...c, label: str(x.label ?? c.label, 60), title: str(x.title ?? c.title, 120), text: str(x.text ?? c.text, 400), button: str(x.button ?? c.button, 80),
            includes: (x.includes || c.includes).map((y, k) => ({ icon: ICONS.includes(y.icon) ? y.icon : (c.includes[k] || {}).icon || "target", text: str(y.text, 120) })).filter((y) => y.text.trim()) };
        });
      }
      if (Array.isArray(b.service_steps)) site.service_steps = b.service_steps.map((x) => ({ title: str(x.title, 120), text: str(x.text, 400) })).filter((x) => x.title.trim());
      await save({ [PAGES_JSON]: JSON.stringify(site, null, 1) + "\n" }, "section pages wording", true);
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "Unknown action" });
  } catch (e) {
    if (e.status === 409 || e.status === 422) return send(res, 409, { error: "The website changed while saving. Please try again." });
    send(res, e.status === 400 ? 400 : 500, { error: String(e.message || e) });
  }
}
