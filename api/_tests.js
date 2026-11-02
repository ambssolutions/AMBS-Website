/* Speed and security tests for Site health (/admin → Insights → Site health → Speed & security).
   Each test runs on its own request so a slow one (Google PageSpeed takes 20–40 seconds) never holds up the rest.
   Read-only: every test only looks at the public website.
     psi       Google PageSpeed Insights (Lighthouse) for phone or laptop, plus real-visitor figures from Chrome when Google has them.
               Uses Vercel env PAGESPEED_KEY when set (a free Google Cloud API key with "PageSpeed Insights API" enabled);
               without it Google's shared allowance is often used up, and the test says how to add a key.
     security  Mozilla HTTP Observatory: grade for the website's security settings (headers).
     cert      the https padlock certificate: who issued it, when it runs out, and that http and www go to https://ambs.co.nz.
     response  how fast the server answers (3 tries), page size and compression.
     sharing   the title, description and picture Facebook, LinkedIn and WhatsApp show for a link.
     index     handled in _ga.js (inspectUrl), through the Search Console connection. */
import tls from "node:tls";

const HOST = "ambs.co.nz";
const strip = (s) => String(s || "").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
export const okUrl = (u) => { try { const x = new URL(u); return x.protocol === "https:" && x.hostname === HOST ? x.href : ""; } catch (e) { return ""; } };

const METRIC = {
  "first-contentful-paint": "First words and pictures appear",
  "largest-contentful-paint": "Main content shows",
  "total-blocking-time": "Busy (can’t tap) for",
  "cumulative-layout-shift": "Things jump around",
  "speed-index": "Looks complete",
};
const FIELD = {
  LARGEST_CONTENTFUL_PAINT_MS: ["Main content shows", "ms"],
  INTERACTION_TO_NEXT_PAINT: ["Reacts to taps", "ms"],
  CUMULATIVE_LAYOUT_SHIFT_SCORE: ["Things jump around", "cls"],
  FIRST_CONTENTFUL_PAINT_MS: ["First words appear", "ms"],
  EXPERIMENTAL_TIME_TO_FIRST_BYTE: ["Server answers", "ms"],
};
const CATS = [["performance", "Speed"], ["accessibility", "Accessibility"], ["best-practices", "Best practices"], ["seo", "SEO"]];

function field(le) {
  if (!le || !le.metrics) return null;
  const out = [];
  for (const [k, [name, unit]] of Object.entries(FIELD)) {
    const m = le.metrics[k];
    if (!m) continue;
    const v = unit === "cls" ? (m.percentile / 100).toFixed(2) : m.percentile >= 1000 ? (m.percentile / 1000).toFixed(1) + " s" : m.percentile + " ms";
    out.push({ name, value: v, cat: m.category || "" });
  }
  return out.length ? { overall: le.overall_category || "", origin: !!le.origin_fallback, metrics: out } : null;
}

