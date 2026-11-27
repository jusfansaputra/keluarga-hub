/* Klien API browser: token disimpan di localStorage + cookie HttpOnly dari server. */
(function () {
  const TOKEN_KEY = 'fh_token';
  let token = localStorage.getItem(TOKEN_KEY) || '';

  async function req(method, path, body, opts) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try {
      res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new Error('Tidak dapat menghubungi server. Pastikan server Keluarga Hub berjalan.');
    }
    if (res.status === 401 && !(opts && opts.allow401)) {
      token = '';
      localStorage.removeItem(TOKEN_KEY);
      if (window.App && window.App.onUnauthorized) window.App.onUnauthorized();
      throw new Error('Sesi berakhir — silakan masuk kembali');
    }
    let json;
    try { json = await res.json(); } catch (e) { json = { ok: false, error: 'Respons server tidak valid (HTTP ' + res.status + ')' }; }
    if (!res.ok || json.ok === false) {
      throw Object.assign(new Error(json.error || 'HTTP ' + res.status), { status: res.status, data: json });
    }
    return json;
  }

  window.API = {
    get: (p, o) => req('GET', p, undefined, o),
    post: (p, b, o) => req('POST', p, b, o),
    put: (p, b) => req('PUT', p, b),
    del: (p) => req('DELETE', p),
    setToken: (t) => { token = t || ''; if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); },
    getToken: () => token,
  };
})();
