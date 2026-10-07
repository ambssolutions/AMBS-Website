/* POST /api/settings: business details and the hours calculator.
   { action: "get" }
   { action: "business", phone, email, location }   changes them everywhere on the site
   { action: "calculator", hours: { cafe: [3, 2.5, 1.5], ... } } */
import { requireEditor, send, readBody, headSha, readFile, commitFiles, listPaths, readBlob, readEnglish, stampHash, nextVersion } from "./_lib.js";

const SITE_JSON = "site-src/content/site.json";
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
      return send(res, 200, { business: details, calculator: biz });
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
      const files = { [SITE_JSON]: JSON.stringify(next, null, 1) + "\n" };
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
