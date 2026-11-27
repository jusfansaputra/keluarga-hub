'use strict';
const { get, run, all, val, getSetting, setSetting, logActivity } = require('../db');
const U = require('../util');
const tuya = require('../tuya');

const DEMO_STATE_KEY = 'iot_demo_state';
const CACHE_KEY = 'tuya_cache';

const DEMO_DEVICES = [
  { id: 'demo-lampu-ruang', name: 'Lampu Ruang Keluarga', category: 'dj', room: 'Ruang Keluarga', online: true,
    codes: [{ code: 'switch_led', value: true }, { code: 'bright_value', value: 780 }, { code: 'temp_value', value: 620 }] },
  { id: 'demo-lampu-kamar', name: 'Lampu Kamar Utama', category: 'dj', room: 'Kamar Utama', online: true,
    codes: [{ code: 'switch_led', value: false }, { code: 'bright_value', value: 400 }] },
  { id: 'demo-ac-kamar', name: 'AC Kamar Utama 1PK', category: 'kt', room: 'Kamar Utama', online: true,
    codes: [{ code: 'switch', value: true }, { code: 'temp_set', value: 24 }, { code: 'mode', value: 'cold' }, { code: 'fan_speed_enum', value: 'mid' }, { code: 'temp_current', value: 27 }] },
  { id: 'demo-ac-anak', name: 'AC Kamar Anak', category: 'kt', room: 'Kamar Anak', online: false,
    codes: [{ code: 'switch', value: false }, { code: 'temp_set', value: 25 }] },
  { id: 'demo-pompa', name: 'Pompa Air Tandon', category: 'zd', room: 'Taman', online: true,
    codes: [{ code: 'switch_1', value: false }, { code: 'countdown_1', value: 0 }] },
  { id: 'demo-pagar', name: 'Lampu Pagar & Gerbang', category: 'dj', room: 'Carport', online: true,
    codes: [{ code: 'switch_led', value: true }] },
  { id: 'demo-sensor-pintu', name: 'Sensor Pintu Depan', category: 'mcs', room: 'Carport', online: true,
    codes: [{ code: 'doorcontact_state', value: false }, { code: 'battery_percentage', value: 82 }] },
  { id: 'demo-th-ruang', name: 'Sensor Suhu & Kelembapan', category: 'wsdcg', room: 'Ruang Keluarga', online: true,
    codes: [{ code: 'temperature', value: 28.4 }, { code: 'humidity', value: 63 }, { code: 'battery_percentage', value: 91 }] },
  { id: 'demo-cctv-power', name: 'Smart Plug DVR CCTV', category: 'cz', room: 'Ruang Keluarga', online: true,
    codes: [{ code: 'switch', value: true }, { code: 'cur_current', value: 320 }, { code: 'cur_power', value: 71 }] },
  { id: 'demo-tirai', name: 'Tirai Ruang Keluarga', category: 'cl', room: 'Ruang Keluarga', online: true,
    codes: [{ code: 'control', value: 'stop' }, { code: 'position', value: 40 }, { code: 'battery', value: 76 }] },
];

const DEMO_SCENES = [
  { id: 'demo-scene-malam', name: 'Mode Malam', desc: 'Matikan lampu luar, kunci sensor, AC 26°C' },
  { id: 'demo-scene-pergi', name: 'Mode Pergi', desc: 'Semua lampu & AC mati, kamera aktif penuh' },
  { id: 'demo-scene-nonton', name: 'Mode Nonton', desc: 'Lampu ruang 20%, tirai tertutup' },
];

function demoState() {
  const st = getSetting(DEMO_STATE_KEY, null);
  if (st && typeof st === 'object') return st;
  const initial = { devices: {}, scenesTriggered: {} };
  DEMO_DEVICES.forEach((d) => {
    initial.devices[d.id] = Object.fromEntries(d.codes.map((c) => [c.code, c.value]));
  });
  setSetting(DEMO_STATE_KEY, initial);
  return initial;
}

