/* Aplikasi utama: auth gate, navigasi, tema, dan router view */
(function () {
  const { esc, icon, toast, modal, confirmBox, avatar } = UI;

  const NAV = [
    { group: 'Ringkasan', items: [
      { id: 'dashboard', label: 'Beranda', ico: 'home', sub: 'Ringkasan hari ini' },
    ] },
    { group: 'Keluarga', items: [
      { id: 'keluarga', label: 'Anggota', ico: 'users', sub: 'Profil keluarga & hak akses' },
      { id: 'agenda', label: 'Agenda', ico: 'calendar', sub: 'Kalender kegiatan keluarga' },
      { id: 'tugas', label: 'Tugas Rumah', ico: 'task', sub: 'Piket & tanggung jawab' },
      { id: 'belanja', label: 'Belanja', ico: 'cart', sub: 'Daftar belanja bersama' },
      { id: 'papan', label: 'Papan Info', ico: 'mega', sub: 'Pengumuman & riwayat aktivitas' },
    ] },
    { group: 'Keuangan & Aset', items: [
      { id: 'keuangan', label: 'Keuangan', ico: 'wallet', sub: 'Pemasukan, pengeluaran, anggaran' },
      { id: 'aset', label: 'Aset', ico: 'box', sub: 'Inventaris harta keluarga' },
    ] },
    { group: 'Rumah', items: [
      { id: 'cctv', label: 'CCTV', ico: 'cctv', sub: 'Pantauan kamera rumah' },
      { id: 'smarthome', label: 'Smart Home', ico: 'plug', sub: 'Perangkat Tuya / Smart Life' },
      { id: 'galeri', label: 'Galeri', ico: 'image', sub: 'Foto & video kenangan' },
    ] },
    { group: 'Sistem', items: [
      { id: 'pengaturan', label: 'Pengaturan', ico: 'gear', sub: 'Akun, integrasi, cadangan data' },
    ] },
  ];
  const BOTTOM = ['dashboard', 'keuangan', 'cctv', 'smarthome', 'galeri'];
  const FLAT = NAV.flatMap((g) => g.items);

  const A = window.App = window.App || {};
  Object.assign(A, {
    state: { view: 'dashboard', per: {}, booting: true },
    user: null, family: null, meta: null, isAdmin: false,
    metaReady: Promise.resolve({ members: [], categories: { income: [], expense: [], asset: [], method: [], cameraKind: [] }, rooms: [], albums: [], family: {} }),
  });

  /* --------------------------------- tema --------------------------------- */
  A.setTheme = (t) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem('fh_theme', t);
    UI.$$('#side-nav [data-theme]').forEach(() => {});
  };
  (function initTheme() {
    const saved = localStorage.getItem('fh_theme');
    if (saved) document.documentElement.dataset.theme = saved;
  })();

  /* -------------------------------- navigasi ------------------------------ */
  function renderNav() {
    const cur = A.state.view;
    UI.$('#side-nav').innerHTML = NAV.map((g) => `
      <div class="nav-group">${esc(g.group)}</div>
      ${g.items.map((it) => `<div class="nav-item ${cur === it.id ? 'active' : ''}" data-nav="${it.id}" title="${esc(it.label)}">
        ${icon(it.ico, 19)}<span>${esc(it.label)}</span></div>`).join('')}`).join('');
    UI.$$('#side-nav [data-nav]').forEach((el) => el.onclick = () => { A.go(el.dataset.nav); closeSidebar(); });
    UI.$('#bottom-nav').innerHTML = BOTTOM.map((id) => {
      const it = FLAT.find((x) => x.id === id);
      return `<div class="nav-item ${cur === id ? 'active' : ''}" data-nav="${id}">${icon(it.ico, 19)}<span>${esc(it.label)}</span></div>`;
    }).join('');
    UI.$$('#bottom-nav [data-nav]').forEach((el) => el.onclick = () => A.go(el.dataset.nav));
  }

  function closeSidebar() { UI.$('#sidebar').classList.remove('open'); UI.$('#scrim').classList.add('hidden'); }
  UI.$('#btn-menu').onclick = () => { UI.$('#sidebar').classList.add('open'); UI.$('#scrim').classList.remove('hidden'); };
  UI.$('#scrim').onclick = closeSidebar;
  UI.$('#btn-theme').onclick = () => A.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  UI.$('#btn-logout').onclick = async () => {
    if (!await confirmBox('Keluar dari portal keluarga?', { yesText: 'Keluar' })) return;
    try { await API.post('/api/auth/logout'); } catch (e) { /* abaikan */ }
    API.setToken(''); A.user = null; showAuth();
  };

  A.go = (view, opts) => {
    if (!FLAT.some((f) => f.id === view)) view = 'dashboard';
    A.state.view = view;
    if (opts && opts.state) A.state.per[view] = Object.assign(A.state.per[view] || {}, opts.state);
    location.hash = view;
    render();
  };
  A.reload = () => render();

  async function render() {
    const view = A.state.view;
    const item = FLAT.find((f) => f.id === view) || FLAT[0];
    UI.$('#page-title').textContent = item.label;
    UI.$('#page-sub').textContent = item.sub;
    renderNav();
    const root = UI.$('#view');
    root.scrollTop = 0; window.scrollTo({ top: 0, behavior: 'smooth' });
    const fn = Views[view];
    if (!fn) { root.innerHTML = '<div class="note bad">Halaman belum tersedia.</div>'; return; }
    const ctx = { root, state: A.state.per[view] || (A.state.per[view] = {}) };
    try { await fn(ctx); }
    catch (e) {
      console.error(e);
      root.innerHTML = `<div class="note bad"><b>Gagal memuat halaman.</b><br>${esc(e.message || e)}</div>`;
    }
  }

  /* ------------------------------- boot data ------------------------------ */
  A.bootFamily = async () => {
    const me = await API.get('/api/auth/me');
    A.user = me.user; A.family = me.family; A.isAdmin = me.user.role === 'admin';
    UI.$('#side-family-name').textContent = me.family.name;
    UI.$('#notif-count').textContent = me.unread || 0;
    UI.$('#notif-count').style.display = me.unread ? 'grid' : 'none';
    UI.$('#btn-user').innerHTML = `${avatar(me.user.name, me.user.color, 'sm')}<span>${esc(me.user.name.split(' ')[0])}</span>`;
    A.metaReady = API.get('/api/meta').then((m) => { A.meta = m; if (m.ui) { /* noop */ } return m; });
    await A.metaReady;
    UI.$('#side-status').innerHTML = `<span><i class="dot"></i>Server keluarga aktif</span>
      <span>${me.family.city ? esc(me.family.city) : ''} · ${A.isAdmin ? 'Admin' : 'Anggota'}</span>`;
    return me;
  };

  A.onUnauthorized = () => { API.setToken(''); showAuth(); };

  /* ------------------------------- quick add ------------------------------ */
  UI.$('#btn-quick').onclick = () => {
    modal({
      title: 'Catat cepat untuk keluarga',
      body: `<div class="grid g-2">
        ${[['wallet', 'Transaksi', 'Catat pemasukan / pengeluaran', 'tx'],
           ['task', 'Tugas rumah', 'Buat piket atau tanggung jawab', 'chore'],
           ['cart', 'Barang belanja', 'Tambah ke daftar belanja', 'shop'],
           ['calendar', 'Agenda', 'Jadwalkan kegiatan keluarga', 'ev'],
           ['mega', 'Pengumuman', 'Sebar info ke semua anggota', 'ann'],
           ['image', 'Foto / video', 'Unggah ke galeri keluarga', 'gal']]
          .map((b) => `<button class="scene-card" data-q="${b[3]}">
            <div class="dev-ico">${icon(b[0], 18)}</div>
            <div class="flex1"><b>${esc(b[1])}</b><small>${esc(b[2])}</small></div></button>`).join('')}
      </div>`,
      onMount(root) {
        root.querySelectorAll('[data-q]').forEach((b) => b.onclick = async () => {
          UI.closeModal();
          const k = b.dataset.q;
          if (k === 'tx') return Views.txForm();
          if (k === 'chore') return Views.newChore();
          if (k === 'shop') return Views.newShopping();
          if (k === 'ev') return Views.newEvent();
          if (k === 'ann') return Views.newAnnouncement();
          if (k === 'gal') return Views.uploadMedia();
        });
      },
    });
  };

  UI.$('#btn-user').onclick = () => {
    modal({
      title: A.user ? A.user.name : 'Akun',
      subtitle: A.user ? '@' + A.user.username : '',
      body: `<div class="flex" style="gap:14px">${avatar(A.user.name, A.user.color, 'lg')}
        <div class="flex1"><dl class="kv">
          <dt>Status</dt><dd>${esc(A.user.relation)} · ${A.isAdmin ? 'Admin' : 'Anggota'}</dd>
          <dt>Keluarga</dt><dd>${esc(A.family.name)}</dd>
          ${A.user.phone ? `<dt>Telepon</dt><dd>${esc(A.user.phone)}</dd>` : ''}
          ${A.user.email ? `<dt>Email</dt><dd>${esc(A.user.email)}</dd>` : ''}
        </dl></div></div>`,
      footer: `<button class="btn" data-close>Tutup</button>
        <button class="btn" id="m-set">⚙ Pengaturan</button>
        <button class="btn btn-danger" id="m-out">Keluar</button>`,
      onMount(root) {
        root.querySelector('#m-set').onclick = () => { UI.closeModal(); A.go('pengaturan'); };
        root.querySelector('#m-out').onclick = () => { UI.closeModal(); UI.$('#btn-logout').click(); };
      },
    });
  };

  UI.$('#btn-notif').onclick = async () => {
    const { notifications } = await API.get('/api/notifications');
    modal({
      title: 'Notifikasi keluarga',
      body: notifications.length ? `<div class="list">${notifications.map((n) => `<div class="list-item">
          <div class="stat-ico ${n.kind === 'warn' ? 'warn' : 'info'}">${icon('bell', 16)}</div>
          <div class="li-body"><div class="li-title">${esc(n.title)}</div><div class="li-sub">${esc(n.body || '')} · ${rel(n.created_at)}</div></div>
          ${n.read ? '' : '<span class="badge acc">baru</span>'}</div>`).join('')}</div>`
        : '<div class="empty"><div class="e-ico">🔔</div><b>Tidak ada notifikasi</b></div>',
      footer: `<button class="btn" data-close>Tutup</button><button class="btn btn-primary" id="mark-read">Tandai semua dibaca</button>`,
      onMount(root) {
        root.querySelector('#mark-read').onclick = async () => { await API.post('/api/notifications/read-all'); UI.closeModal(); A.bootFamily(); };
      },
    });
  };

  UI.$('#global-search').onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    const q = e.target.value.trim();
    if (!q) return;
    A.go('keuangan', { state: { q } });
    toast('Mencari “' + q + '” di transaksi', 'ok');
  };

  /* --------------------------------- auth --------------------------------- */
  function showAuth() {
    UI.$('#app').classList.add('hidden');
    UI.$('#auth-screen').classList.remove('hidden');
  }
  function showApp() {
    UI.$('#auth-screen').classList.add('hidden');
    UI.$('#app').classList.remove('hidden');
  }

  UI.$$('.auth-tab').forEach((t) => t.onclick = () => {
    UI.$$('.auth-tab').forEach((x) => x.classList.toggle('active', x === t));
    UI.$('#login-form').classList.toggle('hidden', t.dataset.authtab !== 'login');
    UI.$('#register-form').classList.toggle('hidden', t.dataset.authtab !== 'register');
  });
  UI.$$('.pw-toggle').forEach((b) => b.onclick = () => {
    const inp = b.parentElement.querySelector('input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  UI.$('#login-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = UI.$('#login-error'); err.classList.add('hidden');
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Memeriksa…';
    try {
      const r = await API.post('/api/auth/login', { username: fd.get('username'), password: fd.get('password') });
      API.setToken(r.token);
      await A.bootFamily();
      showApp();
      const start = (A.meta && A.meta.family && A.meta.family.landing) || 'dashboard';
      A.go(location.hash.replace('#', '') || start);
      toast('Selamat datang, ' + r.user.name.split(' ')[0] + '!', 'ok');
    } catch (ex) {
      err.textContent = ex.message; err.classList.remove('hidden');
    } finally { btn.disabled = false; btn.textContent = 'Masuk ke Portal Keluarga'; }
  };

  UI.$('#register-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = UI.$('#register-error'); err.classList.add('hidden');
    const fd = new FormData(e.target);
    try {
      const r = await API.post('/api/auth/register', {
        code: fd.get('code'), name: fd.get('name'), username: fd.get('username'),
        password: fd.get('password'), relation: fd.get('relation'),
      }, { allow401: true });
      API.setToken(r.token);
      await A.bootFamily();
      showApp(); A.go('dashboard');
      toast('Akun dibuat. Selamat datang di keluarga!', 'ok');
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
  };

  /* --------------------------------- start -------------------------------- */
  window.addEventListener('hashchange', () => {
    const v = location.hash.replace('#', '');
    if (v && v !== A.state.view && FLAT.some((f) => f.id === v)) { A.state.view = v; render(); }
  });

  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  (async function boot() {
    try {
      const health = await fetch('/api/health').then((r) => r.json()).catch(() => null);
      if (!health || !health.ok) throw new Error('Server tidak merespons');
    } catch (e) { /* biarkan, percobaan login akan menampilkan error */ }

    try {
      const me = await API.get('/api/auth/me', { allow401: true });
      A.user = me.user; A.family = me.family; A.isAdmin = me.user.role === 'admin';
      await A.bootFamily();
      showApp();
      const v = location.hash.replace('#', '') || 'dashboard';
      A.state.view = FLAT.some((f) => f.id === v) ? v : 'dashboard';
      render();
      if ((me.user.username === 'budi' || me.user.username === 'sari') && !localStorage.getItem('fh_intro')) {
        localStorage.setItem('fh_intro', '1');
        setTimeout(() => toast('Tip: ubah password contoh & tambahkan kamera/perangkat asli lewat Pengaturan.', 'warn', 9000), 1200);
      }
    } catch (e) {
      API.setToken('');
      showAuth();
    }
    A.state.booting = false;
  })();

  function rel(s) { return UI.rel(s); }
})();
