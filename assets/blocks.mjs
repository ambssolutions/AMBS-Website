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
};

/* kinds of question a contact form can ask */
export const FORM_FIELDS = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  text: "Short answer",
  message: "Long answer",
  select: "Dropdown",
  checkbox: "Tick box",
  date: "Date",
};

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
