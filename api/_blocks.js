/* Checks blocks coming from the editor before they are saved: known block types only, text trimmed
   to sensible lengths, formatted text cleaned, photos only from the site itself. */
import { cleanBody } from "./_lib.js";

const s = (v, max = 400) => String(v ?? "").slice(0, max);
const link = (v) => {
  const u = s(v, 500).trim();
  return /^(javascript|data|vbscript):/i.test(u) ? "" : u;
};
const photo = (v) => {
  const u = s(v, 300).trim();
  return /^\/[A-Za-z0-9/_.-]+\.(webp|png|jpe?g|gif|svg)$/i.test(u) ? u : "";
};
const FIELD_TYPES = ["name", "email", "phone", "text", "message", "select", "checkbox", "date"];
const list = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn) : []);

export function cleanBlocks(blocks) {
  return list(blocks, 60, (b) => {
    b = b || {};
    switch (b.type) {
      case "text": return { type: "text", heading: s(b.heading, 200), body: cleanBody(s(b.body, 20000)) };
      case "media": return { type: "media", heading: s(b.heading, 200), body: cleanBody(s(b.body, 20000)), photo: photo(b.photo), alt: s(b.alt, 200), side: b.side === "left" ? "left" : "right",
        button: { label: s(b.button?.label, 60), link: link(b.button?.link) } };
      case "photo": return { type: "photo", photo: photo(b.photo), alt: s(b.alt, 200), caption: s(b.caption, 300), wide: !!b.wide };
      case "gallery": return { type: "gallery", photos: list(b.photos, 24, (x) => ({ photo: photo(x?.photo), alt: s(x?.alt, 200), caption: s(x?.caption, 200) })) };
      case "cards": return { type: "cards", heading: s(b.heading, 200), items: list(b.items, 12, (x) => ({ title: s(x?.title, 120), text: s(x?.text, 400), link: link(x?.link), photo: photo(x?.photo), alt: s(x?.alt, 200) })) };
      case "buttons": return { type: "buttons", center: !!b.center, items: list(b.items, 4, (x) => ({ label: s(x?.label, 60), link: link(x?.link), style: x?.style === "secondary" ? "secondary" : "primary" })) };
      case "faq": return { type: "faq", heading: s(b.heading, 200), items: list(b.items, 30, (x) => ({ q: s(x?.q, 300), a: s(x?.a, 2000) })) };
      case "cta": return { type: "cta", heading: s(b.heading, 200), text: s(b.text, 600), button: { label: s(b.button?.label, 60), link: link(b.button?.link) } };
      case "quote": return { type: "quote", quote: s(b.quote, 800), name: s(b.name, 120), role: s(b.role, 120), photo: photo(b.photo) };
      case "video": return { type: "video", url: s(b.url, 300), caption: s(b.caption, 200) };
      case "columns": return { type: "columns", leftHeading: s(b.leftHeading, 200), left: cleanBody(s(b.left, 20000)), rightHeading: s(b.rightHeading, 200), right: cleanBody(s(b.right, 20000)) };
      case "form": return { type: "form", name: s(b.name, 80), heading: s(b.heading, 200), text: s(b.text, 600), button: s(b.button, 60), thanks: s(b.thanks, 400),
        fields: list(b.fields, 15, (x) => ({ type: FIELD_TYPES.includes(x?.type) ? x.type : "text", label: s(x?.label, 120), required: !!x?.required, wide: !!x?.wide,
          ...(x?.type === "select" ? { options: list(x?.options, 20, (o) => s(o, 80).trim()).filter(Boolean) } : {}) })).filter((x) => x.label.trim()) };
      default: return null;
    }
  }).filter(Boolean);
}

export function cleanSection(sec) {
  sec = sec || {};
  return { eyebrow: s(sec.eyebrow, 60), title: s(sec.title, 160), lead: s(sec.lead, 400), style: sec.style === "tinted" ? "tinted" : "plain", blocks: cleanBlocks(sec.blocks) };
}
