/* Live visitors from Google Analytics (GA4 Realtime), for the editor's "Visitors now" tab.
   Needs two Vercel environment variables, set once:
     GA_PROPERTY_ID       the property's number (Analytics → Admin → Property details), e.g. 512345678
     GA_SERVICE_ACCOUNT   the whole JSON key of a Google Cloud service account that has Viewer access to that property
   Read-only: it asks Google for numbers and never changes anything in Analytics. */
import crypto from "node:crypto";
import { key } from "./_keys.js";

let tok = null, tokFor = ""; // { value, exp }, and which service account it belongs to

const b64u = (s) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(sa) {
  if (tokFor !== sa.client_email) tok = null;
  if (tok && Date.now() < tok.exp - 60000) return tok.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + claim).sign(sa.private_key).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + sig,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google didn't accept the connection key (" + (j.error_description || j.error || r.status) + ").");
  tok = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }; tokFor = sa.client_email;
  return tok.value;
}

async function report(id, t, body) {
  const r = await fetch("https://analyticsdata.googleapis.com/v1beta/properties/" + id + ":runRealtimeReport", {
    method: "POST",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (j.error && j.error.message) || String(r.status);
    if (r.status === 403) throw new Error("Google says the connection can't see this Analytics property. Add the service account's email as a Viewer in Analytics → Admin → Property access management. (" + m + ")");
    throw new Error("Google Analytics answered with an error: " + m);
  }
  return (j.rows || []).map((x) => ({ k: (x.dimensionValues || []).map((d) => d.value), v: (x.metricValues || []).map((d) => +d.value || 0) }));
}

const users = [{ name: "activeUsers" }];
const top = (rows) => rows.map((x) => ({ name: x.k[0], n: x.v[0] })).filter((x) => x.name && x.name !== "(not set)").slice(0, 8);

function conn() {
  const id = String(key("GA_PROPERTY_ID")).replace(/\D/g, "");
  const raw = key("GA_SERVICE_ACCOUNT");
  if (!id || !raw) return { setup: true, has: { property: !!id, key: !!raw } };
  try { return { id, sa: JSON.parse(raw) }; } catch (e) { throw new Error("The Google service account key isn't the whole JSON key file. Paste the file's full contents in Website settings → Connections."); }
}

/* Totals and top lists for the last 7, 28 or 90 days, each compared with the period before. */
async function runReport(id, t, body) {
  const r = await fetch("https://analyticsdata.googleapis.com/v1beta/properties/" + id + ":runReport", {
    method: "POST",
    headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google Analytics answered with an error: " + ((j.error && j.error.message) || r.status));
  return (j.rows || []).map((x) => ({ k: (x.dimensionValues || []).map((d) => d.value), v: (x.metricValues || []).map((d) => +d.value || 0) }));
}

/* A filter picked on the dashboard (a page, a source, a town or a device): { f: "page"|"source"|"place"|"device", v: "..." }.
   Realtime has no "source", so it is ignored there. Towns arrive as "Auckland, New Zealand" and filter on the town. */
const FDIM = { page: "pageTitle", source: "sessionDefaultChannelGroup", place: "city", device: "deviceCategory" };
const FDIM_RT = { page: "unifiedScreenName", place: "city", device: "deviceCategory" };
function dimFilter(f, rt) {
  if (!f || !f.f || !f.v) return undefined;
  const name = (rt ? FDIM_RT : FDIM)[f.f];
  if (!name) return undefined;
  const value = f.f === "place" ? String(f.v).split(",")[0].trim() : String(f.v);
  return { filter: { fieldName: name, stringFilter: { matchType: "EXACT", value } } };
}

export async function visitorsPeriod(days, f) {
  const c = conn();
  if (c.setup) return c;
  if (+days === 1) return visitors24(c, f);
  const n = [7, 28, 90].includes(+days) ? +days : 7;
  const t = await accessToken(c.sa);
  const cur = { startDate: n + "daysAgo", endDate: "today" }, prev = { startDate: 2 * n + "daysAgo", endDate: (n + 1) + "daysAgo" };
  const df = dimFilter(f, false);
  const one = (dims, metrics, limit, order) => runReport(c.id, t, { dateRanges: [cur], dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), limit: limit || 10, orderBys: order ? [{ metric: { metricName: order }, desc: true }] : undefined, dimensionFilter: df });
  const DM = ["activeUsers", "newUsers", "sessions", "screenPageViews"];
  const M = ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration", "engagementRate"];
  const [tot, totPrev, daily, pages, sources, places, devices, events] = await Promise.all([
    runReport(c.id, t, { dateRanges: [cur], metrics: M.map((name) => ({ name })), dimensionFilter: df }),
    runReport(c.id, t, { dateRanges: [prev], metrics: M.map((name) => ({ name })), dimensionFilter: df }),
    runReport(c.id, t, { dateRanges: [cur, prev], dimensions: [{ name: "nthDay" }], metrics: DM.map((name) => ({ name })), orderBys: [{ dimension: { dimensionName: "nthDay" } }], limit: 400, dimensionFilter: df }),
    one(["pageTitle"], ["screenPageViews"], 10, "screenPageViews"),
    one(["sessionDefaultChannelGroup"], ["sessions"], 10, "sessions"),
    one(["city", "country"], ["activeUsers"], 10, "activeUsers"),
    one(["deviceCategory"], ["activeUsers"], 5, "activeUsers"),
    one(["eventName"], ["eventCount"], 50, "eventCount"),
  ]);
  const pick = (rows) => { const o = {}; M.forEach((m, i) => { o[m] = rows.length ? rows[0].v[i] : 0; }); return o; };
  const named = (rows) => rows.map((x) => ({ name: x.k.filter((s) => s && s !== "(not set)").join(", "), n: x.v[0] })).filter((x) => x.name);
  return {
    days: n,
    totals: pick(tot), before: pick(totPrev),
    daily: dailyRows(daily, n),
    filter: f && f.f ? f : null,
    pages: named(pages), sources: named(sources), places: named(places), devices: named(devices),
    events: events.map((x) => ({ name: x.k[0], n: x.v[0] })),
  };
}

/* Visitors → 24 hours: the last 24 whole and current hours (New Zealand time, the property's time zone) against the
   24 before, hour by hour. Totals and top lists use a dateHour filter so a visitor is counted once across the hours. */
function nzHours(back, count) {
  const out = [], now = Date.now();
  for (let i = back + count - 1; i >= back; i--) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(now - i * 3600000)).map((x) => [x.type, x.value]));
    out.push(p.year + p.month + p.day + p.hour);
  }
  return out;
}
async function visitors24(c, f) {
  const t = await accessToken(c.sa);
  const curH = nzHours(0, 24), prevH = nzHours(24, 24);
  const df = dimFilter(f, false);
  const hf = (hours) => { const h = { filter: { fieldName: "dateHour", inListFilter: { values: hours } } }; return df ? { andGroup: { expressions: [df, h] } } : h; };
  const range = [{ startDate: "2daysAgo", endDate: "today" }];
  const DM = ["activeUsers", "newUsers", "sessions", "screenPageViews"];
  const M = ["activeUsers", "newUsers", "sessions", "screenPageViews", "averageSessionDuration", "engagementRate"];
  const one = (dims, metrics, limit, order) => runReport(c.id, t, { dateRanges: range, dimensions: dims.map((name) => ({ name })), metrics: metrics.map((name) => ({ name })), limit: limit || 10, orderBys: order ? [{ metric: { metricName: order }, desc: true }] : undefined, dimensionFilter: hf(curH) });
  const [tot, totPrev, hourly, pages, sources, places, devices, events] = await Promise.all([
    runReport(c.id, t, { dateRanges: range, metrics: M.map((name) => ({ name })), dimensionFilter: hf(curH) }),
    runReport(c.id, t, { dateRanges: range, metrics: M.map((name) => ({ name })), dimensionFilter: hf(prevH) }),
    runReport(c.id, t, { dateRanges: range, dimensions: [{ name: "dateHour" }], metrics: DM.map((name) => ({ name })), limit: 100, dimensionFilter: hf(curH.concat(prevH)) }),
    one(["pageTitle"], ["screenPageViews"], 10, "screenPageViews"),
    one(["sessionDefaultChannelGroup"], ["sessions"], 10, "sessions"),
    one(["city", "country"], ["activeUsers"], 10, "activeUsers"),
    one(["deviceCategory"], ["activeUsers"], 5, "activeUsers"),
    one(["eventName"], ["eventCount"], 50, "eventCount"),
  ]);
  const pick = (rows) => { const o = {}; M.forEach((m, i) => { o[m] = rows.length ? rows[0].v[i] : 0; }); return o; };
  const named = (rows) => rows.map((x) => ({ name: x.k.filter((s) => s && s !== "(not set)").join(", "), n: x.v[0] })).filter((x) => x.name);
  const byH = Object.fromEntries(hourly.map((x) => [x.k[0], x.v.slice(0, 4)]));
  const zero = [0, 0, 0, 0];
  const daily = curH.map((h, i) => ({ d: h.slice(0, 4) + "-" + h.slice(4, 6) + "-" + h.slice(6, 8) + "T" + h.slice(8, 10), now: byH[h] || zero, before: byH[prevH[i]] || zero }));
  return { days: 1, totals: pick(tot), before: pick(totPrev), daily, filter: f && f.f ? f : null,
    pages: named(pages), sources: named(sources), places: named(places), devices: named(devices), events: events.map((x) => ({ name: x.k[0], n: x.v[0] })) };
}

