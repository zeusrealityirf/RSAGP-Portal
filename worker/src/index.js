/** Cloudflare Worker HTTPS API proxy.
 * No business logic or Discord credentials are processed here. Authorization and
 * per-user permissions are checked in Apps Script on EVERY protected request.
 * Configure GAS_WEB_APP_URL (secret) and SITE_ORIGIN (var), never in GitHub Pages JS.
 */
export default {
  async fetch(request, env) {
    const reqOrigin = request.headers.get('Origin') || '';
    const allowedOrigin = String(env.SITE_ORIGIN || '').replace(/\/+$/, '');
    const devOrigin = String(env.LOCAL_DEV_ORIGIN || '').replace(/\/+$/, '');
    const originAllowed = reqOrigin && (reqOrigin === allowedOrigin || (devOrigin && reqOrigin === devOrigin));
    const corsHeaders = {
      'Access-Control-Allow-Origin': originAllowed ? reqOrigin : allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    };
    const json = (data, status) => new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
    });
    const url = new URL(request.url);
    if (url.pathname !== '/api') return json({ ok: false, error: 'Not found.' }, 404);
    if (!originAllowed) return json({ ok: false, error: 'Origin not allowed.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return json({ ok: false, error: 'Method not allowed.' }, 405);
    const len = Number(request.headers.get('Content-Length') || '0');
    if (len > 1800000) return json({ ok: false, error: 'Request too large.' }, 413);
    const body = await request.text();
    if (body.length > 1800000) return json({ ok: false, error: 'Request too large.' }, 413);
    try {
      const parsed = JSON.parse(body);
      if (!parsed || typeof parsed.action !== 'string' || !Array.isArray(parsed.args))
        return json({ ok: false, error: 'Invalid API request.' }, 400);
      const upstream = String(env.GAS_WEB_APP_URL || '');
      if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(upstream))
        return json({ ok: false, error: 'Backend deployment URL is not configured.' }, 503);
      // Apps Script ContentService redirects JSON responses to googleusercontent.com.
      // Following that redirect *on the server* avoids browser CORS limitations.
      const response = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        body,
        redirect: 'follow',
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      const raw = await response.text();
      let data;
      try { data = JSON.parse(raw); }
      catch (_) { return json({ ok: false, error: 'Apps Script did not return JSON. Verify Web App access and deploy a new version.' }, 502); }
      if (!data || typeof data.ok !== 'boolean') return json({ ok: false, error: 'Unexpected backend response.' }, 502);
      return json(data, response.ok ? 200 : 502);
    } catch (e) {
      return json({ ok: false, error: 'Backend unreachable. Check deployment and Worker configuration.' }, 502);
    }
  }
};
