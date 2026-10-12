/* POST /api/signatures: saved email signatures for the signature builder (/email-signature).
   { action: "list" }                         names and dates, newest first
   { action: "get", id }                      one signature's settings
   { action: "save", id?, name, state }       new (no id) or update; returns { id }
   { action: "delete", id }
   They live in site-src/content/email-signatures.json (not published on the website). Saves are
   "Editor draft:" commits, so they never start a website build. */
import crypto from "node:crypto";
import { requireEditor, send, readBody, headSha, readFile, commitFiles } from "./_lib.js";

const FILE = "site-src/content/email-signatures.json";
const MAX = 1.5 * 1024 * 1024;

async function load(head) {
  const f = await readFile(FILE, head);
  if (!f) return { signatures: [] };
  try { const d = JSON.parse(f.text); return Array.isArray(d.signatures) ? d : { signatures: [] }; } catch (e) { return { signatures: [] }; }
}

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    const head = await headSha();
    const data = await load(head);

    if (b.action === "list") {
      const list = data.signatures.map((s) => ({ id: s.id, name: s.name, updated: s.updated, by: s.by }))
        .sort((x, y) => String(y.updated).localeCompare(String(x.updated)));
      return send(res, 200, { signatures: list });
    }

    if (b.action === "get") {
      const s = data.signatures.find((x) => x.id === b.id);
      if (!s) return send(res, 404, { error: "That signature isn’t saved any more." });
      return send(res, 200, { id: s.id, name: s.name, state: s.state });
    }

    if (b.action === "save") {
      const name = String(b.name || "").trim().slice(0, 80) || "My signature";
      if (!b.state || typeof b.state !== "object") return send(res, 400, { error: "Nothing to save" });
      if (JSON.stringify(b.state).length > MAX) return send(res, 400, { error: "This signature is too large to save. Put uploaded pictures online first (Copy and use → Put it online for me)." });
      const now = new Date().toISOString();
      let s = b.id && data.signatures.find((x) => x.id === b.id);
      if (s) { s.name = name; s.state = b.state; s.updated = now; s.by = who.email; }
      else { s = { id: crypto.randomBytes(6).toString("hex"), name, state: b.state, updated: now, by: who.email }; data.signatures.push(s); }
      await commitFiles(head, { [FILE]: JSON.stringify(data, null, 1) + "\n" }, "Editor draft: email signature “" + name + "” (" + who.email + ")");
      return send(res, 200, { ok: true, id: s.id, name: s.name, updated: now });
    }

    if (b.action === "delete") {
      const before = data.signatures.length;
      data.signatures = data.signatures.filter((x) => x.id !== b.id);
      if (data.signatures.length === before) return send(res, 200, { ok: true });
      await commitFiles(head, { [FILE]: JSON.stringify(data, null, 1) + "\n" }, "Editor draft: remove an email signature (" + who.email + ")");
      return send(res, 200, { ok: true });
    }

    return send(res, 400, { error: "Unknown action" });
  } catch (e) {
    const busy = /GitHub 422/.test(String(e.message));
    return send(res, busy ? 409 : 500, { error: busy ? "Someone else saved at the same moment. Please try again." : String(e.message || e) });
  }
}
