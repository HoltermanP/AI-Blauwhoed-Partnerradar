// Minimale ZIP-ondersteuning zonder extra afhankelijkheid: lezen (Word .docx-bestanden, US-61) en schrijven (volledige
// data-export als CSV-bundel, US-68). Gebruikt alleen node:zlib.
import { deflateRawSync, inflateRawSync } from "node:zlib";

const CRC_TABEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABEL[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Schrijf een ZIP-archief (deflate). */
export function maakZip(bestanden: Array<{ naam: string; inhoud: Buffer | string }>, nu = new Date()): Buffer {
  // DOS-tijd en -datum van het archief (lokale tijd).
  const dosTijd = (nu.getHours() << 11) | (nu.getMinutes() << 5) | Math.floor(nu.getSeconds() / 2);
  const dosDatum = ((nu.getFullYear() - 1980) << 9) | ((nu.getMonth() + 1) << 5) | nu.getDate();
  const lokaal: Buffer[] = [];
  const centraal: Buffer[] = [];
  let offset = 0;
  bestanden.forEach((b) => {
    const data = Buffer.isBuffer(b.inhoud) ? b.inhoud : Buffer.from(b.inhoud, "utf8");
    const gecomprimeerd = deflateRawSync(data);
    const naam = Buffer.from(b.naam, "utf8");
    const crc = crc32(data);
    const kop = Buffer.alloc(30);
    kop.writeUInt32LE(0x04034b50, 0);
    kop.writeUInt16LE(20, 4);
    kop.writeUInt16LE(0x0800, 6); // UTF-8-namen
    kop.writeUInt16LE(8, 8); // deflate
    kop.writeUInt16LE(dosTijd, 10);
    kop.writeUInt16LE(dosDatum, 12);
    kop.writeUInt32LE(crc, 14);
    kop.writeUInt32LE(gecomprimeerd.length, 18);
    kop.writeUInt32LE(data.length, 22);
    kop.writeUInt16LE(naam.length, 26);
    kop.writeUInt16LE(0, 28);
    lokaal.push(kop, naam, gecomprimeerd);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0x0800, 8);
    c.writeUInt16LE(8, 10);
    c.writeUInt16LE(dosTijd, 12);
    c.writeUInt16LE(dosDatum, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(gecomprimeerd.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(naam.length, 28);
    c.writeUInt32LE(offset, 42);
    centraal.push(c, naam);
    offset += kop.length + naam.length + gecomprimeerd.length;
  });
  const cd = Buffer.concat(centraal);
  const eind = Buffer.alloc(22);
  eind.writeUInt32LE(0x06054b50, 0);
  eind.writeUInt16LE(bestanden.length, 8);
  eind.writeUInt16LE(bestanden.length, 10);
  eind.writeUInt32LE(cd.length, 12);
  eind.writeUInt32LE(offset, 16);
  return Buffer.concat([...lokaal, cd, eind]);
}

/** Lees één bestand uit een ZIP-archief (stored of deflate). */
export function leesZipBestand(zip: Buffer, gezocht: string): Buffer | null {
  let eocd = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const aantal = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < aantal && p + 46 <= zip.length; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) return null;
    const methode = zip.readUInt16LE(p + 10);
    const grootte = zip.readUInt32LE(p + 20);
    const naamLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const lokaalOffset = zip.readUInt32LE(p + 42);
    const naam = zip.subarray(p + 46, p + 46 + naamLen).toString("utf8");
    if (naam === gezocht) {
      const lNaam = zip.readUInt16LE(lokaalOffset + 26);
      const lExtra = zip.readUInt16LE(lokaalOffset + 28);
      const start = lokaalOffset + 30 + lNaam + lExtra;
      const data = zip.subarray(start, start + grootte);
      return methode === 0 ? Buffer.from(data) : methode === 8 ? inflateRawSync(data) : null;
    }
    p += 46 + naamLen + extraLen + commentLen;
  }
  return null;
}
