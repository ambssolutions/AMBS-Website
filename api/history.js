/* POST /api/history: what has been published from the editor, and undo.
   { action: "list" }
   { action: "undo", sha }   puts the files that publish changed back the way they were before it
   { action: "detail", sha } what that change changed, from what to what, in plain items (detail() below) */
import { requireEditor, send, readBody, headSha, commitFiles, can, NO_ACCESS, readEnglish } from "./_lib.js";

const REPO = process.env.GITHUB_REPO || "ambssolutions/AMBS-Website";
const GH = "https://api.github.com/repos/" + REPO;
async function gh(path) {
  const r = await fetch(GH + path, { headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } });
  if (!r.ok) throw Object.assign(new Error("GitHub " + r.status), { status: r.status });
  return r.json();
}
/* the editor's own saves; the workflow's rebuild commits are not listed */
const isEditor = (m) => /^(Website editor: |Editor source: |Editor draft: )/.test(m) && !/^Website editor: publish (scheduled )?pages/.test(m);
const SKIP = /^(version\.json)$/;

function describe(msg) {
  const first = msg.split("\n")[0];
  const m = /^(?:Website editor|Editor source|Editor draft): (.*?)(?: \(([^)]+)\))?$/.exec(first);
  return { text: m ? m[1] : first, who: m && m[2] ? m[2] : "", draft: first.startsWith("Editor draft:") };
}

/* ---------- "What changed" for one editor change ----------
   Each file the change touched is read as it was just before and just after, and compared:
   homepage wording (the English list in home.js) word list by key; the other languages only as "cleared for
   translation" / "translated"; JSON content (business details, menus, sections, pages list, chat helper, redirects…)
   value by value, list items matched by their slug/title/question; pages (META + article) field by field and
   paragraph by paragraph; pictures as added / replaced / removed. Built files and bookkeeping files are left out. */
