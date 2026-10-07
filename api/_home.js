/* Adding and removing items on the homepage: list items (questions, rows, points, steps…),
   What we do cards, and the tools strip. Pure functions: file text in, file text out. */

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;");

/* Each list: a pattern matching one whole item (group 1 = its number) and the wording keys it uses. */
export const LISTS = {
  faq: { label: "question", re: /[ \t]*<div class="q"><button type="button"><span data-i18n="faq\.q(\d+)">[^<]*<\/span><\/button>\s*<div class="a" data-i18n="faq\.a\1">[^<]*<\/div><\/div>\n?/g, keys: ["faq.q#", "faq.a#"] },
  "why.o": { label: "row", re: /[ \t]*<li data-i18n="why\.o(\d+)">[^<]*<\/li>\n?/g, keys: ["why.o#"] },
  "why.n": { label: "row", re: /[ \t]*<li data-i18n="why\.n(\d+)">[^<]*<\/li>\n?/g, keys: ["why.n#"] },
  about: { label: "letter", re: /[ \t]*<div class="acr"><b data-i18n="about\.a(\d+)t">[^<]*<\/b><p data-i18n="about\.a\1d">[^<]*<\/p><\/div>\n?/g, keys: ["about.a#t", "about.a#d"] },
  how: { label: "step", re: /[ \t]*<div class="step">\s*<div class="step-n">\d+<\/div>\s*<div>\s*<h3 data-i18n="how\.s(\d+)t">[^<]*<\/h3>\s*<p data-i18n="how\.s\1d">[^<]*<\/p>\s*<\/div>\s*<\/div>\n?/g, keys: ["how.s#t", "how.s#d"] },
  trust: { label: "point", re: /[ \t]*<div class="tcell">\s*<h3 data-i18n="trust\.u(\d+)t">[^<]*<\/h3>\s*<p data-i18n="trust\.u\1d">[^<]*<\/p>\s*<\/div>\n?/g, keys: ["trust.u#t", "trust.u#d"] },
};
/* the three-or-so points under each What we do card: list id "pts:<card number>" */
function listDef(id) {
  if (LISTS[id]) return LISTS[id];
  const m = /^pts:(\d+)$/.exec(id);
  if (m) return { label: "point", re: new RegExp('<li data-i18n="auto\\.c' + m[1] + 'p(\\d+)">[^<]*<\\/li>', "g"), keys: ["auto.c" + m[1] + "p#"] };
  throw new Error("Unknown list " + id);
}
export const keysFor = (id, n) => listDef(id).keys.map((k) => k.replace("#", n));

function items(html, id) {
  return [...html.matchAll(listDef(id).re)].map((m) => ({ n: +m[1], at: m.index, end: m.index + m[0].length, text: m[0] }));
}

/* ---- the English wording block in home.js ---- */
const EN_START = "const I18N = {\nen:{";
function enRange(js) {
  const a = js.indexOf(EN_START) + EN_START.length;
  return { a, z: js.indexOf("\n}", a) };
}
function enAdd(js, pairs) {
  const { z } = enRange(js);
  const add = pairs.map(([k, v]) => '"' + k + '":' + JSON.stringify(v)).join(",");
  return js.slice(0, z) + ",\n " + add + js.slice(z);
}
function enRemove(js, keys) {
  const { a, z } = enRange(js);
  let body = js.slice(a, z);
  for (const k of keys) {
    const q = k.replace(/[.]/g, "\\.");
    body = body.replace(new RegExp(',?\\s*"' + q + '":"(?:[^"\\\\]|\\\\.)*"'), "");
  }
  body = body.replace(/^(\s*),/, "$1");
  return js.slice(0, a) + body + js.slice(z);
}

