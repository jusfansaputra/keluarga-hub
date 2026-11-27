'use strict';
/**
 * Proxy kamera. DVR/NVR XMEye umumnya hanya membuka RTSP (tidak bisa diputar
 * langsung di browser) atau HTTP privat yang terkena CORS/mixed-content.
 * Server ini menjembatani tiga mode yang benar-benar bisa dipakai browser:
 *   snapshot -> tarik JPEG berkala dari URL HTTP kamera
 *   mjpeg    -> teruskan stream multipart/x-mixed-replace
 *   hls      -> teruskan .m3u8 (URL segmen ditulis ulang agar ikut lewat proxy)
 *   iframe / go2rtc -> sematkan halaman stream (mis. go2rtc stream.html)
 */
const { ok } = require('./util');

function authHeader(cam) {
  if (!cam.username) return {};
  const token = Buffer.from(`${cam.username}:${cam.password || ''}`).toString('base64');
  return { Authorization: 'Basic ' + token };
}

function fetchCam(url, cam, timeoutMs = 8000, signal) {
  return fetch(url, {
    headers: authHeader(cam),
    signal: signal || AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
}

async function proxySnapshot(res, cam, cacheSec = 2) {
  try {
    const r = await fetchCam(cam.url, cam, 9000);
    if (!r.ok) throw new Error('Kamera merespons HTTP ' + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    res.writeHead(200, {
      'Content-Type': r.headers.get('content-type') || 'image/jpeg',
      'Content-Length': buf.length,
      'Cache-Control': `private, max-age=${cacheSec}`,
    });
    res.end(buf);
  } catch (e) {
    errorImage(res, e.name === 'TimeoutError' || /abort/i.test(e.message) ? 'Waktu habis' : e.message);
  }
}

async function proxyMjpeg(req, res, cam) {
  let upstream;
  try {
    upstream = await fetchCam(cam.url, cam, 10000, AbortSignal.timeout(6 * 3600 * 1000));
  } catch (e) {
    return errorImage(res, 'Tidak dapat terhubung ke stream MJPEG');
  }
  if (!upstream.ok || !upstream.body) {
    return errorImage(res, 'Kamera merespons HTTP ' + upstream.status);
  }
  const boundary = (upstream.headers.get('content-type') || '').match(/boundary=([^;]+)/i);
  res.writeHead(200, {
    'Content-Type': boundary ? upstream.headers.get('content-type') : 'multipart/x-mixed-replace; boundary=--myboundary',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  });
  const reader = upstream.body.getReader();
  const pump = async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.writableEnded) res.write(Buffer.from(value));
      }
    } catch (e) { /* client/kamera menutup koneksi */ }
    finally { try { res.end(); } catch (e) { /* ignore */ } }
  };
  req.on('close', () => { try { reader.cancel(); } catch (e) { /* ignore */ } });
  pump();
}

function absolute(base, ref) {
  try { return new URL(ref, base).toString(); } catch (e) { return ref; }
}

async function proxyPlaylist(req, res, cam, camId, variantStack = 0) {
  let text;
  try {
    const r = await fetchCam(cam.url, cam, 9000);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    text = await r.text();
  } catch (e) {
    res.writeHead(502, { 'Content-Type': 'application/vnd.apple.mpegurl' });
    return res.end('#EXTM3U\n#EXT-X-ENDLIST\n');
  }
  const out = text.split(/\r?\n/).map((line) => {
    if (!line.trim()) return line;
    if (line.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_m, u) => {
        const abs = absolute(cam.url, u);
        return /\.m3u8(\?|$)/i.test(abs) && variantStack < 3
          ? `URI="/api/cameras/${camId}/playlist?depth=${variantStack + 1}&u=${encodeURIComponent(abs)}"`
          : `URI="/api/cameras/${camId}/segment?u=${encodeURIComponent(abs)}"`;
      });
    }
    const abs = absolute(cam.url, line.trim());
    return /\.m3u8(\?|$)/i.test(abs) && variantStack < 3
      ? `/api/cameras/${camId}/playlist?depth=${variantStack + 1}&u=${encodeURIComponent(abs)}`
      : `/api/cameras/${camId}/segment?u=${encodeURIComponent(abs)}`;
  }).join('\n');

  res.writeHead(200, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(out);
}

async function proxyFromUrl(req, res, cam, targetUrl, type) {
  try {
    const r = await fetchCam(targetUrl, cam, 15000, AbortSignal.timeout(6 * 3600 * 1000));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    res.writeHead(r.status, {
      'Content-Type': r.headers.get('content-type') || type,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    });
    const reader = r.body.getReader();
    req.on('close', () => { try { reader.cancel(); } catch (e) { /* ignore */ } });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (res.writableEnded) break;
      res.write(Buffer.from(value));
    }
  } catch (e) {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  try { res.end(); } catch (e) { /* ignore */ }
}

const SVG_ERR = (msg) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#0f172a"/>` +
  `<text x="320" y="170" fill="#f87171" font-family="Segoe UI,Arial" font-size="22" text-anchor="middle">${String(msg).replace(/[<>&]/g, '')}</text>` +
  `<text x="320" y="205" fill="#94a3b8" font-family="Segoe UI,Arial" font-size="15" text-anchor="middle">Sinyal kamera tidak tersedia</text></svg>`);

function errorImage(res, msg) {
  const buf = SVG_ERR(msg);
  res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
  res.end(buf);
}

module.exports = { proxySnapshot, proxyMjpeg, proxyPlaylist, proxyFromUrl, errorImage, fetchCam, ok };