async function raw(path, ref) {
  if (!ref) return null;
  const r = await fetch(GH + "/contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + ref, { headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github.raw", "X-GitHub-Api-Version": "2022-11-28" } });
  if (r.status === 404) return null;
  if (!r.ok) throw Object.assign(new Error("GitHub " + r.status), { status: r.status });
  return r.text();
}
const LANG = { zh: "Chinese", hi: "Hindi", pa: "Punjabi", mi: "Te reo Māori" };
const PIC = /\.(png|jpe?g|webp|gif|svg|ico|mp4|webm|pdf)$/i;
const NOISE = /^(version\.json|index\.html|assets\/.*\.(js|css|json)|site-src\/content\/(translation-status|ed-strings|legal-state|privacy-check)\.json|.*\.(md|py|mjs|yml))$/;
const isObj = (x) => x && typeof x === "object";
const idOf = (x) => isObj(x) ? (x.slug || x.id || x.key || x.q || x.title || x.name || x.label || x.text || x.from || x.href || null) : null;
const short = (v) => v == null ? "" : typeof v === "string" ? v : Array.isArray(v) ? v.map(short).join(" · ").slice(0, 400) : isObj(v) ? String(v.q || v.title || v.h1 || v.name || v.text || v.label || v.a || idOf(v) || JSON.stringify(v)).slice(0, 400) : String(v);
/* plain names for the files and fields the owner edits */
const GROUP = { site: "Business details", menus: "Menus", chatbot: "Chat helper", "home-sections": "Homepage sections", pages: "Pages list", "site-text": "Wording on every page", photos: "Photo descriptions", "email-signatures": "Email signatures", "wd-drawings": "What we do drawings", vercel: "Redirects" };
const FIELD = { h1: "Heading", title: "Title in Google", description: "Description in Google", lead: "Introduction", eyebrow: "Small label", takeaways: "In short", faqs: "Questions", q: "Question", a: "Answer", phone: "Phone", email: "Email", location: "Location", analytics_id: "Google Analytics ID", profiles: "Social profiles", related: "Related pages", image: "Photo", photo: "Photo", alt: "Photo description", draft: "Draft", publish_at: "Publish at", category: "Category", date: "Date", suggestions: "Quick questions", qa: "Your answers", also: "Other wordings", greeting: "Greeting", theme: "Colours & fonts", redirects: "Redirects", order: "Order", hidden: "Hidden sections", custom: "Your sections", drawer: "Phone menu", company: "Footer: company" };
const nice = (label) => String(label || "").split(" › ").map((x) => FIELD[x] || x.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())).join(" › ");
function jdiff(a, b, path, out) {
  if (out.length > 300 || JSON.stringify(a) === JSON.stringify(b)) return;
  if (Array.isArray(a) && Array.isArray(b)) {
    const ka = a.map(idOf), kb = b.map(idOf);
    if (ka.every((x) => x != null) && kb.every((x) => x != null) && new Set(ka).size === ka.length && new Set(kb).size === kb.length) {
      b.forEach((x, i) => { const j = ka.indexOf(kb[i]); if (j < 0) out.push({ label: path.concat(String(kb[i]).slice(0, 60)).join(" › "), kind: "added", to: short(x) }); else jdiff(a[j], x, path.concat(String(kb[i]).slice(0, 60)), out); });
      a.forEach((x, j) => { if (kb.indexOf(ka[j]) < 0) out.push({ label: path.concat(String(ka[j]).slice(0, 60)).join(" › "), kind: "removed", from: short(x) }); });
      const same = ka.filter((k) => kb.includes(k)), sameB = kb.filter((k) => ka.includes(k));
      if (same.join("\u0001") !== sameB.join("\u0001")) out.push({ label: path.join(" › ") || "Order", kind: "order", from: same.map(String).join(" · ").slice(0, 400), to: sameB.map(String).join(" · ").slice(0, 400) });
      return;
    }
    for (let i = 0; i < Math.max(a.length, b.length); i++) jdiff(a[i], b[i], path.concat("item " + (i + 1)), out);
    return;
  }
  if (isObj(a) && isObj(b) && !Array.isArray(a) && !Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) jdiff(a[k], b[k], path.concat(k), out);
    return;
  }
  out.push({ label: path.join(" › "), kind: a === undefined ? "added" : b === undefined ? "removed" : "changed", from: short(a), to: short(b) });
}
const strip = (h) => String(h || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "’").replace(/\s+/g, " ").trim();
function pageParts(t) {
  if (t == null) return { meta: null, blocks: [] };
  const m = /^<!--META\n([\s\S]*?)\n-->\n?/.exec(t);
  let meta = null; try { meta = m ? JSON.parse(m[1]) : null; } catch (e) {}
  const body = m ? t.slice(m[0].length) : t;
  const blocks = (body.match(/<(h[1-6]|p|li|blockquote|figcaption|td|th)[^>]*>[\s\S]*?<\/\1>|<img[^>]*>/gi) || []).map((x) => /^<img/i.test(x) ? "[photo " + ((/src="([^"]+)"/.exec(x) || [])[1] || "") + "]" : strip(x)).filter(Boolean);
  return { meta, blocks };
}
/* paragraphs: the longest common run kept, then removed / added / changed pairs */
function blockDiff(A, B, label, out) {
  const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0, gone = [], come = [];
  /* a removed and an added paragraph count as one changed paragraph only when they share most of their words */
  const words = (x) => new Set(String(x).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  const alike = (x, y) => { const A = words(x), B = words(y); if (!A.size || !B.size) return 0; let n = 0; A.forEach((w) => { if (B.has(w)) n++; }); return n / Math.max(A.size, B.size); };
  const flush = () => { const pairs = [];
    gone.forEach((g, gi) => come.forEach((c, ci) => { const s = alike(g, c); if (s >= 0.4) pairs.push([s, gi, ci]); }));
    pairs.sort((x, y) => y[0] - x[0]); const ug = new Set(), uc = new Set(), keep = [];
    pairs.forEach(([, gi, ci]) => { if (!ug.has(gi) && !uc.has(ci)) { ug.add(gi); uc.add(ci); keep.push([gi, ci]); } });
    keep.sort((x, y) => x[1] - y[1]).forEach(([gi, ci]) => out.push({ label, kind: "changed", from: gone[gi], to: come[ci] }));
    gone = gone.filter((_, i) => !ug.has(i)); come = come.filter((_, i) => !uc.has(i));
    gone.forEach((x) => out.push({ label, kind: "removed", from: x })); come.forEach((x) => out.push({ label, kind: "added", to: x })); gone = []; come = []; };
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { flush(); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) come.push(B[j++]);
    else gone.push(A[i++]);
  }
  flush();
}
async function detail(sha) {
  const c = await gh("/commits/" + sha), parent = c.parents[0] && c.parents[0].sha, items = [];
  /* only the files that hold the owner's content (built copies and code are left out) */
  const KEEP = /^(site-src\/content\/(?!(translation-status|ed-strings|legal-state|privacy-check)\.json).+|site-src\/assets\/(home\.js|i18n\/\w+\.json)|vercel\.json|assets\/uploads\/.+|[^/]+\.(png|jpe?g|webp|ico|svg))$/;
  const files = (c.files || []).filter((f) => KEEP.test(f.filename));
  for (const f of files.slice(0, 30)) {
    const p = f.filename, where = p.replace(/^site-src\/content\//, "").replace(/\.(json|html)$/, "");
    if (PIC.test(p)) { items.push({ group: "Pictures", label: p.replace(/^.*\//, ""), kind: f.status === "added" ? "added" : f.status === "removed" ? "removed" : "replaced", pic: f.status === "removed" ? "" : "/" + p }); continue; }
    const [a, b] = await Promise.all([f.status === "added" ? null : raw(f.previous_filename || p, parent), f.status === "removed" ? null : raw(p, c.sha)]);
    if (/site-src\/assets\/home\.js$/.test(p)) {
      let A = {}, B = {}; try { A = a ? readEnglish(a) : {}; } catch (e) {} try { B = b ? readEnglish(b) : {}; } catch (e) {}
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (A[k] !== B[k]) items.push({ group: "Homepage wording", key: k, label: k, kind: A[k] === undefined ? "added" : B[k] === undefined ? "removed" : "changed", from: A[k] || "", to: B[k] || "" });
      continue;
    }
    const lm = /site-src\/assets\/i18n\/(\w+)\.json$/.exec(p);
    if (lm) {
      let A = {}, B = {}; try { A = JSON.parse(a || "{}"); } catch (e) {} try { B = JSON.parse(b || "{}"); } catch (e) {}
      let cleared = 0, set = 0;
      for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (A[k] !== B[k]) { if (!B[k]) cleared++; else set++; }
      if (cleared || set) items.push({ group: "Translations", label: LANG[lm[1]] || lm[1], kind: "note", to: [set ? set + " line" + (set === 1 ? "" : "s") + " translated" : "", cleared ? cleared + " line" + (cleared === 1 ? "" : "s") + " waiting for translation (visitors see the English meanwhile)" : ""].filter(Boolean).join(" · ") });
      continue;
    }
    if (/\.json$/.test(p)) {
      let A, B; try { A = a ? JSON.parse(a) : undefined; B = b ? JSON.parse(b) : undefined; } catch (e) { continue; }
      if (p === "vercel.json") { A = { redirects: (A || {}).redirects || [] }; B = { redirects: (B || {}).redirects || [] }; }   /* only the owner's redirects, not the technical headers */
      const out = []; jdiff(A, B, [], out);
      out.forEach((x) => items.push(Object.assign({}, x, { group: GROUP[where] || nice(where), label: nice(x.label) || GROUP[where] || where })));
      continue;
    }
    if (/^site-src\/content\/.+\.html$/.test(p)) {
      const A = pageParts(a), B = pageParts(b), out = [];
      if (!a) out.push({ label: "Page", kind: "added", to: (B.meta && (B.meta.h1 || B.meta.title)) || where });
      else if (!b) out.push({ label: "Page", kind: "removed", from: (A.meta && (A.meta.h1 || A.meta.title)) || where });
      else { jdiff(A.meta || {}, B.meta || {}, [], out); blockDiff(A.blocks, B.blocks, "Article text", out); }
      const name = ((B.meta || A.meta || {}).h1) || where.replace(/^.*\//, "");
      out.forEach((x) => items.push(Object.assign({}, x, { group: "Page: " + name, label: nice(x.label) || "Page" })));
    }
  }
  return { items: items.slice(0, 300), more: items.length > 300, files: (c.files || []).length };
}

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    if (b.action === "list") {
      const commits = await gh("/commits?sha=main&per_page=60");
      const items = commits.filter((c) => isEditor(c.commit.message)).slice(0, 40).map((c) => ({ sha: c.sha, date: c.commit.author.date, ...describe(c.commit.message) }));
      return send(res, 200, { items });
    }
    if (b.action === "detail") {
      if (!/^[0-9a-f]{40}$/.test(b.sha || "")) return send(res, 400, { error: "Unknown change" });
      return send(res, 200, await detail(b.sha));
    }
    if (b.action === "undo") {
      if (!/^[0-9a-f]{40}$/.test(b.sha || "")) return send(res, 400, { error: "Unknown change" });
      const c = await gh("/commits/" + b.sha);
      if (!isEditor(c.commit.message)) return send(res, 400, { error: "Only editor changes can be undone here" });
      const parent = c.parents[0].sha;
      const head = await headSha();
      const parentTree = await gh("/git/trees/" + parent + "?recursive=1");
      const headTree = await gh("/git/trees/" + head + "?recursive=1");
      const before = new Map(parentTree.tree.filter((x) => x.type === "blob").map((x) => [x.path, x.sha]));
      const now = new Map(headTree.tree.filter((x) => x.type === "blob").map((x) => [x.path, x.sha]));
      const files = {}, changedSince = [];
      for (const f of c.files) {
        if (SKIP.test(f.filename)) continue;
        if ((now.get(f.filename) || null) !== (f.status === "removed" ? null : f.sha)) changedSince.push(f.filename);
        const old = before.get(f.filename);
        files[f.filename] = old ? { sha: old } : null;
      }
      if (changedSince.length && !b.force) {
        return send(res, 409, { error: "Some of these files were changed again later, so undoing could also undo those later changes.", files: changedSince });
      }
      await commitFiles(head, files, "Editor source: undo “" + describe(c.commit.message).text + "” (" + who.email + ")");
      return send(res, 200, { ok: true });
    }
    send(res, 400, { error: "Unknown action" });
  } catch (e) {
    if (e.status === 409 || e.status === 422) return send(res, 409, { error: "The website changed while saving. Please try again." });
    send(res, 500, { error: String(e.message || e) });
  }
}

export { detail };   // used by the local test harness only