/* nthDay counts days from each range's own start, so day i of this period sits next to day i of the period before.
   With two date ranges Google adds a "dateRange" dimension (date_range_0 = this period, date_range_1 = before). */
function dailyRows(rows, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() - (n - 1 - i) * 86400000);
    out.push({ d: d.toISOString().slice(0, 10), now: [0, 0, 0, 0], before: [0, 0, 0, 0] });
  }
  rows.forEach((x) => {
    const i = parseInt(x.k[0], 10), which = x.k[1] === "date_range_1" ? "before" : "now";
    if (out[i]) out[i][which] = x.v.slice(0, 4);
  });
  return out;
}

export async function visitorsNow(f) {
  const c = conn();
  if (c.setup) return c;
  const id = c.id, t = await accessToken(c.sa);
  const last5 = [{ startMinutesAgo: 4, endMinutesAgo: 0 }];
  const df = dimFilter(f, true), rp = (b) => report(id, t, Object.assign(b, df ? { dimensionFilter: df } : {}));
  const [now, half, pages, places, devices, events, minutes] = await Promise.all([
    rp({ metrics: users, minuteRanges: last5 }),
    rp({ metrics: users }),
    rp({ dimensions: [{ name: "unifiedScreenName" }], metrics: users, limit: 10 }),
    rp({ dimensions: [{ name: "city" }, { name: "country" }], metrics: users, limit: 10 }),
    rp({ dimensions: [{ name: "deviceCategory" }], metrics: users }),
    rp({ dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], limit: 50 }),
    rp({ dimensions: [{ name: "minutesAgo" }], metrics: users, limit: 30 }),
  ]);
  const perMin = new Array(30).fill(0);
  minutes.forEach((x) => { const m = parseInt(x.k[0], 10); if (m >= 0 && m < 30) perMin[29 - m] = x.v[0]; });
  return {
    now: now.length ? now[0].v[0] : 0,
    last30: half.length ? half[0].v[0] : 0,
    perMin,
    pages: top(pages),
    places: places.map((x) => ({ name: [x.k[0], x.k[1]].filter((s) => s && s !== "(not set)").join(", "), n: x.v[0] })).filter((x) => x.name).slice(0, 8),
    devices: top(devices),
    events: events.map((x) => ({ name: x.k[0], n: x.v[0] })),
    filter: df ? f : null,
    at: new Date().toISOString(),
  };
}

