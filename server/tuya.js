'use strict';
/**
 * Tuya IoT Cloud API client (Smart Home PaaS) — dipakai untuk membaca perangkat
 * dari aplikasi Smart Life / Tuya Smart.
 *
 * Alur resmi: buat Cloud Project di platform.tuya.com (Smart Home, Data Center
 * region sesuai), aktifkan API "IoT Core" + "Smart Home Scene Linkage", lalu
 * tautkan akun aplikasi Smart Life Anda (Link App Account) supaya perangkat muncul.
 */
const crypto = require('node:crypto');
const { getSetting, setSetting } = require('./db');

const CACHE_KEY = 'tuya_cache';
let tokenCache = null;

function cfg() {
  return Object.assign({ endpoint: 'https://openapi.tuyaus.com', accessId: '', accessSecret: '', demoMode: true }, getSetting('tuya', {}) || {});
}

function isConfigured() {
  const c = cfg();
  return !!(c.accessId && c.accessSecret && c.endpoint);
}

function sha256(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function buildSign({ method, path, query, body, token, t, nonce }) {
  const c = cfg();
  const contentSha = sha256(body || '');
  let headersStr = 't:' + t;
  if (nonce) headersStr += '\nnonce:' + nonce;
  if (token) headersStr += '\naccess-token:' + token;
  let url = path;
  if (query && Object.keys(query).length) {
    const qs = Object.keys(query).sort()
      .map((k) => `${k}=${encodeURIComponent(query[k])}`).join('&');
    url += '?' + qs;
  }
  const signStr = [method.toUpperCase(), contentSha, headersStr, url].join('\n');
  const sign = crypto.createHmac('sha256', c.accessSecret).update(signStr, 'utf8').digest('hex').toUpperCase();
  const headers = {
    client_id: c.accessId,
    sign,
    t: String(t),
    sign_method: 'HMAC-SHA256',
    'Content-Type': 'application/json',
  };
  if (nonce) headers.nonce = nonce;
  if (token) headers.access_token = token;
  return { headers, fullUrl: c.endpoint.replace(/\/$/, '') + url };
}

async function raw(method, path, { query, body, token, timeoutMs = 12000 } = {}) {
  const t = Date.now();
  const nonce = crypto.randomBytes(8).toString('hex');
  const payload = body ? JSON.stringify(body) : '';
  const { headers, fullUrl } = buildSign({ method, path, query, body: payload, token, t, nonce });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(fullUrl, {
      method,
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : payload,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) { /* non-JSON */ }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function getToken(force = false) {
  if (!isConfigured()) throw new Error('Tuya belum dikonfigurasi (Access ID / Secret kosong).');
  if (!force && tokenCache && tokenCache.expires_at > Date.now() + 60000) return tokenCache.access_token;

  const c = cfg();
  let path;
  let res;
  if (tokenCache && tokenCache.refresh_token) {
    path = `/v1.0/token/${tokenCache.refresh_token}`;
    res = await raw('GET', path, {});
    if (res.json && res.json.success) {
      tokenCache = {
        access_token: res.json.result.access_token,
        refresh_token: res.json.result.refresh_token,
        expires_at: Date.now() + res.json.result.expire_time * 1000,
      };
      return tokenCache.access_token;
    }
  }
  res = await raw('POST', '/v1.0/token', { query: { grant_type: 1 } });
  if (!res.json || !res.json.success) {
    tokenCache = null;
    const msg = res.json ? `${res.json.code || res.status}: ${res.json.msg || res.json.message || 'gagal'}` : `HTTP ${res.status}`;
    throw new Error('Gagal memperoleh access token Tuya — ' + msg);
  }
  tokenCache = {
    access_token: res.json.result.access_token,
    refresh_token: res.json.result.refresh_token,
    expires_at: Date.now() + res.json.result.expire_time * 1000,
  };
  return tokenCache.access_token;
}

async function api(method, path, { query, body } = {}) {
  const token = await getToken();
  const res = await raw(method, path, { query, body, token });
  if (res.json && res.json.code === 1010) {
    const token2 = await getToken(true);
    return raw(method, path, { query, body, token: token2 });
  }
  return res;
}

/** Tautkan akun aplikasi Smart Life / Tuya Smart, kembalikan uid. */
async function linkAppAccount({ username, countryCode = '62', appSchema = 'smartlife' }) {
  const res = await api('POST', '/v1.0/iot-03/authorized/users', {
    body: { username, country_code: countryCode, app_schema: appSchema },
  });
  if (!res.json || !res.json.success) {
    throw new Error(`Link akun gagal — ${res.json ? (res.json.msg || res.json.code) : 'HTTP ' + res.status}`);
  }
  const uid = res.json.result && (res.json.result.uid || res.json.result.user_id);
  if (uid) {
    const cur = cfg();
    setSetting('tuya', Object.assign(cur, { uid, appUsername: username, countryCode }));
  }
  return res.json.result;
}

async function listDevices(uid) {
  const c = cfg();
  const target = uid || c.uid;
  if (!target) throw new Error('UID akun Smart Life belum ditautkan. Buka Smart Home → Hubungkan Akun.');
  const res = await api('GET', `/v1.0/iot-03/users/${encodeURIComponent(target)}/devices`);
  if (!res.json || !res.json.success) {
    throw new Error(`Gagal mengambil daftar perangkat — ${res.json ? (res.json.msg || res.json.code) : 'HTTP ' + res.status}`);
  }
  return res.json.result || [];
}

async function deviceStatus(deviceId) {
  const res = await api('GET', `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/status`);
  return res.json && res.json.success ? (res.json.result || []) : [];
}

async function deviceFunctions(deviceId) {
  const res = await api('GET', `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/functions`);
  return res.json && res.json.success ? (res.json.result || []) : [];
}

async function deviceDetail(deviceId) {
  const res = await api('GET', `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}`);
  return res.json && res.json.success ? res.json.result : null;
}

async function sendCommands(deviceId, commands) {
  const res = await api('POST', `/v1.0/iot-03/devices/${encodeURIComponent(deviceId)}/commands`, {
    body: { commands },
  });
  return res.json || { success: false, msg: 'HTTP ' + res.status };
}

async function listScenes(homeId) {
  const c = cfg();
  const hid = homeId || c.homeId;
  if (!hid) return [];
  const res = await api('GET', `/v1.0/iot-03/homes/${encodeURIComponent(hid)}/scenes`);
  return res.json && res.json.success ? (res.json.result || []) : [];
}

async function listHomes(uid) {
  const c = cfg();
  const target = uid || c.uid;
  if (!target) return [];
  const res = await api('GET', `/v1.0/iot-03/users/${encodeURIComponent(target)}/homes`);
  return res.json && res.json.success ? (res.json.result || []) : [];
}

async function triggerScene(sceneId) {
  const res = await api('POST', `/v1.0/iot-03/scenes/${encodeURIComponent(sceneId)}/trigger`);
  return res.json || { success: false, msg: 'HTTP ' + res.status };
}

/** Panggil endpoint Tuya apa pun — dipakai panel "Uji API" di Pengaturan. */
async function custom(method, path, query, body) {
  const res = await api(method, path, { query, body });
  return { status: res.status, json: res.json, text: (res.text || '').slice(0, 4000) };
}

function setCache(data) { setSetting(CACHE_KEY, Object.assign({ at: Date.now() }, data)); }
function getCache() { return getSetting(CACHE_KEY, null); }

module.exports = {
  cfg, isConfigured, getToken, api, raw, custom,
  linkAppAccount, listDevices, deviceStatus, deviceFunctions, deviceDetail,
  sendCommands, listScenes, listHomes, triggerScene, setCache, getCache,
};
