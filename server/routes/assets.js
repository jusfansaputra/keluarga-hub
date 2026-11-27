'use strict';
const { get, run, all, val, logActivity } = require('../db');
const U = require('../util');
const { CATEGORIES } = require('../db');

function register(router) {
  router.get('/api/assets', async (req, res, ctx) => {
    let where = '1=1';
    const args = [];
    if (ctx.query.category) { where = 'category = ?'; args.push(ctx.query.category); }
    if (ctx.query.owner) { where = 'owner_id = ?'; args.push(U.toInt(ctx.query.owner)); }
    if (ctx.query.q) { where = '(name LIKE ? OR location LIKE ? OR notes LIKE ? OR document LIKE ?)';
      args.push(...['%', '%', '%', '%'].map((p, i) => p + ctx.query.q + (i === 3 ? p : p))); }
    const rows = all(`SELECT a.*, u.name AS owner_name, u.color AS owner_color FROM assets a
      LEFT JOIN users u ON u.id = a.owner_id WHERE ${where} ORDER BY COALESCE(a.current_value, a.price) DESC`, ...args);
    const byCategory = all(`SELECT category, COUNT(*) AS n, SUM(price) AS cost, SUM(COALESCE(current_value, price)) AS value
      FROM assets WHERE status != 'Dijual' GROUP BY category ORDER BY value DESC`);
    U.ok(res, {
      assets: rows,
      byCategory,
      summary: {
        count: val('SELECT COUNT(*) AS c FROM assets') || 0,
        cost: val('SELECT COALESCE(SUM(price),0) AS s FROM assets') || 0,
        value: val("SELECT COALESCE(SUM(COALESCE(current_value, price)),0) AS s FROM assets WHERE status != 'Dijual'") || 0,
        warrantyActive: val("SELECT COUNT(*) AS c FROM assets WHERE warranty_until != '' AND date(warranty_until) >= date('now')") || 0,
      },
    });
  });

  router.get('/api/assets/:id', async (req, res, ctx) => {
    const a = get('SELECT a.*, u.name AS owner_name FROM assets a LEFT JOIN users u ON u.id=a.owner_id WHERE a.id=?', U.toInt(ctx.params.id));
    if (!a) return U.fail(res, 404, 'Aset tidak ditemukan');
    U.ok(res, { asset: a });
  });

  router.post('/api/assets', async (req, res, ctx) => {
    const b = ctx.body || {};
    if (!U.str(b.name || '').trim()) return U.fail(res, 400, 'Nama aset wajib diisi');
    run(`INSERT INTO assets (name, category, purchase_date, price, current_value, condition, location, owner_id, status, warranty_until, document, notes, photo, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      U.str(b.name, 140), CATEGORIES.asset.includes(U.str(b.category || '')) ? U.str(b.category) : 'Lainnya',
      U.str(b.purchaseDate || '', 20), Math.max(0, U.num(b.price, 0)),
      b.currentValue === undefined || b.currentValue === '' ? null : Math.max(0, U.num(b.currentValue, 0)),
      U.str(b.condition || 'Baik', 30), U.str(b.location || '', 120), U.toInt(b.ownerId, null),
      U.str(b.status || 'Aktif', 30), U.str(b.warrantyUntil || '', 20), U.str(b.document || '', 120),
      U.str(b.notes || '', 1000), U.str(b.photo || '', 300), U.now(), U.now());
    const id = val('SELECT last_insert_rowid() AS i');
    logActivity(ctx.user.id, 'create', 'asset', 'Menambah aset: ' + U.str(b.name, 60));
    U.ok(res, { id, asset: get('SELECT * FROM assets WHERE id = ?', id) });
  });

  router.put('/api/assets/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const a = get('SELECT * FROM assets WHERE id = ?', id);
    if (!a) return U.fail(res, 404, 'Aset tidak ditemukan');
    const b = ctx.body || {};
    run(`UPDATE assets SET name=?, category=?, purchase_date=?, price=?, current_value=?, condition=?, location=?, owner_id=?, status=?, warranty_until=?, document=?, notes=?, photo=?, updated_at=? WHERE id=?`,
      U.str(b.name ?? a.name, 140), CATEGORIES.asset.includes(U.str(b.category || '')) ? U.str(b.category) : a.category,
      U.str(b.purchaseDate ?? a.purchase_date, 20), U.num(b.price ?? a.price, a.price),
      b.currentValue === undefined ? a.current_value : (b.currentValue === '' || b.currentValue === null ? null : U.num(b.currentValue, 0)),
      U.str(b.condition ?? a.condition, 30), U.str(b.location ?? a.location, 120), U.toInt(b.ownerId, a.owner_id),
      U.str(b.status ?? a.status, 30), U.str(b.warrantyUntil ?? a.warranty_until, 20), U.str(b.document ?? a.document, 120),
      U.str(b.notes ?? a.notes, 1000), U.str(b.photo ?? a.photo, 300), U.now(), id);
    logActivity(ctx.user.id, 'update', 'asset', 'Memperbarui aset: ' + U.str(b.name ?? a.name, 60));
    U.ok(res, { asset: get('SELECT * FROM assets WHERE id = ?', id) });
  });

  router.delete('/api/assets/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const a = get('SELECT * FROM assets WHERE id = ?', id);
    if (!a) return U.fail(res, 404, 'Aset tidak ditemukan');
    if (ctx.user.role !== 'admin' && a.owner_id !== ctx.user.id) return U.fail(res, 403, 'Hanya admin atau pemilik aset yang dapat menghapus');
    run('DELETE FROM assets WHERE id = ?', id);
    logActivity(ctx.user.id, 'delete', 'asset', 'Menghapus aset: ' + a.name);
    U.ok(res, { deleted: id });
  });
}

module.exports = { register };