/* What people typed into Google before seeing or visiting the site, from Google Search Console (the same read-only
   login, added as a user in Search Console → Settings → Users and permissions; Search Console API enabled in the
   Google Cloud project). Google shares these about 2–3 days late, and hides very rare searches. */
const SITES = ["sc-domain:ambs.co.nz", "https://ambs.co.nz/", "https://www.ambs.co.nz/"];
export async function searchQueries(days) {
  const c = conn();
  if (c.setup) return c;
  const n = [7, 28, 90].includes(+days) ? +days : 28;
  const t = await accessToken(c.sa);
  const day = (k) => new Date(Date.now() - k * 86400000).toISOString().slice(0, 10);
  const sites = key("GSC_SITE") ? [key("GSC_SITE")] : SITES;
  let last = "";
  for (const site of sites) {
    const r = await fetch("https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(site) + "/searchAnalytics/query", {
      method: "POST",
      headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: day(n + 2), endDate: day(0), dimensions: ["query"], rowLimit: 25, dataState: "all" }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) return { site, days: n, rows: (j.rows || []).map((x) => ({ q: x.keys[0], clicks: x.clicks, shown: x.impressions, pos: Math.round(x.position * 10) / 10 })) };
    last = (j.error && j.error.message) || String(r.status);
    if (r.status !== 403 && r.status !== 404) break;
  }
  return { needs: true, email: c.sa.client_email, why: last };
}

