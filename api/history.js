/* POST /api/history: what has been published from the editor, and undo.
   { action: "list" }
   { action: "undo", sha }   puts the files that publish changed back the way they were before it */
import { requireEditor, send, readBody, headSha, commitFiles } from "./_lib.js";

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
