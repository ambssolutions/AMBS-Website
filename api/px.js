/* GET /assets/email/px/<hex>.png (or /api/px?c=<hex>): a 1×1 picture in one colour.
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
  const raw = String((req.query && req.query.c) || "").replace(/\.png$/i, "").replace(/^#/, "").toLowerCase();
  const hex = /^[0-9a-f]{6}$/.test(raw) ? raw : /^[0-9a-f]{3}$/.test(raw) ? raw.replace(/./g, "$&$&") : null;
  if (!hex) { res.statusCode = 400; res.end("Use a colour like e5352b"); return; }
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  const px = Buffer.from([0, parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]);
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(px)), chunk("IEND", Buffer.alloc(0))]);
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(png);
}
