/* GET /assets/email/px/<hex>.png (or /api/px?c=<hex>): a 1×1 picture in one colour.
   Several colours joined by "-" (e5352b-ff8a00-…) make a stripe picture, top to bottom; start with "h-" for left to right.
   End with _<width>x<height> (…-24b328_3x120) to get it at that exact size, so apps that force height:auto keep its shape.
   The signature builder stretches it into stripe and bar segments, because some email apps
   (the Gmail app among them) drop cell borders and backgrounds but always show pictures. */
import zlib from "node:zlib";

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}

export default function handler(req, res) {
  let raw = String((req.query && req.query.c) || "").replace(/\.png$/i, "").replace(/#/g, "").toLowerCase();
  const across = /^h-/.test(raw); if (across) raw = raw.slice(2);
  let size = null; raw = raw.replace(/_(\d{1,3})x(\d{1,3})$/, (_, w, h) => { size = [Math.max(1, Math.min(800, +w)), Math.max(1, Math.min(800, +h))]; return ""; });
  const cols = raw.split("-").map((h) => (/^[0-9a-f]{6}$/.test(h) ? h : /^[0-9a-f]{3}$/.test(h) ? h.replace(/./g, "$&$&") : null));
  if (!cols.length || cols.length > 12 || cols.some((h) => !h)) { res.statusCode = 400; res.end("Use colours like e5352b or e5352b-ff8a00"); return; }
  /* each colour gets 16 pixels, so stretching the picture keeps the colours crisp */
  const seg = cols.length > 1 ? 16 : 1, n = cols.length * seg, W = size ? size[0] : across ? n : 1, H = size ? size[1] : across ? 1 : n;
  const at = (x, y) => { const len = across ? W : H, pos = across ? x : y; return Math.min(cols.length - 1, Math.floor(pos * cols.length / len)); };
  const rgb = cols.map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < H; y++) { const r = [0]; for (let x = 0; x < W; x++) r.push(...rgb[at(x, y)]); rows.push(Buffer.from(r)); }
  const px = Buffer.concat(rows);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(px)), chunk("IEND", Buffer.alloc(0))]);
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(png);
}