/* Everything for the SEO page, from Search Console plus a quick look at the live site:
   totals now and the period before, clicks and times shown each day, searches, pages, countries, devices,
   chances (searches close to page 1, or shown a lot but rarely clicked), sitemaps and the site's own basics. */
async function gsc(t, site, body) {
  const r = await fetch("https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(site) + "/searchAnalytics/query", {
    method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(Object.assign({ dataState: "all" }, body)),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error((j.error && j.error.message) || String(r.status)); e.status = r.status; throw e; }
  return (j.rows || []).map((x) => ({ k: x.keys || [], clicks: x.clicks, shown: x.impressions, ctr: x.ctr, pos: Math.round(x.position * 10) / 10 }));
}
async function siteBasics() {
  const out = [];
  const get = async (u) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(6000), headers: { "User-Agent": "AMBS-editor-check" } }); return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : "" }; } catch (e) { return { ok: false, status: 0, text: "" }; } };
  const [home, robots, map, llms] = await Promise.all([get("https://ambs.co.nz/"), get("https://ambs.co.nz/robots.txt"), get("https://ambs.co.nz/sitemap.xml"), get("https://ambs.co.nz/llms.txt")]);
  const title = (home.text.match(/<title>([^<]*)<\/title>/i) || [])[1] || "";
  const desc = (home.text.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || "";
  const urls = (map.text.match(/<loc>/g) || []).length;
  out.push({ name: "Homepage title", ok: title.length >= 30 && title.length <= 65, note: title ? title.length + " characters: " + title : "missing" });
  out.push({ name: "Homepage description", ok: desc.length >= 70 && desc.length <= 160, note: desc ? desc.length + " characters" : "missing" });
  out.push({ name: "robots.txt", ok: robots.ok && !/Disallow:\s*\/\s*$/m.test(robots.text), note: robots.ok ? (/sitemap/i.test(robots.text) ? "lets Google in and points to the sitemap" : "lets Google in") : "not found" });
  out.push({ name: "Sitemap", ok: map.ok && urls > 0, note: map.ok ? urls + " pages listed" : "not found" });
  out.push({ name: "Google business data (schema)", ok: /application\/ld\+json/i.test(home.text), note: /LocalBusiness|ProfessionalService|Organization/.test(home.text) ? "business details marked up for Google" : "not found" });
  out.push({ name: "Guide for AI assistants (llms.txt)", ok: llms.ok, note: llms.ok ? "found" : "not found" });
  out.push({ name: "Sharing picture", ok: /property="og:image"/i.test(home.text), note: /property="og:image"/i.test(home.text) ? "set" : "missing" });
  out.push({ name: "Phone-friendly", ok: /name="viewport"/i.test(home.text), note: "fits phone screens" });
  return out;
}
export async function seoReport(days) {
  const c = conn();
  if (c.setup) return c;
  const n = [1, 7, 28, 90].includes(+days) ? +days : 28;
  const t = await accessToken(c.sa);
  const day = (k) => new Date(Date.now() - k * 86400000).toISOString().slice(0, 10);
  /* 24 hours: Google's fresh (not yet final) figures; searches, pages and places cover today and yesterday */
  const cur = n === 1 ? { startDate: day(1), endDate: day(0) } : { startDate: day(n + 2), endDate: day(0) },
    prev = n === 1 ? { startDate: day(3), endDate: day(2) } : { startDate: day(2 * n + 2), endDate: day(n + 3) };
  const sites = key("GSC_SITE") ? [key("GSC_SITE")] : SITES;
  let site = "", last = "";
  for (const s of sites) { try { await gsc(t, s, Object.assign({ rowLimit: 1 }, cur)); site = s; break; } catch (e) { last = e.message; if (e.status !== 403 && e.status !== 404) break; } }
  if (!site) return { needs: true, email: c.sa.client_email, why: last, basics: await siteBasics() };
  const q = (dims, limit, range) => gsc(t, site, Object.assign({ dimensions: dims, rowLimit: limit || 25 }, range || cur));
  const [tot, totPrev, daily, queries, pages, countries, devices, basics, maps] = await Promise.all([
    q([], 1), q([], 1, prev), q(["date"], 500), q(["query"], 250), q(["page"], 50), q(["country"], 10), q(["device"], 5), siteBasics(),
    fetch("https://www.googleapis.com/webmasters/v3/sites/" + encodeURIComponent(site) + "/sitemaps", { headers: { Authorization: "Bearer " + t } }).then((r) => r.ok ? r.json() : {}).catch(() => ({})),
  ]);
  let sum = (rows) => rows[0] ? { clicks: rows[0].clicks, shown: rows[0].shown, ctr: rows[0].ctr, pos: rows[0].pos } : { clicks: 0, shown: 0, ctr: 0, pos: 0 };
  let hourly = null;
  if (n === 1) {
    /* hour by hour for the last 48 hours: the last 24 against the 24 before */
    try {
      const hrs = (await q(["hour"], 200, { startDate: day(3), endDate: day(0), dataState: "hourly_all" })).sort((a, b) => a.k[0] < b.k[0] ? -1 : 1);
      if (hrs.length) {
        const add = (rs) => { const cl = rs.reduce((a, r) => a + r.clicks, 0), sh = rs.reduce((a, r) => a + r.shown, 0), ps = rs.reduce((a, r) => a + r.pos * r.shown, 0);
          return { clicks: cl, shown: sh, ctr: sh ? cl / sh : 0, pos: sh ? Math.round(ps / sh * 10) / 10 : 0 }; };
        const last = hrs.slice(-24), before = hrs.slice(-48, -24);
        hourly = { cur: add(last), prev: add(before), rows: last.map((r) => ({ d: r.k[0], clicks: r.clicks, shown: r.shown })) };
      }
    } catch (e) { hourly = null; }
  }
  const row = (r) => ({ name: r.k[0], clicks: r.clicks, shown: r.shown, ctr: r.ctr, pos: r.pos });
  const qs = queries.map(row);
  return {
    site, days: n, from: cur.startDate, to: cur.endDate,
    totals: hourly ? hourly.cur : sum(tot), before: hourly ? hourly.prev : sum(totPrev), hourly: !!hourly,
    daily: hourly ? hourly.rows : daily.map((r) => ({ d: r.k[0], clicks: r.clicks, shown: r.shown })),
    queries: qs.slice(0, 50),
    nearly: qs.filter((r) => r.pos > 7 && r.pos <= 20 && r.shown >= 2).sort((a, b) => b.shown - a.shown).slice(0, 8),
    lowclick: qs.filter((r) => r.shown >= 15 && r.ctr < 0.02 && r.pos <= 10).sort((a, b) => b.shown - a.shown).slice(0, 8),
    pages: pages.map(row).map((r) => Object.assign(r, { name: r.name.replace(/^https?:\/\/(www\.)?ambs\.co\.nz/, "") || "/" })),
    countries: countries.map(row), devices: devices.map(row),
    sitemaps: (maps.sitemap || []).map((m) => ({ path: m.path, last: m.lastDownloaded, errors: +m.errors || 0, warnings: +m.warnings || 0, pending: !!m.isPending })),
    basics,
  };
}

