'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { db, get, run, all, val, getSetting, setSetting, logActivity, CATEGORIES } = require('../db');
const U = require('../util');
const iot = require('./iot');
const { resolveStreamUrl } = require('./cctv');

const TABLES = ['family', 'users', 'assets', 'transactions', 'budgets', 'cameras', 'rooms', 'media',
  'events', 'chores', 'shopping', 'announcements', 'activity', 'settings', 'invites', 'notifications'];

function monthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildDashboard(user) {
  const mk = monthKey();
  const start = mk + '-01';
  const income = val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='income' AND strftime('%Y-%m',tx_date)=?", mk) || 0;
  const expense = val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='expense' AND strftime('%Y-%m',tx_date)=?", mk) || 0;
  const prevMk = new Date(new Date(start).getTime() - 864e5).toISOString().slice(0, 7);
  const prevExpense = val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='expense' AND strftime('%Y-%m',tx_date)=?", prevMk) || 0;

  return {
    greeting: pickGreeting(),
    today: U.today(),
    month: mk,
    finance: {
      income, expense, balance: income - expense,
      deltaExpensePct: prevExpense ? Math.round(((expense - prevExpense) / prevExpense) * 100) : 0,
      trend: all(`SELECT strftime('%Y-%m', tx_date) AS ym,
          SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income,
          SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
        FROM transactions WHERE tx_date >= date('now','-6 month') GROUP BY ym ORDER BY ym`),
      recent: all(`SELECT t.*, u.name AS member_name, u.color AS member_color FROM transactions t
        LEFT JOIN users u ON u.id = t.member_id ORDER BY t.tx_date DESC, t.id DESC LIMIT 6`),
      topCategory: get(`SELECT category, SUM(amount) AS total FROM transactions
        WHERE type='expense' AND strftime('%Y-%m',tx_date)=? GROUP BY category ORDER BY total DESC LIMIT 1`, mk) || null,
      expenseByCategory: all(`SELECT category, SUM(amount) AS total FROM transactions
        WHERE type='expense' AND strftime('%Y-%m',tx_date)=? GROUP BY category ORDER BY total DESC LIMIT 6`, mk),
      budgetAlerts: all(`SELECT b.category, b.monthly_limit,
          COALESCE((SELECT SUM(amount) FROM transactions WHERE type='expense' AND category=b.category AND strftime('%Y-%m',tx_date)=?),0) AS used
        FROM budgets b`, mk).filter((b) => b.monthly_limit && b.used / b.monthly_limit >= 0.8)
        .map((b) => ({ category: b.category, pct: Math.round((b.used / b.monthly_limit) * 100), used: b.used, limit: b.monthly_limit })),
    },
    family: {
      members: all(`SELECT id, name, relation, role, color, avatar, birthdate FROM users WHERE active=1 ORDER BY id`),
      birthdays: all(`SELECT id, name, relation, birthdate, color FROM users WHERE active=1 AND birthdate != ''
        AND (strftime('%m', birthdate) || '-' || strftime('%d', birthdate)) >= strftime('%m-%d','now')
        ORDER BY strftime('%m', birthdate), strftime('%d', birthdate) LIMIT 3`),
    },
    agenda: {
      today: all(`SELECT * FROM events WHERE ev_date = date('now') OR (end_date != '' AND ev_date <= date('now') AND end_date >= date('now')) ORDER BY ev_time`),
      upcoming: all(`SELECT * FROM events WHERE ev_date > date('now') ORDER BY ev_date, ev_time LIMIT 5`),
      choresOpen: val("SELECT COUNT(*) AS c FROM chores WHERE status='todo'") || 0,
      myChores: all(`SELECT * FROM chores WHERE status='todo' AND (assignee_id = ? OR assignee_id IS NULL) ORDER BY due_date LIMIT 5`, user.id),
      shoppingOpen: val("SELECT COUNT(*) AS c FROM shopping WHERE status='todo'") || 0,
      shoppingItems: all(`SELECT item, qty, unit FROM shopping WHERE status='todo' ORDER BY id DESC LIMIT 6`),
    },
    assets: {
      count: val('SELECT COUNT(*) AS c FROM assets') || 0,
      value: val("SELECT COALESCE(SUM(COALESCE(current_value, price)),0) AS s FROM assets WHERE status != 'Dijual'") || 0,
      byCategory: all(`SELECT category, SUM(COALESCE(current_value, price)) AS value FROM assets WHERE status != 'Dijual' GROUP BY category ORDER BY value DESC LIMIT 6`),
    },
    cameras: all('SELECT * FROM cameras WHERE enabled = 1 ORDER BY sort, id LIMIT 6').map((c) => Object.assign({ streamUrl: resolveStreamUrl(c) }, { id: c.id, name: c.name, location: c.location, kind: c.kind })),
    iot: (() => {
      const cfg = getSetting('tuya', {}) || {};
      const live = !(cfg.enabled !== false && cfg.accessId && cfg.accessSecret && cfg.uid);
      const cache = getSetting('tuya_cache', null);
      if (!live && cache && cache.devices) {
        return { demo: false, total: cache.devices.length, online: cache.devices.filter((d) => d.online).length, sample: cache.devices.slice(0, 6), syncedAt: cache.at };
      }
      const devices = iot.demoDevices();
      return { demo: true, total: devices.length, online: devices.filter((d) => d.online).length, sample: devices.slice(0, 6), syncedAt: null };
    })(),
    announcements: all(`SELECT a.*, u.name AS author_name, u.color AS author_color FROM announcements a
      LEFT JOIN users u ON u.id = a.author_id ORDER BY a.pinned DESC, a.created_at DESC LIMIT 4`),
    activity: all(`SELECT a.*, u.name AS user_name, u.color AS user_color FROM activity a
      LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 8`),
  };
}

