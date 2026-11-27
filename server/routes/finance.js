'use strict';
const { get, run, all, val, logActivity } = require('../db');
const U = require('../util');
const { CATEGORIES } = require('../db');

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function register(router) {
  router.get('/api/finance/summary', async (req, res, ctx) => {
    const months = Math.min(24, Math.max(1, U.toInt(ctx.query.months, 6)));
    const mk = U.str(ctx.query.month || monthKey(), 7);
    const start = mk + '-01';

    const range = all(`
      WITH RECURSIVE seq(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM seq WHERE i < ? - 1)
      SELECT strftime('%Y-%m', date(?, '-' || i || ' month')) AS ym FROM seq ORDER BY ym`,
      months, start);
    const from = range[0].ym + '-01';

    const trend = all(`SELECT strftime('%Y-%m', tx_date) AS ym, type, SUM(amount) AS total
      FROM transactions WHERE tx_date >= ? GROUP BY ym, type`, from);
    const byMonth = Object.fromEntries(range.map((r) => [r.ym, { income: 0, expense: 0 }]));
    trend.forEach((t) => { if (byMonth[t.ym]) byMonth[t.ym][t.type] = t.total; });

    const catRows = all(`SELECT category, SUM(amount) AS total, COUNT(*) AS n FROM transactions
      WHERE type='expense' AND tx_date >= ? AND tx_date < date(?, '+1 month') GROUP BY category ORDER BY total DESC`, start, start);
    const incomeRows = all(`SELECT category, SUM(amount) AS total FROM transactions
      WHERE type='income' AND tx_date >= ? AND tx_date < date(?, '+1 month') GROUP BY category ORDER BY total DESC`, start, start);
    const memberRows = all(`SELECT u.id, u.name, u.color, COALESCE(SUM(t.amount),0) AS total, COUNT(t.id) AS n
      FROM users u LEFT JOIN transactions t ON t.member_id = u.id AND t.type='expense'
        AND t.tx_date >= ? AND t.tx_date < date(?, '+1 month')
      WHERE u.active = 1 GROUP BY u.id ORDER BY total DESC`, start, start);
    const budgets = all('SELECT * FROM budgets');
    const budgetUsage = budgets.map((b) => {
      const used = val(`SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='expense' AND category=? AND tx_date >= ? AND tx_date < date(?, '+1 month')`, b.category, start, start) || 0;
      return Object.assign({}, b, { used, remaining: b.monthly_limit - used, pct: b.monthly_limit ? Math.round((used / b.monthly_limit) * 100) : 0 });
    });

    const monthTotals = {
      income: val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='income' AND tx_date >= ? AND tx_date < date(?, '+1 month')", start, start) || 0,
      expense: val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='expense' AND tx_date >= ? AND tx_date < date(?, '+1 month')", start, start) || 0,
    };
    monthTotals.balance = monthTotals.income - monthTotals.expense;

    const ytdStart = mk.slice(0, 4) + '-01-01';
    const ytd = {
      income: val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='income' AND tx_date >= ?", ytdStart) || 0,
      expense: val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='expense' AND tx_date >= ?", ytdStart) || 0,
    };
    ytd.balance = ytd.income - ytd.expense;

    const last30 = {
      expense: val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='expense' AND tx_date >= date('now','-30 day')") || 0,
      income: val("SELECT COALESCE(SUM(amount),0) AS s FROM transactions WHERE type='income' AND tx_date >= date('now','-30 day')") || 0,
    };
    const savingsRate = ytd.income > 0 ? Math.round((ytd.balance / ytd.income) * 100) : 0;

    U.ok(res, {
      month: mk, months,
      totals: { month: monthTotals, ytd, last30, savingsRate },
      trend: range.map((r) => Object.assign({ ym: r.ym }, byMonth[r.ym])),
      expenseByCategory: catRows,
      incomeByCategory: incomeRows,
      byMember: memberRows,
      budgets: budgetUsage,
      topExpense: all(`SELECT description, amount, tx_date, category FROM transactions
        WHERE type='expense' AND tx_date >= ? AND tx_date < date(?, '+1 month') ORDER BY amount DESC LIMIT 5`, start, start),
    });
  });

  router.get('/api/transactions', async (req, res, ctx) => {
    const where = ['1=1'];
    const args = [];
    if (ctx.query.month) { where.push("strftime('%Y-%m', tx_date) = ?"); args.push(ctx.query.month); }
    if (ctx.query.from) { where.push('tx_date >= ?'); args.push(ctx.query.from); }
    if (ctx.query.to) { where.push('tx_date <= ?'); args.push(ctx.query.to); }
    if (ctx.query.type) { where.push('type = ?'); args.push(ctx.query.type); }
    if (ctx.query.member) { where.push('member_id = ?'); args.push(U.toInt(ctx.query.member)); }
    if (ctx.query.category) { where.push('category = ?'); args.push(ctx.query.category); }
    if (ctx.query.q) { where.push('(description LIKE ? OR category LIKE ?)'); args.push('%' + ctx.query.q + '%', '%' + ctx.query.q + '%'); }
    const limit = Math.min(500, Math.max(1, U.toInt(ctx.query.limit, 100)));
    const offset = Math.max(0, U.toInt(ctx.query.offset, 0));
    const rows = all(`SELECT t.*, u.name AS member_name, u.color AS member_color, c.name AS creator_name
      FROM transactions t LEFT JOIN users u ON u.id = t.member_id LEFT JOIN users c ON c.id = t.created_by
      WHERE ${where.join(' AND ')} ORDER BY t.tx_date DESC, t.id DESC LIMIT ? OFFSET ?`, ...args, limit, offset);
    const total = val(`SELECT COUNT(*) AS c FROM transactions t WHERE ${where.join(' AND ')}`, ...args) || 0;
    U.ok(res, { transactions: rows, total, limit, offset });
  });

  router.post('/api/transactions', async (req, res, ctx) => {
    const b = ctx.body || {};
    const type = b.type === 'income' ? 'income' : 'expense';
    const amount = Math.round(U.num(b.amount, 0) * 100) / 100;
    if (amount <= 0) return U.fail(res, 400, 'Nominal harus lebih besar dari 0');
    const list = type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
    const category = list.includes(U.str(b.category || '')) ? U.str(b.category) : 'Lainnya';
    const memberId = U.toInt(b.memberId, ctx.user.id);
    const date = U.str(b.date || U.today(), 10);
    run(`INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
      type, amount, category, U.str(b.description || category, 200), date, memberId,
      CATEGORIES.method.includes(U.str(b.method || '')) ? U.str(b.method) : 'Tunai', ctx.user.id, U.now());
    const id = val('SELECT last_insert_rowid() AS i');
    logActivity(ctx.user.id, 'create', 'transaction', `${type === 'income' ? 'Pemasukan' : 'Pengeluaran'} ${amount} — ${category}`);
    U.ok(res, { id, transaction: get('SELECT * FROM transactions WHERE id = ?', id) });
  });

  router.put('/api/transactions/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const row = get('SELECT * FROM transactions WHERE id = ?', id);
    if (!row) return U.fail(res, 404, 'Transaksi tidak ditemukan');
    if (ctx.user.role !== 'admin' && row.created_by !== ctx.user.id) return U.fail(res, 403, 'Hanya pembuat transaksi atau admin yang dapat mengubah');
    const b = ctx.body || {};
    const type = ['income', 'expense'].includes(b.type) ? b.type : row.type;
    const list = type === 'income' ? CATEGORIES.income : CATEGORIES.expense;
    run(`UPDATE transactions SET type=?, amount=?, category=?, description=?, tx_date=?, member_id=?, method=? WHERE id=?`,
      type, Math.round(U.num(b.amount ?? row.amount, row.amount) * 100) / 100,
      list.includes(U.str(b.category || '')) ? U.str(b.category) : row.category,
      U.str(b.description ?? row.description, 200), U.str(b.date ?? row.tx_date, 10),
      U.toInt(b.memberId, row.member_id), CATEGORIES.method.includes(U.str(b.method || '')) ? U.str(b.method) : row.method, id);
    logActivity(ctx.user.id, 'update', 'transaction', 'Mengubah transaksi #' + id);
    U.ok(res, { transaction: get('SELECT * FROM transactions WHERE id = ?', id) });
  });

  router.delete('/api/transactions/:id', async (req, res, ctx) => {
    const id = U.toInt(ctx.params.id);
    const row = get('SELECT * FROM transactions WHERE id = ?', id);
    if (!row) return U.fail(res, 404, 'Transaksi tidak ditemukan');
    if (ctx.user.role !== 'admin' && row.created_by !== ctx.user.id) return U.fail(res, 403, 'Hanya pembuat transaksi atau admin yang dapat menghapus');
    run('DELETE FROM transactions WHERE id = ?', id);
    logActivity(ctx.user.id, 'delete', 'transaction', 'Menghapus transaksi #' + id);
    U.ok(res, { deleted: id });
  });

  router.get('/api/budgets', async (req, res, ctx) => U.ok(res, { budgets: all('SELECT * FROM budgets ORDER BY category') }));

  router.post('/api/budgets', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mengatur anggaran');
    const category = U.str(ctx.body.category || '').trim();
    const limitAmt = U.num(ctx.body.monthlyLimit, 0);
    if (!category || limitAmt <= 0) return U.fail(res, 400, 'Kategori dan nominal anggaran wajib diisi');
    run('INSERT INTO budgets (category, monthly_limit) VALUES (?,?) ON CONFLICT(category) DO UPDATE SET monthly_limit=excluded.monthly_limit', category, limitAmt);
    U.ok(res, { budgets: all('SELECT * FROM budgets ORDER BY category') });
  });

  router.delete('/api/budgets/:id', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat menghapus anggaran');
    run('DELETE FROM budgets WHERE id = ?', U.toInt(ctx.params.id));
    U.ok(res, { budgets: all('SELECT * FROM budgets ORDER BY category') });
  });
}

module.exports = { register, monthKey };
