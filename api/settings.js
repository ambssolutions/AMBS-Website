/* POST /api/settings: business details and the hours calculator.
   { action: "get" }
   { action: "business", phone, email, location }   changes them everywhere on the site
   { action: "calculator", hours: { cafe: [3, 2.5, 1.5], ... } }
   { action: "analytics", id: "G-XXXXXXX" }   the Google Analytics measurement ID (empty turns it off)
   { action: "theme", theme: { blue, green, purple, heading_font, body_font, button_shape, button_size, button_style } }   Colours & fonts (empty = the AMBS originals)
   { action: "sitetext", text: { "cta.h": "...", ... } }   the wording on every page other than the homepage
   { action: "chatget" } / { action: "chatbot", data: {...} }   the "Ask us" chat helper (site-src/content/chatbot.json)
   { action: "chatlog", limit } / { action: "chatlogset", ids: [...], done: true|false, del: true } / { action: "chatlogset", ids, note } / { action: "chatlogset", ids, status: "skip"|"open", note }
       the questions visitors typed into the chat (Supabase table chat_questions, read through admin-only functions)
   { action: "test", test: "psi"|"security"|"cert"|"response"|"sharing"|"index", url, strategy }   Site health → Speed & security (see _tests.js)
   { action: "stats", days: 1|7|30|90|180|365 }   Insights → Stats: leads and chat questions (database function website_stats) and button clicks (Google Analytics events), each with the period before
   { action: "leads", days }   Insights → Leads: every website enquiry with its details (database function website_leads)
   { action: "conns" } / { action: "conn-save", svc: "ga"|"gsc"|"psi", values } / { action: "conn-remove", svc }   Website settings → Connections: keys kept in Supabase Vault (see _keys.js)
   { action: "visitors", days?, filter? } / { action: "searches", days } / { action: "seo", days }   who is on the website right now, or with days 7/28/90 the totals for that period, from Google Analytics Realtime (see _ga.js) */
