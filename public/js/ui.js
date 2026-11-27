/* ========================= UI helpers, ikon, chart ========================= */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = (s) => esc(s);

  const PALETTE = ['#6366f1', '#ec4899', '#0ea5e9', '#22c55e', '#f59e0b', '#8b5cf6', '#14b8a6', '#f43f5e', '#84cc16', '#a855f7', '#f97316', '#06b6d4'];

  const ID_MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  function money(n, compact) {
    const v = Number(n || 0);
    if (compact && Math.abs(v) >= 1e9) return 'Rp ' + (v / 1e9).toFixed(v % 1e9 ? 1 : 0) + ' M';
    if (compact && Math.abs(v) >= 1e6) return 'Rp ' + (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + ' jt';
    return 'Rp ' + Math.round(v).toLocaleString('id-ID');
  }
  function num(n) { return Number(n || 0).toLocaleString('id-ID'); }

  function parseDate(s) {
    if (!s) return null;
    const d = new Date(String(s).length <= 10 ? String(s) + 'T00:00:00' : String(s));
    return isNaN(d) ? null : d;
  }
  function dateShort(s) {
    const d = parseDate(s);
    return d ? `${d.getDate()} ${ID_MONTH[d.getMonth()]} ${d.getFullYear()}` : '-';
  }
  function dateTime(s) {
    const d = parseDate(s);
    return d ? `${d.getDate()} ${ID_MONTH[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '-';
  }
  function rel(s) {
    const d = parseDate(s); if (!d) return '-';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'baru saja';
    if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' hari lalu';
    return dateShort(s);
  }
  function monthLabel(ym) {
    const [y, m] = String(ym || '').split('-');
    return m ? `${ID_MONTH[Number(m) - 1]} ${String(y).slice(2)}` : ym;
  }
  function isoDate(d) { const x = d || new Date(); return x.toISOString().slice(0, 10); }

  function initials(name) {
    const p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  function avatar(name, color, cls) {
    return `<div class="avatar ${cls || ''}" style="background:${attr(color || '#6366f1')}">${esc(initials(name))}</div>`;
  }

  /* --------------------------------- ikon -------------------------------- */
  const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICON = {
    home: P('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5"/><path d="M9.5 21v-6h5v6"/>'),
    users: P('<circle cx="9" cy="8" r="3.2"/><path d="M2.8 20c0-3.3 2.8-5.5 6.2-5.5s6.2 2.2 6.2 5.5"/><path d="M16.5 5.6a3 3 0 0 1 0 5.6"/><path d="M18 14.8c2 .7 3.3 2.4 3.3 5.2"/>'),
    wallet: P('<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><circle cx="17.5" cy="14.5" r="1.3"/>'),
    box: P('<path d="M20.5 7.8 12 3.5 3.5 7.8v8.4L12 20.5l8.5-4.3z"/><path d="M3.5 7.8 12 12l8.5-4.2M12 12v8.5"/>'),
    cctv: P('<path d="M2.5 8.5 15 4.2l1.3 4-12.5 4.3z"/><path d="M5.8 12.5v3.2a2 2 0 0 0 2 2h3"/><circle cx="17.8" cy="17.5" r="2.6"/><path d="M17.8 14.9v-2"/><path d="M20 8.6l1.5-.5"/>'),
    plug: P('<path d="M9 2.8v5M15 2.8v5"/><path d="M6.5 7.8h11v3.4a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.7v4.5"/>'),
    image: P('<rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="8.6" cy="10" r="1.6"/><path d="M4 17.5l4.7-4.3 3.3 3 2.7-2.4L20 18"/>'),
    calendar: P('<rect x="3.2" y="5" width="17.6" height="16" rx="3"/><path d="M3.2 10h17.6M8 3v4M16 3v4"/>'),
    cart: P('<circle cx="9.5" cy="19.5" r="1.6"/><circle cx="17.5" cy="19.5" r="1.6"/><path d="M2.5 3.5h2.6l2.6 11.2h10.4l2-7.6H6.4"/>'),
    check: P('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),
    task: P('<rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M8 9.5l1.8 1.8L13 8"/><path d="M8 15.5h8"/>'),
    mega: P('<path d="M3.5 10.5v3a1.5 1.5 0 0 0 1.5 1.5h2.5l5 4V5l-5 4H5a1.5 1.5 0 0 0-1.5 1.5z"/><path d="M16.5 8.8a4.5 4.5 0 0 1 0 6.4M19 6.3a8 8 0 0 1 0 11.4"/>'),
    gear: P('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.6H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
    chart: P('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    plus: P('<path d="M12 5v14M5 12h14"/>'),
    edit: P('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M14.5 5.5 18.5 9.5"/>'),
    trash: P('<path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13"/><path d="M10.5 11v5M13.5 11v5"/>'),
    bell: P('<path d="M6.5 9.5a5.5 5.5 0 1 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z"/><path d="M10 18.5a2.2 2.2 0 0 0 4 0"/>'),
    refresh: P('<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4v5h-5"/>'),
    key: P('<circle cx="8" cy="15" r="4"/><path d="M11 12.5 20 3.5M17 6.5l2.5 2.5M14.5 9 17 11.5"/>'),
    shield: P('<path d="M12 3l7.5 3v6c0 4.5-3.2 7.7-7.5 9.2C7.7 19.7 4.5 16.5 4.5 12V6z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>'),
    link: P('<path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.4 1.4"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.4-1.4"/>'),
    download: P('<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4.5 19.5h15"/>'),
    upload: P('<path d="M12 15.5v-11M7.5 8.5 12 4l4.5 4.5"/><path d="M4.5 19.5h15"/>'),
    play: P('<path d="M7.5 4.8 19 12 7.5 19.2z"/>'),
    eye: P('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
    close: P('<path d="M6 6l12 12M18 6 6 18"/>'),
    gift: P('<rect x="3.5" y="8.5" width="17" height="4"/><path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8.5v12"/><path d="M12 8.5S10.5 3.5 8 4.2 9 8.5 12 8.5zM12 8.5s1.5-5 4-4.3S15 8.5 12 8.5z"/>'),
    activity: P('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
    search: P('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'),
    cloud: P('<path d="M7 18.5h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.8 3.8 0 0 0 1 7.5z"/>'),
    sun: P('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/>'),
    moon: P('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
    walletIn: P('<path d="M12 5v14M7.5 14.5 12 19l4.5-4.5"/>'),
    filter: P('<path d="M3.5 5.5h17l-6.5 7.5v6l-4 2v-8z"/>'),
    camera: P('<path d="M3.5 8.5h3l1.5-2.5h8L17.5 8.5h3v10h-17z"/><circle cx="12" cy="13" r="3.4"/>'),
    info: P('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8v.4"/>'),
    lamp: '💡', ac: '❄️', fan: '🌀', sensor: '🌡️', lock: '🔒', curtain: '🪟', pump: '🚰', socket: '🔌', robot: '🤖',
  };
  function icon(name, size) {
    const i = ICON[name];
    if (!i) return '';
    if (i.startsWith('<svg')) return i.replace('<svg ', `<svg width="${size || 20}" height="${size || 20}" `);
    return `<span style="font-size:${size || 20}px;line-height:1">${i}</span>`;
  }

  /* --------------------------------- toast -------------------------------- */
  function toast(msg, kind, ms) {
    const root = $('#toast-root');
    const t = document.createElement('div');
    t.className = 'toast ' + (kind || '');
    t.innerHTML = `<div class="flex1">${esc(msg)}</div>`;
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; setTimeout(() => t.remove(), 220); }, ms || 3200);
  }

  /* --------------------------------- modal -------------------------------- */
  let openModal = null;
  function modal(opts) {
    closeModal();
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${esc(opts.title || '')}</h3>
        ${opts.subtitle ? `<span class="muted" style="font-size:12px">${esc(opts.subtitle)}</span>` : ''}
        <button class="icon-btn" data-close aria-label="Tutup">${icon('close', 17)}</button></div>
      <div class="modal-body">${opts.body || ''}</div>
      ${opts.footer === null ? '' : `<div class="modal-foot">${opts.footer || ''}</div>`}</div>`;
    $('#modal-root').appendChild(back);
    openModal = back;
    back.addEventListener('click', (e) => {
      if (e.target === back && opts.dismissible !== false) closeModal();
      if (e.target.closest('[data-close]')) closeModal();
    });
    if (opts.onMount) opts.onMount(back, api2);
    const first = back.querySelector('input,select,textarea');
    if (first) setTimeout(() => first.focus(), 60);
    function api2() { return { close: closeModal, root: back }; }
    return { close: closeModal, root: back };
  }
  function closeModal() { if (openModal) { openModal.remove(); openModal = null; } }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeLightbox(); } });

  function confirmBox(message, opts) {
    return new Promise((resolve) => {
      const m = modal({
        title: (opts && opts.title) || 'Konfirmasi',
        body: `<div class="note ${opts && opts.danger ? 'bad' : ''}">${esc(message)}</div>`,
        footer: `<button class="btn" data-no>Batal</button><button class="btn ${opts && opts.danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc((opts && opts.yesText) || 'Ya, lanjutkan')}</button>`,
        onMount(root) {
          root.querySelector('[data-no]').onclick = () => { closeModal(); resolve(false); };
          root.querySelector('[data-yes]').onclick = () => { closeModal(); resolve(true); };
        },
      });
      m.root.addEventListener('click', (e) => { if (e.target === m.root) resolve(false); });
    });
  }

  /** Form modal berbasis spesifikasi field. */
  function formModal(opts) {
    const html = opts.fields.map((f) => fieldHtml(f)).join('');
    return new Promise((resolve) => {
      const m = modal({
        title: opts.title, wide: opts.wide, subtitle: opts.subtitle,
        body: `<form id="fm" class="flex col" style="gap:14px">${html}</form>`,
        footer: `<button class="btn" data-cancel>Batal</button><button class="btn btn-primary" data-save>${esc(opts.saveText || 'Simpan')}</button>`,
        onMount(root) {
          const getValues = () => {
            const out = {};
            opts.fields.forEach((f) => {
              const el = root.querySelector(`[name="${f.name}"]`);
              if (!el) return;
              if (el.type === 'checkbox') out[f.name] = el.checked;
              else if (el.type === 'number') out[f.name] = el.value === '' ? '' : Number(el.value);
              else out[f.name] = el.value;
            });
            return out;
          };
          root.querySelector('[data-cancel]').onclick = () => { closeModal(); resolve(null); };
          const save = () => {
            const v = getValues();
            if (opts.validate) { const err = opts.validate(v); if (err) { toast(err, 'bad'); return; } }
            closeModal(); resolve(v);
          };
          root.querySelector('[data-save]').onclick = save;
          root.querySelector('#fm').onsubmit = (e) => { e.preventDefault(); save(); };
        },
      });
      m.root.addEventListener('click', (e) => { if (e.target === m.root) resolve(null); });
    });
  }

  function fieldHtml(f) {
    const val = f.value === undefined || f.value === null ? '' : f.value;
    const common = `name="${attr(f.name)}" ${f.required ? 'required' : ''} ${f.attrs || ''}`;
    if (f.type === 'select') {
      const opts = (f.options || []).map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return `<option value="${attr(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`;
      }).join('');
      return `<label class="field"><span>${esc(f.label)}</span><select ${common}>${opts}</select></label>`;
    }
    if (f.type === 'textarea') return `<label class="field"><span>${esc(f.label)}</span><textarea ${common} placeholder="${attr(f.placeholder || '')}">${esc(val)}</textarea></label>`;
    if (f.type === 'checkbox') return `<label class="switch"><input type="checkbox" ${common} ${val ? 'checked' : ''}/><span>${esc(f.label)}</span></label>`;
    if (f.type === 'static') return `<div class="note">${f.html || esc(f.label)}</div>`;
    const rowCls = f.half ? '' : '';
    return `<label class="field ${rowCls}"><span>${esc(f.label)}</span>
      <input type="${f.type || 'text'}" ${common} value="${attr(val)}" placeholder="${attr(f.placeholder || '')}" ${f.type === 'number' ? `step="${f.step || 'any'}" min="${f.min === undefined ? '' : f.min}"` : ''}/></label>`;
  }

  /* -------------------------------- lightbox ------------------------------ */
  function lightbox(items, startIndex) {
    let idx = startIndex || 0;
    const root = $('#lightbox-root');
    const draw = () => {
      const it = items[idx];
      if (!it) return closeLightbox();
      const media = it.kind === 'video'
        ? `<video src="${attr(it.url)}" controls autoplay playsinline></video>`
        : `<img src="${attr(it.url)}" alt="${attr(it.caption)}" />`;
      root.innerHTML = `<div class="lightbox">
        ${media}
        <div class="lb-bar">
          <button class="btn btn-sm" data-prev>← Sebelumnya</button>
          <span class="lb-cap">${esc(it.caption || '')} ${it.album ? `· <b>${esc(it.album)}</b>` : ''} · ${idx + 1}/${items.length}</span>
          <button class="btn btn-sm" data-next>Berikutnya →</button>
          <button class="btn btn-sm btn-danger" data-del>Hapus</button>
          <button class="btn btn-sm" data-close>Tutup</button>
        </div></div>`;
      root.querySelector('[data-prev]').onclick = () => { idx = (idx - 1 + items.length) % items.length; draw(); };
      root.querySelector('[data-next]').onclick = () => { idx = (idx + 1) % items.length; draw(); };
      root.querySelector('[data-close]').onclick = closeLightbox;
      root.querySelector('[data-del]').onclick = async () => {
        if (await confirmBox('Hapus file ini dari galeri keluarga?', { danger: true, yesText: 'Hapus' })) {
          if (window.App && window.App.onDeleteMedia) await window.App.onDeleteMedia(it, () => { items.splice(idx, 1); draw(); });
        }
      };
      root.querySelector('.lightbox').addEventListener('click', (e) => { if (e.target.classList.contains('lightbox')) closeLightbox(); });
    };
    draw();
  }
  function closeLightbox() { $('#lightbox-root').innerHTML = ''; }

  /* --------------------------------- chart -------------------------------- */
  function donut(data, opts) {
    const o = Object.assign({ size: 148, thickness: 20 }, opts || {});
    const total = data.reduce((s, d) => s + Number(d.value || 0), 0);
    const r = (o.size - o.thickness) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const segs = total ? data.map((d, i) => {
      const frac = d.value / total;
      const seg = `<circle cx="${o.size / 2}" cy="${o.size / 2}" r="${r}" fill="none" stroke="${d.color || PALETTE[i % PALETTE.length]}"
        stroke-width="${o.thickness}" stroke-dasharray="${(frac * c).toFixed(2)} ${c.toFixed(2)}" stroke-dashoffset="${(-offset * c).toFixed(2)}"
        transform="rotate(-90 ${o.size / 2} ${o.size / 2})" stroke-linecap="butt"/>`;
      offset += frac;
      return seg;
    }).join('') : `<circle cx="${o.size / 2}" cy="${o.size / 2}" r="${r}" fill="none" stroke="var(--line2)" stroke-width="${o.thickness}"/>`;
    return `<div class="donut-wrap">
      <svg width="${o.size}" height="${o.size}" viewBox="0 0 ${o.size} ${o.size}">${segs}
        <text x="50%" y="47%" text-anchor="middle" fill="var(--txt)" font-size="15" font-weight="700">${esc(o.centerTop || '')}</text>
        <text x="50%" y="61%" text-anchor="middle" fill="var(--txt3)" font-size="11">${esc(o.centerBottom || '')}</text></svg>
      <div class="donut-legend">${data.slice(0, o.maxLegend || 7).map((d, i) =>
        `<div><i style="background:${d.color || PALETTE[i % PALETTE.length]}"></i><span>${esc(d.label)}</span><b>${esc(d.text !== undefined ? d.text : money(d.value, true))}</b></div>`).join('')}
      ${!total ? '<div class="muted">Belum ada data</div>' : ''}</div></div>`;
  }

  function bars(rows, opts) {
    const o = Object.assign({ keys: ['income', 'expense'], height: 170 }, opts || {});
    const max = Math.max(1, ...rows.map((r) => Math.max(...o.keys.map((k) => Number(r[k] || 0)))));
    return `<div class="chart-bars" style="height:${o.height}px">${rows.map((r) => `<div class="bar-col">
        <div class="bar-stack">${o.keys.slice().reverse().map((k) => {
          const v = Number(r[k] || 0);
          const h = Math.max(2, Math.round((v / max) * 100));
          return `<i class="${k === 'income' ? 'in' : 'out'}" style="height:${h}%" title="${esc(o.labelFor ? o.labelFor(k) : k)}: ${money(v)}"></i>`;
        }).join('')}</div>
        <small>${esc(r.label || '')}</small></div>`).join('')}</div>
      <div class="legend"><span><i style="background:#22c55e"></i>Pemasukan</span><span><i style="background:#ef4444"></i>Pengeluaran</span></div>`;
  }

  function sparkline(values, color) {
    const v = values.map(Number);
    if (!v.length) return '';
    const max = Math.max(...v), min = Math.min(...v), span = (max - min) || 1;
    const w = 220, h = 44;
    const pts = v.map((x, i) => `${(i / Math.max(1, v.length - 1)) * w},${h - 4 - ((x - min) / span) * (h - 10)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <polyline points="${pts}" fill="none" stroke="${color || 'var(--acc)'}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="0,${h} ${pts} ${w},${h}" fill="${color || 'var(--acc)'}" opacity=".10" stroke="none"/></svg>`;
  }

  function progressBar(pct, kind) {
    const p = Math.max(0, Math.min(100, Number(pct) || 0));
    return `<div class="progress"><i class="${kind || ''}" style="width:${p}%"></i></div>`;
  }

  window.UI = {
    $, $$, esc, attr, money, num, dateShort, dateTime, rel, monthLabel, isoDate, initials, avatar,
    icon, ICON, PALETTE, toast, modal, closeModal, confirmBox, formModal, fieldHtml,
    lightbox, closeLightbox, donut, bars, sparkline, progressBar, ID_MONTH,
  };
})();
