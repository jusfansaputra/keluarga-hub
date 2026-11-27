'use strict';
const { get, run, all, val, logActivity } = require('../db');
const U = require('../util');
const { publicUser } = require('./auth');

function register(router) {
  router.get('/api/family', async (req, res, ctx) => {
    const family = get('SELECT * FROM family WHERE id = 1');
    const members = all(`SELECT u.*,
        (SELECT COUNT(*) FROM transactions t WHERE t.member_id = u.id) AS tx_count,
        (SELECT COALESCE(SUM(t.amount),0) FROM transactions t WHERE t.member_id = u.id AND t.type='expense' AND t.tx_date >= date('now','-30 day')) AS spend_30d
      FROM users u WHERE u.active = 1 ORDER BY CASE u.role WHEN 'admin' THEN 0 ELSE 1 END, u.id`);
    const stats = {
      members: members.length,
      assets: val('SELECT COUNT(*) AS c FROM assets') || 0,
      assetValue: val(`SELECT COALESCE(SUM(COALESCE(current_value, price)),0) AS v FROM assets WHERE status != 'Dijual'`) || 0,
      photos: val(`SELECT COUNT(*) AS c FROM media WHERE kind='photo'`) || 0,
      videos: val(`SELECT COUNT(*) AS c FROM media WHERE kind='video'`) || 0,
      cameras: val('SELECT COUNT(*) AS c FROM cameras WHERE enabled = 1') || 0,
      eventsUpcoming: val("SELECT COUNT(*) AS c FROM events WHERE ev_date >= date('now')") || 0,
      choresOpen: val("SELECT COUNT(*) AS c FROM chores WHERE status = 'todo'") || 0,
    };
    U.ok(res, { family, members: members.map(publicUser).map((m, i) => Object.assign(m, { tx_count: members[i].tx_count, spend_30d: members[i].spend_30d })), stats });
  });

  router.put('/api/family', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin keluarga yang dapat mengubah profil keluarga');
    const b = ctx.body || {};
    run(`UPDATE family SET name=?, address=?, city=?, phone=?, email=?, motto=?, founded=?, timezone=?, currency=?, updated_at=? WHERE id=1`,
      U.str(b.name ?? 'Keluarga Saya', 120), U.str(b.address ?? '', 240), U.str(b.city ?? '', 80), U.str(b.phone ?? '', 40),
      U.str(b.email ?? '', 120), U.str(b.motto ?? '', 200), U.str(b.founded ?? '', 20), U.str(b.timezone ?? 'Asia/Jakarta', 40),
      U.str(b.currency ?? 'IDR', 8), U.now());
    logActivity(ctx.user.id, 'update', 'family', 'Profil keluarga diperbarui');
    U.ok(res, { family: get('SELECT * FROM family WHERE id = 1') });
  });

  router.get('/api/members/:id', async (req, res, ctx) => {
    const m = get('SELECT * FROM users WHERE id = ?', U.toInt(ctx.params.id));
    if (!m) return U.fail(res, 404, 'Anggota tidak ditemukan');
    const tx = all("SELECT type, COALESCE(SUM(amount),0) AS total FROM transactions WHERE member_id = ? GROUP BY type", m.id);
    U.ok(res, {
      member: publicUser(m),
      totals: Object.fromEntries(tx.map((r) => [r.type, r.total])),
      assets: all('SELECT * FROM assets WHERE owner_id = ? ORDER BY name', m.id),
      chores: all('SELECT * FROM chores WHERE assignee_id = ? ORDER BY due_date', m.id),
    });
  });

  router.post('/api/members', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat menambah anggota');
    const b = ctx.body || {};
    const username = U.str(b.username || '').trim().toLowerCase();
    const name = U.str(b.name || '').trim();
    if (!username || !name) return U.fail(res, 400, 'Nama dan username wajib diisi');
    if (val('SELECT COUNT(*) AS c FROM users WHERE lower(username) = ?', username) > 0) return U.fail(res, 409, 'Username sudah dipakai');
    const password = U.str(b.password || '') || 'keluarga123';
    run(`INSERT INTO users (username, password_hash, name, relation, role, gender, birthdate, phone, email, job, school, blood, address, about, color, active, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
      username, U.hashPassword(password), name, U.str(b.relation || 'Anggota', 40),
      b.role === 'admin' ? 'admin' : 'member', U.str(b.gender || '', 10), U.str(b.birthdate || '', 20),
      U.str(b.phone || '', 40), U.str(b.email || '', 120), U.str(b.job || '', 80), U.str(b.school || '', 120),
      U.str(b.blood || '', 5), U.str(b.address || '', 240), U.str(b.about || '', 1000), U.str(b.color || '#6366f1', 20), U.now());
    const id = val('SELECT id FROM users WHERE lower(username) = ?', username);
    logActivity(ctx.user.id, 'create', 'member', `Menambah anggota: ${name}`);
    U.ok(res, { member: publicUser(get('SELECT * FROM users WHERE id = ?', id)), tempPassword: password });
  });

  router.put('/api/members/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    if (ctx.user.role !== 'admin' && ctx.user.id !== id) return U.fail(res, 403, 'Tidak berhak mengubah data anggota ini');
    const m = get('SELECT * FROM users WHERE id = ?', id);
    if (!m) return U.fail(res, 404, 'Anggota tidak ditemukan');
    const b = ctx.body || {};
    const role = ctx.user.role === 'admin' ? (b.role === 'admin' ? 'admin' : 'member') : m.role;
    run(`UPDATE users SET name=?, relation=?, role=?, gender=?, birthdate=?, phone=?, email=?, job=?, school=?, blood=?, address=?, about=?, color=? WHERE id=?`,
      U.str(b.name ?? m.name, 80), U.str(b.relation ?? m.relation, 40), role, U.str(b.gender ?? m.gender, 10),
      U.str(b.birthdate ?? m.birthdate, 20), U.str(b.phone ?? m.phone, 40), U.str(b.email ?? m.email, 120),
      U.str(b.job ?? m.job, 80), U.str(b.school ?? m.school, 120), U.str(b.blood ?? m.blood, 5),
      U.str(b.address ?? m.address, 240), U.str(b.about ?? m.about, 1000), U.str(b.color ?? m.color, 20), id);
    logActivity(ctx.user.id, 'update', 'member', `Memperbarui data ${b.name ?? m.name}`);
    U.ok(res, { member: publicUser(get('SELECT * FROM users WHERE id = ?', id)) });
  });

  router.post('/api/members/:id/reset-password', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mereset password anggota');
    const id = U.toInt(ctx.params.id);
    const temp = U.str(ctx.body.password || '') || 'keluarga123';
    run('UPDATE users SET password_hash = ? WHERE id = ?', U.hashPassword(temp), id);
    run('DELETE FROM sessions WHERE user_id = ?', id);
    logActivity(ctx.user.id, 'update', 'member', 'Mereset password anggota');
    U.ok(res, { tempPassword: temp });
  });

  router.delete('/api/members/:id', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat menonaktifkan anggota');
    const id = U.toInt(ctx.params.id);
    if (id === ctx.user.id) return U.fail(res, 400, 'Anda tidak dapat menonaktifkan akun sendiri');
    run('UPDATE users SET active = 0 WHERE id = ?', id);
    run('DELETE FROM sessions WHERE user_id = ?', id);
    logActivity(ctx.user.id, 'delete', 'member', 'Menonaktifkan anggota');
    U.ok(res, { deactivated: id });
  });

  router.post('/api/members/:id/activate', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mengaktifkan kembali anggota');
    run('UPDATE users SET active = 1 WHERE id = ?', U.toInt(ctx.params.id));
    U.ok(res, { activated: true });
  });

  /* ------------------------------ papan info ----------------------------- */
  router.get('/api/announcements', async (req, res, ctx) => {
    U.ok(res, { announcements: all(`SELECT a.*, u.name AS author_name, u.color AS author_color
      FROM announcements a LEFT JOIN users u ON u.id = a.author_id
      ORDER BY a.pinned DESC, a.created_at DESC LIMIT 100`) });
  });

  router.post('/api/announcements', async (req, res, ctx) => {
    const b = ctx.body || {};
    if (!U.str(b.title || '').trim()) return U.fail(res, 400, 'Judul pengumuman wajib diisi');
    run('INSERT INTO announcements (title, body, level, pinned, author_id, created_at) VALUES (?,?,?,?,?,?)',
      U.str(b.title, 160), U.str(b.body || '', 4000), ['info', 'warning', 'success'].includes(b.level) ? b.level : 'info',
      b.pinned ? 1 : 0, ctx.user.id, U.now());
    logActivity(ctx.user.id, 'create', 'announcement', U.str(b.title, 60));
    U.ok(res, { id: val('SELECT last_insert_rowid() AS i') });
  });

  router.put('/api/announcements/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const a = get('SELECT * FROM announcements WHERE id = ?', id);
    if (!a) return U.fail(res, 404, 'Pengumuman tidak ditemukan');
    if (ctx.user.role !== 'admin' && a.author_id !== ctx.user.id) return U.fail(res, 403, 'Bukan pengumuman Anda');
    const b = ctx.body || {};
    run('UPDATE announcements SET title=?, body=?, level=?, pinned=? WHERE id=?',
      U.str(b.title ?? a.title, 160), U.str(b.body ?? a.body, 4000),
      ['info', 'warning', 'success'].includes(b.level) ? b.level : a.level, b.pinned === undefined ? a.pinned : (b.pinned ? 1 : 0), id);
    U.ok(res, { announcement: get('SELECT * FROM announcements WHERE id = ?', id) });
  });

  router.delete('/api/announcements/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const a = get('SELECT * FROM announcements WHERE id = ?', id);
    if (!a) return U.fail(res, 404, 'Pengumuman tidak ditemukan');
    if (ctx.user.role !== 'admin' && a.author_id !== ctx.user.id) return U.fail(res, 403, 'Bukan pengumuman Anda');
    run('DELETE FROM announcements WHERE id = ?', id);
    U.ok(res, { deleted: id });
  });

  router.get('/api/activity', async (req, res, ctx) => {
    const limit = Math.min(200, Math.max(10, U.toInt(ctx.query.limit, 40)));
    U.ok(res, {
      activity: all(`SELECT a.*, u.name AS user_name, u.color AS user_color FROM activity a
        LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT ?`, limit),
    });
  });
}

module.exports = { register };
