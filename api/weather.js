/* GET /api/weather: the visitor's town (from Vercel's location headers) and its current weather code (open-meteo),
   for the homepage sky. Asked from the server so the browser never calls another site, and it always answers 200,
   so a busy or failing weather service can't put an error in the visitor's console. Falls back to Auckland. */
const seen = new Map(); // "lat,lng" rounded to 0.1° → [time, code]

export default async function handler(req, res) {
  const h = req.headers || {};
  let lat = parseFloat(h["x-vercel-ip-latitude"]), lng = parseFloat(h["x-vercel-ip-longitude"]);
  let city = "";
  try { city = decodeURIComponent(h["x-vercel-ip-city"] || ""); } catch (e) {}
  if (!isFinite(lat) || !isFinite(lng)) { lat = -36.85; lng = 174.76; city = "Auckland"; }
  const key = lat.toFixed(1) + "," + lng.toFixed(1);
  let code = null;
  const hit = seen.get(key);
  if (hit && Date.now() - hit[0] < 15 * 60 * 1000) code = hit[1];
  else {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lng.toFixed(2)}&current=weather_code`, { signal: AbortSignal.timeout(4000) });
      const d = r.ok ? await r.json() : null;
      if (d && d.current && typeof d.current.weather_code === "number") { code = d.current.weather_code; seen.set(key, [Date.now(), code]); }
    } catch (e) {}
  }
  if (seen.size > 2000) seen.clear();
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "private, max-age=900");
  res.end(JSON.stringify({ city: city || "Auckland", code }));
}
