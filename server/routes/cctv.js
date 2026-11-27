'use strict';
const { get, run, all, val, getSetting, logActivity } = require('../db');
const U = require('../util');
const cam = require('../cameras');

const KINDS = ['hls', 'mjpeg', 'snapshot', 'iframe', 'go2rtc'];

function publicCam(c, isAdmin) {
  const { password, ...rest } = c;
  return Object.assign(rest, { password: isAdmin ? (password || '') : (password ? '••••' : ''), hasCredentials: !!c.username });
}

function hostOf(u) {
  try { return new URL(u).host; } catch (e) { return ''; }
}

/** Cegah proxy terbuka: segmen/sub-playlist hanya boleh dari host kamera. */
function allowedTarget(camRow, target) {
  if (!target) return false;
  const h = hostOf(target);
  return !!h && h === hostOf(camRow.url);
}

function resolveStreamUrl(c) {
  if (c.kind === 'go2rtc') {
    const g = getSetting('xmeye', {}) || {};
    const base = (g.go2rtcUrl || 'http://127.0.0.1:1984').replace(/\/$/, '');
    const src = c.url || c.name.toLowerCase().replace(/\s+/g, '-');
    return `${base}/stream.html?src=${encodeURIComponent(src)}`;
  }
  return c.url;
}

function register(router) {
  router.get('/api/cameras', async (req, res, ctx) => {
    const rows = all('SELECT * FROM cameras ORDER BY sort, id');
    U.ok(res, {
      cameras: rows.map((c) => Object.assign(publicCam(c, ctx.user.role === 'admin'), { streamUrl: resolveStreamUrl(c) })),
      xmeye: getSetting('xmeye', {}),
    });
  });

  router.post('/api/cameras', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat menambah kamera');
    const b = ctx.body || {};
    if (!U.str(b.name || '').trim()) return U.fail(res, 400, 'Nama kamera wajib diisi');
    run(`INSERT INTO cameras (name, location, kind, url, username, password, refresh_sec, enabled, sort, notes, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      U.str(b.name, 120), U.str(b.location || '', 120), KINDS.includes(b.kind) ? b.kind : 'hls', U.str(b.url || '', 500),
      U.str(b.username || '', 80), U.str(b.password || '', 120), Math.max(1, U.toInt(b.refreshSec, 5)),
      b.enabled === false ? 0 : 1, U.toInt(b.sort, val('SELECT COALESCE(MAX(sort),0)+1 AS s FROM cameras') || 1), U.str(b.notes || '', 500), U.now());
    logActivity(ctx.user.id, 'create', 'camera', 'Menambah kamera: ' + U.str(b.name, 60));
    U.ok(res, { id: val('SELECT last_insert_rowid() AS i'), cameras: all('SELECT * FROM cameras ORDER BY sort, id') });
  });

  router.put('/api/cameras/:id', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mengubah kamera');
    const id = U.toInt(ctx.params.id);
    const c = get('SELECT * FROM cameras WHERE id = ?', id);
    if (!c) return U.fail(res, 404, 'Kamera tidak ditemukan');
    const b = ctx.body || {};
    run(`UPDATE cameras SET name=?, location=?, kind=?, url=?, username=?, password=?, refresh_sec=?, enabled=?, sort=?, notes=? WHERE id=?`,
      U.str(b.name ?? c.name, 120), U.str(b.location ?? c.location, 120), KINDS.includes(b.kind) ? b.kind : c.kind,
      U.str(b.url ?? c.url, 500), U.str(b.username ?? c.username, 80),
      b.password === undefined || b.password === null ? c.password : U.str(b.password, 120),
      Math.max(1, U.toInt(b.refreshSec, c.refresh_sec)), b.enabled === undefined ? c.enabled : (b.enabled ? 1 : 0),
      U.toInt(b.sort, c.sort), U.str(b.notes ?? c.notes, 500), id);
    logActivity(ctx.user.id, 'update', 'camera', 'Memperbarui kamera: ' + c.name);
    U.ok(res, { camera: get('SELECT * FROM cameras WHERE id = ?', id) });
  });

  router.delete('/api/cameras/:id', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat menghapus kamera');
    run('DELETE FROM cameras WHERE id = ?', U.toInt(ctx.params.id));
    U.ok(res, { deleted: true });
  });

  router.post('/api/cameras/:id/test', async (req, res, ctx) => {
    const c = get('SELECT * FROM cameras WHERE id = ?', U.toInt(ctx.params.id));
    if (!c) return U.fail(res, 404, 'Kamera tidak ditemukan');
    const url = resolveStreamUrl(c);
    const t0 = Date.now();
    try {
      const ctrl = AbortSignal.timeout(9000);
      const r = await cam.fetchCam(url, c, 9000, ctrl);
      const type = r.headers.get('content-type') || '';
      U.ok(res, { ok: r.ok, status: r.status, contentType: type, ms: Date.now() - t0, url,
        hint: c.kind === 'hls' && !/mpegurl/i.test(type) ? 'Respons bukan playlist HLS — periksa URL atau gunakan mode lain' : '' });
    } catch (e) {
      U.ok(res, { ok: false, error: e.name === 'TimeoutError' ? 'Timeout (kamera tidak merespons dalam 9 detik)' : e.message, ms: Date.now() - t0, url });
    }
  });

  /* ------------------------- proxy stream / snapshot ---------------------- */
  router.get('/api/cameras/:id/live', async (req, res, ctx) => {
    const c = get('SELECT * FROM cameras WHERE id = ?', U.toInt(ctx.params.id));
    if (!c || !c.enabled) return cam.errorImage(res, 'Kamera tidak aktif');
    if (c.kind === 'mjpeg') return cam.proxyMjpeg(req, res, c);
    if (c.kind === 'hls') return cam.proxyPlaylist(req, res, c, c.id, U.toInt(ctx.query.depth, 0));
    const target = ctx.query.u && allowedTarget(c, ctx.query.u) ? ctx.query.u : c.url;
    return cam.proxySnapshot(res, Object.assign({}, c, { url: target }));
  }, { raw: true });

  router.get('/api/cameras/:id/playlist', async (req, res, ctx) => {
    const c = get('SELECT * FROM cameras WHERE id = ?', U.toInt(ctx.params.id));
    if (!c) return U.fail(res, 404, 'Kamera tidak ditemukan');
    const u = ctx.query.u;
    if (!allowedTarget(c, u)) return U.fail(res, 403, 'Target playlist di luar host kamera');
    return cam.proxyPlaylist(req, res, Object.assign({}, c, { url: u }), c.id, U.toInt(ctx.query.depth, 1));
  }, { raw: true });

  router.get('/api/cameras/:id/segment', async (req, res, ctx) => {
    const c = get('SELECT * FROM cameras WHERE id = ?', U.toInt(ctx.params.id));
    if (!c) return U.fail(res, 404, 'Kamera tidak ditemukan');
    const u = ctx.query.u;
    if (!allowedTarget(c, u)) return U.fail(res, 403, 'Target segmen di luar host kamera');
    return cam.proxyFromUrl(req, res, c, u, 'video/mp2t');
  }, { raw: true });

  router.get('/api/cameras/:id/thumb', async (req, res, ctx) => {
    const c = get('SELECT * FROM cameras WHERE id = ?', U.toInt(ctx.params.id));
    if (!c) return cam.errorImage(res, 'Tidak ada kamera');
    return cam.proxySnapshot(res, c, 8);
  }, { raw: true });
}

module.exports = { register, resolveStreamUrl, KINDS };