import { visitorsNow, visitorsPeriod, searchQueries, seoReport, seoDetail, inspectUrl, statsEvents, gaCheck, submitSitemap, nzMidnight } from "./_ga.js";
import { loadKeys, keyFrom, KEY_NAMES, key } from "./_keys.js";
import { psi, security, cert, response, sharing, okUrl } from "./_tests.js";
import { SITE_TEXT_JSON, SITE_TEXT_GROUPS, SITE_TEXT_KEYS } from "./_sitetext.js";
import { requireEditor, sbRpc, send, readBody, headSha, readFile, commitFiles, listPaths, readBlob, readEnglish, stampHash, nextVersion, can, NO_ACCESS, PARTS, keyExpiry } from "./_lib.js";

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
    /* which part of the editor each action belongs to (see PARTS in _lib.js); "get" and "me" are for everyone signed in */
    const AREA = { stats: ["stats", "leads"], leads: "leads", visitors: "visitors", searches: ["visitors", "seo"], seo: "seo", "seo-detail": "seo", index: "seo", "index-requests": "seo", "index-mark": "seo", sitemap: "seo",
      conns: "owner", "conn-save": "owner", "conn-remove": "owner", editors: "owner", "editor-invite": "owner", "editor-role": "owner", "editor-remove": "owner", "level-set": "owner",
      test: ["health", "seo"], theme: "design", business: "business", profiles: "business", sitetext: "business", analytics: "business",
      chatlog: "chat", chatlogset: "chat", chatget: "chat", chatbot: "chat", calculator: "calc" }[b.action];
    if (AREA && !(AREA === "owner" ? who.role === "owner" : can(who, AREA))) return send(res, 403, { error: NO_ACCESS });
    if (b.action === "me") return send(res, 200, { email: who.email, role: who.role, realRole: who.realRole, viewAs: who.viewAs, areas: who.areas });
    if (b.action === "level-set") { await sbRpc(who.token, "website_level_set", { p_role: b.role === "writer" ? "writer" : "editor", p_areas: (Array.isArray(b.areas) ? b.areas : []).filter((x) => PARTS.includes(x)) }); return send(res, 200, { ok: true }); }
    if (b.action === "index-requests") return send(res, 200, { requests: (await sbRpc(who.token, "website_index_requests_list", {})) || [] });
    if (b.action === "index-mark") { await sbRpc(who.token, "website_index_request_mark", { p_url: String(b.url || ""), p_clear: !!b.clear }); return send(res, 200, { ok: true }); }
    if (b.action === "editors") return send(res, 200, { levels: (await sbRpc(who.token, "website_levels_list", {})) || [], editors: (await sbRpc(who.token, "website_editors_list", {})) || [], owners: (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean) });
    if (b.action === "editor-invite") {   // Website settings → Editors: a private one-time link the owner sends themselves (no email is sent from here)
      const t = await sbRpc(who.token, "website_editor_invite", { p_email: String(b.email || ""), p_name: String(b.name || ""), p_role: b.role === "writer" ? "writer" : "editor" });
      return send(res, 200, { ok: true, link: "https://ambs.co.nz/admin#invite=" + t });
    }
    if (b.action === "editor-role") { await sbRpc(who.token, "website_editor_set_role", { p_email: String(b.email || ""), p_role: b.role === "writer" ? "writer" : "editor" }); return send(res, 200, { ok: true }); }
    if (b.action === "editor-remove") { await sbRpc(who.token, "website_editor_remove", { p_email: String(b.email || "") }); return send(res, 200, { ok: true }); }
    await loadKeys(who, [].concat(AREA || [])[0]);
    if (b.action === "expiry") return send(res, 200, who.realRole === "owner" ? await keyExpiry(key("GA_SERVICE_ACCOUNT")) : {});   // Home's warning
    if (b.action === "stats") {
      /* 24 hours: the last 24 hours; longer: whole days ending yesterday (New Zealand time), the same days as Google Analytics' own "Last 7 days" */
      const days = [1, 7, 30, 90, 180, 365].includes(+b.days) ? +b.days : 7, span = days * 86400000;
      const to = days === 1 ? new Date() : nzMidnight(0), from = days === 1 ? new Date(to - span) : nzMidnight(days), pfrom = days === 1 ? new Date(to - 2 * span) : nzMidnight(2 * days);
      const [cur, prev, ev] = await Promise.all([
        sbRpc(who.token, "website_stats", { p_from: from.toISOString(), p_to: to.toISOString() }).catch((e) => ({ error: e.message })),
        sbRpc(who.token, "website_stats", { p_from: pfrom.toISOString(), p_to: from.toISOString() }).catch((e) => ({ error: e.message })),
        statsEvents(days).catch((e) => ({ error: e.message })),
      ]);
      const missing = (x) => x && x.error && /website_stats|PGRST202|404/.test(x.error);
      return send(res, 200, { days, from: from.toISOString(), to: to.toISOString(), leads: cur, leadsBefore: prev, events: ev, needsDb: missing(cur) });
    }
    if (b.action === "leads") {   // Insights → Leads: every website enquiry in the period with what they filled in (database function website_leads)
      const days = [1, 7, 30, 90, 180, 365].includes(+b.days) ? +b.days : 30, to = new Date(), from = new Date(to - days * 86400000);
      try { return send(res, 200, { days, rows: (await sbRpc(who.token, "website_leads", { p_from: from.toISOString(), p_to: to.toISOString() })) || [] }); }
      catch (e) { return send(res, 200, { days, rows: [], error: /website_leads|PGRST202|404/.test(e.message) ? "needsDb" : e.message }); }
    }
    if (b.action === "conns") {
      let saved = [], vault = true;
      try { saved = (await sbRpc(who.token, "site_secret_status", {})) || []; } catch (e) { vault = false; }
      const by = Object.fromEntries(saved.map((r) => [r.name, r]));
      /* a key kept in Vercel shows which account it is too: the property number, the service account's email, the Search Console site, a key's last 4 */
      const vHint = (n) => { const v = String(process.env[n] || ""); if (!v) return "";
        if (n === "GA_SERVICE_ACCOUNT") { try { return JSON.parse(v).client_email || ""; } catch (e) { return ""; } }
        return n === "PAGESPEED_KEY" ? "••••" + v.slice(-4) : v.slice(0, 80); };
      const keys = Object.fromEntries(KEY_NAMES.map((n) => [n, { from: keyFrom(n), hint: keyFrom(n) === "vercel" ? vHint(n) : by[n] ? by[n].hint : "", at: by[n] ? by[n].updated_at : "", note: by[n] ? String(by[n].note || "").replace(/^by\s*/, "") : "" }]));
      const sb = { project: (process.env.SUPABASE_URL || "https://onunconxcvkwowtgalxn.supabase.co").replace(/^https:\/\/|\.supabase\.co.*$/g, ""), ok: false, ms: 0 };
      try { const t0 = Date.now(); await sbRpc(who.token, "website_editor_ok", {}); sb.ok = true; sb.ms = Date.now() - t0; } catch (e) { sb.error = e.message.slice(0, 120); }
      const expiry = await keyExpiry(key("GA_SERVICE_ACCOUNT")).catch(() => ({}));
      return send(res, 200, { vault, keys, github: !!process.env.GITHUB_TOKEN, supabase: sb, expiry });
    }
    if (b.action === "conn-save" || b.action === "conn-remove") {
      const SVC = { ga: ["GA_PROPERTY_ID", "GA_SERVICE_ACCOUNT"], gsc: ["GSC_SITE"], psi: ["PAGESPEED_KEY"] }[b.svc];
      if (!SVC) return send(res, 400, { error: "Unknown connection." });
      const put = (n, v) => sbRpc(who.token, "site_secret_set", { p_name: n, p_value: v });
      try {
        if (b.action === "conn-remove") { for (const n of SVC) await put(n, ""); return send(res, 200, { ok: true }); }
        let v = b.values && typeof b.values === "object" ? b.values : {};
        if (b.fromVercel) { v = {}; for (const n of SVC) if (process.env[n]) v[n] = process.env[n];   // copied on the server, never sent to the browser
          if (!Object.keys(v).length) return send(res, 200, { error: "Vercel has no keys for this connection." }); }
        const val = (n) => String(v[n] == null ? "" : v[n]).trim();
        let note = "";
        if (b.svc === "ga") {
          const id = val("GA_PROPERTY_ID").replace(/\D/g, "") || String(key("GA_PROPERTY_ID")).replace(/\D/g, "");
          const raw = val("GA_SERVICE_ACCOUNT") || key("GA_SERVICE_ACCOUNT");
          if (!/^\d{6,12}$/.test(id)) return send(res, 200, { error: "The property number is the long number in Analytics → Admin → Property details (not the G- ID)." });
          if (!raw) return send(res, 200, { error: "Paste the service account's JSON key." });
          note = await gaCheck(id, raw).catch((e) => { throw Object.assign(e, { soft: true }); });
          await put("GA_PROPERTY_ID", id);
          if (val("GA_SERVICE_ACCOUNT")) await put("GA_SERVICE_ACCOUNT", JSON.stringify(JSON.parse(raw)));
        } else if (b.svc === "gsc") {
          const site = val("GSC_SITE");
          if (site && !/^(sc-domain:[a-z0-9.-]+\.[a-z]{2,}|https:\/\/[a-z0-9.-]+\.[a-z]{2,}\/)$/i.test(site)) return send(res, 200, { error: "Use sc-domain:ambs.co.nz, or the address with a slash at the end, like https://ambs.co.nz/" });
          await put("GSC_SITE", site);
          note = site ? "Search Console will use " + site : "Back to trying sc-domain:ambs.co.nz, then the https addresses";
        } else if (b.svc === "psi") {
          const k = val("PAGESPEED_KEY");
          if (!/^AIza[0-9A-Za-z_-]{35}$/.test(k)) return send(res, 200, { error: "A Google API key starts with AIza and is 39 characters long." });
          await put("PAGESPEED_KEY", k);
          note = "Saved. The next speed test in Site health → Speed & security uses it.";
        }
        return send(res, 200, { ok: true, note });
      } catch (e) { return send(res, 200, { error: e.soft ? e.message : /site_secret|PGRST202|404/.test(e.message) ? "Connections need the database update first." : e.message }); }
    }
    if (b.action === "seo-detail") return send(res, 200, await seoDetail(b.days, b.query, b.page));   // Google search: one keyword or page in detail
    if (b.action === "searches") return send(res, 200, await searchQueries(b.days));   // Google search words, from Search Console
    if (b.action === "test") {   // one speed or security test on a public ambs.co.nz page; read-only
      const u = okUrl(b.url || "https://ambs.co.nz/");
      if (!u) return send(res, 400, { error: "Only pages on https://ambs.co.nz can be tested." });
      const run = { psi: () => psi(u, b.strategy), security, cert, response: () => response(u), sharing: () => sharing(u), index: () => inspectUrl(u) }[b.test];
      if (!run) return send(res, 400, { error: "Unknown test." });
      return send(res, 200, await run());
    }
    if (b.action === "seo") return send(res, 200, await seoReport(b.days));
    if (b.action === "sitemap") return send(res, 200, await submitSitemap());   // Google search (SEO) → On Google → Send sitemap to Google   // the SEO page: Search Console and the site's own basics
    if (b.action === "visitors") {   // live, from Google Analytics; nothing read from GitHub. filter: { f, v } narrows it to one page, source, town or device
      const f = b.filter && typeof b.filter === "object" ? { f: String(b.filter.f || ""), v: String(b.filter.v || "").slice(0, 300) } : null;
      return send(res, 200, b.days ? await visitorsPeriod(b.days, f) : await visitorsNow(f));
    }   // live, from Google Analytics; nothing read from GitHub
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

    if (b.action === "profiles") {
      const list = [].concat(b.profiles || []).map((u) => String(u || "").trim()).filter(Boolean).slice(0, 12);
      const bad = list.find((u) => !/^https:\/\/[^\s"<>]+$/.test(u));
      if (bad) return send(res, 400, { error: "Each profile must be a full link starting with https://" });
      if (JSON.stringify(list) === JSON.stringify(details.profiles || [])) return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [SITE_JSON]: JSON.stringify({ ...details, profiles: list }, null, 1) + "\n" }, "Editor source: social profiles" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "analytics") {
      const id = String(b.id || "").trim().toUpperCase();
      if (id && !/^G-[A-Z0-9]{4,}$/.test(id)) return send(res, 400, { error: "The measurement ID starts with G-, like G-AB12CD34EF" });
      if (id === (details.analytics_id || "")) return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [SITE_JSON]: JSON.stringify({ ...details, analytics_id: id }, null, 1) + "\n" }, "Editor source: Google Analytics" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "theme") {   // Colours & fonts: three brand colours and two fonts, applied to every page by build.py (theme_css / theme_head)
      const hex = (v) => (/^#[0-9a-fA-F]{6}$/.test(String(v || "")) ? String(v).toUpperCase() : "");
      const FONTS = ["Inter", "Poppins", "Montserrat", "DM Sans", "Plus Jakarta Sans", "Manrope", "Outfit", "Nunito", "Lato", "Open Sans", "Raleway", "Work Sans", "Space Grotesk", "Sora", "Playfair Display", "Merriweather", "Lora"];
      const font = (v) => (FONTS.includes(String(v || "")) ? String(v) : "");
      const t = b.theme || {};
      const one = (v, list) => (list.includes(String(v || "")) ? String(v) : "");
      const theme = { blue: hex(t.blue), green: hex(t.green), purple: hex(t.purple), heading_font: font(t.heading_font), body_font: font(t.body_font),
        button_shape: one(t.button_shape, ["rounded", "square"]), button_size: one(t.button_size, ["small", "large"]), button_style: one(t.button_style, ["flat", "raised"]) };
      Object.keys(theme).forEach((k) => { if (!theme[k]) delete theme[k]; });
      const next = { ...details };
      if (Object.keys(theme).length) next.theme = theme; else delete next.theme;
      if (JSON.stringify(next.theme || {}) === JSON.stringify(details.theme || {})) return send(res, 400, { error: "Nothing has changed" });
      await commitFiles(head, { [SITE_JSON]: JSON.stringify(next, null, 1) + "\n" }, "Editor source: colours and fonts" + by);
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
      /* won't answer (with a reason), or back to Not answered (clears any note) */
      if (!b.del && (b.status === "skip" || b.status === "open")) {
        const n = await sbRpc(who.token, "chat_questions_mark", { p_ids: ids, p_status: b.status, p_note: typeof b.note === "string" && b.note.trim() ? b.note.replace(/\s+/g, " ").trim().slice(0, 600) : null });
        return send(res, 200, { ok: true, changed: n });
      }
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
        greeting: str(d.greeting, 400) || old.greeting, suggestions: (Array.isArray(d.suggestions) ? d.suggestions : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 7),
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
