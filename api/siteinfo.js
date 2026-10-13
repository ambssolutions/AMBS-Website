/* POST /api/siteinfo { url } → business name, phone, email, address, social accounts and logo read
   from a business website, for the email signature builder's "Fill from website".
   Website editor sign-in only; only public web addresses are fetched. */
import { requireEditor, send, readBody } from "./_lib.js";
import { siteInfo } from "./_siteinfo.js";

export default async function handler(req, res) {
  const who = await requireEditor(req, res);
  if (!who) return;
  try {
    const b = await readBody(req);
    return send(res, 200, await siteInfo(b.url));
  } catch (e) {
    return send(res, 400, { error: e.message || "Couldn’t read that website." });
  }
}
