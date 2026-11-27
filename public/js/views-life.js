/* View: Galeri, Agenda, Tugas, Belanja, Papan Info, Pengaturan */
(function () {
  const { esc, money, icon, avatar, dateShort, dateTime, rel, toast, modal, formModal, confirmBox, lightbox, donut, PALETTE, ID_MONTH } = UI;
  const load = (root) => { root.innerHTML = `<div class="card"><div class="skeleton" style="height:14px;width:35%"></div><div class="skeleton mt" style="height:120px"></div></div>`; };

  /* ================================= GALERI ================================ */
  function readAsBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1]);
      fr.onerror = () => reject(new Error('Gagal membaca ' + file.name));
      fr.readAsDataURL(file);
    });
  }

  Views.uploadMedia = async (album) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*,video/*'; input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      if (!files.length) return;
      const meta = await formModal({
        title: `Unggah ${files.length} file`,
        fields: [
          { name: 'album', label: 'Album', value: album || 'Umum', placeholder: 'mis. Liburan 2026' },
          { name: 'caption', label: 'Keterangan (dipakai untuk semua file)', placeholder: 'mis. Liburan ke Puncak' },
        ],
      });
      if (!meta) return;
      const prog = modal({ title: 'Mengunggah…', dismissible: false, footer: null, body: '<div class="note"><b>0/' + files.length + '</b><div class="progress mt"><i style="width:0%"></i></div><div class="muted mt" id="up-name" style="font-size:12px"></div></div>' });
      let done = 0, failed = 0;
      for (const f of files) {
        prog.root.querySelector('#up-name').textContent = f.name;
        try {
          const data = await readAsBase64(f);
          await API.post('/api/media', { data, mime: f.type, kind: f.type.startsWith('video') ? 'video' : 'photo', caption: meta.caption || f.name.replace(/\.[^.]+$/, ''), album: meta.album || 'Umum' });
        } catch (e) { failed++; toast(e.message, 'bad'); }
        done++;
        prog.root.querySelector('.note b').textContent = `${done}/${files.length}`;
        prog.root.querySelector('.progress i').style.width = Math.round((done / files.length) * 100) + '%';
      }
      UI.closeModal();
      toast(`${done - failed} file diunggah${failed ? `, ${failed} gagal` : ''}`, failed ? 'warn' : 'ok');
      App.reload();
    };
    input.click();
  };

  Views.galeri = async (ctx) => {
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    st.album = st.album || 'all'; st.kind = st.kind || 'all'; st.tab = st.tab || 'albums';
    const { media, albums, covers } = await API.get(`/api/media?album=${st.album === 'all' ? 'all' : encodeURIComponent(st.album)}&kind=${st.kind === 'all' ? '' : st.kind}`);

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Galeri Keluarga</h3><p>${media.length} foto &amp; video · ${albums.length} album</p></div>
      <div class="spacer"></div>
      <div class="chips">
        <button class="chip ${st.tab === 'albums' ? 'active' : ''}" data-tab="albums">Album</button>
        <button class="chip ${st.tab === 'all' ? 'active' : ''}" data-tab="all">Semua</button>
      </div>
      <button class="btn btn-primary" id="upload">⬆ Unggah Foto/Video</button></div>

    ${st.tab === 'albums' ? `<div class="grid g-3">
        ${albums.map((a) => `<div class="album-card" data-album="${esc(a.album)}">
          ${covers[a.album] ? `<img src="${esc(covers[a.album])}" alt="${esc(a.album)}" loading="lazy"/>` : '<div class="empty" style="height:100%">🖼️</div>'}
          <div class="al-meta"><b>${esc(a.album)}</b><small>${a.photos} foto · ${a.videos} video</small></div></div>`).join('')
          || '<div class="empty"><div class="e-ico">🖼️</div><b>Galeri masih kosong</b>Unggah foto &amp; video kenangan keluarga.</div>'}
      </div>` : `
      <div class="chips mb">
        <button class="chip ${st.album === 'all' ? 'active' : ''}" data-falbum="all">Semua album</button>
        ${albums.map((a) => `<button class="chip ${st.album === a.album ? 'active' : ''}" data-falbum="${esc(a.album)}">${esc(a.album)}</button>`).join('')}
        <span style="width:12px"></span>
        <button class="chip ${st.kind === 'all' ? 'active' : ''}" data-fkind="all">Foto + Video</button>
        <button class="chip ${st.kind === 'photo' ? 'active' : ''}" data-fkind="photo">Foto</button>
        <button class="chip ${st.kind === 'video' ? 'active' : ''}" data-fkind="video">Video</button>
        <button class="chip ${st.kind === 'fav' ? 'active' : ''}" data-fkind="fav">★ Favorit</button>
      </div>
      <div class="gal-grid">${media.map((m, i) => `<div class="gal-item" data-i="${i}">
          ${m.kind === 'video'
            ? `<video src="${esc(m.url)}" preload="metadata" muted></video><span class="gi-badge">▶ VIDEO</span>`
            : `<img src="${esc(m.url)}" alt="${esc(m.caption)}" loading="lazy"/>`}
          ${m.favorite ? '<span class="gi-fav">★</span>' : ''}
          <div class="gi-cap">${esc(m.caption || m.album)} · ${dateShort(m.created_at)}</div></div>`).join('')
          || '<div class="empty"><div class="e-ico">📷</div><b>Tidak ada media</b>Coba ubah filter album/jenis.</div>'}</div>`}`;

    ctx.root.querySelector('#upload').onclick = () => Views.uploadMedia(st.album === 'all' ? 'Umum' : st.album);
    ctx.root.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => { st.tab = b.dataset.tab; App.reload(); });
    ctx.root.querySelectorAll('[data-album]').forEach((b) => b.onclick = () => { st.album = b.dataset.album; st.tab = 'all'; App.reload(); });
    ctx.root.querySelectorAll('[data-falbum]').forEach((b) => b.onclick = () => { st.album = b.dataset.falbum; App.reload(); });
    ctx.root.querySelectorAll('[data-fkind]').forEach((b) => b.onclick = () => { st.kind = b.dataset.fkind === 'fav' ? 'fav' : b.dataset.fkind; App.reload(); });
    const items = st.kind === 'fav' ? media.filter((m) => m.favorite) : media;
    ctx.root.querySelectorAll('[data-i]').forEach((el) => el.onclick = () => lightbox(items, Number(el.dataset.i)));
  };

  App_onDeleteMedia = async (item, after) => {
    try { await API.del('/api/media/' + item.id); toast('Media dihapus', 'ok'); after && after(); App.reload(); }
    catch (e) { toast(e.message, 'bad'); }
  };
  window.App = window.App || {};
  App.onDeleteMedia = App_onDeleteMedia;

  /* ================================= AGENDA ================================ */
  Views.newEvent = async (dateStr) => {
    const v = await formModal({
      title: 'Tambah agenda keluarga', wide: true,
      fields: [
        { name: 'title', label: 'Judul kegiatan', required: true, placeholder: 'mis. Arisan keluarga besar' },
        { name: 'category', label: 'Kategori', type: 'select', value: 'Keluarga', options: ['Keluarga', 'Pendidikan', 'Kesehatan', 'Liburan', 'Lingkungan', 'Keagamaan', 'Ulang Tahun', 'Lainnya'] },
        { name: 'date', label: 'Tanggal mulai', type: 'date', value: dateStr || UI.isoDate(), required: true },
        { name: 'time', label: 'Jam', type: 'time', value: '' },
        { name: 'endDate', label: 'Tanggal selesai (opsional)', type: 'date', value: '' },
        { name: 'location', label: 'Lokasi', placeholder: 'mis. Rumah Nenek' },
        { name: 'notes', label: 'Catatan / yang perlu disiapkan', type: 'textarea' },
        { name: 'remind', label: 'Ingatkan di dashboard', type: 'checkbox', value: true },
      ],
    });
    if (!v) return;
    await API.post('/api/events', v); toast('Agenda ditambahkan', 'ok'); App.reload();
  };

  Views.agenda = async (ctx) => {
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    const now = new Date();
    st.cursor = st.cursor || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    st.selected = st.selected || UI.isoDate();
    const { events, birthdays } = await API.get('/api/events');
    const [cy, cm] = st.cursor.split('-').map(Number);
    const first = new Date(cy, cm - 1, 1);
    const startPad = (first.getDay() + 6) % 7;
    const days = new Date(cy, cm, 0).getDate();
    const cells = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(`${st.cursor}-${String(d).padStart(2, '0')}`);
    while (cells.length % 7) cells.push(null);
    const byDate = {};
    events.forEach((e) => { (byDate[e.ev_date] = byDate[e.ev_date] || []).push(e); });
    const dayEvents = (byDate[st.selected] || []).sort((a, b) => (a.ev_time || '').localeCompare(b.ev_time || ''));
    const upcoming = events.filter((e) => e.ev_date >= UI.isoDate()).slice(0, 12);

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Agenda Keluarga</h3><p>Kalender kegiatan, ulang tahun, dan pengingat bersama</p></div>
      <div class="spacer"></div>
      <button class="btn" id="prev-m">←</button><b style="min-width:130px;text-align:center">${ID_MONTH[cm - 1]} ${cy}</b><button class="btn" id="next-m">→</button>
      <button class="btn btn-primary" id="add-ev">＋ Tambah Agenda</button></div>

    <div class="grid g-side">
      <div class="card">
        <div class="cal">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((h) => `<div class="cal-h">${h}</div>`).join('')}
          ${cells.map((d) => d ? `<div class="cal-day ${d === UI.isoDate() ? 'today' : ''} ${d === st.selected ? 'sel' : ''}" data-day="${d}">
            <span class="cd-n">${Number(d.slice(-2))}</span>
            ${(byDate[d] || []).slice(0, 2).map((e) => `<span class="cd-ev">${esc(e.title)}</span>`).join('')}
            ${(byDate[d] || []).length > 2 ? `<span class="cd-ev">+${byDate[d].length - 2} lagi</span>` : ''}
            ${(byDate[d] || []).length ? '<span class="cd-dot"></span>' : ''}</div>` : '<div></div>').join('')}
        </div>
        <div class="card-head mt"><h4>${dateShort(st.selected)}</h4><div class="spacer"></div><span class="badge">${dayEvents.length} kegiatan</span></div>
        ${dayEvents.length ? dayEvents.map((e) => `<div class="check-row">
            <div class="dev-ico">${icon('calendar', 18)}</div>
            <div class="cr-body"><div class="cr-title">${esc(e.title)}</div>
              <div class="cr-sub">${e.ev_time ? esc(e.ev_time) + ' · ' : ''}${esc(e.location || '-')} · ${esc(e.category)}</div>
              ${e.notes ? `<div class="muted" style="font-size:12px;margin-top:4px">${esc(e.notes)}</div>` : ''}</div>
            <button class="btn btn-xs" data-edev="${e.id}">✎</button>
            <button class="btn btn-xs btn-danger" data-delev="${e.id}">🗑</button></div>`).join('')
          : '<div class="empty"><div class="e-ico">🗓️</div><b>Tidak ada kegiatan</b>Klik tanggal lain atau tambah agenda baru.</div>'}
      </div>

      <div class="flex col" style="gap:16px">
        <div class="card"><div class="card-head"><h4>Agenda mendatang</h4></div>
          ${upcoming.map((e) => {
            const days = Math.round((new Date(e.ev_date + 'T00:00:00') - new Date(UI.isoDate() + 'T00:00:00')) / 864e5);
            return `<div class="list-item"><div class="li-body"><div class="li-title">${esc(e.title)}</div>
              <div class="li-sub">${dateShort(e.ev_date)}${e.ev_time ? ' · ' + esc(e.ev_time) : ''}${e.location ? ' · ' + esc(e.location) : ''}</div></div>
              <div class="li-right"><span class="badge ${days <= 2 ? 'warn' : 'acc'}">${days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : 'H-' + days}</span></div></div>`;
          }).join('') || '<div class="muted">Tidak ada agenda mendatang.</div>'}</div>

        <div class="card"><div class="card-head"><h4>Ulang tahun anggota</h4></div>
          ${birthdays.map((b) => {
            const bd = new Date(b.birthdate + 'T00:00:00');
            const next = new Date(new Date().getFullYear(), bd.getMonth(), bd.getDate());
            if (next < new Date(UI.isoDate())) next.setFullYear(next.getFullYear() + 1);
            const age = next.getFullYear() - bd.getFullYear();
            const left = Math.round((next - new Date(UI.isoDate() + 'T00:00:00')) / 864e5);
            return `<div class="list-item">${avatar(b.name, b.color, 'sm')}
              <div class="li-body"><div class="li-title">${esc(b.name)} <span class="muted" style="font-weight:400">(${esc(b.relation)})</span></div>
                <div class="li-sub">${dateShort(b.birthdate)} · akan berusia ${age}</div></div>
              <div class="li-right"><span class="badge ${left <= 7 ? 'warn' : ''}">${left === 0 ? '🎉 Hari ini' : 'H-' + left}</span></div></div>`;
          }).join('')}</div>
      </div>
    </div>`;

    ctx.root.querySelector('#prev-m').onclick = () => { const d = new Date(cy, cm - 2, 1); st.cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; App.reload(); };
    ctx.root.querySelector('#next-m').onclick = () => { const d = new Date(cy, cm, 1); st.cursor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; App.reload(); };
    ctx.root.querySelector('#add-ev').onclick = () => Views.newEvent(st.selected);
    ctx.root.querySelectorAll('[data-day]').forEach((b) => b.onclick = () => { st.selected = b.dataset.day; App.reload(); });
    ctx.root.querySelectorAll('[data-edev]').forEach((b) => b.onclick = async () => {
      const e = events.find((x) => String(x.id) === b.dataset.edev);
      const v = await formModal({
        title: 'Ubah agenda', wide: true,
        fields: [
          { name: 'title', label: 'Judul', value: e.title, required: true },
          { name: 'category', label: 'Kategori', type: 'select', value: e.category, options: ['Keluarga', 'Pendidikan', 'Kesehatan', 'Liburan', 'Lingkungan', 'Keagamaan', 'Ulang Tahun', 'Lainnya'] },
          { name: 'date', label: 'Tanggal', type: 'date', value: e.ev_date },
          { name: 'time', label: 'Jam', type: 'time', value: e.ev_time },
          { name: 'endDate', label: 'Selesai', type: 'date', value: e.end_date },
          { name: 'location', label: 'Lokasi', value: e.location },
          { name: 'notes', label: 'Catatan', type: 'textarea', value: e.notes },
          { name: 'remind', label: 'Tampilkan di dashboard', type: 'checkbox', value: !!e.remind },
        ],
      });
      if (!v) return;
      await API.put('/api/events/' + e.id, v); toast('Agenda diperbarui', 'ok'); App.reload();
    });
    ctx.root.querySelectorAll('[data-delev]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Hapus agenda ini?', { danger: true, yesText: 'Hapus' })) { await API.del('/api/events/' + b.dataset.delev); toast('Agenda dihapus', 'ok'); App.reload(); }
    });
  };

  /* ================================= TUGAS ================================= */
  Views.newChore = async () => {
    const meta = await App.metaReady;
    const v = await formModal({
      title: 'Tambah tugas rumah',
      fields: [
        { name: 'title', label: 'Tugas', required: true, placeholder: 'mis. Cuci mobil' },
        { name: 'assigneeId', label: 'Ditugaskan ke', type: 'select', value: App.user.id, options: [[null, 'Siapa saja']].concat(meta.members.map((m) => [m.id, `${m.name} (${m.relation})`])) },
        { name: 'dueDate', label: 'Tenggat', type: 'date', value: UI.isoDate() },
        { name: 'priority', label: 'Prioritas', type: 'select', value: 'normal', options: [['low', 'Rendah'], ['normal', 'Normal'], ['high', 'Tinggi']] },
        { name: 'repeat', label: 'Pengulangan', type: 'select', value: 'none', options: [['none', 'Sekali'], ['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan'], ['yearly', 'Tahunan']] },
        { name: 'notes', label: 'Catatan', type: 'textarea' },
      ],
    });
    if (!v) return;
    await API.post('/api/chores', v); toast('Tugas ditambahkan', 'ok'); App.reload();
  };

  Views.tugas = async (ctx) => {
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    st.scope = st.scope || 'open'; st.mine = !!st.mine;
    const { chores } = await API.get('/api/chores?scope=' + st.scope);
    const list = st.mine ? chores.filter((c) => c.assignee_id === App.user.id || !c.assignee_id) : chores;
    const meta = await App.metaReady;
    const groups = { overdue: [], today: [], later: [], noDate: [] };
    const today = UI.isoDate();
    list.forEach((c) => {
      if (!c.due_date) groups.noDate.push(c);
      else if (c.due_date < today) groups.overdue.push(c);
      else if (c.due_date === today) groups.today.push(c);
      else groups.later.push(c);
    });
    const section = (title, rows, cls) => rows.length ? `<div class="card mb"><div class="card-head"><h4>${title}</h4><div class="spacer"></div><span class="badge ${cls || ''}">${rows.length}</span></div>
      ${rows.map((c) => `<div class="check-row ${c.status === 'done' ? 'done' : ''}">
        <button class="check-box ${c.status === 'done' ? 'checked' : ''}" data-toggle="${c.id}">${icon('check', 13)}</button>
        <div class="cr-body"><div class="cr-title">${esc(c.title)}</div>
          <div class="cr-sub">${c.assignee_name ? esc(c.assignee_name) + ' · ' : 'Siapa saja · '}${c.due_date ? dateShort(c.due_date) : 'tanpa tenggat'}${c.repeat !== 'none' ? ' · berulang ' + c.repeat : ''}${c.notes ? ' · ' + esc(c.notes) : ''}</div></div>
        <span class="badge ${c.priority === 'high' ? 'bad' : c.priority === 'low' ? '' : 'warn'}">${c.priority === 'high' ? 'tinggi' : c.priority === 'low' ? 'rendah' : 'normal'}</span>
        <button class="btn btn-xs" data-editchore="${c.id}">✎</button>
        <button class="btn btn-xs btn-danger" data-delchore="${c.id}">🗑</button></div>`).join('')}</div>` : '';

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Tugas Rumah</h3><p>Piket &amp; tanggung jawab bersama seluruh anggota</p></div>
      <div class="spacer"></div>
      <div class="chips">${[['open', 'Aktif'], ['done', 'Selesai'], ['all', 'Semua']].map((s) => `<button class="chip ${st.scope === s[0] ? 'active' : ''}" data-scope="${s[0]}">${s[1]}</button>`).join('')}</div>
      <label class="switch"><input type="checkbox" id="mine" ${st.mine ? 'checked' : ''}/><span>Tugas saya</span></label>
      <button class="btn btn-primary" id="add-chore">＋ Tugas</button></div>
    <div class="grid g-4 mb">
      <div class="card stat"><div class="stat-ico bad">${icon('task', 21)}</div><div class="stat-body"><small>Terlewat</small><b>${groups.overdue.length}</b></div></div>
      <div class="card stat"><div class="stat-ico warn">${icon('calendar', 21)}</div><div class="stat-body"><small>Jatuh tempo hari ini</small><b>${groups.today.length}</b></div></div>
      <div class="card stat"><div class="stat-ico info">${icon('check', 21)}</div><div class="stat-body"><small>Akan datang</small><b>${groups.later.length}</b></div></div>
      <div class="card stat"><div class="stat-ico ok">${icon('users', 21)}</div><div class="stat-body"><small>Tanpa tenggat</small><b>${groups.noDate.length}</b></div></div>
    </div>
    ${section('⚠️ Terlewat', groups.overdue, 'bad')}
    ${section('Hari ini', groups.today, 'warn')}
    ${section('Akan datang', groups.later, 'info')}
    ${section('Tanpa tenggat', groups.noDate, '')}
    ${!list.length ? '<div class="empty"><div class="e-ico">🧹</div><b>Tidak ada tugas</b>Tambahkan piket keluarga agar pekerjaan rumah terbagi rata.</div>' : ''}

    <div class="card mt"><div class="card-head"><h4>Beban tugas per anggota</h4></div>
      ${meta.members.map((m) => {
        const mine = chores.filter((c) => c.assignee_id === m.id);
        const open = mine.filter((c) => c.status === 'todo').length;
        return `<div class="list-item">${avatar(m.name, m.color, 'sm')}<div class="li-body"><div class="li-title">${esc(m.name)}</div>
          <div class="li-sub">${open} aktif dari ${mine.length} tugas</div></div>
          <div class="li-right" style="min-width:120px">${UI.progressBar(mine.length ? (open / mine.length) * 100 : 0, open > 3 ? 'warn' : 'ok')}</div></div>`;
      }).join('')}</div>`;

    ctx.root.querySelector('#add-chore').onclick = () => Views.newChore();
    ctx.root.querySelector('#mine').onchange = (e) => { st.mine = e.target.checked; App.reload(); };
    ctx.root.querySelectorAll('[data-scope]').forEach((b) => b.onclick = () => { st.scope = b.dataset.scope; App.reload(); });
    ctx.root.querySelectorAll('[data-toggle]').forEach((b) => b.onclick = async () => { await API.post('/api/chores/' + b.dataset.toggle + '/toggle'); App.reload(); });
    ctx.root.querySelectorAll('[data-delchore]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Hapus tugas ini?', { danger: true, yesText: 'Hapus' })) { await API.del('/api/chores/' + b.dataset.delchore); App.reload(); }
    });
    ctx.root.querySelectorAll('[data-editchore]').forEach((b) => b.onclick = async () => {
      const c = chores.find((x) => String(x.id) === b.dataset.editchore);
      const v = await formModal({
        title: 'Ubah tugas',
        fields: [
          { name: 'title', label: 'Tugas', value: c.title, required: true },
          { name: 'assigneeId', label: 'Ditugaskan ke', type: 'select', value: c.assignee_id, options: [[null, 'Siapa saja']].concat(meta.members.map((m) => [m.id, m.name])) },
          { name: 'dueDate', label: 'Tenggat', type: 'date', value: c.due_date },
          { name: 'priority', label: 'Prioritas', type: 'select', value: c.priority, options: [['low', 'Rendah'], ['normal', 'Normal'], ['high', 'Tinggi']] },
          { name: 'repeat', label: 'Pengulangan', type: 'select', value: c.repeat, options: [['none', 'Sekali'], ['daily', 'Harian'], ['weekly', 'Mingguan'], ['monthly', 'Bulanan'], ['yearly', 'Tahunan']] },
          { name: 'notes', label: 'Catatan', type: 'textarea', value: c.notes },
        ],
      });
      if (!v) return;
      await API.put('/api/chores/' + c.id, v); toast('Tugas diperbarui', 'ok'); App.reload();
    });
  };

  /* ================================ BELANJA ================================ */
  Views.newShopping = async () => {
    const v = await formModal({
      title: 'Tambah daftar belanja',
      fields: [
        { name: 'item', label: 'Barang', required: true, placeholder: 'mis. Beras 10 kg' },
        { name: 'qty', label: 'Jumlah', type: 'number', value: 1, min: 0 },
        { name: 'unit', label: 'Satuan', value: 'pcs', placeholder: 'pcs / kg / botol' },
        { name: 'estPrice', label: 'Perkiraan harga (Rp)', type: 'number', min: 0, value: 0 },
        { name: 'note', label: 'Catatan', placeholder: 'mis. merek favorit Ibu' },
      ],
    });
    if (!v) return;
    await API.post('/api/shopping', v); toast('Ditambahkan ke daftar belanja', 'ok'); App.reload();
  };

  Views.belanja = async (ctx) => {
    load(ctx.root);
    const { items, stats } = await API.get('/api/shopping');
    const open = items.filter((i) => i.status === 'todo');
    const bought = items.filter((i) => i.status === 'bought');

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Daftar Belanja</h3><p>${stats.open} barang perlu dibeli · estimasi ${money(stats.est, true)}</p></div>
      <div class="spacer"></div>
      ${bought.length ? '<button class="btn" id="clear-bought">Bersihkan yang sudah dibeli</button>' : ''}
      <button class="btn btn-primary" id="add-shop">＋ Tambah Barang</button></div>
    <div class="grid g-side">
      <div class="card"><div class="card-head"><h4>Perlu dibeli</h4><div class="spacer"></div><span class="badge warn">${open.length}</span></div>
        ${open.map((i) => `<div class="check-row">
          <button class="check-box" data-tog="${i.id}">${icon('check', 13)}</button>
          <div class="cr-body"><div class="cr-title">${esc(i.item)}</div>
            <div class="cr-sub">${i.qty} ${esc(i.unit)}${i.est_price ? ' · ±' + money(i.est_price * i.qty, true) : ''}${i.note ? ' · ' + esc(i.note) : ''} · ditambah ${esc(i.added_by_name || '-')}</div></div>
          <button class="btn btn-xs btn-danger" data-delshop="${i.id}">🗑</button></div>`).join('')
          || '<div class="empty"><div class="e-ico">🛒</div><b>Daftar belanja kosong</b>Tambahkan barang yang perlu dibeli.</div>'}</div>
      <div class="card"><div class="card-head"><h4>Sudah dibeli</h4><div class="spacer"></div><span class="badge ok">${bought.length}</span></div>
        ${bought.map((i) => `<div class="check-row done">
          <button class="check-box checked" data-tog="${i.id}">${icon('check', 13)}</button>
          <div class="cr-body"><div class="cr-title">${esc(i.item)}</div>
            <div class="cr-sub">${i.qty} ${esc(i.unit)} · dibeli ${esc(i.bought_by_name || '-')} ${rel(i.bought_at)}</div></div></div>`).join('')
          || '<div class="muted">Belum ada.</div>'}</div>
    </div>`;

    ctx.root.querySelector('#add-shop').onclick = () => Views.newShopping();
    const cb = ctx.root.querySelector('#clear-bought');
    if (cb) cb.onclick = async () => { if (await confirmBox('Hapus semua item yang sudah dibeli?')) { await API.post('/api/shopping/clear-bought'); App.reload(); } };
    ctx.root.querySelectorAll('[data-tog]').forEach((b) => b.onclick = async () => { await API.post('/api/shopping/' + b.dataset.tog + '/toggle'); App.reload(); });
    ctx.root.querySelectorAll('[data-delshop]').forEach((b) => b.onclick = async () => { await API.del('/api/shopping/' + b.dataset.delshop); App.reload(); });
  };

  /* =============================== PAPAN INFO ============================== */
  Views.newAnnouncement = async () => {
    const v = await formModal({
      title: 'Tulis pengumuman',
      fields: [
        { name: 'title', label: 'Judul', required: true, placeholder: 'mis. Password WiFi diganti' },
        { name: 'level', label: 'Tingkat', type: 'select', value: 'info', options: [['info', 'Info'], ['warning', 'Penting'], ['success', 'Kabar baik']] },
        { name: 'body', label: 'Isi pengumuman', type: 'textarea' },
        { name: 'pinned', label: 'Sematkan di atas', type: 'checkbox', value: false },
      ],
    });
    if (!v) return;
    await API.post('/api/announcements', v); toast('Pengumuman dipublikasikan', 'ok'); App.reload();
  };

  Views.papan = async (ctx) => {
    load(ctx.root);
    const [{ announcements }, { activity }] = await Promise.all([API.get('/api/announcements'), API.get('/api/activity?limit=60')]);
    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Papan Info Keluarga</h3><p>Pengumuman bersama &amp; riwayat aktivitas semua anggota</p></div>
      <div class="spacer"></div><button class="btn btn-primary" id="add-ann">＋ Tulis Pengumuman</button></div>
    <div class="grid g-side">
      <div>${announcements.map((a) => `<div class="card mb" style="border-left:3px solid ${a.level === 'warning' ? 'var(--warn)' : a.level === 'success' ? 'var(--ok)' : 'var(--acc)'}">
          <div class="card-head"><h4>${a.pinned ? '📌 ' : ''}${esc(a.title)}</h4><div class="spacer"></div>
            <span class="badge ${a.level === 'warning' ? 'warn' : a.level === 'success' ? 'ok' : 'info'}">${esc(a.level)}</span></div>
          <p style="color:var(--txt2);white-space:pre-wrap">${esc(a.body || '')}</p>
          <div class="flex mt" style="gap:8px">${avatar(a.author_name || '?', a.author_color, 'sm')}
            <span class="muted" style="font-size:12px">${esc(a.author_name || 'Keluarga')} · ${rel(a.created_at)}</span>
            <div class="spacer" style="flex:1"></div>
            ${(App.isAdmin || a.author_id === App.user.id) ? `<button class="btn btn-xs" data-pin="${a.id}" data-v="${a.pinned ? 0 : 1}">${a.pinned ? 'Lepas semat' : 'Sematkan'}</button>
            <button class="btn btn-xs btn-danger" data-delann="${a.id}">🗑</button>` : ''}</div></div>`).join('')
          || '<div class="empty"><div class="e-ico">📣</div><b>Belum ada pengumuman</b></div>'}</div>
      <div class="card"><div class="card-head"><h4>Riwayat aktivitas</h4><div class="spacer"></div><span class="sub">otomatis tercatat</span></div>
        <div class="tl">${activity.map((a) => `<div class="tl-item">
          <div class="tl-dot" style="background:${esc(a.user_color || '#64748b')}">${esc(UI.initials(a.user_name || 'S'))}</div>
          <div class="tl-body"><b>${esc(a.user_name || 'Sistem')}</b> <span class="badge">${esc(a.action)} ${esc(a.entity)}</span>
          <small>${esc(a.detail)} · ${rel(a.created_at)}</small></div></div>`).join('') || '<div class="muted">Belum ada aktivitas.</div>'}</div></div>
    </div>`;
    ctx.root.querySelector('#add-ann').onclick = () => Views.newAnnouncement();
    ctx.root.querySelectorAll('[data-delann]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Hapus pengumuman ini?', { danger: true, yesText: 'Hapus' })) { await API.del('/api/announcements/' + b.dataset.delann); App.reload(); }
    });
    ctx.root.querySelectorAll('[data-pin]').forEach((b) => { b.onclick = async () => { await API.put('/api/announcements/' + b.dataset.pin, { pinned: b.dataset.v === '1' }); App.reload(); }; });
  };

  /* ================================ PENGATURAN ============================= */
  Views.pengaturan = async (ctx) => {
    load(ctx.root);
    const [s, sys] = await Promise.all([API.get('/api/settings'), API.get('/api/system/status')]);
    const isAdmin = App.isAdmin;

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>Pengaturan</h3><p>Keamanan akun, integrasi CCTV &amp; Smart Home, tampilan, dan cadangan data</p></div></div>
    <div class="grid g-2">
      <div class="flex col" style="gap:16px">
        <div class="card"><div class="card-head"><h4>Akun saya</h4></div>
          <dl class="kv"><dt>Nama</dt><dd>${esc(App.user.name)}</dd><dt>Username</dt><dd>@${esc(App.user.username)}</dd>
            <dt>Peran</dt><dd>${isAdmin ? 'Admin keluarga' : 'Anggota'}</dd>
            <dt>Masuk terakhir</dt><dd>${App.user.last_login ? rel(App.user.last_login) : 'sesi ini'}</dd></dl>
          <div class="flex wrap mt"><button class="btn btn-sm" id="edit-me">Ubah profil</button>
            <button class="btn btn-sm" id="pw">Ganti password</button></div></div>

        <div class="card"><div class="card-head"><h4>Tampilan</h4></div>
          <div class="flex wrap">
            <button class="chip" data-theme="dark">🌙 Gelap</button>
            <button class="chip" data-theme="light">☀️ Terang</button>
          </div>
          <div class="note mt">Tema tersimpan di perangkat ini. Halaman awal: <b>${esc((s.ui || {}).landing || 'dashboard')}</b>.</div>
        </div>

        <div class="card"><div class="card-head"><h4>Status server</h4></div>
          <dl class="kv">
            <dt>Node.js</dt><dd class="mono">${esc(sys.node)}</dd>
            <dt>Waktu aktif</dt><dd>${Math.floor(sys.uptime / 3600)}j ${Math.floor((sys.uptime % 3600) / 60)}m</dd>
            <dt>Memori</dt><dd>${sys.memoryMb} MB</dd>
            <dt>Ukuran database</dt><dd>${sys.dbSizeKb} KB</dd>
            <dt>Ukuran galeri</dt><dd>${sys.uploadsKb} KB</dd>
            <dt>Lokasi DB</dt><dd class="mono" style="word-break:break-all;font-size:11.5px">${esc(sys.dbPath)}</dd>
          </dl>
          <div class="chips mt">${Object.entries(sys.counts).map((k) => `<span class="badge">${esc(k[0])}: ${k[1]}</span>`).join('')}</div>
        </div>
      </div>

      <div class="flex col" style="gap:16px">
        <div class="card"><div class="card-head"><h4>Integrasi CCTV / XMEye</h4>${isAdmin ? '<div class="spacer"></div><button class="btn btn-xs" id="edit-xmeye">Ubah</button>' : ''}</div>
          <dl class="kv">
            <dt>URL go2rtc</dt><dd class="mono">${esc((s.xmeye || {}).go2rtcUrl || '-')}</dd>
            <dt>Template RTSP</dt><dd class="mono" style="font-size:11.5px;word-break:break-all">${esc((s.xmeye || {}).rtspTemplate || '-')}</dd>
          </dl>
          <div class="note warn mt" style="font-size:12.5px">${esc((s.xmeye || {}).notes || '')}</div>
          ${isAdmin ? `<div class="note mt" style="font-size:12.5px"><b>Contoh konfigurasi go2rtc</b> (jalankan di PC/NAS rumah):<br>
            <span class="mono">docker run -d --name go2rtc -p 1984:1984 -p 8555:8555 -p 1935:1935 alexxit/go2rtc</span><br>
            lalu di <span class="mono">go2rtc.yaml</span>:<br>
            <span class="mono">streams:<br>&nbsp;&nbsp;ruang-keluarga: rtsp://admin:sandi@192.168.1.20:554/user=admin&amp;password=&amp;channel=1&amp;stream=0.sony</span><br>
            Di aplikasi ini tambahkan kamera mode <b>go2rtc</b> dengan sumber <span class="mono">ruang-keluarga</span>.</div>` : ''}
        </div>

        <div class="card"><div class="card-head"><h4>Integrasi Smart Home / Tuya Smart Life</h4>${isAdmin ? '<div class="spacer"></div><button class="btn btn-xs" id="edit-tuya">Ubah</button>' : ''}</div>
          <dl class="kv">
            <dt>Status</dt><dd>${(s.tuya || {}).enabled && (s.tuya || {}).accessId ? '<span class="badge ok">Konfigurasi tersimpan</span>' : '<span class="badge warn">Mode demo</span>'}</dd>
            <dt>Endpoint</dt><dd class="mono" style="font-size:12px">${esc((s.tuya || {}).endpoint || '-')}</dd>
            <dt>Access ID</dt><dd class="mono">${esc((s.tuya || {}).accessId || 'belum diisi')}</dd>
            <dt>UID Smart Life</dt><dd class="mono">${esc((s.tuya || {}).uid || 'belum ditautkan')}</dd>
          </dl>
          <div class="note mt" style="font-size:12.5px">Perangkat dari aplikasi <b>Smart Life</b> muncul setelah: (1) Cloud Project dibuat di platform.tuya.com dengan API <b>IoT Core</b>, (2) Access ID/Secret diisi di sini, (3) akun aplikasi Smart Life ditautkan (menu Smart Home → Tautkan Akun).</div>
          ${isAdmin ? `<div class="flex wrap mt"><button class="btn btn-sm" id="test-tuya">Tes koneksi Tuya</button>
            <button class="btn btn-sm" id="api-test">Panel uji API</button></div>` : ''}
        </div>

        ${isAdmin ? `<div class="card"><div class="card-head"><h4>Keamanan &amp; akses</h4></div>
          <dl class="kv"><dt>Sesi berlaku</dt><dd>${(s.security || {}).sessionDays || 14} hari</dd>
            <dt>Registrasi mandiri</dt><dd>${(s.security || {}).allowSelfRegister ? 'Diizinkan' : 'Hanya dengan kode undangan'}</dd>
            <dt>Anggota</dt><dd>${sys.counts.users} akun</dd></dl>
          <div class="note mt" style="font-size:12.5px">Akses halaman ini dilindungi login. Hanya anggota keluarga dengan username + password (atau kode undangan dari admin) yang bisa masuk. Server sebaiknya hanya dibuka di jaringan lokal rumah; jika ingin diakses dari luar, gunakan VPN/Tailscale atau reverse proxy dengan HTTPS.</div>
          <div class="flex wrap mt"><button class="btn btn-sm" id="edit-sec">Ubah kebijakan</button>
            <button class="btn btn-sm" id="goto-invite">Kelola kode undangan</button></div></div>` : ''}

        ${isAdmin ? `<div class="card"><div class="card-head"><h4>Cadangan data</h4></div>
          <div class="note mb" style="font-size:12.5px">Ekspor seluruh data keluarga (profil, keuangan, aset, agenda, galeri metadata, pengaturan) ke satu file JSON. Pulihkan kapan saja di perangkat lain.</div>
          <div class="flex wrap"><a class="btn btn-sm btn-primary" href="/api/export" download>⬇ Ekspor cadangan</a>
            <button class="btn btn-sm" id="import">⬆ Pulihkan dari file</button></div></div>` : ''}
      </div>
    </div>`;

    ctx.root.querySelectorAll('[data-theme]').forEach((b) => b.onclick = () => App.setTheme(b.dataset.theme));
    ctx.root.querySelector('#edit-me').onclick = async () => {
      const u = App.user;
      const v = await formModal({
        title: 'Ubah profil saya', wide: true,
        fields: [
          { name: 'name', label: 'Nama', value: u.name, required: true },
          { name: 'gender', label: 'Jenis kelamin', type: 'select', value: u.gender, options: [['', '-'], ['L', 'Laki-laki'], ['P', 'Perempuan']] },
          { name: 'birthdate', label: 'Tanggal lahir', type: 'date', value: u.birthdate },
          { name: 'phone', label: 'Telepon', value: u.phone }, { name: 'email', label: 'Email', value: u.email },
          { name: 'job', label: 'Pekerjaan', value: u.job }, { name: 'school', label: 'Sekolah', value: u.school },
          { name: 'blood', label: 'Golongan darah', type: 'select', value: u.blood, options: ['', 'A', 'B', 'AB', 'O'] },
          { name: 'color', label: 'Warna identitas', type: 'color', value: u.color || '#6366f1' },
          { name: 'about', label: 'Tentang saya', type: 'textarea', value: u.about },
        ],
      });
      if (!v) return;
      await API.put('/api/auth/profile', v); toast('Profil disimpan', 'ok'); await App.bootFamily(); App.reload();
    };
    ctx.root.querySelector('#pw').onclick = async () => {
      const v = await formModal({ title: 'Ganti password', fields: [
        { name: 'current', label: 'Password lama', type: 'password', required: true },
        { name: 'next', label: 'Password baru (min. 6 karakter)', type: 'password', required: true }] });
      if (!v) return;
      try { await API.post('/api/auth/password', v); toast('Password diganti', 'ok'); } catch (e) { toast(e.message, 'bad'); }
    };

    if (isAdmin) {
      ctx.root.querySelector('#edit-xmeye').onclick = async () => {
        const v = await formModal({ title: 'Pengaturan CCTV / go2rtc', wide: true, fields: [
          { name: 'go2rtcUrl', label: 'URL go2rtc', value: (s.xmeye || {}).go2rtcUrl || 'http://192.168.1.10:1984' },
          { name: 'rtspTemplate', label: 'Template RTSP XMEye', value: (s.xmeye || {}).rtspTemplate || '' },
          { name: 'notes', label: 'Catatan tampil di halaman CCTV', type: 'textarea', value: (s.xmeye || {}).notes || '' }] });
        if (!v) return; await API.put('/api/settings/xmeye', v); toast('Tersimpan', 'ok'); App.reload();
      };
      ctx.root.querySelector('#edit-tuya').onclick = () => App.go('smarthome');
      ctx.root.querySelector('#test-tuya').onclick = async () => {
        const r = await API.post('/api/iot/test');
        toast(r.ok ? 'Token Tuya berhasil dibuat ✔' : 'Gagal: ' + r.error, r.ok ? 'ok' : 'bad', 6000);
      };
      ctx.root.querySelector('#api-test').onclick = async () => {
        const v = await formModal({ title: 'Panel uji API Tuya', wide: true, fields: [
          { name: 'method', label: 'Method', type: 'select', value: 'GET', options: ['GET', 'POST', 'PUT', 'DELETE'] },
          { name: 'path', label: 'Path', value: '/v1.0/iot-03/users', required: true },
          { name: 'queryJson', label: 'Query (JSON)', value: '{"page_no":1,"page_size":10}' },
          { name: 'bodyJson', label: 'Body (JSON, untuk POST)', value: '{}' }] });
        if (!v) return;
        let query, body;
        try { query = v.queryJson ? JSON.parse(v.queryJson) : undefined; body = v.bodyJson ? JSON.parse(v.bodyJson) : undefined; }
        catch (e) { return toast('JSON tidak valid', 'bad'); }
        const r = await API.post('/api/iot/custom', { method: v.method, path: v.path, query, body });
        modal({ title: 'Respons Tuya', wide: true, body: `<pre class="json">${esc(JSON.stringify(r, null, 2))}</pre>`, footer: '<button class="btn" data-close>Tutup</button>' });
      };
      ctx.root.querySelector('#edit-sec').onclick = async () => {
        const v = await formModal({ title: 'Kebijakan keamanan', fields: [
          { name: 'sessionDays', label: 'Sesi login berlaku (hari)', type: 'number', min: 1, value: (s.security || {}).sessionDays || 14 },
          { name: 'inviteExpiryDays', label: 'Kode undangan berlaku (hari)', type: 'number', min: 1, value: (s.security || {}).inviteExpiryDays || 7 },
          { name: 'allowSelfRegister', label: 'Izinkan daftar tanpa kode (tidak disarankan)', type: 'checkbox', value: !!(s.security || {}).allowSelfRegister }] });
        if (!v) return; await API.put('/api/settings/security', v); toast('Kebijakan disimpan', 'ok'); App.reload();
      };
      ctx.root.querySelector('#goto-invite').onclick = () => App.go('keluarga');
      const imp = ctx.root.querySelector('#import');
      if (imp) imp.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'application/json';
        input.onchange = async () => {
          const file = input.files[0]; if (!file) return;
          if (!await confirmBox('Pulihkan data dari ' + file.name + '? Data dengan ID sama akan ditimpa.', { danger: true, yesText: 'Pulihkan' })) return;
          const text = await file.text();
          try {
            const r = await API.post('/api/import', JSON.parse(text));
            toast('Data dipulihkan: ' + Object.entries(r.imported).map((k) => k[0] + ' ' + k[1]).join(', '), 'ok', 6000);
            await App.bootFamily(); App.reload();
          } catch (e) { toast(e.message, 'bad'); }
        };
        input.click();
      };
    }
  };
})();
