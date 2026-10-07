/* POST /api/media: photos.
   { action: "list" }                                      uploaded photos
   { action: "upload", name, base64 }                      a WebP the editor already resized in the browser
   { action: "delete", path }
   { action: "logo", png, webp, png400, webp400 }          replace the logo (the editor renders each size)
   { action: "social", png }                               replace the picture shown when the site is shared
   { action: "icons", icon192, icon512, mask192, mask512, apple, fav }   replace the app and browser icons */
import { requireEditor, send, readBody, headSha, commitFiles, listPaths, readBlob, nextVersion } from "./_lib.js";

const DIR = "assets/uploads/";
const MAX = 3 * 1024 * 1024;

function bytes(b64) { return Math.floor(String(b64 || "").length * 3 / 4); }
function isWebp(b64) { const b = Buffer.from(String(b64).slice(0, 24), "base64"); return b.slice(0, 4).toString() === "RIFF" && b.slice(8, 12).toString() === "WEBP"; }
function isPng(b64) { return Buffer.from(String(b64).slice(0, 12), "base64").slice(1, 4).toString() === "PNG"; }

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    const head = await headSha();
    const by = " (" + who.email + ")";

    if (b.action === "list") {
      const all = await listPaths(head);
      const photos = all.filter((f) => f.path.startsWith(DIR) && /\.(webp|png|jpe?g)$/i.test(f.path))
        .map((f) => ({ path: f.path, url: "/" + f.path, size: f.size }));
      /* where each photo is used, so deleting one in use can warn first */
      const pages = all.filter((f) => /^site-src\/content\/.+\.html$/.test(f.path));
      const used = {};
      await Promise.all(pages.map(async (p) => {
        const text = await readBlob(p.sha);
        for (const ph of photos) if (text.includes(ph.url)) (used[ph.path] = used[ph.path] || []).push(p.path.replace("site-src/content/", "").replace(/\.html$/, ""));
      }));
      photos.forEach((p) => { p.usedOn = used[p.path] || []; });
      return send(res, 200, { photos });
    }

    if (b.action === "upload") {
      if (!isWebp(b.base64)) return send(res, 400, { error: "That photo could not be read. Try a JPG or PNG." });
      if (bytes(b.base64) > MAX) return send(res, 400, { error: "That photo is too large even after resizing." });
      const base = String(b.name || "photo").toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "photo";
      const path = DIR + base + "-" + Date.now().toString(36) + ".webp";
      await commitFiles(head, { [path]: { base64: b.base64 }, "version.json": await nextVersion(head) }, "Website editor: add photo " + path + by);
      return send(res, 200, { ok: true, path, url: "/" + path });
    }

    if (b.action === "delete") {
      if (!String(b.path || "").startsWith(DIR) || b.path.includes("..")) return send(res, 400, { error: "Only uploaded photos can be deleted" });
      await commitFiles(head, { [b.path]: null, "version.json": await nextVersion(head) }, "Website editor: remove photo " + b.path + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "logo") {
      for (const k of ["png", "png400"]) if (!isPng(b[k])) return send(res, 400, { error: "The logo could not be prepared. Try a PNG." });
      for (const k of ["webp", "webp400"]) if (!isWebp(b[k])) return send(res, 400, { error: "The logo could not be prepared. Try a PNG." });
      if (["png", "webp", "png400", "webp400"].some((k) => bytes(b[k]) > 800 * 1024)) return send(res, 400, { error: "That logo file is too large" });
      await commitFiles(head, {
        "logo.png": { base64: b.png }, "logo.webp": { base64: b.webp },
        "logo-400.png": { base64: b.png400 }, "logo-400.webp": { base64: b.webp400 },
        "version.json": await nextVersion(head),
      }, "Website editor: new logo" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "icons") {
      const keys = ["icon192", "icon512", "mask192", "mask512", "apple", "fav"];
      for (const k of keys) if (!isPng(b[k]) || bytes(b[k]) > 1024 * 1024) return send(res, 400, { error: "The icon could not be prepared. Try a PNG or JPG." });
      await commitFiles(head, {
        "icon-192-v4.png": { base64: b.icon192 }, "icon-512-v4.png": { base64: b.icon512 },
        "icon-192-maskable-v4.png": { base64: b.mask192 }, "icon-512-maskable-v4.png": { base64: b.mask512 },
        "apple-touch-icon-v4.png": { base64: b.apple },
        "favicon-light.png": { base64: b.fav }, "favicon-dark.png": { base64: b.fav },
        "version.json": await nextVersion(head),
      }, "Website editor: new app icon" + by);
      return send(res, 200, { ok: true });
    }

    if (b.action === "social") {
      if (!isPng(b.png)) return send(res, 400, { error: "The picture could not be prepared. Try a JPG or PNG." });
      if (bytes(b.png) > MAX) return send(res, 400, { error: "That picture is too large" });
      await commitFiles(head, { "og-image.png": { base64: b.png }, "version.json": await nextVersion(head) }, "Website editor: new sharing picture" + by);
      return send(res, 200, { ok: true });
    }

    send(res, 400, { error: "Unknown action" });
  } catch (e) {
    if (e.status === 409 || e.status === 422) return send(res, 409, { error: "The website changed while saving. Please try again." });
    send(res, 500, { error: String(e.message || e) });
  }
}