function pickGreeting() {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

function register(router) {
  router.get('/api/dashboard', async (req, res, ctx) => {
    U.ok(res, buildDashboard(ctx.user));
  });

  router.get('/api/meta', async (req, res, ctx) => {
    U.ok(res, {
      categories: CATEGORIES,
      members: all('SELECT id, name, relation, color FROM users WHERE active=1 ORDER BY id'),
      rooms: all('SELECT * FROM rooms ORDER BY sort, id'),
      albums: all('SELECT DISTINCT album FROM media ORDER BY album'),
      family: get('SELECT * FROM family WHERE id = 1'),
    });
  });

  router.get('/api/settings', async (req, res, ctx) => {
    const isAdmin = ctx.user.role === 'admin';
    const tuya = getSetting('tuya', {}) || {};
    U.ok(res, {
      ui: getSetting('ui', {}),
      security: getSetting('security', {}),
      xmeye: getSetting('xmeye', {}),
      tuya: isAdmin ? tuya : { endpoint: tuya.endpoint, uid: tuya.uid, enabled: tuya.enabled, demoMode: tuya.demoMode, accessId: tuya.accessId ? '****' : '', accessSecret: '' },
    });
  });

  router.put('/api/settings/:key', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mengubah pengaturan');
    const key = ctx.params.key;
    if (!['ui', 'security', 'xmeye', 'tuya'].includes(key)) return U.fail(res, 400, 'Kunci pengaturan tidak dikenal');
    const cur = getSetting(key, {}) || {};
    const next = Object.assign({}, cur, ctx.body || {});
    if (key === 'tuya' && (ctx.body || {}).accessSecret === '') delete next.accessSecret;
    setSetting(key, next);
    logActivity(ctx.user.id, 'update', 'settings', 'Mengubah pengaturan ' + key);
    U.ok(res, { key, value: key === 'tuya' && ctx.user.role !== 'admin' ? {} : next });
  });

  router.get('/api/notifications', async (req, res, ctx) => {
    U.ok(res, { notifications: all('SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC LIMIT 50', ctx.user.id) });
  });

  router.post('/api/notifications/read-all', async (req, res, ctx) => {
    run('UPDATE notifications SET read = 1 WHERE user_id = ? OR user_id IS NULL', ctx.user.id);
    U.ok(res, { unread: 0 });
  });

  router.get('/api/system/status', async (req, res, ctx) => {
    const st = fs.existsSync(U.DB_PATH) ? fs.statSync(U.DB_PATH) : { size: 0 };
    U.ok(res, {
      node: process.version,
      uptime: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      dbPath: U.DB_PATH,
      dbSizeKb: Math.round(st.size / 1024),
      uploadsKb: Math.round(dirSize(path.join(U.UPLOAD_DIR, 'media')) / 1024),
      counts: Object.fromEntries(['users', 'assets', 'transactions', 'cameras', 'media', 'events', 'chores', 'shopping', 'announcements']
        .map((t) => [t, val(`SELECT COUNT(*) AS c FROM ${t}`) || 0])),
      seededFresh: !!require('../db').seededNow,
    });
  });

  router.get('/api/export', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mengekspor data');
    const dump = { exportedAt: U.now(), version: 1, tables: {} };
    TABLES.forEach((t) => {
      if (t === 'users') {
        dump.tables[t] = all('SELECT * FROM users').map((u) => { const { password_hash, ...rest } = u; return rest; });
      } else if (t !== 'sessions') {
        dump.tables[t] = all(`SELECT * FROM ${t}`);
      }
    });
    logActivity(ctx.user.id, 'export', 'system', 'Ekspor cadangan data keluarga');
    U.send(res, 200, dump, { 'Content-Disposition': `attachment; filename="cadangan-keluarga-${U.today()}.json"` });
  });

  router.post('/api/import', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat memulihkan data');
    const dump = ctx.body || {};
    if (!dump.tables || typeof dump.tables !== 'object') return U.fail(res, 400, 'File cadangan tidak valid');
    const imported = {};
    TABLES.forEach((t) => {
      const rows = dump.tables[t];
      if (!Array.isArray(rows) || !rows.length) return;
      const cols = Object.keys(rows[0]);
      const stmt = db.prepare(`INSERT OR REPLACE INTO ${t} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`);
      rows.forEach((r) => { try { stmt.run(...cols.map((c) => (r[c] === undefined ? null : r[c]))); imported[t] = (imported[t] || 0) + 1; } catch (e) { /* lewati baris tak cocok */ } });
    });
    logActivity(ctx.user.id, 'import', 'system', 'Memulihkan cadangan: ' + JSON.stringify(imported));
    U.ok(res, { imported });
  });
}

function dirSize(dir) {
  let total = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      const s = fs.statSync(path.join(dir, f));
      if (s.isFile()) total += s.size;
    }
  } catch (e) { /* direktori kosong */ }
  return total;
}

module.exports = { register, buildDashboard };