/* One page as Google sees it (Search Console URL Inspection): indexed or not, last crawl, canonical, rich results. */
export async function inspectUrl(url) {
  const c = conn();
  if (c.setup) return c;
  const t = await accessToken(c.sa);
  const sites = key("GSC_SITE") ? [key("GSC_SITE")] : SITES;
  let last = "";
  for (const site of sites) {
    const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
      method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" },
      body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: "en-NZ" }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const x = j.inspectionResult || {}, ix = x.indexStatusResult || {}, rr = x.richResultsResult || {};
      return {
        site, link: x.inspectionResultLink || "",
        verdict: ix.verdict || "", coverage: ix.coverageState || "", crawled: ix.lastCrawlTime || "", fetch: ix.pageFetchState || "",
        robots: ix.robotsTxtState || "", indexing: ix.indexingState || "", canonical: ix.googleCanonical || "", userCanonical: ix.userCanonical || "",
        rich: { verdict: rr.verdict || "", items: (rr.detectedItems || []).map((d) => ({ type: d.richResultType, names: (d.items || []).map((i) => i.name).filter(Boolean).slice(0, 4),
          issues: (d.items || []).flatMap((i) => (i.issues || []).map((s) => ({ msg: s.issueMessage, sev: s.severity }))).slice(0, 6) })) },
      };
    }
    last = (j.error && j.error.message) || String(r.status);
    if (r.status !== 403 && r.status !== 404) break;
  }
  return { needs: true, email: c.sa.client_email, why: last };
}

