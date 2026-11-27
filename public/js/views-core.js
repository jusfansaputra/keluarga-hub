/* View inti: Dashboard, Keluarga, Keuangan */
window.Views = window.Views || {};
(function () {
  const { esc, money, icon, avatar, dateShort, dateTime, rel, monthLabel, toast, donut, bars, sparkline, progressBar, confirmBox, formModal, modal, PALETTE } = UI;

  const load = (root, label) => { root.innerHTML = `<div class="card"><div class="skeleton" style="height:14px;width:40%"></div><div class="skeleton mt" style="height:60px"></div><div class="skeleton mt" style="height:60px"></div></div>`; };

  /* ================================ DASHBOARD ============================== */
  Views.dashboard = async (ctx) => {
    load(ctx.root);
    let d, iot;
    try { d = await API.get('/api/dashboard'); iot = await API.get('/api/iot'); } catch (e) { return ctx.root.innerHTML = `<div class="note bad">${esc(e.message)}</div>`; }
    const f = d.finance, me = App.user;

    const tiles = [
      { ico: 'walletIn', cls: 'ok', label: 'Pemasukan ' + monthLabel(d.month), val: money(f.income, true) },
      { ico: 'wallet', cls: 'bad', label: 'Pengeluaran ' + monthLabel(d.month), val: money(f.expense, true), delta: f.deltaExpensePct ? `${f.deltaExpensePct > 0 ? '▲' : '▼'} ${Math.abs(f.deltaExpensePct)}% vs bulan lalu` : '', dcls: f.deltaExpensePct > 0 ? 'down' : '' },
      { ico: 'chart', cls: 'info', label: 'Saldo bulan ini', val: money(f.balance, true) },
      { ico: 'box', cls: 'pink', label: `Nilai aset (${d.assets.count} item)`, val: money(d.assets.value, true) },
    ];

    ctx.root.innerHTML = `
    <section class="hero">
      <h2>${esc(d.greeting)}, ${esc(me.name.split(' ')[0])} 👋</h2>
      <p>${dateShort(d.today)} · ${esc(App.family.name)} · ${d.family.members.length} anggota aktif · ${d.iot.total} perangkat pintar${d.iot.demo ? ' (mode demo)' : ''}</p>
      <div class="hero-stats">
        <div class="hero-stat"><b>${money(f.balance, true)}</b><small>Surplus ${monthLabel(d.month)}</small></div>
        <div class="hero-stat"><b>${d.agenda.today.length}</b><small>Agenda hari ini</small></div>
        <div class="hero-stat"><b>${d.agenda.choresOpen}</b><small>Tugas rumah aktif</small></div>
        <div class="hero-stat"><b>${d.cameras.length}</b><small>Kamera online</small></div>
        <div class="hero-stat"><b>${d.iot.online}/${d.iot.total}</b><small>Perangkat aktif</small></div>
      </div>
    </section>

    <div class="grid g-4 mb">${tiles.map((t) => `<div class="card stat">
      <div class="stat-ico ${t.cls}">${icon(t.ico, 21)}</div>
      <div class="stat-body"><small>${esc(t.label)}</small><b>${esc(t.val)}</b>
      ${t.delta ? `<span class="delta ${t.dcls || ''}">${esc(t.delta)}</span>` : ''}</div></div>`).join('')}</div>

    <div class="grid g-side mb">
      <div class="card">
        <div class="card-head"><h4>Arus kas 6 bulan</h4><div class="spacer"></div>
          <button class="btn btn-sm" data-go="keuangan">Buka Keuangan</button></div>
        ${bars(f.trend.map((t) => ({ label: monthLabel(t.ym), income: t.income, expense: t.expense })))}
        <div class="mt">${sparkline(f.trend.map((t) => t.income - t.expense), '#22c55e')}</div>
        <p class="muted" style="font-size:12px;margin-top:4px">Tren saldo bulanan</p>
      </div>
      <div class="card">
        <div class="card-head"><h4>Pengeluaran per kategori</h4></div>
        ${donut(f.expenseByCategory.map((c, i) => ({ label: c.category, value: c.total, color: PALETTE[i % PALETTE.length] })),
          { centerTop: money(f.expense, true), centerBottom: 'pengeluaran ' + monthLabel(d.month) })}
        <div class="note mt" style="font-size:12.5px">
          <b>Kategori teratas bulan ini:</b> ${f.topCategory ? `${esc(f.topCategory.category)} — ${money(f.topCategory.total, true)}` : 'belum ada data'}
        </div>
        ${f.budgetAlerts.length ? `<div class="note warn mt" style="font-size:12.5px"><b>Anggaran menipis:</b> ${f.budgetAlerts.map((b) => `${esc(b.category)} (${b.pct}%)`).join(', ')}</div>` : ''}
      </div>
    </div>

    <div class="grid g-3 mb">
      <div class="card">
        <div class="card-head"><h4>Agenda keluarga</h4><div class="spacer"></div><button class="btn btn-sm" data-go="agenda">Semua</button></div>
        ${d.agenda.today.length || d.agenda.upcoming.length ? `<div class="list">${[...d.agenda.today, ...d.agenda.upcoming].slice(0, 5).map((e) => `
          <div class="list-item"><div class="stat-ico info" style="width:36px;height:36px;border-radius:11px">${icon('calendar', 17)}</div>
          <div class="li-body"><div class="li-title">${esc(e.title)}</div>
          <div class="li-sub">${dateShort(e.ev_date)}${e.ev_time ? ' · ' + esc(e.ev_time) : ''}${e.location ? ' · ' + esc(e.location) : ''}</div></div>
          <div class="li-right"><span class="badge ${e.ev_date === d.today ? 'acc' : ''}">${e.ev_date === d.today ? 'Hari ini' : dateShort(e.ev_date)}</span></div></div>`).join('')}</div>`
          : `<div class="empty"><div class="e-ico">🗓️</div><b>Tidak ada agenda</b>Tambahkan rencana keluarga lewat menu Agenda.</div>`}
      </div>

      <div class="card">
        <div class="card-head"><h4>Tugas &amp; belanja</h4><div class="spacer"></div><button class="btn btn-sm" data-go="tugas">Tugas</button></div>
        ${d.agenda.myChores.length ? d.agenda.myChores.map((c) => `<div class="check-row">
          <button class="check-box" data-chore="${c.id}">${icon('check', 13)}</button>
          <div class="cr-body"><div class="cr-title">${esc(c.title)}</div><div class="cr-sub">${c.due_date ? 'Jatuh tempo ' + dateShort(c.due_date) : 'Tanpa tenggat'}${c.priority === 'high' ? ' · prioritas tinggi' : ''}</div></div>
        </div>`).join('') : `<div class="empty"><div class="e-ico">✅</div><b>Tidak ada tugas untuk Anda</b></div>`}
        <div class="card-head mt"><h4 style="font-size:14px">Perlu dibeli (${d.agenda.shoppingOpen})</h4><div class="spacer"></div><button class="btn btn-sm" data-go="belanja">Buka</button></div>
        <div class="chips">${d.agenda.shoppingItems.map((s) => `<span class="badge">${esc(s.item)} · ${s.qty} ${esc(s.unit)}</span>`).join('') || '<span class="muted">Daftar belanja kosong</span>'}</div>
      </div>

      <div class="card">
        <div class="card-head"><h4>Papan info</h4><div class="spacer"></div><button class="btn btn-sm" data-go="papan">Semua</button></div>
        ${d.announcements.map((a) => `<div class="note ${a.level === 'warning' ? 'warn' : a.level === 'success' ? 'ok' : ''}" style="margin-bottom:9px">
          <b>${esc(a.title)}</b><div style="margin-top:4px">${esc((a.body || '').slice(0, 150))}${(a.body || '').length > 150 ? '…' : ''}</div>
          <div class="muted" style="font-size:11.5px;margin-top:5px">${esc(a.author_name || 'Keluarga')} · ${rel(a.created_at)}</div></div>`).join('') || '<div class="muted">Belum ada pengumuman</div>'}
        ${d.family.birthdays.length ? `<div class="card-head mt"><h4 style="font-size:14px">Ulang tahun terdekat</h4></div>
          ${d.family.birthdays.map((b) => `<div class="flex" style="gap:9px;margin-bottom:7px">${avatar(b.name, b.color, 'sm')}<div><b style="font-size:13px">${esc(b.name)}</b><div class="muted" style="font-size:11.5px">${dateShort(b.birthdate)} · ${esc(b.relation)}</div></div></div>`).join('')}` : ''}
      </div>
    </div>

    <div class="grid g-2 mb">
      <div class="card">
        <div class="card-head"><h4>Pantauan rumah</h4><div class="spacer"></div>
          <button class="btn btn-sm" data-go="cctv">CCTV</button><button class="btn btn-sm" data-go="smarthome">Perangkat</button></div>
        <div class="cam-grid" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">
          ${d.cameras.slice(0, 4).map((c) => `<div class="cam-tile">
            <div class="cam-view" style="aspect-ratio:16/10">
              <img src="/api/cameras/${c.id}/thumb" alt="${esc(c.name)}" loading="lazy" onerror="this.style.display='none'"/>
              <span class="cam-live"><i></i>LIVE</span></div>
            <div class="cam-meta"><div class="cm-body"><b>${esc(c.name)}</b><small>${esc(c.location || c.kind)}</small></div></div></div>`).join('')
            || '<div class="empty"><div class="e-ico">📷</div><b>Belum ada kamera</b>Tambahkan lewat menu CCTV.</div>'}
        </div>
        <div class="card-head mt"><h4 style="font-size:14px">Perangkat pintar</h4></div>
        <div class="chips">${(d.iot.sample || []).map((dev) => {
          const st = dev.status || [];
          const on = st.some((s) => /^(switch|switch_\d+|switch_led)$/.test(s.code) && s.value === true);
          return `<span class="badge ${on ? 'ok' : ''}">${esc(dev.name)}${dev.online === false ? ' · offline' : ''}</span>`;
        }).join('')}</div>
      </div>

      <div class="card">
        <div class="card-head"><h4>Transaksi terbaru</h4><div class="spacer"></div>
          <button class="btn btn-sm btn-primary" data-tx>+ Catat</button></div>
        <div class="list">${f.recent.map((t) => `<div class="list-item">
          ${avatar(t.member_name || '?', t.member_color, 'sm')}
          <div class="li-body"><div class="li-title">${esc(t.description)}</div>
            <div class="li-sub">${esc(t.category)} · ${dateShort(t.tx_date)} · ${esc(t.member_name || '—')}</div></div>
          <div class="li-right ${t.type === 'income' ? 'income-txt' : 'expense-txt'}">${t.type === 'income' ? '+' : '−'}${money(t.amount, true)}</div></div>`).join('')}</div>
        <div class="card-head mt"><h4 style="font-size:14px">Aktivitas keluarga</h4><div class="spacer"></div><span class="badge">${icon('activity', 12)} riwayat</span></div>
        <div class="tl">${d.activity.map((a) => `<div class="tl-item">
          <div class="tl-dot" style="background:${esc(a.user_color || '#6366f1')}">${esc(UI.initials(a.user_name || '?'))}</div>
          <div class="tl-body"><b>${esc(a.user_name || 'Sistem')} · ${esc(a.action)} ${esc(a.entity)}</b>
          <small>${esc(a.detail)} · ${rel(a.created_at)}</small></div></div>`).join('')}</div>
      </div>
    </div>`;

    ctx.root.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => App.go(b.dataset.go));
    ctx.root.querySelector('[data-tx]').onclick = () => Views.txForm();
    ctx.root.querySelectorAll('[data-chore]').forEach((b) => b.onclick = async () => {
      await API.post('/api/chores/' + b.dataset.chore + '/toggle');
      toast('Tugas diperbarui', 'ok'); App.reload();
    });
  };

  /* ================================= KELUARGA ============================== */
  Views.keluarga = async (ctx) => {
    load(ctx.root);
    const { family, members, stats } = await API.get('/api/family');
    const invites = App.isAdmin ? (await API.get('/api/invites')).invites : [];
    const isAdmin = App.isAdmin;

    ctx.root.innerHTML = `
    <div class="page-head"><div><h3>${esc(family.name)}</h3><p>${esc(family.motto || 'Portal keluarga privat')}</p></div>
      <div class="spacer"></div>
      ${isAdmin ? '<button class="btn" id="edit-family">✎ Ubah Profil Keluarga</button>' : ''}
      ${isAdmin ? '<button class="btn btn-primary" id="add-member">＋ Tambah Anggota</button>' : ''}</div>

    <div class="grid g-4 mb">
      ${[['users', 'Anggota aktif', stats.members, ''], ['box', 'Aset terdaftar', stats.assets, money(stats.assetValue, true)],
         ['image', 'Foto & video', stats.photos + stats.videos, stats.photos + ' foto · ' + stats.videos + ' video'],
         ['calendar', 'Agenda mendatang', stats.eventsUpcoming, stats.choresOpen + ' tugas aktif']]
        .map((t) => `<div class="card stat"><div class="stat-ico">${icon(t[0], 21)}</div>
        <div class="stat-body"><small>${t[1]}</small><b>${esc(String(t[2]))}</b><span class="delta" style="color:var(--txt3)">${esc(t[3])}</span></div></div>`).join('')}
    </div>

    <div class="grid g-2">
      <div class="card">
        <div class="card-head"><h4>Anggota keluarga</h4><div class="spacer"></div><span class="badge">${members.length} orang</span></div>
        <div class="grid g-2">${members.map((m) => `<div class="card" style="background:var(--panel2);padding:15px">
          <div class="flex" style="align-items:flex-start">
            ${avatar(m.name, m.color, 'lg')}
            <div class="flex1">
              <b style="font-size:15.5px">${esc(m.name)}</b>
              <div class="muted" style="font-size:12.5px">${esc(m.relation)} · @${esc(m.username)}</div>
              <div class="chips mt" style="gap:6px">
                <span class="badge ${m.role === 'admin' ? 'acc' : ''}">${m.role === 'admin' ? 'Admin' : 'Anggota'}</span>
                ${m.birthdate ? `<span class="badge">🎂 ${dateShort(m.birthdate)}</span>` : ''}
                ${m.blood ? `<span class="badge">🩸 ${esc(m.blood)}</span>` : ''}
              </div>
            </div>
          </div>
          <dl class="kv mt">
            ${m.job ? `<dt>Pekerjaan</dt><dd>${esc(m.job)}</dd>` : ''}
            ${m.school ? `<dt>Sekolah</dt><dd>${esc(m.school)}</dd>` : ''}
            ${m.phone ? `<dt>Telepon</dt><dd>${esc(m.phone)}</dd>` : ''}
            ${m.email ? `<dt>Email</dt><dd>${esc(m.email)}</dd>` : ''}
            <dt>Pengeluaran 30 hr</dt><dd class="expense-txt">${money(m.spend_30d, true)}</dd>
          </dl>
          ${m.about ? `<p class="muted mt" style="font-size:12.5px">${esc(m.about)}</p>` : ''}
          <div class="flex wrap mt">
            <button class="btn btn-sm" data-detail="${m.id}">Detail</button>
            ${isAdmin ? `<button class="btn btn-sm" data-editm="${m.id}">Ubah</button>` : ''}
            ${isAdmin && m.id !== App.user.id ? `<button class="btn btn-sm" data-reset="${m.id}">Reset sandi</button>` : ''}
            ${isAdmin && m.id !== App.user.id ? `<button class="btn btn-sm btn-danger" data-off="${m.id}">Nonaktifkan</button>` : ''}
            ${m.id === App.user.id ? '<span class="badge ok">Ini Anda</span>' : ''}
          </div></div>`).join('')}</div>
      </div>

      <div class="flex col" style="gap:16px">
        <div class="card">
          <div class="card-head"><h4>Profil keluarga</h4></div>
          <dl class="kv">
            <dt>Nama keluarga</dt><dd>${esc(family.name)}</dd>
            <dt>Alamat</dt><dd>${esc(family.address || '-')} ${esc(family.city || '')}</dd>
            <dt>Telepon</dt><dd>${esc(family.phone || '-')}</dd>
            <dt>Email</dt><dd>${esc(family.email || '-')}</dd>
            <dt>Motto</dt><dd>${esc(family.motto || '-')}</dd>
            <dt>Bersejak</dt><dd>${family.founded ? dateShort(family.founded) : '-'}</dd>
            <dt>Zona waktu</dt><dd>${esc(family.timezone)}</dd>
            <dt>Mata uang</dt><dd>${esc(family.currency)}</dd>
          </dl>
        </div>

        ${isAdmin ? `<div class="card">
          <div class="card-head"><h4>Kode undangan anggota</h4><div class="spacer"></div><button class="btn btn-sm btn-primary" id="new-invite">＋ Buat</button></div>
          <div class="note mb">Halaman ini hanya bisa diakses anggota. Anggota baru butuh kode undangan yang Anda buat di sini.</div>
          ${invites.length ? `<div class="table-wrap"><table><thead><tr><th>Kode</th><th>Dipakai</th><th>Berlaku</th><th></th></tr></thead><tbody>
            ${invites.map((i) => `<tr><td><b class="mono">${esc(i.code)}</b>${i.note ? `<div class="muted" style="font-size:11.5px">${esc(i.note)}</div>` : ''}</td>
              <td>${i.uses}/${i.max_uses}</td>
              <td>${i.expires_at ? dateShort(i.expires_at) : '-'}</td>
              <td class="row-actions"><button class="btn btn-xs" data-copy="${esc(i.code)}">Salin</button>
              <button class="btn btn-xs btn-danger" data-delinv="${esc(i.code)}">Cabut</button></td></tr>`).join('')}
          </tbody></table></div>` : '<div class="muted">Belum ada kode undangan.</div>'}
        </div>` : ''}
      </div>
    </div>`;

    const editFamily = ctx.root.querySelector('#edit-family');
    if (editFamily) editFamily.onclick = async () => {
      const v = await formModal({
        title: 'Ubah profil keluarga',
        fields: [
          { name: 'name', label: 'Nama keluarga', value: family.name, required: true },
          { name: 'address', label: 'Alamat', value: family.address },
          { name: 'city', label: 'Kota', value: family.city },
          { name: 'phone', label: 'Telepon', value: family.phone },
          { name: 'email', label: 'Email', value: family.email, type: 'email' },
          { name: 'motto', label: 'Motto keluarga', value: family.motto },
          { name: 'founded', label: 'Berdiri sejak', value: family.founded, type: 'date' },
        ],
      });
      if (!v) return;
      await API.put('/api/family', v); toast('Profil keluarga disimpan', 'ok'); App.reload(); App.bootFamily();
    };

    const memberForm = async (m) => {
      const v = await formModal({
        title: m ? 'Ubah data anggota' : 'Tambah anggota keluarga', wide: true,
        fields: [
          { name: 'name', label: 'Nama lengkap', value: m && m.name, required: true },
          { name: 'username', label: 'Username login', value: m && m.username, required: !m, attrs: m ? 'disabled' : '' },
          { name: 'relation', label: 'Status di keluarga', type: 'select', value: m && m.relation, options: ['Ayah', 'Ibu', 'Anak', 'Kakek', 'Nenek', 'Cucu', 'Saudara', 'Asisten Rumah', 'Anggota'] },
          { name: 'role', label: 'Peran akses', type: 'select', value: m && m.role, options: [['member', 'Anggota (input keuangan, galeri, IoT)'], ['admin', 'Admin (kelola semua)']] },
          { name: 'gender', label: 'Jenis kelamin', type: 'select', value: m && m.gender, options: [['', '-'], ['L', 'Laki-laki'], ['P', 'Perempuan']] },
          { name: 'birthdate', label: 'Tanggal lahir', type: 'date', value: m && m.birthdate },
          { name: 'phone', label: 'Telepon/WA', value: m && m.phone },
          { name: 'email', label: 'Email', value: m && m.email },
          { name: 'job', label: 'Pekerjaan', value: m && m.job },
          { name: 'school', label: 'Sekolah', value: m && m.school },
          { name: 'blood', label: 'Golongan darah', type: 'select', value: m && m.blood, options: ['', 'A', 'B', 'AB', 'O'] },
          { name: 'color', label: 'Warna identitas', type: 'color', value: (m && m.color) || '#6366f1' },
          { name: 'about', label: 'Catatan / hobi', type: 'textarea', value: m && m.about },
          ...(!m ? [{ name: 'password', label: 'Password awal', value: 'keluarga123' }] : []),
        ],
      });
      if (!v) return;
      if (m) { await API.put('/api/members/' + m.id, v); toast('Data anggota diperbarui', 'ok'); }
      else { const r = await API.post('/api/members', v); toast('Anggota ditambahkan. Password awal: ' + r.tempPassword, 'ok', 6000); }
      App.reload();
    };
    const addBtn = ctx.root.querySelector('#add-member');
    if (addBtn) addBtn.onclick = () => memberForm(null);

    ctx.root.querySelectorAll('[data-editm]').forEach((b) => b.onclick = async () => {
      const { member } = await API.get('/api/members/' + b.dataset.editm); memberForm(member);
    });
    ctx.root.querySelectorAll('[data-detail]').forEach((b) => b.onclick = async () => {
      const { member, totals, assets, chores } = await API.get('/api/members/' + b.dataset.detail);
      modal({
        title: member.name, subtitle: member.relation + (member.role === 'admin' ? ' · Admin' : ''), wide: true,
        body: `<div class="flex" style="gap:14px;align-items:flex-start">${avatar(member.name, member.color, 'lg')}
          <div class="flex1"><dl class="kv">
            <dt>Username</dt><dd>@${esc(member.username)}</dd>
            ${member.birthdate ? `<dt>Tanggal lahir</dt><dd>${dateShort(member.birthdate)}</dd>` : ''}
            ${member.phone ? `<dt>Telepon</dt><dd>${esc(member.phone)}</dd>` : ''}
            ${member.email ? `<dt>Email</dt><dd>${esc(member.email)}</dd>` : ''}
            ${member.job ? `<dt>Pekerjaan</dt><dd>${esc(member.job)}</dd>` : ''}
            ${member.school ? `<dt>Sekolah</dt><dd>${esc(member.school)}</dd>` : ''}
            <dt>Total pemasukan dicatat</dt><dd class="income-txt">${money(totals.income || 0)}</dd>
            <dt>Total pengeluaran dicatat</dt><dd class="expense-txt">${money(totals.expense || 0)}</dd>
            <dt>Terakhir masuk</dt><dd>${member.last_login ? rel(member.last_login) : 'belum pernah'}</dd>
          </dl>${member.about ? `<div class="note mt">${esc(member.about)}</div>` : ''}</div></div>
          <div class="grid g-2 mt">
            <div><div class="card-head"><h4 style="font-size:14px">Aset atas nama (${assets.length})</h4></div>
              ${assets.map((a) => `<div class="list-item"><div class="li-body"><div class="li-title">${esc(a.name)}</div><div class="li-sub">${esc(a.category)} · ${esc(a.location)}</div></div><div class="li-right">${money(a.current_value || a.price, true)}</div></div>`).join('') || '<div class="muted">Tidak ada</div>'}</div>
            <div><div class="card-head"><h4 style="font-size:14px">Tugas (${chores.length})</h4></div>
              ${chores.map((c) => `<div class="list-item"><div class="li-body"><div class="li-title">${esc(c.title)}</div><div class="li-sub">${dateShort(c.due_date)}</div></div><div class="li-right"><span class="badge ${c.status === 'done' ? 'ok' : ''}">${c.status === 'done' ? 'selesai' : 'aktif'}</span></div></div>`).join('') || '<div class="muted">Tidak ada</div>'}</div>
          </div>`,
        footer: `<button class="btn" data-close>Tutup</button>`,
      });
    });
    ctx.root.querySelectorAll('[data-reset]').forEach((b) => b.onclick = async () => {
      const v = await formModal({ title: 'Reset password anggota', fields: [{ name: 'password', label: 'Password sementara', value: 'keluarga123', required: true }] });
      if (!v) return;
      const r = await API.post('/api/members/' + b.dataset.reset + '/reset-password', v);
      toast('Password direset. Sampaikan ke anggota: ' + r.tempPassword, 'ok', 6000);
    });
    ctx.root.querySelectorAll('[data-off]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Nonaktifkan anggota ini? Ia tidak bisa lagi masuk, tapi datanya tetap tersimpan.', { danger: true, yesText: 'Nonaktifkan' })) {
        await API.del('/api/members/' + b.dataset.off); toast('Anggota dinonaktifkan', 'ok'); App.reload();
      }
    });
    ctx.root.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => { navigator.clipboard.writeText(b.dataset.copy); toast('Kode disalin: ' + b.dataset.copy, 'ok'); });
    ctx.root.querySelectorAll('[data-delinv]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Cabut kode ' + b.dataset.delinv + '?', { danger: true })) { await API.del('/api/invites/' + b.dataset.delinv); App.reload(); }
    });
    const ni = ctx.root.querySelector('#new-invite');
    if (ni) ni.onclick = async () => {
      const v = await formModal({ title: 'Buat kode undangan', fields: [
        { name: 'code', label: 'Kode (kosongkan = otomatis)', placeholder: 'mis. WIJAYA-2026' },
        { name: 'maxUses', label: 'Berapa kali bisa dipakai', type: 'number', value: 1, min: 1 },
        { name: 'days', label: 'Berlaku (hari)', type: 'number', value: 7, min: 1 },
        { name: 'note', label: 'Catatan', placeholder: 'mis. untuk sepupu Rani' },
      ] });
      if (!v) return;
      const r = await API.post('/api/invites', v);
      toast('Kode dibuat: ' + r.invite.code, 'ok', 6000); App.reload();
    };
  };

  /* ================================ KEUANGAN =============================== */
  Views.txForm = async (prefill) => {
    const meta = App.meta;
    const p = prefill || {};
    const v = await formModal({
      title: p.id ? 'Ubah transaksi' : 'Catat transaksi keluarga',
      fields: [
        { name: 'type', label: 'Jenis', type: 'select', value: p.type || 'expense', options: [['expense', 'Pengeluaran'], ['income', 'Pemasukan']] },
        { name: 'amount', label: 'Nominal (Rp)', type: 'number', value: p.amount || '', min: 0, required: true, placeholder: 'mis. 125000' },
        { name: 'category', label: 'Kategori', type: 'select', value: p.category || '', options: [].concat(
          meta.categories.expense.map((c) => [c, c]), meta.categories.income.map((c) => [c, '(pemasukan) ' + c])) },
        { name: 'description', label: 'Keterangan', value: p.description || '', placeholder: 'mis. Belanja sayur mingguan' },
        { name: 'date', label: 'Tanggal', type: 'date', value: p.date || UI.isoDate(), required: true },
        { name: 'memberId', label: 'Untuk/dari anggota', type: 'select', value: p.member_id || App.user.id, options: meta.members.map((m) => [m.id, `${m.name} (${m.relation})`]) },
        { name: 'method', label: 'Metode', type: 'select', value: p.method || 'Tunai', options: meta.categories.method },
      ],
      validate: (x) => (!x.amount || Number(x.amount) <= 0 ? 'Nominal harus lebih dari 0' : ''),
    });
    if (!v) return;
    if (p.id) await API.put('/api/transactions/' + p.id, v);
    else await API.post('/api/transactions', v);
    toast(p.id ? 'Transaksi diperbarui' : 'Transaksi dicatat', 'ok');
    if (App.state.view === 'keuangan' || App.state.view === 'dashboard') App.reload();
  };

  Views.keuangan = async (ctx) => {
    load(ctx.root);
    const st = ctx.state || (ctx.state = {});
    if (!st.month) { const d = new Date(); st.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
    st.type = st.type || 'all'; st.member = st.member || 'all'; st.q = st.q || '';

    const [sum, tx, meta] = await Promise.all([
      API.get('/api/finance/summary?months=6&month=' + st.month),
      API.get(`/api/transactions?month=${st.month}${st.type !== 'all' ? '&type=' + st.type : ''}${st.member !== 'all' ? '&member=' + st.member : ''}${st.q ? '&q=' + encodeURIComponent(st.q) : ''}&limit=200`),
      App.metaReady,
    ]);
    const months = [];
    for (let i = 11; i >= 0; i--) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`); }

    ctx.root.innerHTML = `
    <div class="page-head">
      <div><h3>Keuangan Keluarga</h3><p>Semua anggota bisa mencatat pemasukan &amp; pengeluaran</p></div>
      <div class="spacer"></div>
      <select id="f-month">${months.map((m) => `<option value="${m}" ${m === st.month ? 'selected' : ''}>${monthLabel(m)}</option>`).join('')}</select>
      <input id="f-q" placeholder="Cari keterangan…" value="${esc(st.q)}" style="width:170px"/>
      <select id="f-member"><option value="all">Semua anggota</option>${meta.members.map((m) => `<option value="${m.id}" ${String(st.member) === String(m.id) ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <button class="btn btn-primary" id="add-tx">＋ Catat Transaksi</button>
    </div>

    <div class="grid g-4 mb">
      <div class="card stat"><div class="stat-ico ok">${icon('walletIn', 21)}</div><div class="stat-body"><small>Pemasukan ${monthLabel(sum.month)}</small><b>${money(sum.totals.month.income)}</b><span class="delta">YTD ${money(sum.totals.ytd.income, true)}</span></div></div>
      <div class="card stat"><div class="stat-ico bad">${icon('wallet', 21)}</div><div class="stat-body"><small>Pengeluaran ${monthLabel(sum.month)}</small><b>${money(sum.totals.month.expense)}</b><span class="delta down">30 hari: ${money(sum.totals.last30.expense, true)}</span></div></div>
      <div class="card stat"><div class="stat-ico info">${icon('chart', 21)}</div><div class="stat-body"><small>Saldo bulan ini</small><b class="${sum.totals.month.balance >= 0 ? 'income-txt' : 'expense-txt'}">${money(sum.totals.month.balance)}</b><span class="delta">Tabungan YTD ${sum.totals.savingsRate}%</span></div></div>
      <div class="card stat"><div class="stat-ico warn">${icon('filter', 21)}</div><div class="stat-body"><small>Transaksi tercatat</small><b>${tx.total}</b><span class="delta" style="color:var(--txt3)">${sum.transactionsCount || ''} filter ${st.type !== 'all' ? st.type : 'semua jenis'}</span></div></div>
    </div>

    <div class="grid g-side mb">
      <div class="card"><div class="card-head"><h4>Pemasukan vs pengeluaran</h4><div class="spacer"></div><span class="sub">6 bulan terakhir</span></div>
        ${bars(sum.trend.map((t) => ({ label: monthLabel(t.ym), income: t.income, expense: t.expense })), { height: 200 })}</div>
      <div class="card"><div class="card-head"><h4>Komposisi pengeluaran</h4></div>
        ${donut(sum.expenseByCategory.map((c, i) => ({ label: c.category, value: c.total, color: PALETTE[i % PALETTE.length] })),
          { centerTop: money(sum.totals.month.expense, true), centerBottom: monthLabel(sum.month) })}
        <div class="note mt" style="font-size:12.5px"><b>Pemasukan terbesar:</b> ${(sum.incomeByCategory[0] || {}).category || '-'} ${sum.incomeByCategory[0] ? money(sum.incomeByCategory[0].total, true) : ''}</div>
      </div>
    </div>

    <div class="grid g-side mb">
      <div class="card">
        <div class="card-head"><h4>Rincian transaksi</h4><div class="spacer"></div>
          <div class="chips">${['all', 'expense', 'income'].map((t) => `<button class="chip ${st.type === t ? 'active' : ''}" data-type="${t}">${t === 'all' ? 'Semua' : t === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</button>`).join('')}</div></div>
        <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th>Anggota</th><th>Metode</th><th class="num">Nominal</th><th></th></tr></thead>
        <tbody>${tx.transactions.map((t) => `<tr>
          <td class="nowrap">${dateShort(t.tx_date)}</td>
          <td><b>${esc(t.description)}</b>${t.created_by && t.created_by !== t.member_id ? `<div class="muted" style="font-size:11.5px">dicatat ${esc(t.creator_name || '')}</div>` : ''}</td>
          <td><span class="badge">${esc(t.category)}</span></td>
          <td class="nowrap">${t.member_name ? `<span class="flex" style="gap:6px">${avatar(t.member_name, t.member_color, 'sm')}${esc(t.member_name)}</span>` : '-'}</td>
          <td class="muted">${esc(t.method)}</td>
          <td class="num ${t.type === 'income' ? 'income-txt' : 'expense-txt'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</td>
          <td class="row-actions">
            ${(App.isAdmin || t.created_by === App.user.id) ? `<button class="btn btn-xs" data-edit='${JSON.stringify({ id: t.id, type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.tx_date, member_id: t.member_id, method: t.method }).replace(/'/g, '&#39;')}'>✎</button>
            <button class="btn btn-xs btn-danger" data-del="${t.id}">🗑</button>` : '<span class="muted" style="font-size:11px">terkunci</span>'}
          </td></tr>`).join('') || '<tr><td colspan="7"><div class="empty"><div class="e-ico">💸</div><b>Belum ada transaksi</b>Klik “Catat Transaksi” untuk mulai.</div></td></tr>'}</tbody></table></div>
      </div>

      <div class="flex col" style="gap:16px">
        <div class="card"><div class="card-head"><h4>Anggaran bulanan</h4>${App.isAdmin ? '<div class="spacer"></div><button class="btn btn-xs" id="edit-budget">Atur</button>' : ''}</div>
          ${sum.budgets.map((b) => `<div style="margin-bottom:13px">
            <div class="flex" style="gap:8px;margin-bottom:5px"><b style="font-size:13px" class="flex1">${esc(b.category)}</b>
              <span class="muted" style="font-size:12px">${money(b.used, true)} / ${money(b.monthly_limit, true)}</span>
              <span class="badge ${b.pct >= 100 ? 'bad' : b.pct >= 80 ? 'warn' : 'ok'}">${b.pct}%</span></div>
            ${progressBar(b.pct, b.pct >= 100 ? 'bad' : b.pct >= 80 ? 'warn' : 'ok')}</div>`).join('') || '<div class="muted">Belum ada anggaran.</div>'}
        </div>
        <div class="card"><div class="card-head"><h4>Pengeluaran per anggota</h4></div>
          ${sum.byMember.map((m) => `<div class="list-item">${avatar(m.name, m.color, 'sm')}
            <div class="li-body"><div class="li-title">${esc(m.name)}</div><div class="li-sub">${m.n} transaksi</div></div>
            <div class="li-right expense-txt">${money(m.total, true)}</div></div>`).join('')}</div>
        <div class="card"><div class="card-head"><h4>Pengeluaran terbesar</h4></div>
          ${sum.topExpense.map((t) => `<div class="list-item"><div class="li-body"><div class="li-title">${esc(t.description)}</div>
            <div class="li-sub">${esc(t.category)} · ${dateShort(t.tx_date)}</div></div><div class="li-right expense-txt">${money(t.amount, true)}</div></div>`).join('') || '<div class="muted">-</div>'}</div>
      </div>
    </div>`;

    ctx.root.querySelector('#add-tx').onclick = () => Views.txForm();
    ctx.root.querySelector('#f-month').onchange = (e) => { st.month = e.target.value; App.reload(); };
    ctx.root.querySelector('#f-member').onchange = (e) => { st.member = e.target.value; App.reload(); };
    const q = ctx.root.querySelector('#f-q');
    q.oninput = () => { clearTimeout(q._t); q._t = setTimeout(() => { st.q = q.value; App.reload(); }, 500); };
    ctx.root.querySelectorAll('[data-type]').forEach((b) => b.onclick = () => { st.type = b.dataset.type; App.reload(); });
    ctx.root.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => Views.txForm(JSON.parse(b.dataset.edit)));
    ctx.root.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
      if (await confirmBox('Hapus transaksi ini?', { danger: true, yesText: 'Hapus' })) { await API.del('/api/transactions/' + b.dataset.del); toast('Transaksi dihapus', 'ok'); App.reload(); }
    });
    const eb = ctx.root.querySelector('#edit-budget');
    if (eb) eb.onclick = async () => {
      const v = await formModal({ title: 'Atur anggaran kategori', fields: [
        { name: 'category', label: 'Kategori pengeluaran', type: 'select', options: meta.categories.expense },
        { name: 'monthlyLimit', label: 'Batas per bulan (Rp)', type: 'number', min: 0, required: true, placeholder: 'mis. 2000000' }] });
      if (!v) return;
      await API.post('/api/budgets', v); toast('Anggaran disimpan', 'ok'); App.reload();
    };
  };
})();
