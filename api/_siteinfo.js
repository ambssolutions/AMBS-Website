/* Reads a business website and picks out what the email signature builder needs:
   business name, phone, email, address, social accounts, booking, Google review and Google
   profile links, a main call-to-action link and the logo.
   Used by api/siteinfo.js. Only public web addresses are fetched. */
import dns from "node:dns/promises";
import net from "node:net";

const UA = "Mozilla/5.0 (compatible; AMBS-signature-builder/1.0; +https://ambs.co.nz/email-signature)";

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const x = ip.toLowerCase();
  if (x.startsWith("::ffff:")) return privateIp(x.slice(7));
  return x === "::" || x === "::1" || x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe80") || x.startsWith("ff");
}

async function safeUrl(u) {
  let p;
  try { p = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(p.protocol) || p.username || p.password) return null;
  if (p.port && !["80", "443"].includes(p.port)) return null;
  const host = p.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") || /\.(local|internal|localhost)$/i.test(host)) return null;
  let addrs;
  try { addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }); } catch (e) { return null; }
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) return null;
  return p;
}

/* fetch a public address, following up to 4 redirects (each one checked), stopping at maxBytes */
export async function grab(u, maxBytes, accept) {
  let cur = u;
  for (let hop = 0; hop < 5; hop++) {
    const p = await safeUrl(cur);
    if (!p) throw new Error("That web address can’t be reached.");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    let r;
    try {
      r = await fetch(p.href, { redirect: "manual", signal: ctl.signal, headers: { "User-Agent": UA, Accept: accept || "text/html,*/*;q=0.8" } });
    } catch (e) { clearTimeout(t); throw new Error("The website didn’t answer."); }
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { clearTimeout(t); cur = new URL(r.headers.get("location"), p.href).href; continue; }
    if (!r.ok) { clearTimeout(t); throw new Error("The website answered with an error (" + r.status + ")."); }
    const chunks = []; let n = 0;
    try {
      for await (const c of r.body) { n += c.length; if (n > maxBytes) break; chunks.push(c); }
    } finally { clearTimeout(t); try { ctl.abort(); } catch (e) {} }
    return { url: p.href, type: (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase(), buf: Buffer.concat(chunks) };
  }
  throw new Error("The website redirects too many times.");
}

const ent = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)));
const attr = (tag, name) => { const m = new RegExp("\\b" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i").exec(tag); return m ? ent(m[2] ?? m[3] ?? m[4]) : ""; };
const meta = (html, key) => {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const k = (attr(m[0], "property") || attr(m[0], "name") || attr(m[0], "itemprop")).toLowerCase();
    if (k === key) return attr(m[0], "content").trim();
  }
  return "";
};

function jsonLd(html) {
  const out = [];
  const walk = (x) => {
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) return x.forEach(walk);
    out.push(x);
    if (x["@graph"]) walk(x["@graph"]);
    for (const k of ["publisher", "author", "provider", "brand", "organization", "mainEntity", "parentOrganization"]) if (x[k]) walk(x[k]);
  };
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(m[1].trim())); } catch (e) {}
  }
  return out;
}

