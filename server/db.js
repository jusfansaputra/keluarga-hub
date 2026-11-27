'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const U = require('./util');

const DB_PATH = process.env.FAMILY_DB || path.join(U.DATA_DIR, 'keluarga.db');
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

const all = (sql, ...p) => db.prepare(sql).all(...p);
const get = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => db.prepare(sql).run(...p);
const val = (sql, ...p) => { const r = db.prepare(sql).get(...p); return r ? Object.values(r)[0] : null; };

db.exec(`
CREATE TABLE IF NOT EXISTS family (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT 'Keluarga Saya',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  motto TEXT DEFAULT '',
  founded TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  timezone TEXT DEFAULT 'Asia/Jakarta',
  currency TEXT DEFAULT 'IDR',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  relation TEXT DEFAULT 'Anggota',
  role TEXT NOT NULL DEFAULT 'member',
  gender TEXT DEFAULT '',
  birthdate TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  job TEXT DEFAULT '',
  school TEXT DEFAULT '',
  blood TEXT DEFAULT '',
  address TEXT DEFAULT '',
  about TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  color TEXT DEFAULT '#6366f1',
  active INTEGER NOT NULL DEFAULT 1,
  last_login TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  created_by INTEGER,
  note TEXT DEFAULT '',
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Lainnya',
  purchase_date TEXT DEFAULT '',
  price REAL NOT NULL DEFAULT 0,
  current_value REAL,
  condition TEXT DEFAULT 'Baik',
  location TEXT DEFAULT '',
  owner_id INTEGER,
  status TEXT DEFAULT 'Aktif',
  warranty_until TEXT DEFAULT '',
  document TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  photo TEXT DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  tx_date TEXT NOT NULL,
  member_id INTEGER,
  method TEXT DEFAULT 'Tunai',
  attachment TEXT DEFAULT '',
  created_by INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  monthly_limit REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS cameras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'hls',
  url TEXT DEFAULT '',
  username TEXT DEFAULT '',
  password TEXT DEFAULT '',
  refresh_sec INTEGER DEFAULT 5,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'home',
  sort INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('photo','video')),
  filename TEXT NOT NULL,
  caption TEXT DEFAULT '',
  album TEXT DEFAULT 'Umum',
  taken_at TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  uploaded_by INTEGER,
  favorite INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  ev_date TEXT NOT NULL,
  ev_time TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  location TEXT DEFAULT '',
  category TEXT DEFAULT 'Keluarga',
  notes TEXT DEFAULT '',
  remind INTEGER DEFAULT 1,
  created_by INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS chores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  assignee_id INTEGER,
  due_date TEXT DEFAULT '',
  repeat TEXT DEFAULT 'none',
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'todo',
  notes TEXT DEFAULT '',
  created_by INTEGER,
  created_at TEXT,
  done_at TEXT
);

CREATE TABLE IF NOT EXISTS shopping (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item TEXT NOT NULL,
  qty REAL DEFAULT 1,
  unit TEXT DEFAULT 'pcs',
  est_price REAL DEFAULT 0,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'todo',
  added_by INTEGER,
  bought_by INTEGER,
  created_at TEXT,
  bought_at TEXT
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  level TEXT DEFAULT 'info',
  pinned INTEGER DEFAULT 0,
  author_id INTEGER,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  kind TEXT DEFAULT 'info',
  read INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(tx_date);
CREATE INDEX IF NOT EXISTS idx_media_album ON media(album);
`);

function getSetting(key, fallback = null) {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return fallback;
  try { return JSON.parse(row.value); } catch (e) { return row.value; }
}

function setSetting(key, value) {
  const json = JSON.stringify(value === undefined ? null : value);
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, json);
}

function logActivity(userId, action, entity, detail) {
  run('INSERT INTO activity (user_id, action, entity, detail, created_at) VALUES (?,?,?,?,?)',
    userId ?? null, action, entity || '', (detail || '').slice(0, 500), U.now());
}

function notify(userId, title, body, kind = 'info') {
  run('INSERT INTO notifications (user_id, title, body, kind, created_at) VALUES (?,?,?,?,?)',
    userId ?? null, title, body || '', kind, U.now());
}

