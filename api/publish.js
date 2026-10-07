/* POST /api/publish: save edited wording and translations to the live site in one commit.
   Body: { changes: { key: { was, en?, zh?, hi?, pa?, mi? } }, status: { key: { lang: "auto" | "reviewed" | "needs" } } }
   "was" is the English the editor started from, so two people changing the same wording can't overwrite each other. */
import { requireEditor, send, readBody, loadFiles, applyChanges, commitFiles, readEnglish } from "./_lib.js";

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const { changes = {}, status, ops, preview } = await readBody(req);
    const hasOps = ops && Object.values(ops).some((v) => (Array.isArray(v) ? v.length : v && Object.values(v).some((x) => x && x.length)));
    if (!Object.keys(changes).length && !hasOps) return send(res, 400, { error: "No changes to publish" });
    const now = await loadFiles();
    const en = readEnglish(now.files["site-src/assets/home.js"]);
    const clashes = Object.entries(changes).filter(([k, ch]) => typeof ch.was === "string" && en[k] !== ch.was).map(([k]) => k);
    if (clashes.length) {
      return send(res, 409, { error: "Someone else changed this wording since you opened the editor: " + clashes.join(", ") + ". Reload the editor and make your change again." });
    }
    const out = applyChanges(now.files, changes, status || {}, hasOps ? ops : null);
    /* preview: the homepage exactly as it would be published, without saving anything */
    if (preview) return send(res, 200, { html: out["index.html"], js: out["assets/home.js"] });
    const n = Object.keys(changes).length + (hasOps ? 1 : 0);
    const sha = await commitFiles(
      now.head,
      out,
      "Website editor: " + n + " wording change" + (n === 1 ? "" : "s") + " by " + who.email,
    );
    send(res, 200, { ok: true, commit: sha, build: JSON.parse(out["version.json"]).build });
  } catch (e) {
    if (e.status === 422 || e.status === 409) {
      return send(res, 409, { error: "The website changed while publishing. Reload the editor and try again." });
    }
    send(res, 500, { error: String(e.message || e) });
  }
}
