/* Content blocks for pages and homepage sections made in the website editor (/admin).
   One renderer for everything: build.py calls it through blocks-cli.mjs, and the editor
   imports the published copy (/assets/blocks.mjs) to draw its previews, so they always match.

   renderBlocks(blocks, { keyPrefix }) -> html
   With keyPrefix (homepage sections), each piece of wording gets a translation key:
   plain text uses data-i18n, formatted text uses data-i18n-html. */

export const BLOCK_TYPES = {
  text: "Text",
  media: "Text with photo",
  photo: "Photo",
  gallery: "Photo gallery",
  cards: "Cards",
  buttons: "Buttons",
  faq: "Questions and answers",
  cta: "Call to action",
  quote: "Quote or testimonial",
  video: "Video",
  columns: "Two columns",
  form: "Contact form",
  webcalc: "Website ROI calculator",
};

/* Website ROI calculator: the ranges, the starting numbers and the wording the numbers use.
   Shared by the page (drawn once here, so the numbers show even without scripts) and /assets/webcalc.js
   (redrawn as people move the sliders). Wording can be changed per block in the editor (block.words). */
export const CALC_RANGES = {
  visitors: { min: 20, max: 1000, step: 10, start: 150 },
  enquiry: { min: 0.5, max: 8, step: 0.5, start: 2 },
  win: { min: 10, max: 70, step: 5, start: 35 },
  job: { min: 100, max: 100000, step: 100, start: 5000 },
  cost: { min: 500, max: 15000, step: 250, start: 3000 },
};
export const CALC_JOBS = [500, 2000, 5000, 10000, 25000];
export const CALC_PERIODS = { month: 1, year: 12, three: 36 };
export const CALC_TEXT = {
  stepJob: "What is an average job worth to you?",
  stepJobHint: "Tap an amount or type your own",
  stepSite: "How your website does each month",
  stepCost: "What the website costs",
  visitors: "Website visitors a month",
  enquiry: "Visitors who send an enquiry",
  enquiryHint: "Quote form, call or email from the site",
  win: "Enquiries you win",
  job: "Average job value",
  cost: "Website cost",
  costHint: "Put in your real quote",
  pMonth: "Month",
  pYear: "Year",
  pThree: "3 years",
  perMonth: "a month",
  perYear: "a year",
  perThree: "over 3 years",
  big: "of work your website could bring in {per}",
  say: "At {job} a job, that is about {money} of work a month.",
  flowHead: "Every month",
  flowVisitors: "Visitors",
  flowLeads: "Enquiries",
  flowJobs: "Jobs won",
  flowWork: "Work",
  payFirst: "Pays for itself in the first month",
  payIn: "Pays for itself in about {n} months",
  payNone: "Move the sliders to see when it pays for itself",
  legendCost: "Website cost {n}",
  legendPaid: "Paid for",
  legendOwed: "Still paying it off",
  axis: "Month",
};
/* fill {n} or {name} in a piece of wording */
export function calcFill(str, n) {
  str = String(str ?? "");
  if (n && typeof n === "object") return str.replace(/\{(\w+)\}/g, (m, k) => (k in n ? n[k] : m));
  return n === undefined ? str : str.replace("{n}", n);
}
export function calcNumber(k, v) {
  const r = CALC_RANGES[k], n = parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return isFinite(n) ? Math.min(r.max, Math.max(r.min, n)) : r.start;
}
export const calcMoney = (n) => "$" + Math.round(n).toLocaleString("en-NZ");
const per = { month: "perMonth", year: "perYear", three: "perThree" };
/* the results for a set of values; t(key, n) gives the wording; period is month, year or three */
export function calcFigures(v, t, period) {
  period = CALC_PERIODS[period] ? period : "year";
  const leads = v.visitors * v.enquiry / 100, jobs = leads * v.win / 100, month = jobs * v.job;
  const pay = month > 0 ? Math.ceil(v.cost / month) : Infinity;
  const one = (n) => (n < 10 ? n.toFixed(1) : String(Math.round(n)));
  const bigN = month * CALC_PERIODS[period];
  return {
    visitors: v.visitors.toLocaleString("en-NZ"), enquiry: v.enquiry + "%", win: v.win + "%", job: calcMoney(v.job), cost: calcMoney(v.cost),
    fv: v.visitors.toLocaleString("en-NZ"), fl: one(leads), fj: one(jobs), fw: calcMoney(month),
    big: calcMoney(bigN), bigN, bigLabel: t("big", { per: t(per[period]) }),
    bar: calcMoney(bigN) + " " + t(per[period]),
    say: t("say", { job: calcMoney(v.job), money: calcMoney(month) }),
    pay: pay <= 1 ? t("payFirst") : pay < Infinity ? t("payIn", pay) : t("payNone"),
    legendCost: t("legendCost", calcMoney(v.cost)),
    perMonth: month,
  };
}
/* the 12-month chart as SVG markup: work won added up, month by month, against the website cost */
export function calcChart(month, cost, t) {
  const L = 58, R = 594, T = 12, B = 176, W = R - L, H = B - T;
  const top = Math.max(month * 12, cost), max = top * 1.08 || 1;
  const y = (val) => B - (val / max) * H;
  const tx = (x, yy, s, anchor) => '<text x="' + x + '" y="' + yy + '"' + (anchor ? ' text-anchor="' + anchor + '"' : "") + ">" + esc(s) + "</text>";
  let s = "";
  for (const f of [0, 0.5, 1]) {
    const val = top * f, yy = y(val).toFixed(1);
    s += '<line class="g" x1="' + L + '" x2="' + R + '" y1="' + yy + '" y2="' + yy + '"/>' + tx(L - 8, (+yy + 5).toFixed(1), val >= 1000 ? "$" + Math.round(val / 1000) + "k" : "$" + Math.round(val), "end");
  }
  const bw = W / 12;
  for (let m = 1; m <= 12; m++) {
    const cum = month * m, x = (L + (m - 1) * bw + bw * 0.16).toFixed(1), h = Math.max(B - y(cum), 0);
    s += '<rect class="' + (cum >= cost && cum > 0 ? "paid" : "owed") + '" x="' + x + '" y="' + (B - h).toFixed(1) + '" width="' + (bw * 0.68).toFixed(1) + '" height="' + h.toFixed(1) + '" rx="4"/>' + tx((+x + bw * 0.34).toFixed(1), B + 20, m, "middle");
  }
  const cy = y(cost).toFixed(1);
  s += '<line class="cost" x1="' + L + '" x2="' + R + '" y1="' + cy + '" y2="' + cy + '"/>';
  s += tx(R, 216, t("axis"), "end");
  return s;
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = (s) => esc(s).replace(/"/g, "&quot;");
const href = (u) => {
  u = String(u ?? "").trim();
  if (!u) return "#";
  if (/^(javascript|data|vbscript):/i.test(u)) return "#";
  return u;
};
const external = (u) => /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?ambs\.co\.nz/i.test(u);
const linkAttrs = (u) => 'href="' + attr(href(u)) + '"' + (external(u) ? ' target="_blank" rel="noopener"' : "");

/* the editor already cleans formatted text; this is a second, simple safety net */
function rich(html) {
  return String(html ?? "")
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
}

function videoEmbed(url) {
  url = String(url || "").trim();
  let m = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(url);
  if (m) return "https://www.youtube-nocookie.com/embed/" + m[1];
  m = /vimeo\.com\/(?:video\/)?(\d+)/i.exec(url);
  if (m) return "https://player.vimeo.com/video/" + m[1];
  return null;
}

function img(src, alt, cls, w) {
  if (!src) return "";
  return '<img class="' + (cls || "") + '" src="' + attr(src) + '" alt="' + attr(alt || "") + '" loading="lazy" decoding="async"' + (w ? ' sizes="' + w + '"' : "") + ">";
}

export function renderBlocks(blocks, opts = {}) {
  const P = opts.keyPrefix || "";
  const idp = (P ? P.replace(/[^a-z0-9]+/gi, "-") : "pg") + "-f";
  let n = 0, nf = 0;
  const T = (tag, text, cls, extra) => {
    if (!String(text ?? "").trim()) return "";
    const key = P + "." + ++n;
    if (opts.strings && P) opts.strings[key] = String(text);
    const k = P ? ' data-i18n="' + key + '"' : "";
    return "<" + tag + (cls ? ' class="' + cls + '"' : "") + k + (extra || "") + ">" + esc(text) + "</" + tag + ">";
  };
  const R = (html, cls) => {
    if (!String(html ?? "").replace(/<[^>]+>/g, "").trim()) return "";
    const key = P + "." + ++n;
    if (opts.strings && P) opts.strings[key] = rich(html);
    const k = P ? ' data-i18n-html="' + key + '"' : "";
    return '<div class="' + (cls || "blk-rich") + '"' + k + ">" + rich(html) + "</div>";
  };
  const out = [];
  for (const b of blocks || []) {
    const t = b.type;
    if (t === "text") {
      out.push('<div class="blk blk-text">' + T("h2", b.heading, "blk-h") + R(b.body) + "</div>");
    } else if (t === "media") {
      out.push('<div class="blk blk-media' + (b.side === "left" ? " blk-media--left" : "") + '"><div class="blk-media-copy">' + T("h2", b.heading, "blk-h") + R(b.body) +
        (b.button && b.button.label ? '<p class="blk-btns"><a class="blk-btn" ' + linkAttrs(b.button.link) + ">" + T("span", b.button.label) + "</a></p>" : "") +
        '</div><div class="blk-media-pic">' + img(b.photo, b.alt) + "</div></div>");
    } else if (t === "photo") {
      if (!b.photo) continue;
      out.push('<figure class="blk blk-photo' + (b.wide ? " blk-photo--wide" : "") + '">' + img(b.photo, b.alt) + (b.caption ? T("figcaption", b.caption) : "") + "</figure>");
    } else if (t === "gallery") {
      const ps = (b.photos || []).filter((x) => x && x.photo);
      if (!ps.length) continue;
      out.push('<div class="blk blk-gallery" style="--cols:' + Math.min(4, Math.max(2, ps.length >= 4 ? 4 : ps.length)) + '">' + ps.map((x) => "<figure>" + img(x.photo, x.alt) + (x.caption ? T("figcaption", x.caption) : "") + "</figure>").join("") + "</div>");
    } else if (t === "cards") {
      const it = (b.items || []).filter((x) => x && (x.title || x.text));
      if (!it.length) continue;
      out.push('<div class="blk blk-cards">' + T("h2", b.heading, "blk-h") + '<div class="blk-cards-grid">' + it.map((x) => {
        const inner = (x.photo ? img(x.photo, x.alt, "blk-card-pic") : "") + '<div class="blk-card-body">' + T("h3", x.title) + T("p", x.text) + (x.link ? '<span class="blk-card-go" aria-hidden="true">→</span>' : "") + "</div>";
        return x.link ? '<a class="blk-card" ' + linkAttrs(x.link) + ">" + inner + "</a>" : '<div class="blk-card">' + inner + "</div>";
      }).join("") + "</div></div>");
    } else if (t === "buttons") {
      const it = (b.items || []).filter((x) => x && x.label);
      if (!it.length) continue;
      out.push('<p class="blk blk-btns' + (b.center ? " blk-btns--center" : "") + '">' + it.map((x) => '<a class="blk-btn' + (x.style === "secondary" ? " blk-btn--soft" : "") + '" ' + linkAttrs(x.link) + ">" + T("span", x.label) + "</a>").join("") + "</p>");
    } else if (t === "faq") {
      const it = (b.items || []).filter((x) => x && x.q && x.a);
      if (!it.length) continue;
      out.push('<div class="blk blk-faq">' + T("h2", b.heading, "blk-h") + it.map((x) => "<details>" + T("summary", x.q) + T("p", x.a) + "</details>").join("") + "</div>");
    } else if (t === "cta") {
      out.push('<div class="blk blk-cta">' + T("h2", b.heading, "blk-cta-h") + T("p", b.text) +
        (b.button && b.button.label ? '<p class="blk-btns blk-btns--center"><a class="blk-btn blk-btn--light" ' + linkAttrs(b.button.link) + ">" + T("span", b.button.label) + "</a></p>" : "") + "</div>");
    } else if (t === "quote") {
      if (!b.quote) continue;
      out.push('<figure class="blk blk-quote"><blockquote>' + T("p", b.quote) + "</blockquote>" +
        (b.name ? "<figcaption>" + (b.photo ? img(b.photo, "", "blk-quote-pic") : "") + "<span>" + T("b", b.name) + T("span", b.role, "blk-quote-role") + "</span></figcaption>" : "") + "</figure>");
    } else if (t === "video") {
      const src = videoEmbed(b.url);
      if (!src) continue;
      out.push('<figure class="blk blk-video"><div class="blk-video-box"><iframe src="' + attr(src) + '" title="' + attr(b.caption || "Video") + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' + (b.caption ? T("figcaption", b.caption) : "") + "</figure>");
    } else if (t === "form") {
      const fs = (b.fields || []).filter((x) => x && FORM_FIELDS[x.type] && String(x.label || "").trim());
      if (!fs.length) continue;
      const fid = idp + ++nf;
      const rows = fs.map((x, i) => {
        const id = fid + "-" + i, name = attr(x.label), req = x.required ? " required" : "";
        const star = x.required ? '<span class="blk-req" aria-hidden="true">*</span>' : "";
        if (x.type === "checkbox") return '<div class="blk-fld blk-fld--full blk-fld--chk"><label for="' + id + '"><input id="' + id + '" type="checkbox" name="' + name + '" value="Yes"' + req + ">" + T("span", x.label) + star + "</label></div>";
        const lab = '<label for="' + id + '">' + T("span", x.label) + star + "</label>";
        let input;
        if (x.type === "message") input = '<textarea id="' + id + '" name="' + name + '" rows="5"' + req + "></textarea>";
        else if (x.type === "select") input = '<select id="' + id + '" name="' + name + '"' + req + '><option value="">—</option>' +
          (x.options || []).filter((o) => String(o).trim()).map((o) => T("option", o, "", ' value="' + attr(o) + '"')).join("") + "</select>";
        else {
          const ty = { name: ['text', ' autocomplete="name"'], email: ['email', ' autocomplete="email"'], phone: ['tel', ' autocomplete="tel" inputmode="tel"'], date: ['date', ""], text: ['text', ""] }[x.type];
          input = '<input id="' + id + '" type="' + ty[0] + '" name="' + name + '"' + ty[1] + ' data-kind="' + x.type + '"' + req + ">";
        }
        return '<div class="blk-fld' + (x.type === "message" || x.wide ? " blk-fld--full" : "") + '">' + lab + input + "</div>";
      });
      out.push('<form class="blk blk-form" data-blk-form data-form-name="' + attr(b.name || b.heading || "Contact form") + '" novalidate>' + T("h2", b.heading, "blk-h") + T("p", b.text, "blk-form-lead") +
        '<div class="blk-form-grid">' + rows.join("") + "</div>" +
        '<input type="text" name="botcheck" class="blk-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<p class="blk-form-go"><button type="submit" class="blk-btn">' + (T("span", b.button || "Send") || "<span>Send</span>") + "</button></p>" +
        T("p", b.thanks || "Thanks, your message has been sent. We will be in touch soon.", "blk-form-ok", ' role="status" tabindex="-1" hidden') + "</form>");
    } else if (t === "webcalc") {
      const cid = idp + "c" + ++nf;
      const word = (k) => String((b.words || {})[k] || "").trim() || CALC_TEXT[k];
      const fill = (k, n) => calcFill(word(k), n);
      const v = {};
      for (const k in CALC_RANGES) v[k] = calcNumber(k, (b.start || {})[k]);
      const fig = calcFigures(v, fill, "year");
      const ctl = (k, hint) => {
        const r = CALC_RANGES[k];
        return '<div class="blk-calc-ctl' + (k === "cost" ? " blk-calc-ctl--cost" : "") + '"><label for="' + cid + "-" + k + '">' + T("span", word(k)) + '<output data-o="' + k + '">' + esc(fig[k]) + "</output></label>" +
          '<input type="range" id="' + cid + "-" + k + '" data-k="' + k + '" min="' + r.min + '" max="' + r.max + '" step="' + r.step + '" value="' + v[k] + '">' + (hint ? T("small", word(hint)) : "") + "</div>";
      };
      const step = (n, k, inner) => '<fieldset class="blk-calc-step"><legend><span class="blk-calc-n" aria-hidden="true">' + n + "</span>" + T("span", word(k)) + "</legend>" + inner + "</fieldset>";
      const chips = CALC_JOBS.map((j) => '<button type="button" class="blk-calc-chip" data-job="' + j + '" aria-pressed="' + (j === v.job) + '">' + calcMoney(j) + "</button>").join("");
      const jobIn = '<div class="blk-calc-chips" role="group">' + chips + "</div>" +
        '<label class="blk-calc-money" for="' + cid + '-job"><span aria-hidden="true">$</span><input type="text" inputmode="numeric" autocomplete="off" id="' + cid + '-job" data-k="job" value="' + Math.round(v.job).toLocaleString("en-NZ") + '" aria-label="' + attr(word("job")) + '"></label>' +
        T("small", word("stepJobHint"), "blk-calc-hint");
      const per = ["month", "year", "three"].map((p) => '<button type="button" data-p="' + p + '" aria-pressed="' + (p === "year") + '">' + T("span", word({ month: "pMonth", year: "pYear", three: "pThree" }[p])) + "</button>").join("");
      const flow = [["fv", "flowVisitors"], ["fl", "flowLeads"], ["fj", "flowJobs"], ["fw", "flowWork"]].map((x) => '<li><b data-r="' + x[0] + '">' + esc(fig[x[0]]) + "</b>" + T("span", word(x[1])) + "</li>").join("");
      const tpl = Object.keys(CALC_TEXT).filter((k) => /^(per|big|say|pay|legend|axis)/.test(k)).map((k) => T("span", word(k), "", ' data-tpl="' + k + '"')).join("");
      out.push('<div class="blk blk-calc" data-webcalc data-period="year">' + T("h2", b.heading, "blk-h") + T("p", b.text, "blk-calc-lead") +
        '<p class="blk-calc-bar" aria-hidden="true"><b data-r="bar">' + esc(fig.bar) + "</b></p>" +
        '<div class="blk-calc-grid"><div class="blk-calc-in">' +
        step(1, "stepJob", jobIn) + step(2, "stepSite", ctl("visitors") + ctl("enquiry", "enquiryHint") + ctl("win")) + step(3, "stepCost", ctl("cost", "costHint")) + "</div>" +
        '<div class="blk-calc-out"><div class="blk-calc-card">' +
        '<div class="blk-calc-period" role="group">' + per + "</div>" +
        '<p class="blk-calc-big" aria-live="polite"><b data-r="big">' + esc(fig.big) + '</b><span data-r="bigLabel">' + esc(fig.bigLabel) + "</span></p>" +
        '<p class="blk-calc-say" data-r="say">' + esc(fig.say) + "</p>" +
        T("p", word("flowHead"), "blk-calc-flow-h") + '<ol class="blk-calc-flow">' + flow + "</ol>" +
        '<p class="blk-calc-pay" data-r="pay">' + esc(fig.pay) + "</p>" +
        '<p class="blk-calc-legend"><span class="lc"><i></i><span data-r="legendCost">' + esc(fig.legendCost) + '</span></span><span class="lp"><i></i>' + T("span", word("legendPaid")) + '</span><span class="lo"><i></i>' + T("span", word("legendOwed")) + "</span></p>" +
        '<svg class="blk-calc-chart" viewBox="0 0 600 222" role="img" aria-label="' + attr(word("legendPaid") + ", " + word("legendOwed")) + '">' + calcChart(fig.perMonth, v.cost, fill) + "</svg>" +
        T("p", b.note, "blk-calc-note") +
        (b.button && b.button.label ? '<p class="blk-btns blk-btns--center"><a class="blk-btn" ' + linkAttrs(b.button.link) + ">" + T("span", b.button.label) + "</a></p>" : "") +
        '</div></div></div><div class="blk-calc-words" hidden>' + tpl + "</div></div>");
    } else if (t === "columns") {
      out.push('<div class="blk blk-cols"><div>' + T("h3", b.leftHeading, "blk-h3") + R(b.left) + "</div><div>" + T("h3", b.rightHeading, "blk-h3") + R(b.right) + "</div></div>");
    }
  }
  return out.join("\n");
}

/* A homepage section made of blocks. */
export function renderSection(id, sec, strings) {
  const P = "ed." + id;
  if (strings) for (const f of ["eyebrow", "title", "lead"]) if (sec[f]) strings[P + "." + f] = String(sec[f]);
  const head = (sec.eyebrow || sec.title || sec.lead)
    ? '<div class="sec-head blk-sec-head">' +
      (sec.eyebrow ? '<p class="eyebrow" data-i18n="' + P + '.eyebrow">' + esc(sec.eyebrow) + "</p>" : "") +
      (sec.title ? '<h2 data-i18n="' + P + '.title">' + esc(sec.title) + "</h2>" : "") +
      (sec.lead ? '<p class="lead" data-i18n="' + P + '.lead">' + esc(sec.lead) + "</p>" : "") + "</div>"
    : "";
  return '<section class="edsec' + (sec.style === "tinted" ? " edsec--tinted" : "") + '" id="' + attr(id) + '"><div class="wrap">' + head + '<div class="blk-flow">' + renderBlocks(sec.blocks, { keyPrefix: P, strings }) + "</div></div></section>";
}

/* Every piece of wording a homepage section adds, so it can be queued for translation. */
export function sectionStrings(id, sec) {
  const out = {};
  renderSection(id, sec, out);
  return out;
}
