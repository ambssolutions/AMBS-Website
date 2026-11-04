/* Google reviews for the editor (Google search → Reviews): the business's star rating, number of reviews and the
   latest reviews Google shares (up to 5), from the Places API (New) with the key saved in Connections (PLACES_KEY,
   or the PageSpeed key when it has Places API (New) enabled too). Read-only; nothing loads on public pages.
   The full Business Profile (every review, replies, calls and directions) needs Google's Business Profile API
   approval and a sign-in with the owner's Google account; this is the quick version until then. */
import { key } from "./_keys.js";

const BASE = "https://places.googleapis.com/v1/";
const placesKey = () => key("PLACES_KEY") || key("PAGESPEED_KEY");

async function call(path, k, fields, body) {
  const r = await fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { "X-Goog-Api-Key": k, "X-Goog-FieldMask": fields, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = (j.error && j.error.message) || "Google answered " + r.status;
    throw Object.assign(new Error(/not been used|disabled|SERVICE_DISABLED/i.test(m) ? "Places API (New) isn’t turned on for this key yet. Turn it on in Google Cloud (steps below), wait a minute, then try again." : /API key not valid|API_KEY_INVALID/i.test(m) ? "Google says this key isn’t valid." : m), { soft: true });
  }
  return j;
}

/* a Google Maps link (maps.app.goo.gl/…, g.page, share.google or a full google.com/maps/place/… address): opened on the
   server to read the business name and its pin, so the search can look right there */
async function fromLink(q) {
  let u = q;
  if (!/google\.[a-z.]+\/maps\/place\//.test(u)) {
    const r = await fetch(q, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
    if (r) u = r.url || u;
  }
  /* Google may send the server through its cookie page (consent.google.com/?continue=<the Maps address, encoded>):
     undo the extra encoding (up to 3 layers) so the name and pin can be read */
  for (let i = 0; i < 3 && /%2[1FB]|%40/i.test(u); i++) { try { u = decodeURIComponent(u); } catch (e) { break; } }
  let name = "";
  try { name = decodeURIComponent(((u.match(/\/maps\/place\/([^/@?&]+)/) || [])[1] || "").replace(/\+/g, " ")).replace(/\+/g, " ").trim(); } catch (e) {}
  const lat = (u.match(/!3d(-?\d+(?:\.\d+)?)/) || [])[1], lng = (u.match(/!4d(-?\d+(?:\.\d+)?)/) || [])[1];
  return { name, lat: lat ? +lat : null, lng: lng ? +lng : null, id: (u.match(/(ChIJ[0-9A-Za-z_-]{10,})/) || [])[1] || "" };
}

/* find the business on Google Maps: a place ID (ChIJ…), a Google Maps link, or the name and town */
const F = "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount";
export async function findPlace(k, q) {
  q = String(q || "").trim();
  let id = (q.match(/(ChIJ[0-9A-Za-z_-]{10,})/) || [])[1], link = null;
  if (!id && /^https?:\/\//i.test(q)) { link = await fromLink(q); id = link.id; }
  if (id) return [await call("places/" + id, k, "id,displayName,formattedAddress,rating,userRatingCount")];
  const text = link ? link.name : q;
  if (!text) throw Object.assign(new Error("That link didn’t open a business on Google Maps. In Google Maps, open your business, tap Share → Copy link, and paste that."), { soft: true });
  const body = { textQuery: text, regionCode: "NZ", pageSize: 5, includePureServiceAreaBusinesses: true };   // businesses with no public address (like AMBS) are left out unless asked for
  if (link && link.lat != null) body.locationBias = { circle: { center: { latitude: link.lat, longitude: link.lng }, radius: 50000 } };
  let list = (await call("places:searchText", k, F, body)).places || [];
  if (!list.length && link) list = (await call("places:searchText", k, F, { textQuery: text + " New Zealand", pageSize: 5, includePureServiceAreaBusinesses: true })).places || [];
  if (!list.length && link) throw Object.assign(new Error("Google Maps has “" + text + "”, but Google’s places service doesn’t list it yet. New Business Profiles usually appear there within a few weeks; try again later, nothing else to change."), { soft: true });
  /* with a link, keep the matches that carry the business's own name */
  if (link && list.length > 1) { const n = text.toLowerCase(), same = list.filter((p) => ((p.displayName && p.displayName.text) || "").toLowerCase() === n); if (same.length) list = same; }
  return list;
}

let cache = { at: 0, id: "", data: null };
export async function placeReviews() {
  const k = placesKey(), id = key("PLACE_ID");
  if (!k || !id) return { setup: true, hasKey: !!k };
  if (cache.data && cache.id === id && Date.now() - cache.at < 30 * 60 * 1000) return cache.data;   // 30 minutes, to keep within Google's free allowance
  const p = await call("places/" + id + "?languageCode=en", k, "id,displayName,formattedAddress,rating,userRatingCount,googleMapsUri,reviews");
  const data = {
    id: p.id || id, name: (p.displayName && p.displayName.text) || "", address: p.formattedAddress || "",
    rating: p.rating || 0, count: p.userRatingCount || 0, maps: p.googleMapsUri || "",
    reviews: (p.reviews || []).map((r) => ({
      rating: r.rating || 0, text: (r.originalText && r.originalText.text) || (r.text && r.text.text) || "",
      when: r.relativePublishTimeDescription || "", at: r.publishTime || "",
      author: (r.authorAttribution && r.authorAttribution.displayName) || "A Google user",
      authorUrl: (r.authorAttribution && r.authorAttribution.uri) || "", photo: (r.authorAttribution && r.authorAttribution.photoUri) || "",
      link: r.googleMapsUri || "",
    })),
    checked: new Date().toISOString(),
  };
  cache = { at: Date.now(), id, data };
  return data;
}
