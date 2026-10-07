/* POST /api/content: the homepage wording in every language, grouped by section, for the editor. */
import { requireEditor, send, loadFiles, readEnglish, readLayout, LANGS } from "./_lib.js";
import { LISTS, readCards, readTools, CARD_ICONS } from "./_home.js";

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const { head, files } = await loadFiles();
    const en = readEnglish(files["site-src/assets/home.js"]);
    const layout = readLayout(files["index.html"]);
    const tr = {};
    for (const l of LANGS) tr[l] = JSON.parse(files["site-src/assets/i18n/" + l + ".json"]);
    const status = files["site-src/content/translation-status.json"]
      ? JSON.parse(files["site-src/content/translation-status.json"]) : {};
    const keys = [...layout.order, ...Object.keys(en).filter((k) => !layout.where[k])];
    const items = keys.filter((k) => k in en).map((k) => ({
      key: k,
      section: layout.where[k] || "other",
      en: en[k],
      tr: Object.fromEntries(LANGS.map((l) => [l, tr[l][k] ?? ""])),
      status: status[k] || {},
    }));
    const html = files["index.html"];
    const drawings = files["site-src/content/wd-drawings.json"] ? JSON.parse(files["site-src/content/wd-drawings.json"]) : {};
    const cards = readCards(html, drawings);
    /* which wording belongs to an add/remove list, so the editor can offer + Add and Remove */
    const lists = {};
    const listIds = [...Object.keys(LISTS), ...cards.map((c) => "pts:" + c.n)];
    for (const id of listIds) {
      const re = id.startsWith("pts:") ? new RegExp('<li data-i18n="auto\\.c' + id.slice(4) + 'p(\\d+)">', "g") : LISTS[id].re;
      lists[id] = { label: id.startsWith("pts:") ? "point" : LISTS[id].label, ns: [...html.matchAll(re)].map((m) => +m[1]) };
    }
    send(res, 200, { head, email: who.email, items, lists, cards, tools: readTools(html), icons: CARD_ICONS });
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
}
