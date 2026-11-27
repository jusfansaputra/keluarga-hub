'use strict';
const { get, run, all, val, getSetting, setSetting, logActivity } = require('../db');
const U = require('../util');

const SESSION_COOKIE = 'fh_token';
const SESSION_DAYS = () => Number(getSetting('security', {})?.sessionDays || 14);

function publicUser(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return rest;
}

function getUserByToken(token) {
  if (!token) return null;
  const s = get('SELECT * FROM sessions WHERE token = ?', token);
  if (!s) return null;
  if (new Date(s.expires_at).getTime() < Date.now()) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return null;
  }
  return publicUser(get('SELECT * FROM users WHERE id = ? AND active = 1', s.user_id));
}

function resolveUser(req) {
  const header = req.headers.authorization || '';
  if (/^Bearer /i.test(header)) return getUserByToken(header.slice(7).trim());
  const cookies = U.parseCookies(req);
  if (cookies[SESSION_COOKIE]) return getUserByToken(cookies[SESSION_COOKIE]);
  const u = new URL(req.url, 'http://localhost');
  if (u.searchParams.get('token')) return getUserByToken(u.searchParams.get('token'));
  return null;
}

function createSession(userId) {
  const token = U.randomToken(28);
  const expires = new Date(Date.now() + SESSION_DAYS() * 864e5).toISOString();
  run('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)', token, userId, U.now(), expires);
  return { token, expires };
}

function setCookie(res, token) {
  const maxAge = SESSION_DAYS() * 86400;
  const existing = res.getHeader ? res.getHeader('Set-Cookie') : undefined;
  const cookie = `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax`;
  if (existing) res.setHeader('Set-Cookie', [].concat(existing, cookie));
  else res.setHeader('Set-Cookie', cookie);
}