/* ---- What we do cards ---- */
const ICON_PATHS = {
  auto: '<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
  web: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.5h18"/><circle cx="12" cy="14.3" r="3.4"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h9A2.5 2.5 0 0 1 18 6.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3.5V15A2 2 0 0 1 4 13z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  chart: '<path d="M4 4v16h16"/><path d="M4 14l4-3 4 2 7-6"/>',
  shield: '<path d="M12 3l7 3v5.5c0 4.5-3 7.8-7 9.5-4-1.7-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
  link: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><path d="M10 6.5h5.5a2 2 0 0 1 2 2V14"/>',
  invoice: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h4"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".8"/>',
  cafe: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  trades: '<path d="M14.5 5.5l4 4-9.5 9.5H5v-4z"/><path d="M12.5 7.5l4 4"/>',
  retail: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v11H4z"/><path d="M9 20v-6h6v6"/>',
  transport: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/>',
};
export const CARD_ICONS = Object.keys(ICON_PATHS);

const TAB_RE = /[ \t]*<button type="button" role="tab" class="wd-tab( wd-tab--g)?" id="wd-t(\d+)"[\s\S]*?<\/button>\n/g;
const PANEL_RE = /[ \t]*<div class="wd-panel( on)?( wd-panel--g)?" role="tabpanel" id="wd-p(\d+)"[\s\S]*?\n {8}<\/div>\n/g;

export function readCards(html, drawings) {
  const tabs = [...html.matchAll(TAB_RE)].map((m) => ({ n: +m[2], digital: !!m[1] }));
  const panels = Object.fromEntries([...html.matchAll(PANEL_RE)].map((m) => [+m[3], m[0]]));
  return tabs.map((t) => {
    const p = panels[t.n] || "";
    const photo = (/<div class="wd-stage wd-stage--photo"[^>]*><img src="([^"]+)"/.exec(p) || [])[1] || null;
    const link = (/<a class="wd-more" href="([^"]*)"/.exec(p) || [])[1] || "";
    return { n: t.n, digital: t.digital, photo, link, hasDrawing: !photo || !!(drawings && drawings[t.n]) };
  });
}

function tabHtml(n, digital, icon, title) {
  const paths = (ICON_PATHS[icon] || ICON_PATHS.target).replace(/<(path|rect|circle)\b/g, '<$1 class="ic-line" pathLength="1"');
  return '        <button type="button" role="tab" class="wd-tab' + (digital ? " wd-tab--g" : "") + '" id="wd-t' + n + '" aria-controls="wd-p' + n + '" aria-selected="false" tabindex="-1"><span class="wd-ico"><svg viewBox="0 0 24 24" aria-hidden="true">' + paths + '</svg></span><span class="wd-tt" data-i18n="auto.c' + n + 't">' + esc(title) + '</span><span class="wd-timer"></span></button>\n';
}
function photoStage(url, alt) {
  return '<div class="wd-stage wd-stage--photo" aria-hidden="true"><img src="' + escAttr(url) + '" alt="' + escAttr(alt || "") + '" loading="lazy" decoding="async"></div>';
}
function panelHtml(n, digital, c) {
  const pts = (c.p || []).map((t, i) => '<li data-i18n="auto.c' + n + "p" + (i + 1) + '">' + esc(t) + "</li>").join("");
  return '        <div class="wd-panel' + (digital ? " wd-panel--g" : "") + '" role="tabpanel" id="wd-p' + n + '" aria-labelledby="wd-t' + n + '" inert>\n' +
    "          " + photoStage(c.photo, c.t) + "\n" +
    '          <div class="wd-copy"><h3 data-i18n="auto.c' + n + 't">' + esc(c.t) + '</h3><p data-i18n="auto.c' + n + 'd">' + esc(c.d) + "</p>" +
    (pts ? '<ul class="wd-pts">' + pts + "</ul>" : "") +
    '<a class="wd-more" href="' + escAttr(c.link || "/services") + '"><span data-i18n="wd.more">Learn more</span></a></div>\n' +
    "        </div>\n";
}
/* the drawing part of a card: everything from the stage up to the text */
function stageOf(panel) {
  const a = panel.indexOf('<div class="wd-stage');
  const z = panel.indexOf('\n          <div class="wd-copy">');
  return a >= 0 && z > a ? [a, z] : null;
}