const SOC = [
  ["instagram", /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]{2,30})\/?(?:[?#].*)?$/i, ["p", "reel", "explore", "accounts", "stories", "tv"]],
  ["tiktok", /^https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]{2,30})\/?(?:[?#].*)?$/i, []],
  ["facebook", /^https?:\/\/(?:www\.|m\.|web\.)?(?:facebook|fb)\.com\/((?:profile\.php\?id=\d+)|(?:share\/(?!p\/|r\/|v\/)[A-Za-z0-9]{6,20})|[A-Za-z0-9.\-]{2,60})\/?(?:[?#].*)?$/i, ["sharer", "sharer.php", "share", "dialog", "plugins", "tr", "events", "groups", "watch", "login", "pages"]],
  ["linkedin", /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/((?:company|in|school)\/[A-Za-z0-9_\-%.]{2,100})\/?(?:[?#].*)?$/i, []],
  ["youtube", /^https?:\/\/(?:www\.|m\.)?youtube\.com\/((?:@[A-Za-z0-9_.\-]{2,60})|(?:channel|c|user)\/[A-Za-z0-9_\-]{2,60})\/?(?:[?#].*)?$/i, []],
  ["x", /^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{2,15})\/?(?:[?#].*)?$/i, ["share", "intent", "home", "search", "hashtag", "i"]],
  ["whatsapp", /^https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?\+?(\d{6,15})/i, []],
];

function socialFrom(href, found) {
  for (const [k, re, bad] of SOC) {
    if (found[k]) continue;
    const m = re.exec(href);
    if (!m) continue;
    const id = m[1];
    if (bad.includes(id.toLowerCase())) continue;
    if (k === "instagram" || k === "tiktok" || k === "x") found[k] = "@" + id;
    else if (k === "whatsapp") found[k] = "+" + id;
    else found[k] = href.replace(/[?#].*$/, "").replace(/\/$/, "");
  }
}

/* booking, Google review, Google profile and a main call-to-action link */
const BOOK_HOSTS = /(^|\.)(calendly\.com|cal\.com|setmore\.com|acuityscheduling\.com|as\.me|youcanbook\.me|tidycal\.com|zcal\.co|simplybook\.(me|it|asia)|fresha\.com|gettimely\.com|cliniko\.com|nookal\.com|halaxy\.com|hotdoc\.com\.au|healthengine\.com\.au|bookwhen\.com|vagaro\.com|mindbodyonline\.com|opentable\.(com|co\.nz|com\.au)|resdiary\.com|nowbookit\.com|bookeo\.com|picktime\.com|square\.site|appointy\.com|meetings\.hubspot\.com|zoho\.com|bookings\.gettimely\.com|treatwell\.[a-z.]+|booksy\.com|timely\.(co\.nz|com))$/i;
const BOOK_PATHS = /^https?:\/\/(?:(?:outlook\.office(?:365)?\.com\/(?:book|owa\/calendar\/[^/]+\/bookings))|(?:calendar\.app\.google\/)|(?:calendar\.google\.com\/calendar\/(?:appointments|u\/\d+\/appointments))|(?:(?:app|book)\.squareup\.com\/appointments)|(?:squareup\.com\/appointments)|(?:[\w-]+\.zohobookings\.[a-z.]+\/)|(?:[\w-]+\.setmore\.com))/i;
const BOOK_TEXT = /\b(book(?:\s+(?:now|online|in|a|an|your|my|today|a\s+call|a\s+time|an?\s+appointment|a\s+meeting|a\s+consult(?:ation)?|a\s+session|a\s+table|a\s+service|a\s+free[\w\s]*))?|booking|appointments?|schedule\s+a\s+(?:call|meeting|time|consult(?:ation)?)|reserve(?:\s+a\s+table)?|make\s+a\s+reservation)\b/i;
const EXTRA_TEXT = /^(get\s+(?:a|your|an)\s+(?:free\s+)?(?:quote|estimate|price)|request\s+a\s+(?:free\s+)?(?:quote|callback|call\s*back)|free\s+quote|order\s+(?:online|now)|shop\s+(?:now|online)|view\s+(?:our\s+)?menu|our\s+menu|see\s+(?:the\s+)?menu|donate(?:\s+now)?|enrol(?:\s+now)?|enroll(?:\s+now)?|apply\s+now|get\s+started|start\s+(?:a|your)\s+project|free\s+consultation|get\s+in\s+touch|enquire\s+(?:now|today)|contact\s+us\s+today)$/i;
function googleLink(u) {
  let x; try { x = new URL(u); } catch (e) { return null; }
  const h = x.hostname.replace(/^www\./, ""), path = x.pathname;
  if (h === "g.page") {
    const m = /^\/r\/([\w-]+)(\/review)?/i.exec(path);
    if (m) return { review: "https://g.page/r/" + m[1] + "/review", profile: m[2] ? "" : "https://g.page/r/" + m[1] };
    const n = /^\/([\w.-]+)(\/review)?/i.exec(path);
    if (n) return { review: n[2] ? "https://g.page/" + n[1] + "/review" : "", profile: "https://g.page/" + n[1] };
  }
  if (h === "search.google.com" && /writereview/i.test(path + x.search) && /placeid=/i.test(x.search)) return { review: x.href, profile: "" };
  if (/^(maps\.app\.goo\.gl|goo\.gl|g\.co|share\.google)$/.test(h) && (h !== "goo.gl" || /^\/maps\//.test(path)) && (h !== "g.co" || /^\/kgs\//.test(path))) return { review: "", profile: x.href };
  if (/^(maps\.)?google\.[a-z.]+$/.test(h) && (/^\/maps\/(place|search)\//.test(path) || ((/^\/maps\/?$/.test(path) || h.startsWith("maps.")) && /[?&]cid=\d+/.test(x.search)))) {
    if (/writereview|\/review/i.test(path + x.search)) return { review: x.href, profile: "" };
    return { review: "", profile: x.href };
  }
  /* google.com/search?...&ludocid=<id>#lrd=...,1,... : the reviews panel (",3," opens "write a review") */
  if (/^google\.[a-z.]+$/.test(h) && path === "/search") {
    const cid = x.searchParams.get("ludocid"), lrd = /lrd=([^&]+)/.exec(x.hash);
    if (cid || lrd) {
      let review = "";
      if (lrd) { const parts = decodeURIComponent(lrd[1]).split(","); parts[1] = "3"; x.hash = "lrd=" + parts.join(","); review = x.href; }
      return { review, profile: cid && /^\d+$/.test(cid) ? "https://maps.google.com/?cid=" + cid : "" };
    }
  }
  if (/(^|\.)business\.site$/.test(h)) return { review: "", profile: x.origin };
  return null;
}
function linkText(inner, tag) {
  const t = ent(String(inner).replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return t || attr(tag, "aria-label").trim() || attr(tag, "title").trim();
}
const niceLabel = (t, fallback) => { t = String(t || "").replace(/[→›»>➜➔✓✔★☆]+/g, "").replace(/\s+/g, " ").trim(); return t.length >= 3 && t.length <= 32 && /[a-z]/i.test(t) && !/^(https?:|www\.)/i.test(t) ? t.charAt(0).toUpperCase() + t.slice(1) : fallback; };
export function findLinks(html, base) {
  const out = { book: null, review: "", google: "", extra: null };
  const origin = (() => { try { return new URL(base).origin; } catch (e) { return ""; } })();
  let bookInside = null;
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]{0,600}?)<\/a>/gi)) {
    const tag = "<a" + m[1] + ">", h = attr(tag, "href");
    if (!h || /^(tel:|mailto:|javascript:)/i.test(h)) continue;
    let u; try { u = new URL(ent(h).trim(), base); } catch (e) { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const href = u.href, text = linkText(m[2], tag);
    const g = googleLink(href);
    if (g) { if (g.review && !out.review) out.review = g.review; if (g.profile && !out.google) out.google = g.profile; continue; }
    const host = u.hostname.replace(/^www\./, "");
    if (!out.book && (BOOK_HOSTS.test(host) || BOOK_PATHS.test(href))) { out.book = { url: href, label: niceLabel(BOOK_TEXT.test(text) ? text : "", "Book online") }; continue; }
    const inSite = u.origin === origin;
    if (!bookInside && inSite && text.length <= 40 && BOOK_TEXT.test(text) && !/\b(e-?book|facebook|bookkeep\w*|notebook|guestbook|booklet)\b/i.test(text + " " + u.pathname) && (u.pathname !== "/" || u.hash)) bookInside = { url: href, label: niceLabel(text, "Book now") };
    if (!out.extra && text.length <= 32 && EXTRA_TEXT.test(text.replace(/[→›»>!.]+$/g, "").trim())) out.extra = { url: href, label: niceLabel(text.replace(/[!.]+$/, ""), text) };
  }
  if (!out.book && bookInside) out.book = bookInside;
  /* the business's map listing from structured data */
  if (!out.google) for (const x of jsonLd(html)) { const hm = typeof x.hasMap === "string" ? x.hasMap : x.hasMap && x.hasMap.url; const g = hm && googleLink(hm); if (g && g.profile) { out.google = g.profile; break; } }
  return out;
}

const cleanPhone = (s) => ent(s).replace(/^tel:/i, "").replace(/%20/g, " ").replace(/[^\d+()\- ]/g, "").replace(/\s+/g, " ").trim();
const okPhone = (s) => { const d = s.replace(/\D/g, ""); return d.length >= 7 && d.length <= 15; };
const okEmail = (s) => /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(s) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(s) && !/(sentry|wixpress|example\.com|domain\.com|email\.com)/i.test(s);

/* everything we can tell from one page */
export function readPage(html, base) {
  const abs = (h) => { try { return new URL(ent(h).trim(), base).href; } catch (e) { return ""; } };
  const r = { name: "", phones: [], emails: [], address: "", social: {}, logos: [], contact: "" };
  const ld = jsonLd(html);
  const org = ld.find((x) => /Organization|LocalBusiness|Corporation|Store|Restaurant|Service|ProfessionalService|Brand/i.test([].concat(x["@type"] || []).join(" "))) || {};
  const site = ld.find((x) => /WebSite/i.test([].concat(x["@type"] || []).join(" "))) || {};
  const title = ent((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || "").replace(/\s+/g, " ").trim();
  r.name = (typeof org.name === "string" && org.name) || meta(html, "og:site_name") || meta(html, "application-name") || (typeof site.name === "string" && site.name) ||
    title.split(/\s+[|–—:•·-]\s+/).filter(Boolean).sort((a, b) => a.length - b.length)[0] || "";
  r.name = r.name.replace(/\s+/g, " ").trim().slice(0, 80);

  for (const x of ld) {
    if (typeof x.telephone === "string") r.phones.push(cleanPhone(x.telephone));
    if (typeof x.email === "string") r.emails.push(x.email.replace(/^mailto:/i, "").trim());
    for (const s of [].concat(x.sameAs || [])) if (typeof s === "string") socialFrom(s, r.social);
    const lg = x.logo && (typeof x.logo === "string" ? x.logo : x.logo.url || x.logo.contentUrl);
    if (lg && typeof lg === "string") r.ldLogos = (r.ldLogos || []).concat(abs(lg));
    if (!r.address && x.address) {
      const a = x.address;
      r.address = typeof a === "string" ? a : [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter((v) => typeof v === "string" && v).join(", ");
    }
  }
  for (const m of html.matchAll(/<a\b[^>]*>([^<]{0,40})/gi)) {
    const h = attr(m[0], "href");
    if (!h) continue;
    if (/^tel:/i.test(h)) { const tx = cleanPhone(m[1] || ""); r.phones.push(okPhone(tx) && tx.replace(/\D/g, "").endsWith(cleanPhone(h).replace(/\D/g, "").slice(-7)) ? tx : cleanPhone(h)); continue; }
    if (/^mailto:/i.test(h)) { r.emails.push(decodeURIComponent(h.replace(/^mailto:/i, "").split("?")[0]).trim()); continue; }
    const u = abs(h);
    socialFrom(u, r.social);
    if (!r.contact && /contact/i.test(h) && u.startsWith(new URL(base).origin)) r.contact = u;
    if (!r.about && /(about|team|our-story|who-we-are|meet|people|staff)/i.test(h) && !/#/.test(h.replace(/^[^#]*$/, "")) && u.startsWith(new URL(base).origin) && u !== base) r.about = u;
  }
  if (!r.emails.length) for (const m of html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").matchAll(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}/g)) r.emails.push(m[0]);

  /* logo: an <img> that says "logo", then the icons the site gives phones */
  const nm = r.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(), first = nm.split(" ")[0] || "";
  /* the header: a <header>, or a block named header/navbar, or else the top of the page */
  const body = html.slice(Math.max(0, html.search(/<body\b/i)));
  const hdr = (/<header\b[\s\S]*?<\/header>/i.exec(body) || /<(div|nav|section)\b[^>]*(?:id|class)\s*=\s*["'][^"']*\b(?:site-header|header|navbar|masthead|top-bar|topbar)\b[\s\S]{0,8000}/i.exec(body) || [body.slice(0, 6000)])[0];
  const inHdr = [], strong = [], weak = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const t = m[0], src = attr(t, "src") || attr(t, "data-src") || (attr(t, "srcset").split(/\s+/)[0] || "");
    if (!src || /^data:/i.test(src)) continue;
    const alt = attr(t, "alt").toLowerCase(), tags = [attr(t, "class"), attr(t, "id"), alt, src].join(" ");
    if (hdr.includes(t)) { if (!/(icon|flag|avatar|cart|search|menu|arrow)/i.test(tags) || /logo/i.test(tags)) inHdr.push({ u: abs(src), l: /logo/i.test(tags) || (first.length > 2 && alt.includes(first)) }); }
    else if (/logo/i.test(tags)) strong.push(abs(src));
    else if (first.length > 2 && alt.includes(first)) weak.push(abs(src));
  }
  /* header pictures named logo (or after the business) first, then the header's first picture */
  const hdrImgs = [...inHdr.filter((x) => x.l).map((x) => x.u), ...inHdr.filter((x) => !x.l).slice(0, 1).map((x) => x.u)];
  r.logos.push(...hdrImgs, ...strong, ...(r.ldLogos || []), ...weak);
  r.hdrCount = hdrImgs.length;
  /* a header logo drawn without an <img>: as a background in the page's styles, or as an inline <svg> */
  r.hdrClasses = [];
  for (const m of hdr.matchAll(/<(?!img\b)[a-z][a-z0-9]*\b[^>]*>/gi)) {
    const t = m[0], cls = attr(t, "class"), tags = [cls, attr(t, "id"), attr(t, "aria-label")].join(" ");
    if (/logo/i.test(tags) || (/brand/i.test(cls) && /role\s*=\s*["']?img/i.test(t))) for (const c of cls.split(/\s+/)) if (c && /logo|brand/i.test(c)) r.hdrClasses.push(c);
  }
  r.hdrClasses = [...new Set(r.hdrClasses)].slice(0, 6);
  const svgM = /<(?:a|div|span)\b[^>]*(?:class|id|aria-label)\s*=\s*["'][^"']*(?:logo|brand)[^"']*["'][^>]*>\s*(?:<[^>]+>\s*){0,2}(<svg\b[\s\S]*?<\/svg>)/i.exec(hdr) || /(<svg\b[^>]*(?:class|id|aria-label)\s*=\s*["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<\/svg>)/i.exec(hdr);
  if (svgM && svgM[1].length > 300 && svgM[1].length < 300000) { let sv = svgM[1]; if (!/xmlns=/.test(sv)) sv = sv.replace(/<svg\b/i, '<svg xmlns="http://www.w3.org/2000/svg"'); r.hdrSvg = "data:image/svg+xml;base64," + Buffer.from(sv).toString("base64"); }
  r.styleUrls = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) if (/stylesheet/i.test(attr(m[0], "rel")) && attr(m[0], "href")) r.styleUrls.push(abs(attr(m[0], "href")));
  const rel = (want) => { for (const m of html.matchAll(/<link\b[^>]*>/gi)) { const rl = attr(m[0], "rel").toLowerCase(); if (want.some((w) => rl.split(/\s+/).includes(w) || rl === w)) { const h = attr(m[0], "href"); if (h) return abs(h); } } return ""; };
  const touch = rel(["apple-touch-icon", "apple-touch-icon-precomposed"]);
  if (touch) r.logos.push(touch);
  const og = meta(html, "og:image");
  r.ogImage = og ? abs(og) : "";
  r.people = findPeople(html, ld, r.name);
  const byDigits = new Map();
  for (const p of r.phones.filter(okPhone)) { const d = p.replace(/\D/g, "").slice(-9), had = byDigits.get(d); if (!had || (/\s/.test(p) && !/\s/.test(had))) byDigits.set(d, p); }
  r.phones = [...byDigits.values()];
  r.emails = [...new Set(r.emails.map((e) => e.toLowerCase()).filter(okEmail))];
  r.logos = [...new Set(r.logos.filter(Boolean))];
  r.links = findLinks(html, base);
  return r;
}

/* a director, owner or founder named on the page: from structured data first, then wording like
   "Jane Smith, Director", "Director: Jane Smith", "Jane Smith (Owner)" or "Meet Jane Smith" */
const ROLES = "Managing Director|Director|Co-?founder|Founder|Owner|Business Owner|Chief Executive Officer|CEO|Principal|General Manager|Operations Manager|Manager|Partner|Proprietor";
const NAME = "([A-Z][a-z'’\\-]+(?:\\s+(?:[A-Z][a-z'’\\-]+|[A-Z]\\.)){1,2})";
function findPeople(html, ld, biz) {
  const out = [], seen = new Set(), bizWords = new Set(String(biz || "").toLowerCase().split(/\W+/).filter(Boolean));
  const add = (name, role) => {
    name = String(name || "").replace(/\s+/g, " ").trim(); role = String(role || "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 40 || !/\s/.test(name)) return;
    const k = name.toLowerCase();
    if (seen.has(k) || k.split(" ").some((w) => bizWords.has(w)) || /\b(the|our|your|and|with|for|from|about|team|services?|solutions?|limited|ltd|group|google|review|street|road)\b/i.test(name)) return;
    seen.add(k); out.push({ name, role: role.replace(/^co-?founder$/i, "Co-founder") });
  };
  const people = [];
  for (const x of ld) {
    for (const key of ["founder", "employee", "member", "author", "contactPoint"]) for (const p of [].concat(x[key] || [])) if (p && typeof p === "object" && typeof p.name === "string") people.push({ name: p.name, role: p.jobTitle || (key === "founder" ? "Founder" : "") });
    if (/Person/.test([].concat(x["@type"] || []).join(" ")) && typeof x.name === "string") people.push({ name: x.name, role: x.jobTitle || "" });
  }
  for (const p of people) if (p.role) add(p.name, typeof p.role === "string" ? p.role : "");
  const text = ent(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " | ")).replace(/\s+/g, " ");
  const pats = [
    new RegExp(NAME + "\\s*(?:\\||,|–|—|-|\\()\\s*(?:\\|\\s*)?(" + ROLES + ")\\b", "g"),
    new RegExp("\\b(" + ROLES + ")\\s*(?::|\\||–|—|-)\\s*(?:\\|\\s*)?" + NAME, "g"),
    new RegExp("\\b(?:Meet|meet)\\s+" + NAME + "(?:\\s*,\\s*(?:our\\s+)?(" + ROLES + "))?", "g"),
  ];
  for (const m of text.matchAll(pats[0])) add(m[1], m[2]);
  for (const m of text.matchAll(pats[1])) add(m[2], m[1]);
  for (const m of text.matchAll(pats[2])) add(m[1], m[2] || "");
  return out.slice(0, 4);
}

export function normaliseSite(input) {
  let s = String(input || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  try { const u = new URL(s); return u.href; } catch (e) { return ""; }
}

const sameUrl = (a, b) => a.replace(/\/(index\.html?)?(?=#|$)/i, "") === b.replace(/\/(index\.html?)?(?=#|$)/i, "");
const addLinks = (r, o) => { for (const k of ["book", "review", "google", "extra"]) if (!r.links[k] && o.links[k]) r.links[k] = o.links[k]; };
export async function siteInfo(input) {
  const start = normaliseSite(input);
  if (!start) throw new Error("Please type a website address, like yourbusiness.co.nz");
  const page = await grab(start, 1.5e6);
  if (!/html|xml|text\/plain/.test(page.type || "text/html")) throw new Error("That address isn’t a web page.");
  const html = page.buf.toString("utf8");
  const r = readPage(html, page.url);
  /* the contact page often has what the home page leaves out */
  if ((!r.phones.length || !r.emails.length || !r.address) && r.contact && r.contact !== page.url) {
    try {
      const c = await grab(r.contact, 1e6);
      const rc = readPage(c.buf.toString("utf8"), c.url);
      r.phones = [...new Set(r.phones.concat(rc.phones))];
      r.emails = [...new Set(r.emails.concat(rc.emails))];
      r.address = r.address || rc.address;
      for (const k in rc.social) r.social[k] = r.social[k] || rc.social[k];
      addLinks(r, rc);
    } catch (e) {}
  }
  /* the about or team page usually names the director or owner */
  if (r.about && r.about !== page.url) {
    try {
      const a = await grab(r.about, 1.2e6);
      const ra = readPage(a.buf.toString("utf8"), a.url);
      const have = new Set(r.people.map((p) => p.name.toLowerCase()));
      for (const p of ra.people) if (!have.has(p.name.toLowerCase())) r.people.push(p);
      for (const k in ra.social) r.social[k] = r.social[k] || ra.social[k];
      r.phones = [...new Set(r.phones.concat(ra.phones))];
      addLinks(r, ra);
    } catch (e) {}
  }
  /* the logo, as a picture the builder can read colours from: the header's own logo first */
  let logo = null;
  let cands = r.logos;
  if (!r.hdrCount && (r.hdrClasses.length || r.hdrSvg)) {
    const found = [];
    if (r.hdrClasses.length) {
      const srcs = [{ text: html, base: page.url }];
      for (const u of r.styleUrls.filter((u) => { try { return new URL(u).hostname === new URL(page.url).hostname; } catch (e) { return false; } }).slice(0, 3)) {
        try { const g = await grab(u, 8e5, "text/css,*/*"); srcs.push({ text: g.buf.toString("utf8"), base: g.url }); } catch (e) {}
      }
      const urlIn = (txt, base) => { const m = /url\(\s*["']?([^"')]+)["']?\s*\)/i.exec(txt); if (!m) return ""; const u = m[1].trim(); if (/^data:image\//i.test(u)) return u; try { return new URL(u, base).href; } catch (e) { return ""; } };
      const varUrl = (name) => { for (const s2 of srcs) { const m = new RegExp(name.replace(/[-]/g, "\\-") + "\\s*:\\s*(url\\((?:\"[^\"]*\"|'[^']*'|[^)]*)\\))", "i").exec(s2.text); if (m) { const u = urlIn(m[1], s2.base); if (u) return u; } } return ""; };
      for (const c of r.hdrClasses) {
        const re = new RegExp("\\." + c.replace(/[^\w-]/g, "") + "(?![\\w-])[^{}]*\\{([^}]*)\\}", "g");
        for (const s2 of srcs) {
          for (const m of s2.text.matchAll(re)) {
            const body = m[1], bg = /background(?:-image)?\s*:([^;]*)/i.exec(body) || /(?:-webkit-)?mask(?:-image)?\s*:([^;]*)/i.exec(body);
            if (!bg) continue;
            const v = /var\(\s*(--[\w-]+)/.exec(bg[1]);
            const u = v ? varUrl(v[1]) : urlIn(bg[1], s2.base);
            if (u) found.push(u);
          }
        }
      }
    }
    if (r.hdrSvg) found.push(r.hdrSvg);
    cands = [...new Set(found.slice(0, 3).concat(r.logos))];
  }
  if (r.links.extra && r.links.book && sameUrl(r.links.extra.url, r.links.book.url)) r.links.extra = null;
  const host = new URL(page.url).hostname.replace(/^www\./, "");
  const emails = r.emails.slice().sort((a, b) => (b.endsWith("@" + host) ? 1 : 0) - (a.endsWith("@" + host) ? 1 : 0));
  for (const u of cands.concat(r.ogImage ? [r.ogImage] : []).slice(0, 6)) {
    try {
      const dm = /^data:(image\/[\w.+-]+)(;base64)?,(.*)$/is.exec(u);
      if (dm) {
        const buf = dm[2] ? Buffer.from(dm[3], "base64") : Buffer.from(decodeURIComponent(dm[3]));
        if (buf.length < 200 || buf.length > 1.5e6) continue;
        logo = { url: "", type: dm[1].toLowerCase(), data: "data:" + dm[1].toLowerCase() + ";base64," + buf.toString("base64"), fromOg: false };
        break;
      }
      const g = await grab(u, 1.5e6, "image/*");
      const type = /svg/.test(g.type) || /\.svg(\?|$)/i.test(u) ? "image/svg+xml" : (g.type.startsWith("image/") ? g.type : "");
      if (!type || g.buf.length < 200) continue;
      logo = { url: g.url, type, data: "data:" + type + ";base64," + g.buf.toString("base64"), fromOg: u === r.ogImage && !r.logos.includes(u) };
      break;
    } catch (e) {}
  }
  return { website: page.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), name: r.name, phone: r.phones[0] || "", phones: r.phones.slice(0, 4), email: emails[0] || "", emails: emails.slice(0, 4), address: r.address.slice(0, 160), social: r.social, links: r.links, people: r.people.slice(0, 4), logo };
}
