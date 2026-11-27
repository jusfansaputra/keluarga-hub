# 🏠 Keluarga Hub — Portal Web Keluarga

Aplikasi web privat untuk satu keluarga: profil anggota, keuangan bersama, inventaris aset,
pantauan **CCTV (XMEye / IP camera)**, **Smart Home (Tuya Smart Life)**, galeri foto & video,
agenda, tugas rumah, daftar belanja, papan pengumuman, dan cadangan data.

Dibangun **tanpa dependensi npm** — hanya Node.js bawaan (`node:http`, `node:sqlite`, `fetch`, `crypto`).
Tidak perlu `npm install`.

---

## 1. Menjalankan

Butuh **Node.js 22.5 ke atas** (memakai modul bawaan `node:sqlite`).

```bash
npm start          # atau: node --no-warnings server/index.js
```

Lalu buka **http://localhost:3000**. Server juga mencetak alamat LAN
(mis. `http://192.168.1.7:3000`) supaya bisa dibuka dari HP semua anggota keluarga.

| Perintah | Fungsi |
|---|---|
| `npm start` | Jalankan server (port 3000) |
| `npm run dev` | Jalankan dengan auto-reload saat file diubah |
| `npm run reset` | Hapus database + galeri, buat ulang data contoh (`node server/reset.js --yes`) |
| `PORT=8080 npm start` | Ganti port |

### Akun contoh (data demo sudah terisi otomatis saat pertama dijalankan)

| Username | Password | Peran |
|---|---|---|
| `budi` | `keluarga123` | Admin (Ayah) |
| `sari` | `keluarga123` | Admin (Ibu) |
| `dimas` | `keluarga123` | Anggota (Anak) |
| `ayu` | `keluarga123` | Anggota (Anak) |
| `hendra` | `keluarga123` | Anggota (Kakek) |

> Ganti password semua akun contoh lewat **Pengaturan → Ganti password** sebelum dipakai serius.

---

## 2. Fitur

**Akses khusus keluarga**
- Login username + password (hash `scrypt`, sesi token acak di DB, cookie `HttpOnly` + `SameSite=Lax`).
- Registrasi anggota baru **wajib memakai kode undangan** yang dibuat admin (Keluarga → Kode undangan).
- Dua peran: **admin** (kelola anggota, aset, kamera, integrasi, cadangan) dan **anggota**
  (mencatat transaksi, unggah galeri, menjalankan perangkat, menambah agenda/belanja).
- Pembatasan percobaan login (12x / 5 menit per IP).

**Beranda** — salam, surplus bulan ini, agenda hari ini, tugas saya, daftar belanja, thumbnail CCTV,
status perangkat pintar, papan info, transaksi & aktivitas terbaru.

**Keuangan** — semua anggota bisa input pemasukan/pengeluaran; filter bulan/jenis/anggota/pencarian;
grafik arus kas 6 bulan; komposisi kategori; **anggaran bulanan** dengan peringatan 80%/100%;
rekap per anggota; saldo & rasio tabungan YTD. Transaksi hanya bisa diubah pembuatnya atau admin.

**Aset** — properti, kendaraan, elektronik, furnitur, perhiasan, investasi; harga beli vs nilai kini,
garansi, dokumen (SHM/plat), lokasi, pemilik, status; donut komposisi nilai; peringatan garansi habis.

**CCTV** — grid multi-kamera, mode perbesar, indikator LIVE, tes koneksi (status HTTP + latency),
thumbnail otomatis di beranda. Mendukung 5 mode (lihat bagian 3).

**Smart Home** — daftar perangkat, saklar on/off, slider kecerahan/suhu AC/posisi tirai, baca sensor
(suhu, kelembapan, baterai, kontak pintu, daya listrik), filter per ruang, **skenario/scene** sekali klik,
sinkron manual, panel uji API Tuya.

**Galeri** — album, unggah multi foto/video (drag/klik), lightbox dengan navigasi & hapus, favorit, filter jenis.

**Agenda** — kalender bulanan, kegiatan per tanggal, agenda mendatang (H-n), ulang tahun anggota otomatis.

**Tugas Rumah** — piket dengan penanggung jawab, tenggat, prioritas, pengulangan, pengelompokan
terlewat/hari ini/mendatang, beban tugas per anggota.

**Belanja** — daftar bersama, estimasi harga, tandai sudah dibeli, siapa yang menambah/membeli.

**Papan Info** — pengumuman (info/penting/kabar baik, bisa disematkan) + riwayat aktivitas otomatis semua anggota.

**Pengaturan** — profil akun, tema gelap/terang, konfigurasi go2rtc/XMEye, konfigurasi Tuya, kebijakan sesi,
status server, **ekspor/impor cadangan JSON** seluruh data.

Responsif: sidebar jadi drawer + navigasi bawah di HP.

---

## 3. Menampilkan CCTV dari XMEye

Aplikasi XMEye/DVR Cina **tidak punya API/cloud publik**, dan browser tidak bisa memutar RTSP langsung.
Karena itu server ini menyediakan proxy + 5 mode tampilan:

