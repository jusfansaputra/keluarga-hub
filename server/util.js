'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PUBLIC_DIR = path.join(ROOT, 'public');

for (const d of [DATA_DIR, UPLOAD_DIR, path.join(UPLOAD_DIR, 'media'), PUBLIC_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeOf(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function now() {
  return new Date().toISOString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix) {
  return (prefix ? prefix + '_' : '') + crypto.randomBytes(8).toString('hex');
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function inviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 8; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out.slice(0, 4) + '-' + out.slice(4);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return salt + '$' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = crypto.scryptSync(String(password), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sha256hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function hmacSha256Hex(key, message) {
  return crypto.createHmac('sha256', key).update(message).digest('hex').toUpperCase();
}

function send(res, status, payload, headers = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }, headers));
  res.end(body);
}

function ok(res, payload) {
  send(res, 200, payload === undefined ? { ok: true } : payload);
}

function fail(res, status, message, extra) {
  send(res, status, Object.assign({ ok: false, error: message }, extra || {}));
}

function readBody(req, limitBytes = 24 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error('Payload terlalu besar'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req, limitBytes) {
  const buf = await readBody(req, limitBytes);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (e) {
    throw Object.assign(new Error('Body JSON tidak valid'), { status: 400 });
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value, max = 2000) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, max);
}

function toInt(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

/** Serve a file with Range support (needed for video seeking). */
function serveFile(req, res, filePath) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (e) {
    return false;
  }
  if (!stat.isFile()) return false;
  const type = mimeOf(filePath);
  const range = req.headers.range;
  const etag = 'W/"' + stat.size + '-' + stat.mtimeMs + '"';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : stat.size - 1;
      if (start < stat.size && end >= start) {
        res.writeHead(206, {
          'Content-Type': type,
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          ETag: etag,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return true;
      }
    }
  }
  // Media files are immutable once uploaded; code assets must revalidate so
  // edits show up without a manual cache clear.
  const cache = filePath.startsWith(UPLOAD_DIR) ? 'public, max-age=86400' : 'no-cache';
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cache,
    ETag: etag,
  });
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function safeJoin(baseDir, relPath) {
  const p = path.normalize(path.join(baseDir, relPath));
  if (!p.startsWith(path.normalize(baseDir))) return null;
  return p;
}

module.exports = {
  ROOT, DATA_DIR, UPLOAD_DIR, PUBLIC_DIR, MIME,
  mimeOf, now, today, uid, randomToken, inviteCode,
  hashPassword, verifyPassword, sha256hex, hmacSha256Hex,
  send, ok, fail, readBody, readJson, parseCookies,
  num, str, toInt, serveFile, safeJoin,
};
