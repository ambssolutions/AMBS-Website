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
import { requireEditor, send, readBody, headSha, readFile, commitFiles, cleanBody, listPaths, readEnglish } from "./_lib.js";
import { cleanBlocks } from "./_blocks.js";

const SECTIONS = ["guides", "industries", "services", "news", "legal"];
const LISTED = ["guides", "industries", "services", "news"];
const PAGES_JSON = "site-src/content/pages.json";
const ICONS = ["auto", "web", "cafe", "trades", "clinic", "retail", "adviser", "transport", "guide", "shield", "chart", "chat", "cal", "link", "invoice", "book", "target"];
/* addresses a page of its own can't take */
const RESERVED = new Set(["index", "admin", "api", "assets", "404", "booking-confirmed", "privacy", "terms", "services", "industries", "guides", "news", "invoice", "sitemap", "robots", "manifest", "sw", "version", "site-src", "logo", "favicon", "og-image"]);
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

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    const head = await headSha();
    const site = JSON.parse((await readFile(PAGES_JSON, head)).text);
    const by = " (" + who.email + ")";
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
      return send(res, 200, { now: nowNZ(), pages: site.pages, custom, legal, hubs: site.hubs, service_cards: site.service_cards, service_steps: site.service_steps, icons: ICONS });
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
        await save({ [src("page", slug)]: JSON.stringify(d, null, 1) + "\n" }, "new page /" + slug, false);
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
        meta.takeaways = (Array.isArray(st.takeaways) ? st.takeaways : []).slice(0, 12).map((x) => str(x, 200)).filter((x) => x.trim());
        meta.faq = (Array.isArray(st.faq) ? st.faq : []).slice(0, 20).map((x) => [str(x?.[0], 200), str(x?.[1], 400)]).filter((x) => x[0].trim() && x[1].trim());
        meta.related = (Array.isArray(st.related) ? st.related : []).map((x) => str(x, 120)).filter((x) => /^(guides|industries|services|news)\/[a-z0-9-]+$/.test(x)).slice(0, 3);
      }
      if (sec === "guides" || sec === "news") meta.published = meta.updated = today();
      const category = (st && str(st.category, 60).trim()) || (sec === "guides" ? "Getting started" : sec === "news" ? "News" : title);
      const icon = st && ICONS.includes(st.icon) ? st.icon : sec === "guides" || sec === "news" ? "guide" : "target";
      site.pages.push({ section: sec, slug, title, blurb: "", category, icon, draft: true });
      const body = (st && cleanBody(str(st.body, 60000))) || "<h2>" + title.replace(/[<&>]/g, "") + "</h2>\n<p>Start writing here.</p>";
      await save({
        [src(sec, slug)]: serialise(meta, body),
        [PAGES_JSON]: JSON.stringify(site, null, 1) + "\n",
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
      await save(files, "delete page " + b.section + "/" + b.slug, true);
      return send(res, 200, { ok: true });
    }

    if (b.action === "hubs") {
      for (const sec of ["services", "industries", "guides", "news"]) {
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
