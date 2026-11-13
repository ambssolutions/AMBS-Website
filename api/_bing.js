/* Bing for Website settings → Connections → Bing (owner only).
   IndexNow: tells Bing (and Yandex, Seznam, Naver) which pages changed. It needs no account, only the public key file
   https://ambs.co.nz/<key>.txt; the same key is used by site-src/indexnow.py after every publish.
   Bing Webmaster Tools: with the owner's API key (Bing Webmaster → Settings → API access), the editor reads whether
   Bing has the site, its crawl numbers, searches and clicks, and can send the sitemap. Read-only apart from the sitemap. */
import { key } from "./_keys.js";

export const INDEXNOW_KEY = "9951515280924afe83b4c493631012d8";
const HOST = "ambs.co.nz", SITE = "https://ambs.co.nz/";
const API = "https://ssl.bing.com/webmaster/api.svc/json/";

/* Bing's JSON dates look like "/Date(1731456000000-0800)/" */
const bDate = (d) => { const m = /Date\((-?\d+)/.exec(String(d || "")); return m ? new Date(+m[1]).toISOString() : null; };

async function bing(method, k, params, body) {
  const q = new URLSearchParams(Object.assign({ apikey: k }, params || {}));
  const r = await fetch(API + method + "?" + q, body ? { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) } : {});
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  if (!r.ok) {
    const msg = (j && (j.Message || (j.ErrorCode != null && "Bing error " + j.ErrorCode))) || t.slice(0, 160) || "Bing answered " + r.status;
    const e = new Error(/InvalidApiKey|NotAuthorized|401|ApiKey/i.test(msg + r.status) ? "Bing didn’t accept that key. Copy it again from Bing Webmaster → Settings → API access." : msg);
    e.status = r.status; throw e;
  }
  return j && "d" in j ? j.d : j;
}

/* the sites this Bing account has, and whether ambs.co.nz is one of them and verified */
export async function bingCheck(k) {
  const sites = (await bing("GetUserSites", k)) || [];
  const mine = sites.find((s) => /^https?:\/\/(www\.)?ambs\.co\.nz\/?$/i.test(String(s.Url || "")));
  return { sites: sites.map((s) => ({ url: s.Url, verified: !!s.IsVerified })), site: mine ? mine.Url : null, verified: !!(mine && mine.IsVerified) };
}

/* everything the Bing card shows; each part fails on its own so one slow answer doesn't hide the rest */
export async function bingReport() {
  const k = key("BING_KEY");
  const out = { connected: !!k, indexnow: await indexNowFile() };
  if (!k) return out;
  try { Object.assign(out, await bingCheck(k)); } catch (e) { out.error = e.message; return out; }
  if (!out.site) return out;
  const su = { siteUrl: out.site };
  const [traffic, crawl, queries, feeds, quota] = await Promise.all([
    bing("GetRankAndTrafficStats", k, su).catch((e) => ({ error: e.message })),
    bing("GetCrawlStats", k, su).catch((e) => ({ error: e.message })),
    bing("GetQueryStats", k, su).catch((e) => ({ error: e.message })),
    bing("GetFeeds", k, su).catch((e) => ({ error: e.message })),
    bing("GetUrlSubmissionQuota", k, su).catch(() => null),
  ]);
  /* searches and clicks for the last 28 days of Bing's daily numbers, against the 28 before */
  if (Array.isArray(traffic)) {
    const days = traffic.map((d) => ({ day: (bDate(d.Date) || "").slice(0, 10), clicks: +d.Clicks || 0, shown: +d.Impressions || 0 })).filter((d) => d.day).sort((a, b) => a.day.localeCompare(b.day));
    const last = days.slice(-28), before = days.slice(-56, -28), sum = (a, f) => a.reduce((s, d) => s + d[f], 0);
    out.traffic = { days: last, clicks: sum(last, "clicks"), shown: sum(last, "shown"), clicksBefore: sum(before, "clicks"), shownBefore: sum(before, "shown") };
  } else if (traffic && traffic.error) out.trafficError = traffic.error;
  if (Array.isArray(crawl) && crawl.length) {
    const c = crawl.map((d) => Object.assign({ at: bDate(d.Date) }, d)).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const l = c[c.length - 1];
    out.crawl = { at: l.at, inIndex: +l.InIndex || 0, crawled: +l.CrawledPages || 0, errors: +l.CrawlErrors || 0, blocked: +l.BlockedByRobotsTxt || 0,
      notFound: +l.Code4xx || 0, server: +l.Code5xx || 0, crawled28: c.slice(-28).reduce((s, d) => s + (+d.CrawledPages || 0), 0) };
  }
  if (Array.isArray(queries)) {
    const by = {};
    for (const q of queries) { const n = String(q.Query || "").trim(); if (!n) continue;
      const o = by[n] || (by[n] = { q: n, clicks: 0, shown: 0, pos: 0 }); o.clicks += +q.Clicks || 0; o.shown += +q.Impressions || 0; o.pos = +q.AvgImpressionPosition || o.pos; }
    out.queries = Object.values(by).sort((a, b) => b.shown - a.shown || b.clicks - a.clicks).slice(0, 10);
  }
  if (Array.isArray(feeds)) out.feeds = feeds.map((f) => ({ url: f.Url, status: f.Status, urls: +f.UrlCount || 0, crawled: bDate(f.LastCrawled), submitted: bDate(f.Submitted) }));
  if (quota && typeof quota === "object") out.quota = { daily: +quota.DailyQuota || 0, monthly: +quota.MonthlyQuota || 0 };
  return out;
}

export async function bingSitemap() {
  const k = key("BING_KEY"); if (!k) throw new Error("Connect Bing Webmaster first.");
  const c = await bingCheck(k); if (!c.site) throw new Error("This Bing account doesn’t have ambs.co.nz yet. Add it in Bing Webmaster (Import from Google Search Console).");
  await bing("SubmitFeed", k, null, { siteUrl: c.site, feedUrl: SITE + "sitemap.xml" });
  return "Sitemap sent to Bing. It usually reads it within a day.";
}

/* is the IndexNow key file live? (Bing refuses the list without it) */
async function indexNowFile() {
  try { const r = await fetch(SITE + INDEXNOW_KEY + ".txt", { cache: "no-store" }); return { key: INDEXNOW_KEY, ok: r.ok && (await r.text()).trim() === INDEXNOW_KEY }; }
  catch (e) { return { key: INDEXNOW_KEY, ok: false }; }
}

/* "Send every page to Bing now": every page in the live sitemap, through IndexNow */
export async function indexNowAll() {
  const xml = await (await fetch(SITE + "sitemap.xml", { cache: "no-store" })).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(SITE));
  if (!urls.length) throw new Error("The sitemap has no pages.");
  const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: SITE + INDEXNOW_KEY + ".txt", urlList: urls }) });
  if (r.status === 200 || r.status === 202) return { sent: urls.length, note: "Sent all " + urls.length + " pages to Bing through IndexNow." };
  const t = (await r.text()).slice(0, 160);
  throw new Error(r.status === 403 ? "IndexNow couldn’t find the key file on the website yet. Try again in a few minutes." : r.status === 429 ? "IndexNow says too many at once. Try again in an hour." : "IndexNow answered " + r.status + (t ? ": " + t : ""));
}
