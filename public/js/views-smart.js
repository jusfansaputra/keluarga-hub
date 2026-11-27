/* View: Aset, CCTV, Smart Home (Tuya / Smart Life) */
(function () {
  const { esc, money, icon, dateShort, rel, toast, donut, modal, formModal, confirmBox, PALETTE } = UI;
  const load = (root) => { root.innerHTML = `<div class="card"><div class="skeleton" style="height:14px;width:35%"></div><div class="skeleton mt" style="height:120px"></div></div>`; };

  /* ================================== ASET ================================= */
  Views.aset = async (ctx) => {
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    st.category = st.category || 'all'; st.q = st.q || '';
    const meta = await App.metaReady;
    const url = `/api/assets?${st.category !== 'all' ? 'category=' + encodeURIComponent(st.category) + '&' : ''}${st.q ? 'q=' + encodeURIComponent(st.q) : ''}`;
    const { assets, byCategory, summary } = await API.get(url);

    const assetForm = async (a) => {
      const v = await formModal({
        title: a ? 'Ubah aset' : 'Tambah aset keluarga', wide: true,
        fields: [
          { name: 'name', label: 'Nama aset', value: a && a.name, required: true, placeholder: 'mis. Mobil Avanza 2021' },
          { name: 'category', label: 'Kategori', type: 'select', value: (a && a.category) || 'Elektronik', options: meta.categories.asset },
          { name: 'price', label: 'Harga beli (Rp)', type: 'number', min: 0, value: a && a.price, required: true },
          { name: 'currentValue', label: 'Perkiraan nilai sekarang (Rp)', type: 'number', min: 0, value: a && a.current_value },
          { name: 'purchaseDate', label: 'Tanggal pembelian', type: 'date', value: a && a.purchase_date },
          { name: 'warrantyUntil', label: 'Garansi sampai', type: 'date', value: a && a.warranty_until },
          { name: 'location', label: 'Lokasi penyimpanan', value: a && a.location, placeholder: 'mis. Garasi' },
          { name: 'ownerId', label: 'Atas nama', type: 'select', value: (a && a.owner_id) || App.user.id, options: [[null, '— bersama —']].concat(meta.members.map((m) => [m.id, `${m.name} (${m.relation})`])) },
          { name: 'condition', label: 'Kondisi', type: 'select', value: (a && a.condition) || 'Baik', options: ['Baru', 'Sangat Baik', 'Baik', 'Perlu Perawatan', 'Rusak'] },
          { name: 'status', label: 'Status', type: 'select', value: (a && a.status) || 'Aktif', options: ['Aktif', 'Disimpan', 'Dipinjam', 'Servis', 'Dijual', 'Hilang'] },
          { name: 'document', label: 'No. dokumen/surat', value: a && a.document, placeholder: 'mis. B 1234 WIJ / SHM 12345' },
          { name: 'notes', label: 'Catatan', type: 'textarea', value: a && a.notes },
        ],
      });
      if (!v) return;
      if (a) await API.put('/api/assets/' + a.id, v); else await API.post('/api/assets', v);
      toast(a ? 'Aset diperbarui' : 'Aset ditambahkan', 'ok'); App.reload();
    };

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Aset Keluarga</h3><p>Inventaris properti, kendaraan, elektronik, dan investasi</p></div>
      <div class="spacer"></div>
      <input id="a-q" placeholder="Cari aset…" value="${esc(st.q)}" style="width:180px"/>
      <button class="btn btn-primary" id="add-asset">＋ Tambah Aset</button></div>

    <div class="grid g-4 mb">
      <div class="card stat"><div class="stat-ico">${icon('box', 21)}</div><div class="stat-body"><small>Total nilai aset</small><b>${money(summary.value, true)}</b></div></div>
      <div class="card stat"><div class="stat-ico info">${icon('chart', 21)}</div><div class="stat-body"><small>Biaya perolehan</small><b>${money(summary.cost, true)}</b><span class="delta ${summary.value >= summary.cost ? '' : 'down'}">${summary.cost ? Math.round(((summary.value - summary.cost) / summary.cost) * 100) : 0}% ${summary.value >= summary.cost ? 'apresiasi' : 'penyusutan'}</span></div></div>
      <div class="card stat"><div class="stat-ico ok">${icon('check', 21)}</div><div class="stat-body"><small>Jumlah aset</small><b>${summary.count}</b></div></div>
      <div class="card stat"><div class="stat-ico warn">${icon('shield', 21)}</div><div class="stat-body"><small>Garansi masih aktif</small><b>${summary.warrantyActive}</b></div></div>
    </div>

    <div class="chips mb">${['all'].concat(meta.categories.asset).map((c) => `<button class="chip ${st.category === c ? 'active' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'Semua' : esc(c)}</button>`).join('')}</div>

    <div class="grid g-side">
      <div class="card"><div class="card-head"><h4>Daftar aset</h4><div class="spacer"></div><span class="sub">${assets.length} item</span></div>
        <div class="table-wrap"><table><thead><tr><th>Aset</th><th>Kategori</th><th>Pemilik</th><th>Lokasi</th><th>Dibeli</th><th class="num">Harga beli</th><th class="num">Nilai kini</th><th>Status</th><th></th></tr></thead>
        <tbody>${assets.map((a) => `<tr>
          <td><b>${esc(a.name)}</b>${a.document ? `<div class="muted mono" style="font-size:11px">${esc(a.document)}</div>` : ''}</td>
          <td><span class="badge">${esc(a.category)}</span></td>
          <td class="nowrap">${a.owner_name ? esc(a.owner_name) : '<span class="muted">Bersama</span>'}</td>
          <td class="muted">${esc(a.location || '-')}</td>
          <td class="nowrap muted">${a.purchase_date ? dateShort(a.purchase_date) : '-'}</td>
          <td class="num muted">${money(a.price)}</td>
          <td class="num"><b>${money(a.current_value === null ? a.price : a.current_value)}</b></td>
          <td><span class="badge ${a.status === 'Aktif' ? 'ok' : a.status === 'Rusak' || a.status === 'Hilang' ? 'bad' : 'warn'}">${esc(a.status)}</span></td>
          <td class="row-actions"><button class="btn btn-xs" data-edit="${a.id}">✎</button>
            ${(App.isAdmin || a.owner_id === App.user.id) ? `<button class="btn btn-xs btn-danger" data-del="${a.id}">🗑</button>` : ''}</td></tr>`).join('')
          || '<tr><td colspan="9"><div class="empty"><div class="e-ico">📦</div><b>Belum ada aset</b>Catat properti, kendaraan, dan barang berharga keluarga.</div></td></tr>'}</tbody></table></div></div>

      <div class="flex col" style="gap:16px">
        <div class="card"><div class="card-head"><h4>Komposisi nilai aset</h4></div>
          ${donut(byCategory.map((c, i) => ({ label: c.category, value: c.value, color: PALETTE[i % PALETTE.length] })), { centerTop: money(summary.value, true), centerBottom: 'total' })}</div>
        <div class="card"><div class="card-head"><h4>Garansi &amp; dokumen</h4></div>
          ${assets.filter((a) => a.warranty_until).map((a) => {
            const left = Math.round((new Date(a.warranty_until) - Date.now()) / 864e5);
            return `<div class="list-item"><div class="li-body"><div class="li-title">${esc(a.name)}</div>
              <div class="li-sub">sampai ${dateShort(a.warranty_until)}</div></div>
              <div class="li-right"><span class="badge ${left < 0 ? 'bad' : left < 60 ? 'warn' : 'ok'}">${left < 0 ? 'habis' : left + ' hari'}</span></div></div>`;
          }).join('') || '<div class="muted">Tidak ada aset dengan garansi tercatat.</div>'}</div>
        <div class="card"><div class="card-head"><h4>Perlu perhatian</h4></div>
          ${assets.filter((a) => a.status !== 'Aktif').map((a) => `<div class="list-item"><div class="li-body"><div class="li-title">${esc(a.name)}</div>
            <div class="li-sub">${esc(a.status)} · ${esc(a.condition)}</div></div></div>`).join('') || '<div class="muted">Semua aset dalam kondisi aktif.</div>'}</div>
      </div>
    </div>`;

    ctx.root.querySelector('#add-asset').onclick = () => assetForm(null);
    const q = ctx.root.querySelector('#a-q');
    q.oninput = () => { clearTimeout(q._t); q._t = setTimeout(() => { st.q = q.value; App.reload(); }, 450); };
    ctx.root.querySelectorAll('[data-cat]').forEach((b) => b.onclick = () => { st.category = b.dataset.cat; App.reload(); });
    ctx.root.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => assetForm(assets.find((a) => String(a.id) === b.dataset.edit)));
    ctx.root.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Hapus aset ini dari inventaris?', { danger: true, yesText: 'Hapus' })) { await API.del('/api/assets/' + b.dataset.del); toast('Aset dihapus', 'ok'); App.reload(); }
    });
  };

  /* ================================== CCTV ================================= */
  let camTimers = [];
  function clearCamTimers() { camTimers.forEach((t) => clearInterval(t)); camTimers = []; }

  function ensureHls(cb) {
    if (window.Hls) return cb(window.Hls);
    if (window.__hlsLoading) { window.__hlsQueue.push(cb); return; }
    window.__hlsLoading = true; window.__hlsQueue = [cb];
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
    s.onload = () => { window.__hlsLoading = false; window.__hlsQueue.splice(0).forEach((f) => f(window.Hls)); };
    s.onerror = () => { window.__hlsLoading = false; window.__hlsQueue.splice(0).forEach((f) => f(null)); };
    document.head.appendChild(s);
  }

  function playerHtml(c, big) {
    const live = `<span class="cam-live"><i></i>LIVE</span>`;
    if (c.kind === 'iframe' || c.kind === 'go2rtc') {
      return `<div class="cam-view" style="${big ? 'aspect-ratio:16/9' : ''}">${live}<iframe src="${esc(c.streamUrl)}" allow="autoplay; fullscreen; encrypted-media" loading="lazy"></iframe></div>`;
    }
    if (c.kind === 'hls') {
      return `<div class="cam-view" style="${big ? 'aspect-ratio:16/9' : ''}">${live}
        <video data-hls="${esc(c.url)}" data-cam="${c.id}" controls playsinline muted></video></div>`;
    }
    const src = `/api/cameras/${c.id}/live`;
    return `<div class="cam-view" style="${big ? 'aspect-ratio:16/9' : ''}">${live}
      <img data-live="${c.id}" data-refresh="${c.refresh_sec || 5}" src="${src}?ts=${Date.now()}" alt="${esc(c.name)}" loading="lazy"/></div>`;
  }

  function mountPlayers(root) {
    root.querySelectorAll('[data-live]').forEach((img) => {
      const every = Math.max(1, Number(img.dataset.refresh)) * 1000;
      const t = setInterval(() => { img.src = `/api/cameras/${img.dataset.live}/live?ts=${Date.now()}`; }, every);
      camTimers.push(t);
    });
    const vids = root.querySelectorAll('[data-hls]');
    if (vids.length) ensureHls((Hls) => {
      vids.forEach((v) => {
        const src = v.dataset.hls;
        const proxied = `/api/cameras/${v.dataset.cam}/live`;
        if (Hls && Hls.isSupported()) {
          const h = new Hls({ lowLatencyMode: true, maxBufferLength: 8 });
          h.loadSource(proxied); h.attachMedia(v);
          h.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) { h.destroy(); tryLoadNative(v, src); } });
          v.play().catch(() => {});
        } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
          v.src = proxied; v.play().catch(() => {});
        } else {
          tryLoadNative(v, src);
        }
      });
    });
  }
  function tryLoadNative(v, src) {
    v.controls = true; v.src = src; v.play().catch(() => {});
    v.addEventListener('error', () => {
      const wrap = v.closest('.cam-view');
      if (wrap && !wrap.querySelector('.cam-fallback')) {
        const d = document.createElement('div');
        d.className = 'cam-fallback note warn';
        d.style.cssText = 'position:absolute;left:10px;right:10px;bottom:10px;font-size:12px;z-index:3';
        d.innerHTML = `Browser ini tidak memutar HLS langsung. <a href="${esc(src)}" target="_blank" rel="noopener">Buka stream di tab baru</a>, atau pakai go2rtc (mode <code>go2rtc</code>).`;
        wrap.appendChild(d);
      }
    }, { once: true });
  }

  Views.cctv = async (ctx) => {
    clearCamTimers();
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    st.big = st.big || false; st.focus = st.focus || null;
    const { cameras, xmeye } = await API.get('/api/cameras');
    const list = st.focus ? cameras.filter((c) => String(c.id) === String(st.focus)) : cameras;

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>CCTV Rumah</h3><p>Pantauan langsung dari kamera XMEye / DVR / IP camera keluarga</p></div>
      <div class="spacer"></div>
      ${st.focus ? `<button class="btn" id="back-grid">← Kembali ke grid</button>` : ''}
      <button class="btn" id="reload-cams">${icon('refresh', 16)} Muat ulang</button>
      ${App.isAdmin ? '<button class="btn btn-primary" id="add-cam">＋ Tambah Kamera</button>' : ''}</div>

    ${cameras.length ? '' : '<div class="note warn mb">Belum ada kamera. Tambahkan kamera XMEye/IP camera lewat tombol di atas.</div>'}

    <div class="note mb" style="font-size:12.8px">
      <b>Cara menampilkan kamera XMEye di web:</b> DVR/NVR XMEye tidak menyediakan API publik, jadi ada 3 jalur yang didukung aplikasi ini —
      <b>(1)</b> mode <code>snapshot</code>/<code>mjpeg</code> bila kamera membuka URL HTTP (mis. <span class="mono">http://IP/snapshot.cgi</span>),
      <b>(2)</b> mode <code>hls</code> bila Anda menjalankan <b>go2rtc</b> untuk menjembatani RTSP XMEye → HLS/WebRTC
      (<span class="mono">docker run -p 1984:1984 -p 8555:8555 alexxit/go2rtc</span>, lalu source <span class="mono">${esc(xmeye.rtspTemplate || 'rtsp://user:pass@IP:554/...')}</span>),
      <b>(3)</b> mode <code>iframe</code>/<code>go2rtc</code> untuk menempelkan halaman stream (mis. <span class="mono">${esc(xmeye.go2rtcUrl || 'http://IP:1984')}/stream.html?src=nama-kamera</span>).
      Semua stream di-proxy oleh server keluarga sehingga tidak terbentur CORS.
    </div>

    <div class="cam-grid ${st.focus || st.big ? 'single' : ''}" id="cam-grid">
      ${list.map((c) => `<div class="cam-tile" data-tile="${c.id}">
        ${playerHtml(c, !!st.focus)}
        <div class="cam-meta">
          <div class="cm-body"><b>${esc(c.name)}</b><small>${esc(c.location || '-')} · mode ${esc(c.kind)}${c.kind === 'snapshot' ? ` · refresh ${c.refresh_sec}s` : ''}</small></div>
          <button class="btn btn-xs" data-open="${c.id}" title="Perbesar">${icon('eye', 14)}</button>
          <button class="btn btn-xs" data-test="${c.id}" title="Tes koneksi">Tes</button>
          ${App.isAdmin ? `<button class="btn btn-xs" data-editcam="${c.id}">✎</button>
          <button class="btn btn-xs btn-danger" data-delcam="${c.id}">🗑</button>` : ''}
        </div>
        ${c.notes ? `<div class="cam-note">${esc(c.notes)}</div>` : ''}
      </div>`).join('')}</div>`;

    mountPlayers(ctx.root);

    const rb = ctx.root.querySelector('#reload-cams'); if (rb) rb.onclick = () => App.reload();
    const bg = ctx.root.querySelector('#back-grid'); if (bg) bg.onclick = () => { st.focus = null; App.reload(); };
    ctx.root.querySelectorAll('[data-open]').forEach((b) => b.onclick = () => { st.focus = b.dataset.open; App.reload(); });

    const camForm = async (c) => {
      const v = await formModal({
        title: c ? 'Ubah kamera' : 'Tambah kamera', wide: true,
        fields: [
          { name: 'name', label: 'Nama kamera', value: c && c.name, required: true, placeholder: 'mis. Ruang Keluarga' },
          { name: 'location', label: 'Lokasi', value: c && c.location, placeholder: 'mis. Indoor — sudut TV' },
          { name: 'kind', label: 'Mode tampilan', type: 'select', value: (c && c.kind) || 'hls', options: [
            ['hls', 'HLS (.m3u8) — lewat proxy server'],
            ['mjpeg', 'MJPEG (http://IP/videostream) — lewat proxy'],
            ['snapshot', 'Snapshot JPEG berkala (XMEye/IP cam HTTP)'],
            ['iframe', 'Iframe / halaman web stream (XMEye share, NVR web)'],
            ['go2rtc', 'go2rtc (RTSP → browser, disarankan untuk XMEye)'],
          ] },
          { name: 'url', label: 'URL stream / snapshot / sumber go2rtc', value: c && c.url, required: true,
            placeholder: 'http://192.168.1.20/snapshot.cgi  ·  http://IP:1984/stream.html?src=cam1  ·  https://…/index.m3u8' },
          { name: 'username', label: 'Username kamera (opsional)', value: c && c.username },
          { name: 'password', label: 'Password kamera (opsional)', value: c && c.password, type: 'password' },
          { name: 'refreshSec', label: 'Refresh snapshot (detik)', type: 'number', min: 1, value: (c && c.refresh_sec) || 5 },
          { name: 'enabled', label: 'Aktifkan kamera', type: 'checkbox', value: c ? !!c.enabled : true },
          { name: 'notes', label: 'Catatan untuk keluarga', type: 'textarea', value: c && c.notes },
        ],
      });
      if (!v) return;
      if (c) await API.put('/api/cameras/' + c.id, v); else await API.post('/api/cameras', v);
      toast(c ? 'Kamera diperbarui' : 'Kamera ditambahkan', 'ok'); App.reload();
    };
    const ac = ctx.root.querySelector('#add-cam'); if (ac) ac.onclick = () => camForm(null);
    ctx.root.querySelectorAll('[data-editcam]').forEach((b) => b.onclick = () => camForm(cameras.find((c) => String(c.id) === b.dataset.editcam)));
    ctx.root.querySelectorAll('[data-delcam]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Hapus kamera ini?', { danger: true, yesText: 'Hapus' })) { await API.del('/api/cameras/' + b.dataset.delcam); toast('Kamera dihapus', 'ok'); App.reload(); }
    });
    ctx.root.querySelectorAll('[data-test]').forEach((b) => b.onclick = async () => {
      b.disabled = true; b.textContent = '…';
      const r = await API.post('/api/cameras/' + b.dataset.test + '/test');
      b.disabled = false; b.textContent = 'Tes';
      modal({ title: 'Hasil tes koneksi kamera', body: `<div class="note ${r.ok ? 'ok' : 'bad'}">
          <b>${r.ok ? 'Kamera merespons' : 'Gagal terhubung'}</b>
          <dl class="kv mt"><dt>Status HTTP</dt><dd>${r.status || '-'}</dd>
          <dt>Tipe konten</dt><dd>${esc(r.contentType || '-')}</dd>
          <dt>Waktu respons</dt><dd>${r.ms} ms</dd>
          <dt>URL diuji</dt><dd class="mono" style="word-break:break-all">${esc(r.url || '')}</dd>
          ${r.error ? `<dt>Pesan</dt><dd>${esc(r.error)}</dd>` : ''}
          ${r.hint ? `<dt>Saran</dt><dd>${esc(r.hint)}</dd>` : ''}</dl></div>`,
        footer: '<button class="btn" data-close>Tutup</button>' });
    });
  };

  /* =============================== SMART HOME ============================== */
  const CAT_ICON = { dj: 'lamp', dd: '💡', kt: 'ac', fs: 'fan', mcs: 'sensor', wsdcg: 'sensor', cz: 'socket', cl: 'curtain', zd: 'pump', kg: 'lock', sp: '📷', ywzs: '🚨', rs: '🌧️', cx: '🌀' };
  const READONLY = new Set(['temperature', 'humidity', 'battery_percentage', 'battery', 'temp_current', 'cur_power', 'cur_current',
    'cur_voltage', 'doorcontact_state', 'water_level', 'illuminance', 'pm25', 'pm10', 'co2', 'ch2o', 'bright_value_v2']);
  const CODE_LABEL = { switch: 'Daya', switch_1: 'Daya ch.1', switch_2: 'Daya ch.2', switch_led: 'Lampu', switch_socket: 'Stop kontak',
    bright_value: 'Kecerahan', bright_value_1: 'Kecerahan', temp_value: 'Suhu warna', temp_set: 'Suhu diatur', temperature: 'Suhu',
    temp_current: 'Suhu ruang', humidity: 'Kelembapan', battery_percentage: 'Baterai', battery: 'Baterai', position: 'Posisi',
    control: 'Kendali', mode: 'Mode', fan_speed_enum: 'Kecepatan kipas', work_state: 'Status', cur_power: 'Daya listrik',
    cur_current: 'Arus', doorcontact_state: 'Kontak pintu', countdown_1: 'Timer', water_level: 'Level air', pm25: 'PM2.5' };

  function labelOf(code) { return CODE_LABEL[code] || code.replace(/_/g, ' '); }
  function unitOf(code, v) {
    if (/temperature|temp_set|temp_current|temp_value/.test(code)) return '°C';
    if (/humidity|battery|position|bright/.test(code)) return '%';
    if (/cur_power/.test(code)) return 'W';
    if (/cur_current/.test(code)) return 'mA';
    return '';
  }
  function isSwitch(code) { return /^switch(_\w+)?$/.test(code); }
  function deviceOn(dev) { return (dev.status || []).some((s) => isSwitch(s.code) && (s.value === true || s.value === 'on')); }

  function deviceHtml(dev, rooms) {
    const st = dev.status || [];
    const on = deviceOn(dev);
    const switches = st.filter((s) => isSwitch(s.code));
    const sliders = st.filter((s) => !READONLY.has(s.code) && !isSwitch(s.code) && typeof s.value === 'number' && ['bright_value', 'bright_value_1', 'temp_set', 'position', 'temp_value'].includes(s.code));
    const reads = st.filter((s) => READONLY.has(s.code) || (!isSwitch(s.code) && !sliders.includes(s.code)));
    const enums = st.filter((s) => !READONLY.has(s.code) && typeof s.value === 'string' && !isSwitch(s.code) && s.code !== 'control');
    const ctrl = st.find((s) => s.code === 'control');
    const ico = CAT_ICON[dev.category] || 'plug';

    return `<div class="dev-card ${on ? 'on' : 'off'} ${dev.online === false ? 'off' : ''}" data-dev="${esc(dev.id)}">
      <div class="dev-top">
        <div class="dev-ico">${typeof ico === 'string' && ico.length > 3 ? icon(ico, 20) : `<span>${ico}</span>`}</div>
        <div class="flex1"><div class="dev-name">${esc(dev.name)}</div>
          <div class="dev-sub">${esc(dev.room || dev.product_name || dev.category || 'perangkat')} ·
            <span class="badge ${dev.online === false ? 'bad' : on ? 'ok' : ''}">${dev.online === false ? 'offline' : on ? 'menyala' : 'siaga'}</span></div></div>
        ${switches.length ? `<label class="toggle"><input type="checkbox" data-switch="${esc(switches[0].code)}" ${on ? 'checked' : ''} ${dev.online === false ? 'disabled' : ''}/></label>` : ''}
      </div>
      <div class="dev-ctrl">
        ${switches.slice(1).map((s) => `<div class="ctrl-row"><label>${esc(labelOf(s.code))}</label>
          <span class="toggle"><input type="checkbox" data-switch="${esc(s.code)}" ${s.value === true ? 'checked' : ''} ${dev.online === false ? 'disabled' : ''}/></span></div>`).join('')}
        ${sliders.map((s) => {
          const max = /bright|temp_value/.test(s.code) ? 1000 : s.code === 'position' ? 100 : 32;
          const min = s.code === 'temp_set' ? 16 : 0;
          const pct = Math.round(((s.value - min) / (max - min)) * 100);
          return `<div class="ctrl-row"><label>${esc(labelOf(s.code))}</label>
            <input type="range" min="${min}" max="${max}" step="${max === 1000 ? 10 : 1}" value="${s.value}" data-slider="${esc(s.code)}" ${dev.online === false ? 'disabled' : ''}/>
            <b class="nowrap" style="font-size:12px;min-width:46px;text-align:right">${pct}${unitOf(s.code) === '%' || max !== 1000 ? (max === 1000 ? '%' : unitOf(s.code, s.value)) : ''}</b></div>`;
        }).join('')}
        ${ctrl ? `<div class="ctrl-row"><label>Kendali</label>${['open', 'stop', 'close'].map((v) => `<button class="btn btn-xs" data-cmd="${v}" data-code="control" ${dev.online === false ? 'disabled' : ''}>${v === 'open' ? 'Buka' : v === 'stop' ? 'Stop' : 'Tutup'}</button>`).join('')}</div>` : ''}
        ${enums.map((s) => `<div class="ctrl-row"><label>${esc(labelOf(s.code))}</label><span class="badge acc">${esc(String(s.value))}</span></div>`).join('')}
      </div>
      ${reads.length ? `<div class="dev-read">${reads.map((s) => `<div><small class="muted" style="display:block;font-size:11px">${esc(labelOf(s.code))}</small>
        <b>${typeof s.value === 'boolean' ? (s.value ? 'Terbuka' : 'Tertutup') : esc(String(s.value))}${unitOf(s.code, s.value)}</b></div>`).join('')}</div>` : ''}
      ${dev.demo ? '<div class="muted" style="font-size:11px">Mode demo — sambungkan akun Smart Life untuk perangkat asli</div>' : ''}
    </div>`;
  }

  function wireDevices(root) {
    root.querySelectorAll('[data-dev]').forEach((card) => {
      const id = card.dataset.dev;
      const send = async (commands) => {
        try {
          await API.post(`/api/iot/devices/${encodeURIComponent(id)}/command`, { commands });
          UI.toast('Perintah terkirim ke ' + id.slice(0, 18), 'ok', 1800);
          App.reload();
        } catch (e) { UI.toast(e.message, 'bad'); }
      };
      card.querySelectorAll('[data-switch]').forEach((inp) => inp.onchange = () => send([{ code: inp.dataset.switch, value: inp.checked }]));
      card.querySelectorAll('[data-slider]').forEach((inp) => {
        let t;
        const show = inp.parentElement.querySelector('b');
        inp.oninput = () => { if (show) show.textContent = inp.value + (inp.max === '1000' ? '%' : unitOf(inp.dataset.slider, Number(inp.value))); };
        inp.onchange = () => { clearTimeout(t); t = setTimeout(() => send([{ code: inp.dataset.slider, value: Number(inp.value) }]), 300); };
      });
      card.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => send([{ code: b.dataset.code, value: b.dataset.cmd }]));
    });
  }

  Views.smarthome = async (ctx) => {
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    st.room = st.room || 'all';
    const data = await API.get('/api/iot' + (ctx.query && ctx.query.refresh ? '?refresh=1' : ''));
    const devices = data.devices || [];
    const shown = st.room === 'all' ? devices : devices.filter((d) => (d.room || 'Lainnya') === st.room);
    const rooms = Array.from(new Set(devices.map((d) => d.room || 'Lainnya')));
    const online = devices.filter((d) => d.online !== false).length;

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Smart Home</h3>
      <p>Perangkat Tuya / Smart Life ${data.demo ? '· <b style="color:var(--warn)">mode demo aktif</b>' : '· terhubung ke cloud Tuya'}</p></div>
      <div class="spacer"></div>
      ${App.isAdmin ? '<button class="btn" id="iot-config">⚙ Konfigurasi Tuya</button>' : ''}
      ${App.isAdmin ? '<button class="btn" id="iot-link">🔗 Tautkan Akun Smart Life</button>' : ''}
      <button class="btn" id="iot-sync">${icon('refresh', 16)} Sinkron</button></div>

    ${data.error ? `<div class="note bad mb"><b>Kesalahan koneksi Tuya:</b> ${esc(data.error)}<br>Menampilkan data cache/demo. Periksa Access ID/Secret, region endpoint, dan koneksi internet di menu Konfigurasi.</div>` : ''}
    ${data.demo ? `<div class="note warn mb"><b>Belum terhubung ke akun Smart Life Anda.</b>
      Data di bawah adalah simulasi 10 perangkat rumah agar tampilan bisa dicoba. Untuk perangkat asli: buat Cloud Project di
      <span class="mono">platform.tuya.com</span> (Smart Home, region sesuai), aktifkan <b>IoT Core</b>, salin <b>Access ID/Secret</b> ke
      ${App.isAdmin ? 'tombol <b>Konfigurasi Tuya</b>' : 'menu Pengaturan (admin)'}, lalu tautkan akun aplikasi Smart Life Anda.</div>` : ''}

    <div class="grid g-4 mb">
      <div class="card stat"><div class="stat-ico">${icon('plug', 21)}</div><div class="stat-body"><small>Total perangkat</small><b>${devices.length}</b></div></div>
      <div class="card stat"><div class="stat-ico ok">${icon('activity', 21)}</div><div class="stat-body"><small>Online</small><b>${online}</b></div></div>
      <div class="card stat"><div class="stat-ico warn">${icon('lamp', 21)}</div><div class="stat-body"><small>Sedang menyala</small><b>${devices.filter(deviceOn).length}</b></div></div>
      <div class="card stat"><div class="stat-ico info">${icon('cloud', 21)}</div><div class="stat-body"><small>Sinkron terakhir</small><b>${data.syncedAt ? rel(new Date(data.syncedAt).toISOString()) : 'demo'}</b></div></div>
    </div>

    ${(data.scenes || []).length ? `<div class="card mb"><div class="card-head"><h4>Skenario (scene)</h4><div class="spacer"></div><span class="sub">sekali klik untuk banyak perangkat</span></div>
      <div class="grid g-3">${data.scenes.map((s) => `<div class="scene-card" data-scene="${esc(s.id)}">
        <div class="dev-ico">${icon('spark' in UI.ICON ? 'spark' : 'play', 18)}</div>
        <div class="flex1"><b>${esc(s.name)}</b><small>${esc(s.desc || s.scene_name || 'Jalankan skenario')}</small></div>
        <button class="btn btn-xs btn-primary">Jalankan</button></div>`).join('')}</div></div>` : ''}

    <div class="chips mb">${['all'].concat(rooms).map((r) => `<button class="chip ${st.room === r ? 'active' : ''}" data-room="${esc(r)}">${r === 'all' ? 'Semua ruang' : esc(r)}</button>`).join('')}</div>

    <div class="dev-grid">${shown.map((d) => deviceHtml(d)).join('') || '<div class="empty"><div class="e-ico">🔌</div><b>Tidak ada perangkat di ruang ini</b></div>'}</div>`;

    wireDevices(ctx.root);
    ctx.root.querySelectorAll('[data-room]').forEach((b) => b.onclick = () => { st.room = b.dataset.room; App.reload(); });
    ctx.root.querySelectorAll('[data-scene]').forEach((b) => b.onclick = async () => {
      try { await API.post('/api/iot/scenes/' + encodeURIComponent(b.dataset.scene) + '/trigger'); toast('Skenario dijalankan', 'ok'); App.reload(); }
      catch (e) { toast(e.message, 'bad'); }
    });
    const sync = ctx.root.querySelector('#iot-sync');
    if (sync) sync.onclick = async () => {
      sync.disabled = true; sync.textContent = 'Menyinkronkan…';
      try {
        const r = await API.post('/api/iot/sync');
        toast(r.error ? 'Sinkron gagal: ' + r.error : (r.demo ? 'Mode demo dimuat ulang' : `${(r.devices || []).length} perangkat disinkronkan dari Tuya`), r.error ? 'bad' : 'ok');
      } catch (e) { toast(e.message, 'bad'); }
      App.reload();
    };

    const cfgBtn = ctx.root.querySelector('#iot-config');
    if (cfgBtn) cfgBtn.onclick = async () => {
      const s = await API.get('/api/settings');
      const t = s.tuya || {};
      const v = await formModal({
        title: 'Konfigurasi Tuya IoT Cloud', wide: true,
        fields: [
          { type: 'static', html: `Isi dari <b>platform.tuya.com → Cloud → Development</b>: buat proyek <i>Smart Home</i>, pilih <b>Data Center</b> sesuai region akun Smart Life Anda, lalu aktifkan API <b>IoT Core</b> &amp; <b>Smart Home Scene Linkage</b>.` },
          { name: 'endpoint', label: 'Endpoint API (region)', value: t.endpoint || 'https://openapi.tuyaus.com', required: true },
          { name: 'accessId', label: 'Access ID / Client ID', value: t.accessId || '' },
          { name: 'accessSecret', label: 'Access Secret', value: '', type: 'password', placeholder: t.accessSecret ? '(tersimpan — kosongkan untuk tidak mengubah)' : '' },
          { name: 'uid', label: 'UID akun Smart Life (hasil tautan)', value: t.uid || '' },
          { name: 'countryCode', label: 'Kode negara', value: t.countryCode || '62' },
          { name: 'homeId', label: 'Home ID (opsional, untuk scene)', value: t.homeId || '' },
          { name: 'devicesRefresh', label: 'Interval sinkron (menit)', type: 'number', min: 1, value: t.devicesRefresh || 30 },
          { name: 'enabled', label: 'Gunakan koneksi Tuya asli', type: 'checkbox', value: !!t.enabled },
          { name: 'demoMode', label: 'Tampilkan perangkat demo bila belum terhubung', type: 'checkbox', value: t.demoMode !== false },
        ],
      });
      if (!v) return;
      await API.put('/api/settings/tuya', v);
      const test = await API.post('/api/iot/test');
      toast(test.ok ? 'Konfigurasi disimpan — token Tuya berhasil dibuat ✔' : 'Tersimpan, tapi tes token gagal: ' + test.error, test.ok ? 'ok' : 'warn', 7000);
      App.reload();
    };

    const linkBtn = ctx.root.querySelector('#iot-link');
    if (linkBtn) linkBtn.onclick = async () => {
      const v = await formModal({
        title: 'Tautkan akun aplikasi Smart Life',
        fields: [
          { type: 'static', html: 'Masukkan email/nomor ponsel yang Anda pakai login di aplikasi <b>Smart Life</b> atau <b>Tuya Smart</b>. Perangkat dari akun itu akan muncul di halaman ini.' },
          { name: 'username', label: 'Akun Smart Life (email/nomor)', required: true, placeholder: 'nama@mail.com atau 628123456789' },
          { name: 'countryCode', label: 'Kode negara', value: '62' },
          { name: 'appSchema', label: 'Aplikasi', type: 'select', value: 'smartlife', options: [['smartlife', 'Smart Life'], ['tuyasmart', 'Tuya Smart']] },
        ],
      });
      if (!v) return;
      const r = await API.post('/api/iot/link', v);
      modal({ title: 'Hasil penautan akun', body: `<pre class="json">${esc(JSON.stringify(r, null, 2))}</pre>`, footer: '<button class="btn" data-close>Tutup</button>' });
      if (r.ok) { toast('Akun ditautkan. Klik Sinkron untuk memuat perangkat.', 'ok'); App.reload(); }
    };
  };
})();
