'use strict';

/** Mini router: pattern matching with :params, automatic body parsing. */
const { readJson, fail } = require('./util');

function createRouter() {
  const routes = [];

  function compile(pattern) {
    const keys = [];
    const rx = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\/:([A-Za-z0-9_]+)/g, '/:$1')
      .replace(/:([A-Za-z0-9_]+)/g, (_m, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    return { rx, keys };
  }

  function add(method, pattern, handler, opts = {}) {
    const { rx, keys } = compile(pattern);
    routes.push({ method, rx, keys, handler, opts });
  }

  const api = {
    get: (p, h, o) => add('GET', p, h, o),
    post: (p, h, o) => add('POST', p, h, o),
    put: (p, h, o) => add('PUT', p, h, o),
    delete: (p, h, o) => add('DELETE', p, h, o),
    raw: add,
  };

  async function handle(req, res, url, ctx) {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = r.rx.exec(url.pathname);
      if (!m) continue;
      const params = {};
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      ctx.params = params;
      ctx.query = Object.fromEntries(url.searchParams.entries());
      if (!r.opts.raw && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        try {
          ctx.body = await readJson(req, r.opts.limit);
        } catch (e) {
          return fail(res, e.status || 400, e.message);
        }
      }
      if (r.opts.admin && (!ctx.user || ctx.user.role !== 'admin')) {
        return fail(res, 403, 'Hanya admin keluarga yang boleh melakukan aksi ini');
      }
      await r.handler(req, res, ctx);
      return true;
    }
    return false;
  }

  return Object.assign(api, { handle, routes });
}

module.exports = { createRouter };