| Mode | Kapan dipakai | Contoh URL |
|---|---|---|
| `snapshot` | Kamera/DVR membuka endpoint JPEG | `http://192.168.1.20/snapshot.cgi` (di-refresh tiap n detik) |
| `mjpeg` | Kamera punya stream MJPEG HTTP | `http://192.168.1.20/videostream.asf` |
| `hls` | Sudah ada jembatan HLS (go2rtc, NVR, ffmpeg) | `http://192.168.1.10:1984/ruang-keluarga/index.m3u8` |
| `go2rtc` | Menempel halaman WebRTC/MSE go2rtc | sumber: `ruang-keluarga` (nama stream) |
| `iframe` | Halaman web NVR/XMEye yang bisa di-embed | `http://192.168.1.20/web/` atau link share XMEye |

**Cara paling andal untuk XMEye: go2rtc** (RTSP → WebRTC/HLS, latensi rendah).

```bash
docker run -d --name go2rtc -p 1984:1984 -p 8555:8555 -p 1935:1935 alexxit/go2rtc
```

`go2rtc.yaml`:

```yaml
streams:
  ruang-keluarga: rtsp://admin:SANDI@192.168.1.20:554/user=admin&password=&channel=1&stream=0.sony
  gerbang:        rtsp://admin:SANDI@192.168.1.21:554/channel=1
```

Format URL RTSP XMEye umumnya:
`rtsp://USER:PASS@IP:554/user=admin&password=&channel=1&stream=0.sony`
(`stream=0` = utama, `stream=1` = sub-stream yang lebih ringan).

Lalu di aplikasi ini: **CCTV → Tambah Kamera → mode `go2rtc`** dengan sumber `ruang-keluarga`,
atau mode `hls` dengan URL `http://IP-GO2RTC:1984/ruang-keluarga/index.m3u8`.
Simpan URL go2rtc default di **Pengaturan → Integrasi CCTV**.

Catatan:
- Kredensial kamera disimpan di database lokal; semua stream **di-proxy server keluarga** sehingga
  tidak terbentur CORS/mixed-content dan tidak perlu login ulang di tiap browser.
- Proxy HLS hanya meneruskan segmen dari host kamera yang sama (bukan proxy terbuka).
- Mode `hls` di Chrome memerlukan `hls.js` (dimuat otomatis dari CDN saat dibutuhkan).
  Tanpa internet, gunakan mode `go2rtc`/`iframe`/`snapshot` yang tidak butuh CDN.
- Kamera contoh bawaan memakai stream HLS publik — hapus/ganti dengan kamera Anda.

---

## 4. Menghubungkan IoT Tuya / Smart Life

Perangkat di aplikasi **Smart Life** atau **Tuya Smart** dibaca lewat **Tuya IoT Cloud API**
(signing HMAC-SHA256 diimplementasikan di `server/tuya.js`).

1. Buka **https://platform.tuya.com** → *Cloud* → *Development* → **Create Cloud Project**.
2. Pilih **Smart Home** pada *Industry* dan **Data Center** sesuai region akun Smart Life Anda
   (Indonesia/Asia → `https://openapi.tuyaus.com` atau `https://openapi.tuyain.com`; Cina → `tuyacn.com`; EU → `tuyaeu.com`).
3. Di tab *API Explorer*, aktifkan layanan **IoT Core** dan **Smart Home Scene Linkage**.
4. Salin **Access ID/Client ID** dan **Access Secret**.
5. Di aplikasi ini: **Smart Home → Konfigurasi Tuya** → isi endpoint, Access ID, Access Secret → simpan
   (server langsung mengetes pembuatan token).
6. Klik **Tautkan Akun Smart Life** → masukkan email/nomor akun aplikasi Smart Life Anda.
   Hasilnya berupa **UID**; setelah itu klik **Sinkron** dan perangkat asli Anda muncul.

Endpoint yang dipakai: `/v1.0/token`, `/v1.0/iot-03/authorized/users`,
`/v1.0/iot-03/users/{uid}/devices`, `/v1.0/iot-03/devices/{id}/status|functions|commands`,
`/v1.0/iot-03/scenes/{id}/trigger`, plus **panel uji API** untuk memanggil endpoint Tuya apa pun.

**Mode demo:** selama Tuya belum dikonfigurasi, halaman Smart Home menampilkan 10 perangkat simulasi
(lampu, AC, pompa, sensor pintu, sensor suhu, smart plug DVR, tirai) yang benar-benar bisa di-toggle
agar Anda bisa mencoba antarmukanya lebih dulu. Status demo tersimpan di database.
Matikan lewat *Konfigurasi Tuya → “Tampilkan perangkat demo”* bila sudah terhubung ke akun asli.

---

## 5. Aplikasi Android & PWA

### PWA (install dari Chrome, tanpa build)
Web ini sudah PWA: `public/manifest.webmanifest` + service worker `public/sw.js`
(shell UI di-cache saat install; `/api/` dan `/uploads/` selalu lewat jaringan agar data segar
dan video tetap bisa seek).

- **HTTPS atau localhost**: buka di Chrome Android → menu → *Install app / Tambahkan ke layar Utama* →
  ikon "Keluarga" terpasang dan terbuka fullscreen standalone.