export async function psi(url, strategy) {
  const key = process.env.PAGESPEED_KEY || "";
  const q = new URLSearchParams({ url, strategy: strategy === "desktop" ? "desktop" : "mobile", locale: "en" });
  CATS.forEach((c) => q.append("category", c[0]));
  if (key) q.set("key", key);
  let r, j;
  try {
    r = await fetch("https://www.googleapis.com/pagespeedonline/v5/runPagespeed?" + q, { signal: AbortSignal.timeout(55000) });
    j = await r.json().catch(() => ({}));
  } catch (e) { return { error: "Google’s speed test took too long this time. Try again in a minute." }; }
  if (!r.ok) {
    const m = (j.error && j.error.message) || String(r.status);
    if (r.status === 429 || /quota/i.test(m)) return { needsKey: true, hasKey: !!key, why: m };
    return { error: "Google’s speed test answered with an error: " + m };
  }
  const lr = j.lighthouseResult || {}, au = lr.audits || {}, cats = lr.categories || {};
  const scores = CATS.map(([id, name]) => ({ id, name, score: cats[id] && cats[id].score != null ? Math.round(cats[id].score * 100) : null }));
  const metrics = Object.keys(METRIC).filter((k) => au[k]).map((k) => ({ name: METRIC[k], value: au[k].displayValue || "", score: au[k].score }));
  /* what to improve: performance audits with savings, and every failing check in the other three */
  const fix = [];
  for (const [id, name] of CATS) {
    const c = cats[id];
    if (!c) continue;
    for (const ref of c.auditRefs || []) {
      const a = au[ref.id];
      if (!a || ref.group === "metrics" || a.score == null || a.score >= 0.9) continue;
      if (!["binary", "numeric", "metricSavings"].includes(a.scoreDisplayMode)) continue;
      if (id === "performance" && !a.displayValue) continue;   // insights with nothing measurable to save
      fix.push({ cat: name, title: strip(a.title), value: a.displayValue || "", weight: ref.weight || 0, score: a.score });
    }
  }
  /* real failures in accessibility, best practices and SEO first, then the biggest speed savings */
  fix.sort((a, b) => (a.cat === "Speed") - (b.cat === "Speed") || a.score - b.score || b.weight - a.weight);
  const seen = new Set(), speed = { n: 0 };
  return {
    strategy: q.get("strategy"), url, at: lr.fetchTime || new Date().toISOString(), lighthouse: lr.lighthouseVersion || "",
    scores, metrics, field: field(j.loadingExperience) || field(j.originLoadingExperience),
    fix: fix.filter((f) => !seen.has(f.title) && seen.add(f.title) && (f.cat !== "Speed" || ++speed.n <= 5)).slice(0, 12),
    report: "https://pagespeed.web.dev/analysis?url=" + encodeURIComponent(url) + "&form_factor=" + (q.get("strategy") === "desktop" ? "desktop" : "mobile"),
  };
}

export async function security() {
  const base = "https://observatory-api.mdn.mozilla.net/api/v2/";
  try {
    const r = await fetch(base + "scan?host=" + HOST, { method: "POST", signal: AbortSignal.timeout(25000) });
    const s = await r.json().catch(() => ({}));
    if (!r.ok || s.error) return { error: "Mozilla’s security check answered with an error: " + (s.error || s.message || r.status) };
    const a = await fetch(base + "analyze?host=" + HOST, { signal: AbortSignal.timeout(15000) }).then((x) => x.json()).catch(() => ({}));
    const tests = Object.values(a.tests || {}).map((t) => ({ name: strip(t.title || t.name), pass: !!t.pass || (t.score_modifier || 0) >= 0, what: strip(t.score_description), fix: strip(t.recommendation), mod: t.score_modifier || 0 }))
      .sort((x, y) => (x.pass - y.pass) || (x.mod - y.mod));
    return { grade: s.grade, score: s.score, passed: s.tests_passed, failed: s.tests_failed, total: s.tests_quantity, at: s.scanned_at, tests, report: s.details_url || "https://developer.mozilla.org/en-US/observatory/analyze?host=" + HOST };
  } catch (e) { return { error: "Mozilla’s security check didn’t answer in time. Try again in a minute." }; }
}

function peer(host) {
  return new Promise((ok) => {
    const s = tls.connect({ host, port: 443, servername: host, timeout: 8000 }, () => {
      const c = s.getPeerCertificate() || {};
      ok({ host, valid: s.authorized, err: s.authorizationError ? String(s.authorizationError) : "", protocol: s.getProtocol(), to: c.valid_to || "", from: c.valid_from || "",
        issuer: (c.issuer && (c.issuer.O || c.issuer.CN)) || "", names: String(c.subjectaltname || "").replace(/DNS:/g, "").split(/,\s*/).filter(Boolean).slice(0, 6) });
      s.end();
    });
    s.on("error", (e) => ok({ host, valid: false, err: e.message }));
    s.on("timeout", () => { s.destroy(); ok({ host, valid: false, err: "no answer" }); });
  });
}
/* follows up to 4 redirects and reports where the address ends up */
async function hop(u) {
  let at = u, status = 0, n = 0;
  try {
    for (; n < 4; n++) {
      const r = await fetch(at, { redirect: "manual", signal: AbortSignal.timeout(8000) });
      status = r.status;
      const loc = r.headers.get("location");
      if (!(status >= 300 && status < 400 && loc)) break;
      at = new URL(loc, at).href;
    }
    return { from: u, status, to: at, hops: n };
  } catch (e) { return { from: u, status: 0, to: "", hops: n }; }
}
export async function cert() {
  const [main, www, h1, h2, h3] = await Promise.all([peer(HOST), peer("www." + HOST), hop("http://" + HOST + "/"), hop("http://www." + HOST + "/"), hop("https://www." + HOST + "/")]);
  const days = main.to ? Math.floor((new Date(main.to) - Date.now()) / 86400000) : null;
  const goes = (h) => /^https:\/\/ambs\.co\.nz\/?$/.test(h.to) && h.status === 200 && h.hops > 0;
  const hsts = await fetch("https://" + HOST + "/", { method: "HEAD", signal: AbortSignal.timeout(8000) }).then((r) => r.headers.get("strict-transport-security") || "").catch(() => "");
  return {
    valid: main.valid, err: main.err, issuer: main.issuer, protocol: main.protocol, expires: main.to, days, names: main.names || [], wwwValid: www.valid,
    redirects: [h1, h2, h3].map((h) => ({ from: h.from, to: h.to, ok: goes(h), hops: h.hops })), hsts: !!hsts,
    report: "https://www.ssllabs.com/ssltest/analyze.html?d=" + HOST,
  };
}