/* Stats (Insights → Stats): how often the website's buttons and forms were used in a period, from the Google Analytics
   events the pages send (book_click, phone_click, email_click, generate_lead, booking_confirmed, chat_open…), with the
   period before. hours = 24 counts the last 24 hours hour by hour (the property's time zone, New Zealand). */
export const STAT_EVENTS = ["book_click", "booking_confirmed", "generate_lead", "phone_click", "email_click", "chat_open", "chat_question", "chat_auto_open", "page_view"];
export async function statsEvents(days) {
  const c = conn();
  if (c.setup) return c;
  const t = await accessToken(c.sa);
  const filter = { filter: { fieldName: "eventName", inListFilter: { values: STAT_EVENTS } } };
  const add = (o, k, n) => { o[k] = (o[k] || 0) + n; };
  const now = {}, before = {};
  if (+days === 1) {
    const rows = await runReport(c.id, t, { dateRanges: [{ startDate: "2daysAgo", endDate: "today" }], dimensions: [{ name: "dateHour" }, { name: "eventName" }], metrics: [{ name: "eventCount" }], dimensionFilter: filter, limit: 5000 });
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    const nowH = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour);
    rows.forEach((r) => { const h = r.k[0], at = Date.UTC(+h.slice(0, 4), +h.slice(4, 6) - 1, +h.slice(6, 8), +h.slice(8, 10)), ago = (nowH - at) / 3600000;
      if (ago >= 0 && ago < 24) add(now, r.k[1], r.v[0]); else if (ago >= 24 && ago < 48) add(before, r.k[1], r.v[0]); });
    return { days: 1, now, before };
  }
  const n = Math.max(2, Math.min(400, Math.round(+days) || 7));
  const rows = await runReport(c.id, t, { dateRanges: [{ startDate: (n - 1) + "daysAgo", endDate: "today" }, { startDate: (2 * n - 1) + "daysAgo", endDate: n + "daysAgo" }], dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], dimensionFilter: filter, limit: 100 });
  rows.forEach((r) => add(r.k[1] === "date_range_1" ? before : now, r.k[0], r.v[0]));
  return { days: n, now, before };
}
/* Connections → Google Analytics: check a property number and service account key work (one tiny report) */
export async function gaCheck(id, raw) {
  let sa; try { sa = JSON.parse(raw); } catch (e) { throw new Error("That isn't the whole JSON key file. Open the downloaded .json file and copy everything in it."); }
  if (!sa.client_email || !sa.private_key) throw new Error("That JSON isn't a service account key (it needs client_email and private_key).");
  tok = null;
  const t = await accessToken(sa);
  await runReport(String(id).replace(/\D/g, ""), t, { dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "activeUsers" }] }).catch((e) => {
    throw new Error(/403|permission/i.test(e.message) ? "Google says " + sa.client_email + " can't see property " + id + ". Add it as a Viewer in Analytics → Admin → Property access management." : e.message); });
  tok = null;
  return "Google Analytics answered for property " + String(id).replace(/\D/g, "") + " as " + sa.client_email;
}