- **HTTP LAN polos**: Chrome tidak memunculkan prompt install (PWA mewajibkan secure context).
  Pakai menu → *Tambahkan ke layar Utama* (shortcut), atau pakai jalur APK di bawah,
  atau beri server HTTPS (Tailscale Funnel / Cloudflare Tunnel / reverse proxy Caddy+HTTPS).
- Service worker hanya aktif di secure context; di HTTP LAN web berjalan normal tanpa cache offline.

### APK (proyek Android Studio di folder `android/`)
Wrapper WebView minimal tanpa npm dan tanpa dependensi AndroidX:

1. Buka folder `android/` di **Android Studio** (Gradle + JDK 17 sudah dibundel Android Studio).
2. Edit `SERVER_URL` di `android/app/src/main/java/id/keluarga/hub/MainActivity.java`
   ke alamat LAN server, mis. `http://192.168.1.10:3000/` (URL LAN dicetak server saat start).
3. *Build → Build Bundle(s)/APK(s) → Build APK(s)* → hasil di `app/build/outputs/apk/debug/app-debug.apk`.
4. Salin APK ke ponsel dan install (izinkan sumber tidak dikenal). Aplikasi membuka Keluarga Hub
   fullscreen, tombol back mengikuti riwayat web, dan upload foto/video galeri didukung
   lewat file picker (`onShowFileChooser`).
5. Ponsel harus satu WiFi dengan server; HTTP cleartext diizinkan eksplisit di manifest
   (`android:usesCleartextTraffic="true"`).

Alternatif tanpa Android Studio: bila server sudah terekspos HTTPS publik,
**PWABuilder.com** bisa menghasilkan APK/TWA siap pasang langsung dari URL.

---

## 6. Keamanan & catatan penting

- Data tersimpan lokal: `data/keluarga.db` (SQLite WAL) dan `uploads/media/` (foto/video).
  **Cadangkan berkala** lewat *Pengaturan → Ekspor cadangan* (+ salin folder `uploads`).
- Password di-hash `scrypt` dengan salt per pengguna; token sesi acak 28 byte dengan kedaluwarsa.
- Jangan buka port server ini langsung ke internet. Untuk akses dari luar rumah gunakan
  **VPN/Tailscale**, atau reverse proxy (Caddy/nginx) dengan **HTTPS** + auth tambahan.
  Cookie sengaja tidak memakai flag `Secure` agar tetap jalan di HTTP LAN — aktifkan sendiri bila sudah HTTPS.
- Semua akses API mensyaratkan sesi login (kecuali `login`, `register`, `health`).
- Kredensial Tuya & kamera tersimpan di DB lokal; jangan bagikan file `data/`.

---

## 7. Struktur proyek

```
server/
  index.js        HTTP server, static, auth gate, rate-limit login
  router.js       mini router (pola :param, parsing body, guard admin)
  util.js         hash password, sesi, JSON, upload, static + Range (video)
  db.js           skema SQLite, seed data contoh, setting, log aktivitas
  tuya.js         klien Tuya IoT Cloud (signing HMAC-SHA256)
  cameras.js      proxy snapshot / MJPEG / HLS (rewrite playlist) untuk XMEye
  reset.js        hapus & buat ulang database contoh
  routes/         auth · family · finance · assets · planner · media · cctv · iot · system
public/
  index.html      login + shell aplikasi (+ link manifest PWA)
  manifest.webmanifest, sw.js, icons/   PWA: manifest, service worker, ikon
  css/style.css   tema gelap/terang, komponen, responsif
  js/             ui.js (helper/ikon/chart/modal) · api.js · app.js (router)
                  views-core.js (Beranda, Anggota, Keuangan)
                  views-smart.js (Aset, CCTV, Smart Home)
                  views-life.js (Galeri, Agenda, Tugas, Belanja, Papan, Pengaturan)
android/          proyek APK WebView (Android Studio, tanpa dependensi npm)
data/             keluarga.db            uploads/media/  foto & video
```

## 8. API singkat

`POST /api/auth/login|register|logout` · `GET /api/auth/me` · `GET/PUT /api/family` ·
`GET/POST/PUT/DELETE /api/members` · `GET/POST/PUT/DELETE /api/transactions` ·
`GET /api/finance/summary` · `GET/POST/DELETE /api/budgets` · `GET/POST/PUT/DELETE /api/assets` ·
`GET/POST/PUT/DELETE /api/cameras` · `POST /api/cameras/:id/test` · `GET /api/cameras/:id/live|playlist|segment|thumb` ·
`GET /api/iot` · `POST /api/iot/config|test|link|sync|custom` ·
`POST /api/iot/devices/:id/command` · `GET /api/iot/devices/:id/status` · `POST /api/iot/scenes/:id/trigger` ·
`GET/POST /api/media` · `GET /files/media/:name` · `GET/POST/PUT/DELETE /api/events|chores|shopping|announcements` ·
`GET /api/dashboard` · `GET /api/meta` · `GET/PUT /api/settings/:key` · `GET /api/export` · `POST /api/import`
