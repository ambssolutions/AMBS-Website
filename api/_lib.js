/* Shared helpers for the website editor (/admin).
   Files starting with "_" in api/ are not deployed as their own endpoints. */
import crypto from "node:crypto";
import { applyOps } from "./_home.js";

export const LANGS = ["zh", "hi", "pa", "mi"];
const SUPABASE_URL = process.env.SUPABASE_URL || "https://onunconxcvkwowtgalxn.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_xahs0OqyRaBptSTSvR3Vgg_ZtvsFX2U";
const REPO = process.env.GITHUB_REPO || "ambssolutions/AMBS-Website";
const BRANCH = process.env.GITHUB_BRANCH || "main";
const GH = "https://api.github.com/repos/" + REPO;

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/* Only signed-in people whose email is on ADMIN_EMAILS (or ADMIN_EMAIL) may use the editor. */
export async function requireEditor(req, res) {
  if (req.method !== "POST") { send(res, 405, { error: "Use POST" }); return null; }
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) { send(res, 401, { error: "Please sign in" }); return null; }
  const r = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token },
  });
  if (!r.ok) { send(res, 401, { error: "Your sign-in has expired. Please sign in again." }); return null; }
  const user = await r.json();
  const allowed = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const email = String(user.email || "").toLowerCase();
  if (!allowed.includes(email)) { send(res, 403, { error: "This account is not allowed to edit the website." }); return null; }
  return { email };
}

async function gh(path, init = {}) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is not set in Vercel");
  const r = await fetch(GH + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + process.env.GITHUB_TOKEN,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!r.ok) {
    const err = new Error("GitHub " + r.status + ": " + (await r.text()).slice(0, 300));
    err.status = r.status;
    throw err;
  }
  return r.json();
}

/* The files the editor reads and writes, as they are on the live branch right now. */
export const FILES = [
  "index.html",
  "site-src/assets/home.js",
  ...LANGS.map((l) => "site-src/assets/i18n/" + l + ".json"),
  "site-src/content/translation-status.json",
  "site-src/content/wd-drawings.json",
  "version.json",
];

export async function loadFiles() {
  const ref = await gh("/git/ref/heads/" + BRANCH);
  const head = ref.object.sha;
  const out = { head, files: {} };
  await Promise.all(FILES.map(async (p) => {
    try {
      const f = await gh("/contents/" + p.split("/").map(encodeURIComponent).join("/") + "?ref=" + head);
      out.files[p] = Buffer.from(f.content, "base64").toString("utf8");
    } catch (e) {
      if (e.status === 404) out.files[p] = null; else throw e;
    }
  }));
  return out;
}

/* One commit with every changed file, so the site redeploys once per publish.
   files: { path: "text" | { base64: "..." } | { sha: "<existing blob>" } | null }   null deletes the file. */
export async function commitFiles(baseHead, files, message) {
  const base = await gh("/git/commits/" + baseHead);
  const tree = [];
  for (const [path, content] of Object.entries(files)) {
    if (content === null) tree.push({ path, mode: "100644", type: "blob", sha: null });
    else if (typeof content === "object" && content.sha) tree.push({ path, mode: "100644", type: "blob", sha: content.sha });
    else if (typeof content === "object") {
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: content.base64, encoding: "base64" }) });
      tree.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    } else tree.push({ path, mode: "100644", type: "blob", content });
  }
  const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
  const commit = await gh("/git/commits", {
    method: "POST",
    body: JSON.stringify({ message, tree: t.sha, parents: [baseHead] }),
  });
  /* not forced: if someone else changed the site in the meantime, this fails instead of overwriting them */
  await gh("/git/refs/heads/" + BRANCH, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return commit.sha;
}

export async function headSha() {
  return (await gh("/git/ref/heads/" + BRANCH)).object.sha;
}

/* One file at a commit: { text, sha } or null when it doesn't exist. */
export async function readFile(path, ref) {
  try {
    const f = await gh("/contents/" + path.split("/").map(encodeURIComponent).join("/") + "?ref=" + ref);
    return { text: Buffer.from(f.content, "base64").toString("utf8"), sha: f.sha };
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

/* Every file path in the repository at a commit. */
export async function listPaths(ref) {
  const t = await gh("/git/trees/" + ref + "?recursive=1");
  return t.tree.filter((x) => x.type === "blob").map((x) => ({ path: x.path, sha: x.sha, size: x.size }));
}

export async function readBlob(sha) {
  const b = await gh("/git/blobs/" + sha);
  return Buffer.from(b.content, "base64").toString("utf8");
}

export function stampHash(text) {
  return md5_8(text);
}

/* ---------- reading and rewriting the homepage wording ---------- */

const EN_START = "const I18N = {\nen:{";

function enBlock(js) {
  const a = js.indexOf(EN_START);
  if (a < 0) throw new Error("English wording block not found in home.js");
  const start = a + EN_START.length;
  const end = js.indexOf("\n}", start);
  return { start, end };
}

const ENTRY = /"([A-Za-z0-9_.-]+)":("(?:[^"\\]|\\.)*")/g;

export function readEnglish(js) {
  const { start, end } = enBlock(js);
  const body = js.slice(start, end);
  const en = {};
  for (const m of body.matchAll(ENTRY)) en[m[1]] = JSON.parse(m[2]);
  return en;
}

function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const TAGGED = /<(\w+)([^>]*?)\sdata-i18n="([^"]+)"([^>]*)>([^<]*)<\/\1>/g;

