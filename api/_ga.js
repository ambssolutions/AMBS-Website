/* Live visitors from Google Analytics (GA4 Realtime), for the editor's "Visitors now" tab.
   Needs two Vercel environment variables, set once:
     GA_PROPERTY_ID       the property's number (Analytics → Admin → Property details), e.g. 512345678
     GA_SERVICE_ACCOUNT   the whole JSON key of a Google Cloud service account that has Viewer access to that property
   Read-only: it asks Google for numbers and never changes anything in Analytics. */
import crypto from "node:crypto";

let tok = null; // { value, exp }

const b64u = (s) => Buffer.from(s).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function accessToken(sa) {
  if (tok && Date.now() < tok.exp - 60000) return tok.value;
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + claim).sign(sa.private_key).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + head + "." + claim + "." + sig,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Google didn't accept the connection key (" + (j.error_description || j.error || r.status) + ").");
  tok = { value: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
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

export async function visitorsNow() {
  const id = String(process.env.GA_PROPERTY_ID || "").replace(/\D/g, "");
  const raw = process.env.GA_SERVICE_ACCOUNT || "";
  if (!id || !raw) return { setup: true, has: { property: !!id, key: !!raw } };
  let sa;
  try { sa = JSON.parse(raw); } catch (e) { throw new Error("GA_SERVICE_ACCOUNT in Vercel isn't the whole JSON key file. Paste the file's full contents."); }
  const t = await accessToken(sa);
  const last5 = [{ startMinutesAgo: 4, endMinutesAgo: 0 }];
  const [now, half, pages, places, devices, events, minutes] = await Promise.all([
    report(id, t, { metrics: users, minuteRanges: last5 }),
    report(id, t, { metrics: users }),
    report(id, t, { dimensions: [{ name: "unifiedScreenName" }], metrics: users, limit: 10 }),
    report(id, t, { dimensions: [{ name: "city" }, { name: "country" }], metrics: users, limit: 10 }),
    report(id, t, { dimensions: [{ name: "deviceCategory" }], metrics: users }),
    report(id, t, { dimensions: [{ name: "eventName" }], metrics: [{ name: "eventCount" }], limit: 50 }),
    report(id, t, { dimensions: [{ name: "minutesAgo" }], metrics: users, limit: 30 }),
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
    at: new Date().toISOString(),
  };
}
