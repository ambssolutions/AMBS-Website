/* POST /api/settings: business details and the hours calculator.
   { action: "get" }
   { action: "business", phone, email, location }   changes them everywhere on the site
   { action: "calculator", hours: { cafe: [3, 2.5, 1.5], ... } }
   { action: "analytics", id: "G-XXXXXXX" }   the Google Analytics measurement ID (empty turns it off)
   { action: "sitetext", text: { "cta.h": "...", ... } }   the wording on every page other than the homepage
   { action: "chatget" } / { action: "chatbot", data: {...} }   the "Ask us" chat helper (site-src/content/chatbot.json)
   { action: "chatlog", limit } / { action: "chatlogset", ids: [...], done: true|false, del: true } / { action: "chatlogset", ids, note }
       the questions visitors typed into the chat (Supabase table chat_questions, read through admin-only functions) */
import { SITE_TEXT_JSON, SITE_TEXT_GROUPS, SITE_TEXT_KEYS } from "./_sitetext.js";
import { requireEditor, sbRpc, send, readBody, headSha, readFile, commitFiles, listPaths, readBlob, readEnglish, stampHash, nextVersion } from "./_lib.js";

const SITE_JSON = "site-src/content/site.json";
const CHAT_JSON = "site-src/content/chatbot.json";
const TEXT = /\.(html|js|json|py|xml|txt|webmanifest|css|md)$/i;
const SKIP = /^(api\/|\.github\/|node_modules\/|package(-lock)?\.json$|version\.json$|admin\.html$|CLAUDE\.md$|README\.md$|site-src\/content\/site\.json$|site-src\/content\/translation-status\.json$)/;
const BIZ_RE = /\{id:"([a-z]+)",\s*tasks:\[((?:\["[^"]+",[0-9.]+\],?)+)\]\}/g;

function readBiz(js) {
  const out = [];
  for (const m of js.matchAll(BIZ_RE)) {
    out.push({ id: m[1], tasks: [...m[2].matchAll(/\["([^"]+)",([0-9.]+)\]/g)].map((t) => ({ key: t[1], hours: parseFloat(t[2]) })) });
  }
  return out;
}

const tel = (p) => p.replace(/[^\d+]/g, "");

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    const head = await headSha();
    const by = " (" + who.email + ")";
    const details = JSON.parse((await readFile(SITE_JSON, head)).text);
    const js = (await readFile("site-src/assets/home.js", head)).text;

    if (b.action === "get") {
      const en = readEnglish(js);
      const biz = readBiz(js).map((x) => ({ ...x, name: en["biz." + x.id] || x.id, tasks: x.tasks.map((t) => ({ ...t, name: en[t.key] || t.key })) }));
      const st = await readFile(SITE_TEXT_JSON, head);
      const text = st ? JSON.parse(st.text) : {};
      const sitetext = SITE_TEXT_GROUPS.map((g) => ({ name: g.name, items: g.items.map(([key, label, long]) => ({ key, label, long: !!long, text: text[key] ?? "" })) }));
      return send(res, 200, { business: details, calculator: biz, sitetext });
    }

    if (b.action === "business") {
      const next = {
        phone: String(b.phone || "").trim(),
        email: String(b.email || "").trim(),
        location: String(b.location || "").trim(),
      };
      if (!/^\+?[\d ()-]{7,20}$/.test(next.phone)) return send(res, 400, { error: "Enter the phone number with digits and spaces, like +64 22 099 9578" });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email)) return send(res, 400, { error: "That email address doesn't look right" });
      if (!next.location || next.location.length > 60) return send(res, 400, { error: "Enter a short location, like Auckland, NZ" });
      const swaps = [];
      if (next.phone !== details.phone) swaps.push([details.phone, next.phone], [tel(details.phone), tel(next.phone)]);
      if (next.email !== details.email) swaps.push([details.email, next.email]);
      if (next.location !== details.location) swaps.push([details.location, next.location]);
      if (!swaps.length) return send(res, 400, { error: "Nothing has changed" });
      const files = { [SITE_JSON]: JSON.stringify({ ...details, ...next }, null, 1) + "\n" };
      const paths = (await listPaths(head)).filter((f) => TEXT.test(f.path) && !SKIP.test(f.path) && f.size < 600000);
      let changed = 0;
      await Promise.all(paths.map(async (f) => {
        const text = await readBlob(f.sha);
        if (!swaps.some(([a]) => text.includes(a))) return;
        let out = text;
        for (const [a, z] of swaps) out = out.split(a).join(z);
        files[f.path] = out;
        changed++;
      }));
      await commitFiles(head, files, "Editor source: business details" + by);
      return send(res, 200, { ok: true, files: changed });
    }

    if (b.action === "analytics") {
      const id = String(b.id || "").trim().toUpperCase();
      if (id && !/^G-[A-Z0-9]{4,}$/.test(id)) return send(res, 400, { error: "The measurement ID starts with G-, like G-AB12CD34EF" });
      if (id === (details.analytics_id || "")) return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [SITE_JSON]: JSON.stringify({ ...details, analytics_id: id }, null, 1) + "\n" }, "Editor source: Google Analytics" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "sitetext") {
      const st = await readFile(SITE_TEXT_JSON, head);
      const text = st ? JSON.parse(st.text) : {};
      const next = { ...text };
      for (const k of SITE_TEXT_KEYS) {
        if (!b.text || typeof b.text[k] !== "string") continue;
        const v = b.text[k].replace(/\s+/g, " ").trim().slice(0, 400);
        if (!v) return send(res, 400, { error: "Every line needs some wording" });
        next[k] = v;
      }
      if (JSON.stringify(next) === JSON.stringify(text)) return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [SITE_TEXT_JSON]: JSON.stringify(next, null, 1) + "\n" }, "Editor source: wording on every page" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "chatlog") {
      const rows = await sbRpc(who.token, "chat_questions_list", { p_limit: Math.min(2000, Math.max(1, Number(b.limit) || 500)) });
      return send(res, 200, { rows: rows || [] });
    }
    if (b.action === "chatlogset") {
      const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 2000);
      if (!ids.length) return send(res, 400, { error: "Nothing chosen" });
      /* an answer was added or linked: mark it answered and keep what the chat will reply next time */
      if (!b.del && typeof b.note === "string" && b.note.trim()) {
        const n = await sbRpc(who.token, "chat_questions_note", { p_ids: ids, p_note: b.note.replace(/\s+/g, " ").trim().slice(0, 600) });
        return send(res, 200, { ok: true, changed: n });
      }
      const n = await sbRpc(who.token, "chat_questions_update", { p_ids: ids, p_done: b.del ? null : !!b.done, p_delete: !!b.del });
      return send(res, 200, { ok: true, changed: n });
    }

    if (b.action === "chatget") {
      const f = await readFile(CHAT_JSON, head);
      return send(res, 200, { chat: f ? JSON.parse(f.text) : {} });
    }

    if (b.action === "chatbot") {
      const f = await readFile(CHAT_JSON, head);
      const old = f ? JSON.parse(f.text) : {};
      const d = b.data || {};
      const str = (v, max) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
      const labels = {}, chat = {};
      for (const [k, v] of Object.entries(old.chat || {})) chat[k] = str(d.chat && typeof d.chat[k] === "string" ? d.chat[k] : v, 400) || v;
      for (const [k, v] of Object.entries(old.labels || {})) labels[k] = str(d.labels && typeof d.labels[k] === "string" ? d.labels[k] : v, 200) || v;
      const link = (v) => { v = str(v, 300); return /^(\/|https?:\/\/|mailto:|tel:|#)/.test(v) || !v ? v : "/" + v.replace(/^\/+/, ""); };
      const qa = (Array.isArray(d.qa) ? d.qa : []).map((x, i) => ({
        id: str(x.id, 40) || "q" + Date.now().toString(36) + i, q: str(x.q, 200), also: str(x.also, 2000), a: str(x.a, 1500), link: link(x.link), link_label: str(x.link_label, 60),
      })).filter((x) => x.q && x.a).slice(0, 250);
      const next = {
        enabled: d.enabled !== false, name: str(d.name, 60) || old.name || "Ambs helper",
        greeting: str(d.greeting, 400) || old.greeting, suggestions: (Array.isArray(d.suggestions) ? d.suggestions : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 6),
        not_found: str(d.not_found, 400) || old.not_found,
        nudge: { enabled: !(d.nudge && d.nudge.enabled === false), open: !(d.nudge && d.nudge.open === false), delay: Math.min(600, Math.max(5, Math.round(Number(d.nudge && d.nudge.delay) || 15))), text: str(d.nudge && d.nudge.text, 200) || (old.nudge && old.nudge.text) || "" },
        chat, labels, qa,
      };
      /* keep a list of the questions visitors ask (on unless switched off) */
      if (d.log === false || old.log === false) next.log = d.log !== false;
      /* "People also ask" buttons after an answer (on unless switched off) */
      if (d.related === false || old.related === false) next.related = d.related !== false;
      if (JSON.stringify(next) === JSON.stringify(old)) return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [CHAT_JSON]: JSON.stringify(next, null, 1) + "\n" }, "Editor source: chat helper" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "calculator") {
      const hours = b.hours || {};
      let bad = false;
      const out = js.replace(BIZ_RE, (all, id, tasks) => {
        const h = hours[id];
        if (!Array.isArray(h)) return all;
        let i = 0;
        const nt = tasks.replace(/\["([^"]+)",([0-9.]+)\]/g, (t, key, old) => {
          const v = Number(h[i++]);
          if (!(v >= 0 && v <= 40)) { bad = true; return t; }
          return '["' + key + '",' + (Math.round(v * 10) / 10).toFixed(1) + "]";
        });
        return all.replace(tasks, nt);
      });
      if (bad) return send(res, 400, { error: "Hours must be between 0 and 40" });
      if (out === js) return send(res, 400, { error: "Nothing has changed" });
      const index = (await readFile("index.html", head)).text.replace(/home\.js\?v=[A-Za-z0-9]+/g, "home.js?v=" + stampHash(out));
      if (b.preview) return send(res, 200, { html: index, js: out });
      await commitFiles(head, {
        "site-src/assets/home.js": out, "assets/home.js": out, "index.html": index, "version.json": await nextVersion(head),
      }, "Website editor: calculator hours" + by);
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "Unknown action" });
  } catch (e) {
    if (e.status === 409 || e.status === 422) return send(res, 409, { error: "The website changed while saving. Please try again." });
    send(res, 500, { error: String(e.message || e) });
  }
}