/* Where each piece of wording sits on the page, so the editor can group it by section. */
export function readLayout(html) {
  const sections = [];
  const marks = [];
  for (const m of html.matchAll(/<(section|header|footer|main)\b([^>]*)>/g)) {
    const id = (m[2].match(/\sid="([^"]+)"/) || [])[1];
    marks.push({ at: m.index, id: id || m[1] });
  }
  const order = [];
  const where = {};
  for (const m of html.matchAll(TAGGED)) {
    const key = m[3];
    if (where[key]) continue;
    let sec = "page";
    for (const mk of marks) { if (mk.at < m.index) sec = mk.id; else break; }
    where[key] = sec;
    order.push(key);
    if (!sections.includes(sec)) sections.push(sec);
  }
  return { order, where, sections };
}

function md5_8(s) {
  return crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex").slice(0, 8);
}

/* Apply a set of edits to the source files. Pure: takes file text in, returns file text out.
   changes: { key: { en?, zh?, hi?, pa?, mi? } }  status: { key: { lang: "auto" | "reviewed" | "needs" } }
   "needs" marks a translation waiting for Claude to write it (see site-src/pending_translations.py). */
export function applyChanges(files, changes, status, ops) {
  let html = files["index.html"];
  let js = files["site-src/assets/home.js"];
  const tr = {};
  for (const l of LANGS) tr[l] = JSON.parse(files["site-src/assets/i18n/" + l + ".json"]);
  const st = files["site-src/content/translation-status.json"]
    ? JSON.parse(files["site-src/content/translation-status.json"]) : {};
  let drawings = files["site-src/content/wd-drawings.json"] ? JSON.parse(files["site-src/content/wd-drawings.json"]) : {};
  let drawingsChanged = false;
  if (ops && Object.keys(ops).length) {
    /* added and removed items, cards and tools; new wording shows in English until Claude translates it */
    const r = applyOps(html, js, drawings, ops);
    html = r.html; js = r.js;
    drawingsChanged = JSON.stringify(r.drawings) !== JSON.stringify(drawings);
    drawings = r.drawings;
    for (const k of r.newKeys) st[k] = Object.fromEntries(LANGS.map((l) => [l, "needs"]));
    for (const k of r.goneKeys) { delete st[k]; for (const l of LANGS) delete tr[l][k]; }
  }

  const en = readEnglish(js);
  for (const [key, ch] of Object.entries(changes)) {
    if (!(key in en)) throw new Error("Unknown wording key: " + key);
    if (typeof ch.en === "string" && ch.en !== en[key]) {
      const { start, end } = enBlock(js);
      const body = js.slice(start, end);
      let hits = 0;
      const nb = body.replace(ENTRY, (all, k) => {
        if (k !== key) return all;
        hits++;
        return '"' + k + '":' + JSON.stringify(ch.en);
      });
      if (hits !== 1) throw new Error("Could not update " + key + " in home.js");
      js = js.slice(0, start) + nb + js.slice(end);
      html = html.replace(TAGGED, (all, tag, a1, k, a2) =>
        k === key ? "<" + tag + a1 + ' data-i18n="' + k + '"' + a2 + ">" + escHtml(ch.en) + "</" + tag + ">" : all);
    }
    for (const l of LANGS) {
      /* a string sets the translation; null removes it, so that language shows the English until it is translated */
      if (typeof ch[l] === "string") tr[l][key] = ch[l];
      else if (ch[l] === null) delete tr[l][key];
    }
  }
  for (const [key, langs] of Object.entries(status || {})) {
    st[key] = { ...(st[key] || {}), ...langs };
  }

  const out = {};
  out["site-src/assets/home.js"] = js;
  out["assets/home.js"] = js;
  let i18nAll = "";
  for (const l of LANGS) {
    const text = JSON.stringify(tr[l]);
    out["site-src/assets/i18n/" + l + ".json"] = text;
    out["assets/i18n/" + l + ".json"] = text;
  }
  for (const l of [...LANGS].sort()) i18nAll += out["site-src/assets/i18n/" + l + ".json"];
  /* new version stamps so browsers fetch the new wording instead of a cached copy */
  html = html.replace(/home\.js\?v=[A-Za-z0-9]+/g, "home.js?v=" + md5_8(js));
  html = html.replace(/data-i18nv="[A-Za-z0-9]*"/g, 'data-i18nv="' + md5_8(i18nAll) + '"');
  out["index.html"] = html;
  out["site-src/content/translation-status.json"] = JSON.stringify(st, null, 1) + "\n";
  if (drawingsChanged) out["site-src/content/wd-drawings.json"] = JSON.stringify(drawings) + "\n";

  const ver = JSON.parse(files["version.json"]);
  ver.build = String((parseInt(ver.build, 10) || 0) + 1);
  ver.released = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  out["version.json"] = JSON.stringify(ver, null, 2) + "\n";
  return out;
}

/* version.json with the next build number. Bumping it makes returning visitors' browsers drop their offline copy. */
export async function nextVersion(ref) {
  const f = await readFile("version.json", ref);
  const v = JSON.parse(f.text);
  v.build = String((parseInt(v.build, 10) || 0) + 1);
  v.released = new Date().toLocaleDateString("en-CA", { timeZone: "Pacific/Auckland" });
  return JSON.stringify(v, null, 2) + "\n";
}

/* The article text comes from the editor's rich text box. Editors are trusted, but scripts,
   embedded frames, inline event handlers and javascript: links are still removed. */
export function cleanBody(html) {
  return String(html)
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(contenteditable|data-ed-[a-z-]+)(="[^"]*")?/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/<p>\s*(<br\s*\/?>)?\s*<\/p>/gi, "")
    .trim();
}

