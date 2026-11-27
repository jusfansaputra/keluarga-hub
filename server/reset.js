'use strict';
/** Hapus database & file galeri, lalu buat ulang dengan data contoh.
 *  Jalankan: node --no-warnings server/reset.js --yes
 */
const fs = require('node:fs');
const path = require('node:path');
const U = require('./util');

if (!process.argv.includes('--yes')) {
  console.log('Ini akan MENGHAPUS seluruh data keluarga (database + galeri).');
  console.log('Jalankan ulang dengan flag: node --no-warnings server/reset.js --yes');
  process.exit(1);
}

const dbFile = process.env.FAMILY_DB || path.join(U.DATA_DIR, 'keluarga.db');
for (const f of [dbFile, dbFile + '-wal', dbFile + '-shm']) {
  try { fs.rmSync(f); } catch (e) { /* tidak ada */ }
}
const mediaDir = path.join(U.UPLOAD_DIR, 'media');
try { fs.rmSync(mediaDir, { recursive: true, force: true }); } catch (e) { /* tidak ada */ }

require('./db');
console.log('Selesai. Database baru dengan data contoh sudah dibuat di:', dbFile);
