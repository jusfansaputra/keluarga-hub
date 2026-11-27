'use strict';
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const U = require('./util');
const { createRouter } = require('./router');

const router = createRouter();
const authRoutes = require('./routes/auth');
require('./routes/family').register(router);
require('./routes/finance').register(router);
require('./routes/assets').register(router);
require('./routes/planner').register(router);
require('./routes/media').register(router);
require('./routes/cctv').register(router);
require('./routes/iot').register(router);
require('./routes/system').register(router);
authRoutes.register(router);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_PATHS = new Set(['/api/auth/login', '/api/auth/register', '/api/health']);

router.get('/api/health', async (req, res) => U.ok(res, { ok: true, time: U.now(), node: process.version }));

/* Batasi percobaan login agar password keluarga tidak mudah ditebak. */
const attempts = new Map();
function rateLimited(key) {
  const now = Date.now();
  const rec = attempts.get(key) || { n: 0, first: now };
  if (now - rec.first > 5 * 60000) { attempts.set(key, { n: 1, first: now }); return false; }
  rec.n += 1;
  attempts.set(key, rec);
  return rec.n > 12;
}

function spa(res, file) {
  const p = path.join(U.PUBLIC_DIR, file);
  if (!U.serveFile({ headers: {}, method: 'GET' }, res, p)) {
    U.fail(res, 404, 'Halaman tidak ditemukan');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const ip = req.socket.remoteAddress || 'unknown';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '600',
    });
    return res.end();
  }

  try {
    const isApi = url.pathname.startsWith('/api/');
    const isFile = url.pathname.startsWith('/files/');
    const ctx = { ip };

    if (isApi || isFile) {
      ctx.user = authRoutes.resolveUser(req);
      if (!PUBLIC_PATHS.has(url.pathname) && !ctx.user) {
        return U.fail(res, 401, 'Anda belum masuk atau sesi sudah berakhir');
      }
      if (url.pathname === '/api/auth/login' && rateLimited(ip)) {
        return U.fail(res, 429, 'Terlalu banyak percobaan login. Coba lagi beberapa menit.');
      }
      if (await router.handle(req, res, url, ctx)) return;
      return U.fail(res, 404, 'Endpoint tidak ditemukan: ' + url.pathname);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return U.fail(res, 405, 'Metode tidak diizinkan');

    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    const target = U.safeJoin(U.PUBLIC_DIR, rel);
    if (target && fs.existsSync(target) && fs.statSync(target).isFile()) {
      if (U.serveFile(req, res, target)) return;
    }
    return spa(res, 'index.html');
  } catch (e) {
    console.error('[error]', req.method, url.pathname, e);
    if (!res.headersSent) U.fail(res, e.status || 500, e.message || 'Kesalahan server');
    else try { res.end(); } catch (_) { /* ignore */ }
  }
});

server.listen(PORT, HOST, () => {
  const nets = os.networkInterfaces();
  const lan = [];
  Object.values(nets).forEach((list) => (list || []).forEach((n) => {
    if (n.family === 'IPv4' && !n.internal) lan.push(n.address);
  }));
  const line = '─'.repeat(58);
  console.log(`\n${line}\n  🏠  Keluarga Hub — server berjalan\n${line}`);
  console.log(`  Lokal    : http://localhost:${PORT}`);
  lan.forEach((a) => console.log(`  Jaringan : http://${a}:${PORT}   (bisa dibuka dari HP keluarga)`));
  console.log(`  Database : ${require('./db').DB_PATH}`);
  console.log(`  Node     : ${process.version}`);
  console.log(`${line}\n  Akun contoh: budi / sari / dimas / ayu / hendra\n  Password  : keluarga123   (admin: budi & sari)\n${line}\n`);
});

process.on('SIGINT', () => { console.log('\nServer dihentikan.'); process.exit(0); });