export async function response(url) {
  const tries = [];
  let last = null;
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    try {
      const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + t0 + i, { headers: { "Accept-Encoding": "br, gzip", "User-Agent": "AMBS-editor-check" }, signal: AbortSignal.timeout(10000) });
      const first = Date.now() - t0, body = await r.arrayBuffer();
      tries.push({ first, total: Date.now() - t0 });
      last = { status: r.status, size: body.byteLength, enc: r.headers.get("content-encoding") || "", cache: r.headers.get("x-vercel-cache") || "", region: (r.headers.get("x-vercel-id") || "").split("::")[0] };
    } catch (e) { tries.push({ first: 0, total: 0, fail: true }); }
  }
  const ok = tries.filter((t) => !t.fail);
  if (!ok.length) return { error: "The website didn’t answer from our server." };
  const med = (k) => ok.map((t) => t[k]).sort((a, b) => a - b)[Math.floor(ok.length / 2)];
  return Object.assign({ url, first: med("first"), total: med("total"), tries: ok.length }, last);
}

export async function sharing(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "facebookexternalhit/1.1 (AMBS-editor-check)" }, signal: AbortSignal.timeout(10000) });
    const h = await r.text();
    const meta = (p) => { const m = h.match(new RegExp('<meta[^>]+(?:property|name)="' + p + '"[^>]*content="([^"]*)"', "i")) || h.match(new RegExp('<meta[^>]+content="([^"]*)"[^>]*(?:property|name)="' + p + '"', "i")); return m ? m[1].replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "’").replace(/&quot;/g, '"') : ""; };
    const title = meta("og:title") || ((h.match(/<title>([^<]*)<\/title>/i) || [])[1] || ""), desc = meta("og:description") || meta("description"), img = meta("og:image");
    let pic = null;
    if (img) {
      const p = await fetch(img, { method: "HEAD", signal: AbortSignal.timeout(8000) }).catch(() => null);
      pic = { ok: !!(p && p.ok), type: p ? p.headers.get("content-type") || "" : "", size: p ? +p.headers.get("content-length") || 0 : 0 };
    }
    const checks = [
      { name: "Title", ok: title.length >= 15 && title.length <= 90, note: title ? title.length + " characters" : "missing" },
      { name: "Description", ok: desc.length >= 50 && desc.length <= 200, note: desc ? desc.length + " characters" : "missing" },
      { name: "Picture", ok: !!(pic && pic.ok), note: !img ? "missing" : pic && pic.ok ? "found" + (pic.size ? ", " + Math.round(pic.size / 1024) + " KB" : "") : "can’t be loaded" },
      { name: "Picture size", ok: !!(meta("og:image:width") && +meta("og:image:width") >= 1200) || !meta("og:image:width"), note: meta("og:image:width") ? meta("og:image:width") + " × " + meta("og:image:height") + " px" : "not stated" },
      { name: "Card style for X", ok: !!meta("twitter:card"), note: meta("twitter:card") || "missing" },
    ];
    return { url, title, desc, img, site: meta("og:site_name") || HOST, checks, report: "https://www.opengraph.xyz/url/" + encodeURIComponent(url) };
  } catch (e) { return { error: "Couldn’t read the page." }; }
}