function demoDevices() {
  const st = demoState();
  return DEMO_DEVICES.map((d) => Object.assign({}, d, {
    status: Object.entries(st.devices[d.id] || {}).map(([code, value]) => ({ code, value })),
    demo: true,
  }));
}

function demoControl(deviceId, commands) {
  const st = demoState();
  if (!st.devices[deviceId]) return { ok: false, error: 'Perangkat demo tidak dikenal' };
  let online = (DEMO_DEVICES.find((d) => d.id === deviceId) || {}).online;
  if (!online) return { ok: false, error: 'Perangkat sedang offline' };
  commands.forEach((c) => {
    if (c && c.code !== undefined) {
      st.devices[deviceId][c.code] = c.value;
      if (['temp_current'].includes(c.code)) delete st.devices[deviceId][c.code];
    }
  });
  if (deviceId === 'demo-ac-kamar' && st.devices[deviceId].switch) st.devices[deviceId].temp_current = Math.round((st.devices[deviceId].temp_set + 2 + Math.random()) * 10) / 10;
  setSetting(DEMO_STATE_KEY, st);
  return { ok: true };
}

async function mapAsync(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

async function syncFromTuya() {
  const c = tuya.cfg();
  const devices = await tuya.listDevices(c.uid);
  const enriched = await mapAsync(devices, 5, async (d) => {
    let status = [];
    try { status = await tuya.deviceStatus(d.id); } catch (e) { status = []; }
    return {
      id: d.id, name: d.name, category: d.category, online: !!d.online,
      icon_url: d.icon_url || '', product_name: d.product_name || '',
      local_key_hidden: true, status, source: 'tuya',
    };
  });
  const scenes = await tuya.listScenes(c.homeId).catch(() => []);
  const payload = { devices: enriched, scenes, at: Date.now() };
  tuya.setCache(payload);
  return payload;
}

function register(router) {
  router.get('/api/iot', async (req, res, ctx) => {
    const c = tuya.cfg();
    const configured = tuya.isConfigured() && c.enabled !== false;
    const cache = tuya.getCache();
    const fresh = ctx.query.refresh === '1';
    let devices = [];
    let scenes = [];
    let demo = true;
    let error = '';

    if (configured && c.uid) {
      try {
        const data = fresh || !cache || Date.now() - cache.at > (c.devicesRefresh || 30) * 60000
          ? await syncFromTuya() : cache;
        devices = data.devices || [];
        scenes = data.scenes || [];
        demo = false;
      } catch (e) {
        error = e.message;
        if (cache && cache.devices) { devices = cache.devices; scenes = cache.scenes || []; demo = false; }
        else if (c.demoMode !== false) { devices = demoDevices(); scenes = DEMO_SCENES.map((s) => Object.assign({}, s, { demo: true })); }
      }
    } else if (c.demoMode !== false) {
      devices = demoDevices();
      scenes = DEMO_SCENES.map((s) => Object.assign({}, s, { demo: true }));
    }

    const rooms = all('SELECT * FROM rooms ORDER BY sort, id');
    U.ok(res, {
      demo, error, configured,
      config: { endpoint: c.endpoint, accessId: c.accessId ? c.accessId.slice(0, 4) + '••••' + c.accessId.slice(-3) : '', uid: c.uid || '', demoMode: c.demoMode !== false, enabled: c.enabled !== false, appUsername: c.appUsername || '' },
      devices, scenes, rooms,
      syncedAt: cache ? cache.at : null,
      serverTime: U.now(),
    });
  });

  router.post('/api/iot/config', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin yang dapat mengubah konfigurasi Smart Home');
    const b = ctx.body || {};
    const cur = getSetting('tuya', {}) || {};
    const next = Object.assign({}, cur, {
      endpoint: U.str(b.endpoint ?? cur.endpoint, 120).replace(/\/$/, ''),
      accessId: U.str(b.accessId ?? cur.accessId, 120).trim(),
      accessSecret: b.accessSecret === undefined || b.accessSecret === '' ? (cur.accessSecret || '') : U.str(b.accessSecret, 200),
      uid: U.str(b.uid ?? cur.uid, 80).trim(),
      homeId: U.str(b.homeId ?? cur.homeId, 80).trim(),
      appUsername: U.str(b.appUsername ?? cur.appUsername, 120),
      countryCode: U.str(b.countryCode ?? cur.countryCode ?? '62', 6),
      devicesRefresh: Math.max(1, U.toInt(b.devicesRefresh, cur.devicesRefresh || 30)),
      enabled: b.enabled === undefined ? cur.enabled : !!b.enabled,
      demoMode: b.demoMode === undefined ? (cur.demoMode !== false) : !!b.demoMode,
    });
    setSetting('tuya', next);
    logActivity(ctx.user.id, 'update', 'iot', 'Konfigurasi Tuya disimpan');
    U.ok(res, { saved: true, config: { endpoint: next.endpoint, accessId: next.accessId ? '****' : '', uid: next.uid, enabled: next.enabled } });
  });

  router.post('/api/iot/test', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin');
    try {
      const token = await tuya.getToken(true);
      U.ok(res, { ok: true, tokenPreview: token.slice(0, 6) + '••••' });
    } catch (e) {
      U.ok(res, { ok: false, error: e.message });
    }
  });

  router.post('/api/iot/link', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin');
    const b = ctx.body || {};
    try {
      const result = await tuya.linkAppAccount({
        username: U.str(b.username || ''),
        countryCode: U.str(b.countryCode || '62', 6),
        appSchema: U.str(b.appSchema || 'smartlife', 20),
      });
      U.ok(res, { ok: true, result });
    } catch (e) {
      U.ok(res, { ok: false, error: e.message });
    }
  });

  router.post('/api/iot/sync', async (req, res, ctx) => {
    const c = tuya.cfg();
    if (!tuya.isConfigured() || c.enabled === false) {
      return U.ok(res, { demo: true, devices: demoDevices(), scenes: DEMO_SCENES, message: 'Mode demo aktif — Tuya belum dikonfigurasi.' });
    }
    try {
      const data = await syncFromTuya();
      logActivity(ctx.user.id, 'update', 'iot', `Sinkron ${data.devices.length} perangkat dari Tuya`);
      U.ok(res, { demo: false, devices: data.devices, scenes: data.scenes, at: data.at });
    } catch (e) {
      U.ok(res, { ok: false, demo: true, error: e.message, devices: demoDevices(), scenes: DEMO_SCENES });
    }
  });

  router.get('/api/iot/devices/:id/status', async (req, res, ctx) => {
    const c = tuya.cfg();
    const id = ctx.params.id;
    if (!tuya.isConfigured() || c.enabled === false || id.startsWith('demo-')) {
      const d = demoDevices().find((x) => x.id === id);
      return U.ok(res, { demo: true, status: d ? d.status : [] });
    }
    try {
      const status = await tuya.deviceStatus(id);
      U.ok(res, { demo: false, status });
    } catch (e) { U.fail(res, 502, e.message); }
  });

  router.get('/api/iot/devices/:id/functions', async (req, res, ctx) => {
    const id = ctx.params.id;
    if (id.startsWith('demo-')) {
      const d = DEMO_DEVICES.find((x) => x.id === id);
      return U.ok(res, { demo: true, functions: (d ? d.codes : []).map((c) => ({ code: c.code, type: typeof c.value === 'boolean' ? 'Boolean' : 'Integer', values: '' })) });
    }
    try {
      U.ok(res, { demo: false, functions: await tuya.deviceFunctions(id), detail: await tuya.deviceDetail(id) });
    } catch (e) { U.fail(res, 502, e.message); }
  });

  router.post('/api/iot/devices/:id/command', async (req, res, ctx) => {
    const id = ctx.params.id;
    const b = ctx.body || {};
    const commands = Array.isArray(b.commands) && b.commands.length ? b.commands : [{ code: b.code, value: b.value }];
    const clean = commands.filter((c) => c && typeof c.code === 'string').map((c) => ({ code: c.code.slice(0, 40), value: c.value }));
    if (!clean.length) return U.fail(res, 400, 'Perintah tidak valid');
    logActivity(ctx.user.id, 'update', 'iot', `${ctx.user.name} mengirim perintah ${clean.map((c) => c.code).join(',')} ke ${id}`);

    if (id.startsWith('demo-') || !tuya.isConfigured() || tuya.cfg().enabled === false) {
      const r = demoControl(id, clean);
      if (!r.ok) return U.fail(res, 409, r.error);
      const d = demoDevices().find((x) => x.id === id);
      return U.ok(res, { demo: true, device: d || null });
    }
    try {
      const result = await tuya.sendCommands(id, clean);
      const status = await tuya.deviceStatus(id).catch(() => []);
      U.ok(res, { demo: false, result, status });
    } catch (e) { U.fail(res, 502, e.message); }
  });

  router.post('/api/iot/scenes/:id/trigger', async (req, res, ctx) => {
    const id = ctx.params.id;
    logActivity(ctx.user.id, 'update', 'iot', `Menjalankan skenario ${id}`);
    if (id.startsWith('demo-') || !tuya.isConfigured() || tuya.cfg().enabled === false) {
      const st = demoState();
      if (id === 'demo-scene-malam') {
        st.devices['demo-lampu-ruang'].switch_led = false;
        st.devices['demo-pagar'].switch_led = true;
        st.devices['demo-ac-kamar'].temp_set = 26;
      } else if (id === 'demo-scene-pergi') {
        ['demo-lampu-ruang', 'demo-lampu-kamar', 'demo-pagar'].forEach((k) => { st.devices[k].switch_led = false; });
        st.devices['demo-ac-kamar'].switch = false;
        st.devices['demo-ac-anak'].switch = false;
      } else if (id === 'demo-scene-nonton') {
        st.devices['demo-lampu-ruang'].switch_led = true;
        st.devices['demo-lampu-ruang'].bright_value = 200;
        st.devices['demo-tirai'].position = 100;
      }
      st.scenesTriggered[id] = U.now();
      setSetting(DEMO_STATE_KEY, st);
      return U.ok(res, { demo: true, triggered: id });
    }
    try {
      U.ok(res, { demo: false, result: await tuya.triggerScene(id) });
    } catch (e) { U.fail(res, 502, e.message); }
  });

  router.post('/api/iot/custom', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin');
    const b = ctx.body || {};
    try {
      U.ok(res, await tuya.custom(
        ['GET', 'POST', 'PUT', 'DELETE'].includes(String(b.method || '').toUpperCase()) ? String(b.method).toUpperCase() : 'GET',
        U.str(b.path || '', 200),
        b.query && typeof b.query === 'object' ? b.query : undefined,
        b.body && typeof b.body === 'object' ? b.body : undefined));
    } catch (e) { U.ok(res, { ok: false, error: e.message }); }
  });

  /* --------------------------------- rooms -------------------------------- */
  router.post('/api/rooms', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin');
    const name = U.str(ctx.body.name || '').trim();
    if (!name) return U.fail(res, 400, 'Nama ruang wajib diisi');
    run('INSERT INTO rooms (name, icon, sort) VALUES (?,?,?) ON CONFLICT(name) DO NOTHING',
      name, U.str(ctx.body.icon || 'home', 20), U.toInt(ctx.body.sort, val('SELECT COALESCE(MAX(sort),0)+1 AS s FROM rooms') || 1));
    U.ok(res, { rooms: all('SELECT * FROM rooms ORDER BY sort, id') });
  });

  router.delete('/api/rooms/:id', async (req, res, ctx) => {
    if (ctx.user.role !== 'admin') return U.fail(res, 403, 'Hanya admin');
    run('DELETE FROM rooms WHERE id = ?', U.toInt(ctx.params.id));
    U.ok(res, { rooms: all('SELECT * FROM rooms ORDER BY sort, id') });
  });
}

module.exports = { register, demoDevices, DEMO_DEVICES, DEMO_SCENES };
