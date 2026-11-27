'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { get, run, all, val, logActivity } = require('../db');
const U = require('../util');

const MEDIA_DIR = path.join(U.UPLOAD_DIR, 'media');
const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
  'image/svg+xml': '.svg', 'image/avif': '.avif', 'image/heic': '.heic',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov', 'video/x-matroska': '.mkv',
};
const KIND_OF = (mime) => (mime || '').startsWith('video/') ? 'video' : 'photo';

function register(router) {
  router.get('/api/media', async (req, res, ctx) => {
    const where = ['1=1'];
    const args = [];
    if (ctx.query.album && ctx.query.album !== 'all') { where.push('album = ?'); args.push(ctx.query.album); }
    if (ctx.query.kind) { where.push('kind = ?'); args.push(ctx.query.kind); }
    if (ctx.query.fav === '1') where.push('favorite = 1');
    if (ctx.query.q) { where.push('caption LIKE ?'); args.push('%' + ctx.query.q + '%'); }
    const rows = all(`SELECT m.*, u.name AS uploader_name FROM media m LEFT JOIN users u ON u.id = m.uploaded_by
      WHERE ${where.join(' AND ')} ORDER BY m.favorite DESC, m.created_at DESC LIMIT 500`, ...args);
    U.ok(res, {
      media: rows.map((r) => Object.assign({}, r, { url: `/files/media/${encodeURIComponent(r.filename)}` })),
      albums: all(`SELECT album, COUNT(*) AS n,
          SUM(CASE WHEN kind='photo' THEN 1 ELSE 0 END) AS photos,
          SUM(CASE WHEN kind='video' THEN 1 ELSE 0 END) AS videos,
          MAX(created_at) AS latest
        FROM media GROUP BY album ORDER BY album`),
      covers: Object.fromEntries(all(`SELECT album, filename FROM media m WHERE created_at =
          (SELECT MAX(created_at) FROM media WHERE album = m.album AND kind='photo')`).map((r) => [r.album, `/files/media/${encodeURIComponent(r.filename)}`])),
    });
  });

  router.post('/api/media', async (req, res, ctx) => {
    const b = ctx.body || {};
    let mime = U.str(b.mime || '', 60);
    let b64 = U.str(b.data || '', 600 * 1024 * 1024);
    if (!b64 && U.str(b.dataUrl || '')) {
      const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(b.dataUrl);
      if (!m) return U.fail(res, 400, 'Format data file tidak dikenali');
      mime = m[1] || mime;
      b64 = m[3];
    }
    if (!b64) return U.fail(res, 400, 'File kosong');
    b64 = b64.replace(/^data:[^,]*,/, '');
    let buf;
    try { buf = Buffer.from(b64, 'base64'); } catch (e) { return U.fail(res, 400, 'File gagal didekode'); }
    if (!buf.length) return U.fail(res, 400, 'File kosong');

    const kind = U.str(b.kind || '') === 'video' ? 'video' : KIND_OF(mime);
    const ext = EXT[mime] || (kind === 'video' ? '.mp4' : '.jpg');
    const filename = U.uid('m') + ext;
    fs.writeFileSync(path.join(MEDIA_DIR, filename), buf);

    run(`INSERT INTO media (kind, filename, caption, album, taken_at, size, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      kind, filename, U.str(b.caption || '', 300), U.str(b.album || 'Umum', 80), U.str(b.takenAt || '', 20),
      buf.length, ctx.user.id, U.now());
    const id = val('SELECT last_insert_rowid() AS i');
    logActivity(ctx.user.id, 'create', 'media', `Mengunggah ${kind}: ${U.str(b.caption || filename, 60)}`);
    U.ok(res, { id, item: { id, kind, filename, url: `/files/media/${filename}`, caption: b.caption || '', album: b.album || 'Umum' } });
  });

  router.put('/api/media/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const m = get('SELECT * FROM media WHERE id = ?', id);
    if (!m) return U.fail(res, 404, 'Media tidak ditemukan');
    const b = ctx.body || {};
    run('UPDATE media SET caption=?, album=? WHERE id=?', U.str(b.caption ?? m.caption, 300), U.str(b.album ?? m.album, 80), id);
    U.ok(res, { item: get('SELECT * FROM media WHERE id = ?', id) });
  });

  router.post('/api/media/:id/favorite', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    run('UPDATE media SET favorite = 1 - favorite WHERE id = ?', id);
    U.ok(res, { item: get('SELECT * FROM media WHERE id = ?', id) });
  });

  router.delete('/api/media/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const m = get('SELECT * FROM media WHERE id = ?', id);
    if (!m) return U.fail(res, 404, 'Media tidak ditemukan');
    if (ctx.user.role !== 'admin' && m.uploaded_by !== ctx.user.id) return U.fail(res, 403, 'Hanya pengunggah atau admin yang dapat menghapus');
    try { fs.unlinkSync(path.join(MEDIA_DIR, m.filename)); } catch (e) { /* file sudah hilang */ }
    run('DELETE FROM media WHERE id = ?', id);
    logActivity(ctx.user.id, 'delete', 'media', 'Menghapus ' + m.filename);
    U.ok(res, { deleted: id });
  });

  router.get('/api/albums', async (req, res, ctx) => {
    U.ok(res, { albums: all('SELECT DISTINCT album FROM media ORDER BY album') });
  });

  /* Sajikan file galeri (foto/video). Auth lewat cookie atau ?token=. */
  router.get('/files/media/:name', async (req, res, ctx) => {
    const name = path.basename(ctx.params.name);
    const p = path.join(MEDIA_DIR, name);
    if (!U.serveFile(req, res, p)) U.fail(res, 404, 'File tidak ditemukan');
  }, { raw: true });
}

module.exports = { register, MEDIA_DIR };
