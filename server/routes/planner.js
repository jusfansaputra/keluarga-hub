'use strict';
const { get, run, all, val, logActivity } = require('../db');
const U = require('../util');

const REPEATS = ['none', 'daily', 'weekly', 'monthly', 'yearly'];
const PRIORITIES = ['low', 'normal', 'high'];

function register(router) {
  /* -------------------------------- agenda ------------------------------- */
  router.get('/api/events', async (req, res, ctx) => {
    const scope = ctx.query.scope || 'all';
    const where = scope === 'upcoming' ? "ev_date >= date('now')" : scope === 'past' ? "ev_date < date('now')" : '1=1';
    U.ok(res, {
      events: all(`SELECT e.*, u.name AS author_name, u.color AS author_color FROM events e
        LEFT JOIN users u ON u.id = e.created_by WHERE ${where} ORDER BY ev_date ASC, ev_time ASC LIMIT 300`),
      birthdays: all(`SELECT id, name, relation, birthdate, color FROM users WHERE active=1 AND birthdate != ''
        ORDER BY CAST(strftime('%m', birthdate) AS INTEGER), CAST(strftime('%d', birthdate) AS INTEGER)`),
    });
  });

  router.post('/api/events', async (req, res, ctx) => {
    const b = ctx.body || {};
    if (!U.str(b.title || '').trim() || !U.str(b.date || '')) return U.fail(res, 400, 'Judul dan tanggal wajib diisi');
    run(`INSERT INTO events (title, ev_date, ev_time, end_date, location, category, notes, remind, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      U.str(b.title, 160), U.str(b.date, 20), U.str(b.time || '', 10), U.str(b.endDate || '', 20),
      U.str(b.location || '', 160), U.str(b.category || 'Keluarga', 40), U.str(b.notes || '', 2000),
      b.remind === false ? 0 : 1, ctx.user.id, U.now());
    logActivity(ctx.user.id, 'create', 'event', U.str(b.title, 60));
    U.ok(res, { id: val('SELECT last_insert_rowid() AS i') });
  });

  router.put('/api/events/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const e = get('SELECT * FROM events WHERE id = ?', id);
    if (!e) return U.fail(res, 404, 'Agenda tidak ditemukan');
    const b = ctx.body || {};
    run(`UPDATE events SET title=?, ev_date=?, ev_time=?, end_date=?, location=?, category=?, notes=?, remind=? WHERE id=?`,
      U.str(b.title ?? e.title, 160), U.str(b.date ?? e.ev_date, 20), U.str(b.time ?? e.ev_time, 10),
      U.str(b.endDate ?? e.end_date, 20), U.str(b.location ?? e.location, 160), U.str(b.category ?? e.category, 40),
      U.str(b.notes ?? e.notes, 2000), b.remind === undefined ? e.remind : (b.remind ? 1 : 0), id);
    U.ok(res, { event: get('SELECT * FROM events WHERE id = ?', id) });
  });

  router.delete('/api/events/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const e = get('SELECT * FROM events WHERE id = ?', id);
    if (!e) return U.fail(res, 404, 'Agenda tidak ditemukan');
    if (ctx.user.role !== 'admin' && e.created_by !== ctx.user.id) return U.fail(res, 403, 'Bukan agenda Anda');
    run('DELETE FROM events WHERE id = ?', id);
    U.ok(res, { deleted: id });
  });

  /* ------------------------------- tugas rumah ---------------------------- */
  router.get('/api/chores', async (req, res, ctx) => {
    const scope = ctx.query.scope || 'open';
    const where = scope === 'done' ? "status='done'" : scope === 'all' ? '1=1' : "status='todo'";
    U.ok(res, {
      chores: all(`SELECT c.*, u.name AS assignee_name, u.color AS assignee_color, u.relation AS assignee_relation
        FROM chores c LEFT JOIN users u ON u.id = c.assignee_id WHERE ${where}
        ORDER BY CASE c.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, c.due_date ASC, c.id DESC`),
    });
  });

  router.post('/api/chores', async (req, res, ctx) => {
    const b = ctx.body || {};
    if (!U.str(b.title || '').trim()) return U.fail(res, 400, 'Judul tugas wajib diisi');
    run(`INSERT INTO chores (title, assignee_id, due_date, repeat, priority, status, notes, created_by, created_at, done_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
      U.str(b.title, 160), U.toInt(b.assigneeId, null), U.str(b.dueDate || U.today(), 20),
      REPEATS.includes(b.repeat) ? b.repeat : 'none', PRIORITIES.includes(b.priority) ? b.priority : 'normal',
      b.status === 'done' ? 'done' : 'todo', U.str(b.notes || '', 1000), ctx.user.id, U.now(), b.status === 'done' ? U.now() : null);
    logActivity(ctx.user.id, 'create', 'chore', U.str(b.title, 60));
    U.ok(res, { id: val('SELECT last_insert_rowid() AS i') });
  });

  router.put('/api/chores/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const c = get('SELECT * FROM chores WHERE id = ?', id);
    if (!c) return U.fail(res, 404, 'Tugas tidak ditemukan');
    const b = ctx.body || {};
    const status = b.status === 'done' ? 'done' : b.status === 'todo' ? 'todo' : c.status;
    run(`UPDATE chores SET title=?, assignee_id=?, due_date=?, repeat=?, priority=?, status=?, notes=?, done_at=? WHERE id=?`,
      U.str(b.title ?? c.title, 160), U.toInt(b.assigneeId, c.assignee_id), U.str(b.dueDate ?? c.due_date, 20),
      REPEATS.includes(b.repeat) ? b.repeat : c.repeat, PRIORITIES.includes(b.priority) ? b.priority : c.priority,
      status, U.str(b.notes ?? c.notes, 1000), status === 'done' ? (c.done_at || U.now()) : null, id);
    if (status === 'done' && c.status !== 'done') logActivity(ctx.user.id, 'update', 'chore', 'Menyelesaikan: ' + c.title);
    U.ok(res, { chore: get('SELECT * FROM chores WHERE id = ?', id) });
  });

  router.post('/api/chores/:id/toggle', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const c = get('SELECT * FROM chores WHERE id = ?', id);
    if (!c) return U.fail(res, 404, 'Tugas tidak ditemukan');
    const next = c.status === 'done' ? 'todo' : 'done';
    run('UPDATE chores SET status = ?, done_at = ? WHERE id = ?', next, next === 'done' ? U.now() : null, id);
    U.ok(res, { chore: get('SELECT * FROM chores WHERE id = ?', id) });
  });

  router.delete('/api/chores/:id', async (req, res, ctx) => {
    run('DELETE FROM chores WHERE id = ?', U.toInt(ctx.params.id));
    U.ok(res, { deleted: true });
  });

  /* ------------------------------ daftar belanja --------------------------- */
  router.get('/api/shopping', async (req, res, ctx) => {
    U.ok(res, {
      items: all(`SELECT s.*, u.name AS added_by_name, b.name AS bought_by_name FROM shopping s
        LEFT JOIN users u ON u.id = s.added_by LEFT JOIN users b ON b.id = s.bought_by
        ORDER BY CASE s.status WHEN 'todo' THEN 0 ELSE 1 END, s.id DESC`),
      stats: {
        open: val("SELECT COUNT(*) AS c FROM shopping WHERE status='todo'") || 0,
        est: val("SELECT COALESCE(SUM(est_price * qty),0) AS s FROM shopping WHERE status='todo'") || 0,
        bought: val("SELECT COUNT(*) AS c FROM shopping WHERE status='bought'") || 0,
      },
    });
  });

  router.post('/api/shopping', async (req, res, ctx) => {
    const b = ctx.body || {};
    if (!U.str(b.item || '').trim()) return U.fail(res, 400, 'Nama barang wajib diisi');
    run(`INSERT INTO shopping (item, qty, unit, est_price, note, status, added_by, created_at) VALUES (?,?,?,?,?,?,?,?)`,
      U.str(b.item, 140), Math.max(0, U.num(b.qty, 1)), U.str(b.unit || 'pcs', 20), Math.max(0, U.num(b.estPrice, 0)),
      U.str(b.note || '', 300), 'todo', ctx.user.id, U.now());
    U.ok(res, { id: val('SELECT last_insert_rowid() AS i') });
  });

  router.put('/api/shopping/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const s = get('SELECT * FROM shopping WHERE id = ?', id);
    if (!s) return U.fail(res, 404, 'Item tidak ditemukan');
    const b = ctx.body || {};
    const status = ['todo', 'bought'].includes(b.status) ? b.status : s.status;
    run(`UPDATE shopping SET item=?, qty=?, unit=?, est_price=?, note=?, status=?, bought_by=?, bought_at=? WHERE id=?`,
      U.str(b.item ?? s.item, 140), U.num(b.qty ?? s.qty, s.qty), U.str(b.unit ?? s.unit, 20),
      U.num(b.estPrice ?? s.est_price, s.est_price), U.str(b.note ?? s.note, 300), status,
      status === 'bought' ? (s.bought_by || ctx.user.id) : null, status === 'bought' ? (s.bought_at || U.now()) : null, id);
    U.ok(res, { item: get('SELECT * FROM shopping WHERE id = ?', id) });
  });

  router.post('/api/shopping/:id/toggle', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const s = get('SELECT * FROM shopping WHERE id = ?', id);
    if (!s) return U.fail(res, 404, 'Item tidak ditemukan');
    const bought = s.status !== 'bought';
    run('UPDATE shopping SET status=?, bought_by=?, bought_at=? WHERE id=?',
      bought ? 'bought' : 'todo', bought ? ctx.user.id : null, bought ? U.now() : null, id);
    U.ok(res, { item: get('SELECT * FROM shopping WHERE id = ?', id) });
  });

  router.delete('/api/shopping/:id', async (req, res, ctx) => {
    run('DELETE FROM shopping WHERE id = ?', U.toInt(ctx.params.id));
    U.ok(res, { deleted: true });
  });

  router.post('/api/shopping/clear-bought', async (req, res, ctx) => {
    run("DELETE FROM shopping WHERE status='bought'");
    U.ok(res, { cleared: true });
  });
}

module.exports = { register };