/* Apply homepage structure operations.
   ops: { add: [{list, n, en: [..]}], remove: [{list, n}],
          cards: { add: [{n, digital, icon, link, photo, t, d, p: [..]}], remove: [n], photo: [{n, url}], drawing: [n], link: [{n, href}] },
          tools: [names] }
   Returns { html, js, drawings, newKeys, goneKeys }. */
export function applyOps(html, js, drawings, ops) {
  drawings = { ...(drawings || {}) };
  const newKeys = [], goneKeys = [];
  const enPairs = [];

  for (const r of ops.remove || []) {
    const its = items(html, r.list);
    if (its.length <= 1) throw new Error("Keep at least one " + listDef(r.list).label + " in each list");
    const it = its.find((x) => x.n === +r.n);
    if (!it) continue;
    html = html.slice(0, it.at) + html.slice(it.end);
    goneKeys.push(...keysFor(r.list, it.n));
  }
  for (const a of ops.add || []) {
    const its = items(html, a.list);
    if (!its.length) throw new Error("List not found: " + a.list);
    const last = its[its.length - 1];
    const n = Math.max(...its.map((x) => x.n), 0) + 1;
    const keys = keysFor(a.list, n), oldKeys = keysFor(a.list, last.n);
    let clone = last.text;
    oldKeys.forEach((ok, i) => {
      const okq = ok.replace(/[.]/g, "\\.");
      clone = clone.replace(new RegExp('data-i18n="' + okq + '">[^<]*<'), 'data-i18n="' + keys[i] + '">' + esc((a.en || [])[i] || "") + "<");
    });
    html = html.slice(0, last.end) + clone + html.slice(last.end);
    keys.forEach((k, i) => { enPairs.push([k, String((a.en || [])[i] || "")]); newKeys.push(k); });
  }
  /* "How it works" steps are numbered by position */
  let step = 0;
  html = html.replace(/<div class="step-n">\d+<\/div>/g, () => '<div class="step-n">' + ++step + "</div>");

  const c = ops.cards || {};
  for (const n of c.remove || []) {
    if ([...html.matchAll(TAB_RE)].length <= 1) throw new Error("Keep at least one What we do card");
    html = html.replace(new RegExp('[ \\t]*<button type="button" role="tab" class="wd-tab[^"]*" id="wd-t' + +n + '"[\\s\\S]*?<\\/button>\\n'), "");
    html = html.replace(new RegExp('[ \\t]*<div class="wd-panel[^"]*" role="tabpanel" id="wd-p' + +n + '"[\\s\\S]*?\\n {8}<\\/div>\\n'), "");
    goneKeys.push("auto.c" + n + "t", "auto.c" + n + "d", ...[1, 2, 3, 4, 5, 6].map((i) => "auto.c" + n + "p" + i), ..."abcd".split("").map((x) => "wd.s" + n + x));
    delete drawings[n];
  }
  for (const card of c.add || []) {
    const tabs = [...html.matchAll(TAB_RE)];
    const n = Math.max(0, ...tabs.map((m) => +m[2]), ...[...html.matchAll(/id="wd-p(\d+)"/g)].map((m) => +m[1])) + 1;
    const digital = !!card.digital;
    const same = tabs.filter((m) => !!m[1] === digital);
    const lastTab = same[same.length - 1] || tabs[tabs.length - 1];
    const tAt = lastTab.index + lastTab[0].length;
    html = html.slice(0, tAt) + tabHtml(n, digital, card.icon, card.t) + html.slice(tAt);
    const panels = [...html.matchAll(PANEL_RE)];
    const sameP = panels.filter((m) => !!m[2] === digital);
    const lastP = sameP[sameP.length - 1] || panels[panels.length - 1];
    const pAt = lastP.index + lastP[0].length;
    html = html.slice(0, pAt) + panelHtml(n, digital, card) + html.slice(pAt);
    enPairs.push(["auto.c" + n + "t", card.t], ["auto.c" + n + "d", card.d]);
    (card.p || []).forEach((t, i) => enPairs.push(["auto.c" + n + "p" + (i + 1), t]));
    newKeys.push("auto.c" + n + "t", "auto.c" + n + "d", ...(card.p || []).map((_, i) => "auto.c" + n + "p" + (i + 1)));
  }
  const panelRe = (n) => new RegExp('[ \\t]*<div class="wd-panel[^"]*" role="tabpanel" id="wd-p' + +n + '"[\\s\\S]*?\\n {8}<\\/div>\\n');
  for (const ph of c.photo || []) {
    const m = panelRe(ph.n).exec(html);
    if (!m) continue;
    const panel = m[0], r = stageOf(panel);
    if (!r) continue;
    const stage = panel.slice(r[0], r[1]);
    if (!stage.startsWith('<div class="wd-stage wd-stage--photo"') && !drawings[ph.n]) drawings[ph.n] = stage;
    const np = panel.slice(0, r[0]) + photoStage(ph.url, ph.alt) + panel.slice(r[1]);
    html = html.slice(0, m.index) + np + html.slice(m.index + panel.length);
  }
  for (const n of c.drawing || []) {
    const m = panelRe(n).exec(html);
    if (!m || !drawings[n]) continue;
    const panel = m[0], r = stageOf(panel);
    const np = panel.slice(0, r[0]) + drawings[n] + panel.slice(r[1]);
    html = html.slice(0, m.index) + np + html.slice(m.index + panel.length);
    delete drawings[n];
  }
  for (const l of c.link || []) {
    const m = panelRe(l.n).exec(html);
    if (!m) continue;
    const np = m[0].replace(/<a class="wd-more" href="[^"]*"/, '<a class="wd-more" href="' + escAttr(l.href) + '"');
    html = html.slice(0, m.index) + np + html.slice(m.index + m[0].length);
  }
  /* the first card is the one shown when the page opens */
  const firstTab = /id="wd-t(\d+)"/.exec(html);
  if (firstTab && (c.remove || []).length) {
    const f = firstTab[1];
    html = html.replace(/(<button type="button" role="tab" class="wd-tab[^"]*" id="wd-t)(\d+)(" aria-controls="wd-p\d+" aria-selected=")(true|false)(" tabindex=")(-?\d)/g,
      (all, a, n, b, sel, c2) => a + n + b + (n === f ? "true" : "false") + c2 + (n === f ? "0" : "-1"));
    html = html.replace(/<div class="wd-panel( on)?([^"]*)" role="tabpanel" id="wd-p(\d+)" aria-labelledby="wd-t\3"( inert)?>/g,
      (all, on, g, n) => '<div class="wd-panel' + (n === f ? " on" : "") + g + '" role="tabpanel" id="wd-p' + n + '" aria-labelledby="wd-t' + n + '"' + (n === f ? "" : " inert") + ">");
  }

  if (Array.isArray(ops.tools)) {
    const names = ops.tools.map((s) => String(s).trim()).filter(Boolean).slice(0, 40);
    html = html.replace(/(<div class="tools rv">)[\s\S]*?(\n {6}<\/div>)/, (all, a, z) => a + "\n        " + names.map((t) => '<span class="tool">' + esc(t) + "</span>").join("") + z);
  }

  if (enPairs.length) js = enAdd(js, enPairs);
  const stillUsed = (k) => html.includes('data-i18n="' + k + '"');
  const gone = goneKeys.filter((k) => !stillUsed(k));
  if (gone.length) js = enRemove(js, gone);
  return { html, js, drawings, newKeys, goneKeys: gone };
}

export function readTools(html) {
  const m = /<div class="tools rv">([\s\S]*?)\n {6}<\/div>/.exec(html);
  return m ? [...m[1].matchAll(/<span class="tool">([^<]*)<\/span>/g)].map((x) => x[1].replace(/&amp;/g, "&")) : [];
}
