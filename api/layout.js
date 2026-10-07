/* POST /api/layout: menus and the order of homepage sections.
   { action: "get" }
   { action: "menus", menus: { main, drawer, company, explore } }
   { action: "sections", order, hidden, custom: { id: section } }
   Both save page sources ("Editor source:"), so the GitHub workflow rebuilds and publishes the site. */
import { requireEditor, send, readBody, headSha, readFile, commitFiles, readEnglish } from "./_lib.js";
import { cleanSection } from "./_blocks.js";

const MENUS = "site-src/content/menus.json";
const SECS = "site-src/content/home-sections.json";
const NAMES = ["main", "drawer", "company", "explore"];
const LIMIT = { main: 6, drawer: 14, company: 10, explore: 10 };
const BUILT_IN = { automate: "What we do", transform: "Before & after", about: "About us", why: "Why us", how: "How it works", trust: "Trust strip", knowledge: "Guides", faq: "Questions", book: "Booking & contact form" };

function homeSections(html) {
  const a = html.indexOf("<!-- WHAT WE AUTOMATE: moving strip -->"), z = html.indexOf("</main>");
  const out = [];
  for (const m of html.slice(a, z).matchAll(/\n  <section\b([^>]*)>/g)) {
    const id = (/\sid="([^"]+)"/.exec(m[1]) || /class="([^" ]+)/.exec(m[1]))[1];
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    const head = await headSha();
    const by = " (" + who.email + ")";
    const menusF = await readFile(MENUS, head);
    const menus = menusF ? JSON.parse(menusF.text) : {};
    const secsF = await readFile(SECS, head);
    const secs = secsF ? JSON.parse(secsF.text) : { order: [], hidden: [], custom: {} };

    if (b.action === "get") {
      const en = readEnglish((await readFile("site-src/assets/home.js", head)).text);
      const html = (await readFile("index.html", head)).text;
      const present = homeSections(html);
      const order = [...(secs.order || []).filter((x) => present.includes(x) || (secs.custom || {})[x]), ...present.filter((x) => !(secs.order || []).includes(x))];
      for (const id of Object.keys(secs.custom || {})) if (!order.includes(id)) order.push(id);
      const label = (it) => (it.key && en[it.key]) || it.label || "";
      const m = {};
      for (const n of NAMES) m[n] = (menus[n] || []).map((it) => ({ ...it, label: label(it) }));
      return send(res, 200, { menus: m, limits: LIMIT, sections: { order, hidden: secs.hidden || [], custom: secs.custom || {}, names: BUILT_IN } });
    }

    if (b.action === "menus") {
      const next = { _about: menus._about || "Menus and footer links. Edited in the website editor (/admin)." };
      const en = readEnglish((await readFile("site-src/assets/home.js", head)).text);
      for (const n of NAMES) {
        const list = Array.isArray(b.menus?.[n]) ? b.menus[n] : menus[n] || [];
        if (list.length > LIMIT[n]) return send(res, 400, { error: "The " + (n === "main" ? "top menu" : n + " list") + " has room for " + LIMIT[n] + " links." });
        next[n] = list.map((it, i) => {
          const href = String(it.href || "").trim().slice(0, 300);
          if (!href || /^(javascript|data|vbscript):/i.test(href)) throw Object.assign(new Error("Every link needs an address"), { status: 400 });
          const label = String(it.label || "").trim().slice(0, 60);
          /* a link keeps its translated wording while its label is unchanged */
          if (it.key && en[it.key] && en[it.key] === label) return { href, key: it.key };
          if (!label) throw Object.assign(new Error("Every link needs a name"), { status: 400 });
          const id = /^[a-z0-9-]{1,40}$/.test(it.id || "") ? it.id : label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) + "-" + Date.now().toString(36).slice(-4) + i;
          return { href, label, id };
        });
      }
      await commitFiles(head, { [MENUS]: JSON.stringify(next, null, 1) + "\n" }, "Editor source: menus" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "sections") {
      const custom = {};
      for (const [id, sec] of Object.entries(b.custom || {})) {
        if (!/^c-[a-z0-9-]{1,40}$/.test(id)) return send(res, 400, { error: "Unknown section " + id });
        custom[id] = cleanSection(sec);
      }
      const known = new Set([...Object.keys(BUILT_IN), ...Object.keys(custom)]);
      const order = (b.order || []).filter((x) => known.has(x));
      const hidden = (b.hidden || []).filter((x) => known.has(x));
      if (Object.keys(BUILT_IN).every((x) => hidden.includes(x)) && !Object.keys(custom).some((x) => !hidden.includes(x))) return send(res, 400, { error: "Keep at least one section showing" });
      await commitFiles(head, { [SECS]: JSON.stringify({ order, hidden, custom }, null, 1) + "\n" }, "Editor source: homepage sections" + by);
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "Unknown action" });
  } catch (e) {
    if (e.status === 409 || e.status === 422) return send(res, 409, { error: "The website changed while saving. Please try again." });
    send(res, e.status === 400 ? 400 : 500, { error: String(e.message || e) });
  }
}
