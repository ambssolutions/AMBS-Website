/* Connection keys the editor keeps in Supabase Vault (Website settings → Connections), read through the admin-only
   database function site_secret_get as the signed-in person. A key saved there is used first; a Vercel environment
   variable with the same name still works as a fallback. Keys never reach the browser. */
import { sbRpc, serverProof } from "./_lib.js";

export const KEY_NAMES = ["GA_PROPERTY_ID", "GA_SERVICE_ACCOUNT", "GSC_SITE", "PAGESPEED_KEY"];
let K = {};
export const key = (n) => K[n] || process.env[n] || "";
export const keyFrom = (n) => (K[n] ? "editor" : process.env[n] ? "vercel" : "");
export async function loadKeys(who, area) {
  try {
    /* the owner reads them directly; an invited person's request gets them through the server's proof (and only for parts that need them) */
    const rows = who.realRole === "owner" ? await sbRpc(who.token, "site_secret_get", {})
      : ["stats", "visitors", "seo", "health"].includes(area) ? await sbRpc(who.token, "site_secret_get_server", { p_proof: serverProof(), p_area: area }) : [];
    const k = {};
    (rows || []).forEach((r) => { if (r && r.value && KEY_NAMES.includes(r.name)) k[r.name] = String(r.value); });
    K = k;
  } catch (e) { K = {}; }   // not set up yet (or not allowed): Vercel's variables are used
}