function register(router) {
  router.post('/api/auth/login', async (req, res, ctx) => {
    const username = U.str(ctx.body.username || '').trim().toLowerCase();
    const password = U.str(ctx.body.password || '');
    if (!username || !password) return U.fail(res, 400, 'Username dan password wajib diisi');
    const user = get('SELECT * FROM users WHERE lower(username) = ?', username);
    if (!user || !user.active || !U.verifyPassword(password, user.password_hash)) {
      return U.fail(res, 401, 'Username atau password salah');
    }
    const { token, expires } = createSession(user.id);
    run('UPDATE users SET last_login = ? WHERE id = ?', U.now(), user.id);
    setCookie(res, token);
    logActivity(user.id, 'login', 'auth', 'Masuk ke aplikasi');
    U.ok(res, { token, expires, user: publicUser(user) });
  });

  router.post('/api/auth/register', async (req, res, ctx) => {
    const code = U.str(ctx.body.code || '').trim().toUpperCase();
    const username = U.str(ctx.body.username || '').trim().toLowerCase();
    const password = U.str(ctx.body.password || '');
    const name = U.str(ctx.body.name || '').trim();
    if (!code || !username || !password || !name) return U.fail(res, 400, 'Lengkapi kode undangan, nama, username, dan password');
    if (password.length < 6) return U.fail(res, 400, 'Password minimal 6 karakter');
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) return U.fail(res, 400, 'Username 3-24 karakter: huruf, angka, titik, garis bawah');

    const inv = get('SELECT * FROM invites WHERE code = ?', code);
    if (!inv) return U.fail(res, 403, 'Kode undangan tidak dikenal — akses dibatasi untuk anggota keluarga');
    if (inv.uses >= inv.max_uses) return U.fail(res, 403, 'Kode undangan sudah habis dipakai');
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) return U.fail(res, 403, 'Kode undangan sudah kedaluwarsa');
    if (val('SELECT COUNT(*) AS c FROM users WHERE lower(username) = ?', username) > 0) {
      return U.fail(res, 409, 'Username sudah dipakai anggota lain');
    }

    run('INSERT INTO users (username, password_hash, name, relation, role, active, created_at) VALUES (?,?,?,?,?,1,?)',
      username, U.hashPassword(password), name, U.str(ctx.body.relation || 'Anggota'), 'member', U.now());
    const id = val('SELECT id FROM users WHERE lower(username) = ?', username);
    run('UPDATE invites SET uses = uses + 1 WHERE code = ?', code);
    logActivity(id, 'register', 'auth', `Bergabung memakai kode ${code}`);
    const { token, expires } = createSession(id);
    setCookie(res, token);
    U.ok(res, { token, expires, user: publicUser(get('SELECT * FROM users WHERE id = ?', id)) });
  });

  router.post('/api/auth/logout', async (req, res, ctx) => {
    const cookies = U.parseCookies(req);
    const token = (req.headers.authorization || '').replace(/^Bearer /i, '') || cookies[SESSION_COOKIE];
    if (token) run('DELETE FROM sessions WHERE token = ?', token);
    setCookie(res, '');
    res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
    U.ok(res, { loggedOut: true });
  });

  router.get('/api/auth/me', async (req, res, ctx) => {
    if (!ctx.user) return U.fail(res, 401, 'Belum masuk');
    const family = get('SELECT * FROM family WHERE id = 1');
    const pending = val('SELECT COUNT(*) AS c FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND read = 0', ctx.user.id);
    U.ok(res, { user: ctx.user, family, unread: pending });
  });

  router.put('/api/auth/profile', async (req, res, ctx) => {
    const b = ctx.body || {};
    run(`UPDATE users SET name=?, gender=?, birthdate=?, phone=?, email=?, job=?, school=?, blood=?, address=?, about=?, color=? WHERE id=?`,
      U.str(b.name ?? ctx.user.name, 80), U.str(b.gender ?? ctx.user.gender, 10), U.str(b.birthdate ?? '', 20),
      U.str(b.phone ?? '', 40), U.str(b.email ?? '', 120), U.str(b.job ?? '', 80), U.str(b.school ?? '', 120),
      U.str(b.blood ?? '', 5), U.str(b.address ?? '', 240), U.str(b.about ?? '', 1000), U.str(b.color ?? '#6366f1', 20), ctx.user.id);
    logActivity(ctx.user.id, 'update', 'profile', 'Memperbarui profil sendiri');
    U.ok(res, { user: publicUser(get('SELECT * FROM users WHERE id = ?', ctx.user.id)) });
  });

  router.post('/api/auth/password', async (req, res, ctx) => {
    const row = get('SELECT * FROM users WHERE id = ?', ctx.user.id);
    if (!U.verifyPassword(U.str(ctx.body.current || ''), row.password_hash)) {
      return U.fail(res, 403, 'Password lama tidak cocok');
    }
    const next = U.str(ctx.body.next || '');
    if (next.length < 6) return U.fail(res, 400, 'Password baru minimal 6 karakter');
    run('UPDATE users SET password_hash = ? WHERE id = ?', U.hashPassword(next), ctx.user.id);
    logActivity(ctx.user.id, 'update', 'auth', 'Mengganti password');
    U.ok(res, { changed: true });
  });

  router.get('/api/invites', async (req, res, ctx) => {
    U.ok(res, { invites: all('SELECT * FROM invites ORDER BY created_at DESC') });
  });

  router.post('/api/invites', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang bisa membuat kode undangan');
    const code = U.str(ctx.body.code || '').trim().toUpperCase() || U.inviteCode();
    const maxUses = Math.max(1, U.toInt(ctx.body.maxUses, 1));
    const days = Math.max(1, U.toInt(ctx.body.days, 7));
    run('INSERT INTO invites (code, created_by, note, max_uses, uses, expires_at, created_at) VALUES (?,?,?,?,0,?,?)',
      code, ctx.user.id, U.str(ctx.body.note || '', 200), maxUses, new Date(Date.now() + days * 864e5).toISOString(), U.now());
    logActivity(ctx.user.id, 'create', 'invite', `Kode ${code} (${maxUses}x)`);
    U.ok(res, { invite: get('SELECT * FROM invites WHERE code = ?', code) });
  });

  router.delete('/api/invites/:code', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang bisa mencabut kode');
    run('DELETE FROM invites WHERE code = ?', ctx.params.code.toUpperCase());
    U.ok(res, { deleted: ctx.params.code });
  });
}

module.exports = { register, resolveUser, publicUser, setCookie, SESSION_COOKIE };