/* ------------------------------- seeding -------------------------------- */

function seedMediaFiles() {
  const dir = path.join(U.UPLOAD_DIR, 'media');
  const made = [];
  const specs = [
    ['liburan-puncak', 'Liburan ke Puncak', '#0ea5e9', '#6366f1', 'Liburan'],
    ['lebaran-bersama', 'Lebaran bersama keluarga besar', '#f59e0b', '#ef4444', 'Lebaran'],
    ['ulang-tahun-ayu', 'Ulang tahun Ayu ke-12', '#ec4899', '#8b5cf6', 'Momen'],
    ['renovasi-dapur', 'Progress renovasi dapur', '#10b981', '#059669', 'Rumah'],
    ['lomba-17an', 'Lomba 17-an di komplek', '#ef4444', '#f97316', 'Momen'],
    ['wisuda-dimas', 'Wisuda SD Dimas', '#6366f1', '#22d3ee', 'Pendidikan'],
  ];
  specs.forEach(([slug, label, c1, c2, album], i) => {
    const file = `${slug}.svg`;
    const p = path.join(dir, file);
    if (!fs.existsSync(p)) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="1200" height="800" fill="url(#g)"/>
<circle cx="${180 + i * 90}" cy="220" r="120" fill="#ffffff" opacity="0.14"/>
<circle cx="980" cy="620" r="180" fill="#ffffff" opacity="0.10"/>
<g fill="#ffffff" opacity="0.92" font-family="Segoe UI, Arial, sans-serif">
<text x="80" y="420" font-size="56" font-weight="700">${label}</text>
<text x="80" y="480" font-size="28" opacity="0.85">Foto contoh — unggah foto asli lewat menu Galeri</text>
</g></svg>`;
      fs.writeFileSync(p, svg);
    }
    made.push({ file, label, album, i });
  });
  return made;
}

function seed() {
  if (val('SELECT COUNT(*) AS c FROM users') > 0) return false;

  run(`INSERT INTO family (id, name, address, city, phone, email, motto, founded, timezone, currency, updated_at)
       VALUES (1, 'Keluarga Wijaya', 'Jl. Melati Raya No. 21, Bintaro Sektor 5', 'Tangerang Selatan',
               '+62 812-8000-1122', 'keluarga.wijaya@mail.com', 'Rumahku, surgaku — bersama selalu.',
               '2009-06-14', 'Asia/Jakarta', 'IDR', ?)`, U.now());

  const members = [
    ['budi', 'Budi Wijaya', 'Ayah', 'admin', 'L', '1981-03-12', '+62 812-8000-1122', 'budi@mail.com', 'Wiraswasta', '', 'O', 'Pendiri & pengambil keputusan keluarga. Hobi: bersepeda dan memancing.', '#6366f1'],
    ['sari', 'Sari Wijaya', 'Ibu', 'admin', 'P', '1984-07-30', '+62 813-9000-2233', 'sari@mail.com', 'Apoteker', '', 'AB', 'Mengatur keuangan dan jadwal keluarga. Hobi: memasak dan berkebun.', '#ec4899'],
    ['dimas', 'Dimas Wijaya', 'Anak', 'member', 'L', '2010-01-18', '', 'dimas@mail.com', '', 'SMP Nusantara kelas 9', '', 'Suka robotik dan futsal.', '#0ea5e9'],
    ['ayu', 'Ayu Wijaya', 'Anak', 'member', 'P', '2013-09-05', '', '', '', 'SD Melati kelas 6', '', 'Suka menggambar dan menari.', '#f59e0b'],
    ['hendra', 'Hendra Wijaya', 'Kakek', 'member', 'L', '1955-11-22', '+62 811-2233-4455', '', '', '', 'B', 'Pensiunan guru, tinggal di paviliun belakang.', '#10b981'],
  ];
  members.forEach(([username, name, relation, role, gender, birthdate, phone, email, job, school, blood, about, color], i) => {
    run(`INSERT INTO users (username, password_hash, name, relation, role, gender, birthdate, phone, email, job, school, blood, about, color, active, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`,
      username, U.hashPassword('keluarga123'), name, relation, role, gender, birthdate, phone, email, job, school, blood, about, color, new Date(Date.now() - (300 - i * 40) * 864e5).toISOString());
  });

  const assets = [
    ['Rumah Tinggal Bintaro', 'Properti', '2012-08-17', 850000000, 1450000000, 'Sangat Baik', 'Bintaro Sektor 5', 1, 'Aktif', '', 'SHM No. 12345', 'KPR lunas 2022, renovasi dapur 2025.'],
    ['Toyota Innova 2019', 'Kendaraan', '2019-05-02', 385000000, 265000000, 'Baik', 'Garasi', 1, 'Aktif', '2026-05-02', 'B 1234 WIJ', 'Servis rutin tiap 10.000 km.'],
    ['Honda Vario 2022', 'Kendaraan', '2022-02-11', 22500000, 16000000, 'Baik', 'Carport', 2, 'Aktif', '2027-02-11', 'B 6789 WIJ', 'Dipakai Ibu untuk antar anak.'],
    ['MacBook Air M2', 'Elektronik', '2023-11-20', 18500000, 12000000, 'Baik', 'Ruang Kerja', 1, 'Aktif', '2026-11-20', '', 'Garansi Apple hingga Nov 2026.'],
    ['TV LG 55" OLED', 'Elektronik', '2024-03-08', 13900000, 10500000, 'Baik', 'Ruang Keluarga', 2, 'Aktif', '2026-03-08', '', ''],
    ['Kulkas Samsung 2 pintu', 'Elektronik', '2021-06-15', 7800000, 4200000, 'Baik', 'Dapur', 2, 'Aktif', '', '', ''],
    ['AC Daikin 1 PK x3', 'Elektronik', '2022-09-01', 12600000, 8400000, 'Baik', 'Kamar Utama / Anak / Tamu', 1, 'Aktif', '', '', 'Cuci AC tiap 4 bulan.'],
    ['Perhiasan Emas 45 gr', 'Perhiasan', '2020-12-24', 32000000, 52000000, 'Baik', 'Safe deposit box', 2, 'Disimpan', '', '', 'Nilai mengikuti harga emas.'],
    ['Deposito Bank', 'Investasi', '2023-01-10', 150000000, 165000000, 'Baik', 'Bank', 1, 'Aktif', '2026-12-10', '', 'Bunga 5.25% per tahun, ARO.'],
    ['Reksadana Saham', 'Investasi', '2022-04-05', 60000000, 78500000, 'Baik', 'Aplikasi investasi', 1, 'Aktif', '', '', 'DCA tiap tanggal 5.'],
    ['Set Sofa Ruang Tamu', 'Furnitur', '2021-02-20', 15500000, 8000000, 'Baik', 'Ruang Tamu', 2, 'Aktif', '', '', ''],
    ['Sepeda Polygon x2', 'Lainnya', '2023-07-19', 8900000, 6000000, 'Baik', 'Garasi', 1, 'Aktif', '', '', 'Satu untuk Ayah, satu untuk Dimas.'],
  ];
  assets.forEach((a, i) => {
    run(`INSERT INTO assets (name, category, purchase_date, price, current_value, condition, location, owner_id, status, warranty_until, document, notes, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7], a[8], a[9], a[10], a[11], U.now(), U.now());
  });

  const incomeCats = ['Gaji', 'Usaha', 'Bonus', 'Investasi', 'Hadiah', 'Lainnya'];
  const expenseCats = ['Belanja Bulanan', 'Tagihan & Utilitas', 'Pendidikan', 'Kesehatan', 'Makan di Luar', 'Transportasi', 'Hiburan', 'Renovasi Rumah', 'Zakat & Sosial', 'Lainnya'];
  expenseCats.forEach((c, i) => {
    const limits = [4500000, 2500000, 3000000, 1500000, 1200000, 1500000, 800000, 2000000, 1000000, 700000];
    run('INSERT INTO budgets (category, monthly_limit) VALUES (?,?)', c, limits[i]);
  });

  const desc = {
    'Gaji': ['Gaji Bulanan', 'Gaji ke-13'],
    'Usaha': ['Omzet toko online', 'Proyek konsultasi', 'Penjualan katering'],
    'Bonus': ['Bonus kinerja', 'THR'],
    'Investasi': ['Dividen reksadana', 'Bunga deposito'],
    'Hadiah': ['Hadiah ulang tahun', 'Angpao keluarga'],
    'Lainnya': ['Refund pembelian', 'Penjualan barang bekas'],
    'Belanja Bulanan': ['Belanja supermarket', 'Belanja pasar minggu', 'Kebutuhan harian'],
    'Tagihan & Utilitas': ['Listrik PLN', 'Internet & TV kabel', 'Air PDAM', 'IPL komplek', 'Pulsa & paket data'],
    'Pendidikan': ['SPP Dimas', 'SPP Ayu', 'Les matematika', 'Buku & alat tulis'],
    'Kesehatan': ['Vitamin & suplemen', 'Kontrol dokter', 'Obat apotek', 'Asuransi kesehatan'],
    'Makan di Luar': ['Makan malam keluarga', 'Kopi akhir pekan', 'Pesan antar'],
    'Transportasi': ['Bensin', 'Tol & parkir', 'Servis motor', 'Ojek online'],
    'Hiburan': ['Tiket bioskop', 'Liburan akhir pekan', 'Langganan streaming'],
    'Renovasi Rumah': ['Material bangunan', 'Upah tukang', 'Cat & dekorasi'],
    'Zakat & Sosial': ['Zakat mal', 'Sedekah Jumat', 'Sumbangan warga'],
  };
  const methods = ['Tunai', 'Transfer', 'Debit', 'QRIS', 'Kartu Kredit'];

  let seeded = 0;
  for (let back = 180; back >= 0; back--) {
    const d = new Date(Date.now() - back * 864e5);
    const date = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const dayOfMonth = d.getDate();

    if (dayOfMonth === 1) {
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'income', 18500000, 'Gaji', 'Gaji Bulanan', date, 1, 'Transfer', 1, d.toISOString());
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'income', 9200000, 'Gaji', 'Gaji Bulanan', date, 2, 'Transfer', 2, d.toISOString());
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'expense', 2400000, 'Tagihan & Utilitas', 'IPL komplek + listrik + internet', date, 1, 'Transfer', 1, d.toISOString());
    }
    if (dayOfMonth === 5) {
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'expense', 1500000, 'Pendidikan', 'Tabungan pendidikan & DCA reksadana', date, 1, 'Transfer', 1, d.toISOString());
    }
    if (dayOfMonth === 10) {
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'income', 3200000 + Math.round(Math.random() * 2500000), 'Usaha', 'Omzet toko online', date, 2, 'QRIS', 2, d.toISOString());
    }
    const nExp = dow === 0 || dow === 6 ? 2 : 1;
    for (let k = 0; k < nExp; k++) {
      const cat = expenseCats[Math.floor(Math.random() * expenseCats.length)];
      const list = desc[cat] || ['Pengeluaran'];
      const dsc = list[Math.floor(Math.random() * list.length)];
      const base = cat === 'Renovasi Rumah' ? 1200000 : cat === 'Pendidikan' ? 650000 : cat === 'Belanja Bulanan' ? 480000 : 145000;
      const amount = Math.round((base + Math.random() * base * 1.4) / 1000) * 1000;
      const member = 1 + Math.floor(Math.random() * 4);
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'expense', amount, cat, dsc, date, member, methods[Math.floor(Math.random() * methods.length)], member, d.toISOString());
      seeded++;
    }
    if (back % 21 === 0) {
      const cat = incomeCats[2 + Math.floor(Math.random() * 4)];
      const list = desc[cat] || ['Pemasukan lain'];
      run('INSERT INTO transactions (type, amount, category, description, tx_date, member_id, method, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        'income', Math.round((750000 + Math.random() * 3500000) / 50000) * 50000, cat, list[0], date, 1 + Math.floor(Math.random() * 2), 'Transfer', 1, d.toISOString());
    }
  }

  const camBase = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
  [
    ['Ruang Keluarga', 'Indoor — sudut TV', 'hls', camBase, 5, 1],
    ['Carport & Gerbang', 'Outdoor — menghadap jalan', 'hls', 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8', 5, 2],
    ['Dapur', 'Indoor — dekat pantry', 'snapshot', 'http://192.168.1.20/snapshot.cgi', 3, 3],
    ['Taman Belakang', 'Outdoor — XMEye DVR ch.4', 'iframe', 'http://192.168.1.10:1984/stream.html?src=taman', 5, 4],
  ].forEach(([name, location, kind, url, refresh, sort]) => {
    run('INSERT INTO cameras (name, location, kind, url, refresh_sec, enabled, sort, notes, created_at) VALUES (?,?,?,?,?,1,?,?,?)',
      name, location, kind, url, refresh, sort, sort <= 2 ? 'Kamera contoh (stream publik). Ganti dengan URL kamera XMEye Anda di menu Pengaturan / CCTV.' : 'Hubungkan ke DVR XMEye melalui go2rtc atau URL snapshot kamera.', U.now());
  });

  ['Ruang Keluarga', 'Dapur', 'Kamar Utama', 'Kamar Anak', 'Taman', 'Carport', 'Seluruh Rumah'].forEach((r, i) => {
    run('INSERT INTO rooms (name, icon, sort) VALUES (?,?,?)', r, ['sofa', 'coffee', 'bed', 'bed', 'tree', 'car', 'home'][i], i);
  });

  seedMediaFiles().forEach(({ file, label, album, i }) => {
    const stat = fs.statSync(path.join(U.UPLOAD_DIR, 'media', file));
    run('INSERT INTO media (kind, filename, caption, album, size, uploaded_by, created_at) VALUES (?,?,?,?,?,?,?)',
      'photo', file, label, album, stat.size, 1 + (i % 4), new Date(Date.now() - (i * 12 + 3) * 864e5).toISOString());
  });

  const d0 = new Date();
  const iso = (offset) => new Date(d0.getTime() + offset * 864e5).toISOString().slice(0, 10);
  [
    ['Arisan keluarga besar', iso(2), '19:00', 'Rumah Tante Rina', 'Keluarga', 'Bawa buah tangan, iuran Rp150.000.', 1],
    ['Kontrol gigi Ayu', iso(5), '10:30', 'RS Pondok Indah', 'Kesehatan', 'Bawa kartu asuransi.', 2],
    ['Rapat RT & kerja bakti', iso(7), '07:00', 'Balai Warga', 'Lingkungan', 'Dimas ikut kerja bakti.', 1],
    ['Ulang tahun Kakek Hendra', iso(12), '18:00', 'Rumah', 'Keluarga', 'Kue tart rasa mocca + kado dari semua cucu.', 2],
    ['Pengambilan rapor Dimas', iso(-3), '08:00', 'SMP Nusantara', 'Pendidikan', 'Sudah selesai.', 1],
    ['Liburan ke Bandung', iso(20), '06:00', 'Bandung', 'Liburan', 'Booking villa Lembang untuk 3 malam.', 1],
  ].forEach(([title, ev_date, ev_time, location, category, notes, by]) => {
    run('INSERT INTO events (title, ev_date, ev_time, location, category, notes, remind, created_by, created_at) VALUES (?,?,?,?,?,?,1,?,?)',
      title, ev_date, ev_time, location, category, notes, by, U.now());
  });

  [
    ['Buang sampah & pilah daur ulang', 3, iso(0), 'daily', 'normal', 'done'],
    ['Cuci mobil', 3, iso(1), 'weekly', 'normal', 'todo'],
    ['Siram tanaman pagi', 4, iso(0), 'daily', 'normal', 'todo'],
    ['Bersihkan akuarium', 3, iso(4), 'monthly', 'normal', 'todo'],
    ['Rapikan kamar sendiri', 4, iso(0), 'daily', 'high', 'todo'],
    ['Servis AC ruang keluarga', 1, iso(9), 'none', 'normal', 'todo'],
  ].forEach(([title, assignee, due, repeat, priority, status]) => {
    run('INSERT INTO chores (title, assignee_id, due_date, repeat, priority, status, created_by, created_at, done_at) VALUES (?,?,?,?,?,?,1,?,?)',
      title, assignee, due, repeat, priority, status, U.now(), status === 'done' ? U.now() : null);
  });

  [
    ['Beras 10 kg', 1, 'karung', 145000, 'todo', 2],
    ['Telur ayam', 2, 'kg', 30000, 'todo', 2],
    ['Sabun cuci piring', 1, 'botol', 22000, 'todo', 3],
    ['Sayur bayam & kangkung', 3, 'ikat', 15000, 'bought', 2],
    ['Susu UHT anak', 4, 'pak', 68000, 'todo', 1],
    ['Baterai AA (untuk sensor pintu)', 4, 'pack', 35000, 'todo', 1],
    ['Filter air kulkas', 1, 'pcs', 180000, 'todo', 1],
  ].forEach(([item, qty, unit, price, status, by]) => {
    run('INSERT INTO shopping (item, qty, unit, est_price, status, added_by, created_at, bought_at, bought_by) VALUES (?,?,?,?,?,?,?,?,?)',
      item, qty, unit, price, status, by, U.now(), status === 'bought' ? U.now() : null, status === 'bought' ? by : null);
  });

  [
    ['Iuran sampah & IPL naik mulai bulan depan', 'Pengurus RT menyampaikan IPL naik dari Rp250.000 menjadi Rp275.000 per bulan karena penambahan petugas keamanan malam.', 'warning', 1, 1],
    ['Password WiFi rumah sudah diganti', 'SSID: WIJAYA_HOME / Password: rumahku2026. Tolong sambungkan ulang semua perangkat termasuk kamera dan smart plug.', 'info', 1, 1],
    ['Jadwal piket dapur minggu ini', 'Senin-Rabu: Ayu & Dimas. Kamis-Sabtu: Ibu. Minggu: Ayah masak spesial.', 'info', 0, 2],
  ].forEach(([title, body, level, pinned, author]) => {
    run('INSERT INTO announcements (title, body, level, pinned, author_id, created_at) VALUES (?,?,?,?,?,?)',
      title, body, level, pinned, author, U.now());
  });

  setSetting('tuya', { enabled: false, endpoint: 'https://openapi.tuyaus.com', accessId: '', accessSecret: '', devicesRefresh: 30, demoMode: true });
  setSetting('xmeye', { notes: 'DVR/NVR XMEye tidak punya API publik. Gunakan go2rtc untuk menjembatani RTSP ke browser, atau URL snapshot HTTP kamera.', go2rtcUrl: 'http://192.168.1.10:1984', rtspTemplate: 'rtsp://{user}:{pass}@{ip}:554/user=admin&password=&channel=1&stream=0.sony' });
  setSetting('ui', { theme: 'dark', accent: '#6366f1', density: 'comfortable', landing: 'dashboard' });
  setSetting('security', { sessionDays: 14, inviteExpiryDays: 7, allowSelfRegister: false, cameraTokenInUrl: true });

  run('INSERT INTO invites (code, created_by, note, max_uses, uses, expires_at, created_at) VALUES (?,?,?,?,?,?,?)',
    'WIJAYA-DEMO', 1, 'Kode contoh untuk menambah anggota baru (bisa dipakai 5x)', 5, 0, new Date(Date.now() + 30 * 864e5).toISOString(), U.now());

  logActivity(1, 'seed', 'database', 'Data contoh keluarga dibuat');
  return true;
}

const seededNow = seed();

module.exports = {
  db, all, get, run, val, getSetting, setSetting, logActivity, notify,
  seedMediaFiles, DB_PATH, seededNow,
  CATEGORIES: {
    income: ['Gaji', 'Usaha', 'Bonus', 'Investasi', 'Hadiah', 'Lainnya'],
    expense: ['Belanja Bulanan', 'Tagihan & Utilitas', 'Pendidikan', 'Kesehatan', 'Makan di Luar', 'Transportasi', 'Hiburan', 'Renovasi Rumah', 'Zakat & Sosial', 'Lainnya'],
    asset: ['Properti', 'Kendaraan', 'Elektronik', 'Furnitur', 'Perhiasan', 'Investasi', 'Dokumen', 'Lainnya'],
    method: ['Tunai', 'Transfer', 'Debit', 'QRIS', 'Kartu Kredit', 'E-Wallet'],
    cameraKind: ['hls', 'mjpeg', 'snapshot', 'iframe', 'go2rtc'],
  },
};
