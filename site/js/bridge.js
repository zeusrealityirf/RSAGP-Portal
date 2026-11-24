/* RSAGP GitHub Pages <-> Cloudflare Workers/D1 transport.
   All access control is enforced by the Cloudflare Worker against D1.
   Site and API addresses are public. Never store secrets in this file. */
(function () {
  'use strict';
  function configuredUrl() {
    var u = String((window.RSAGP_CONFIG || {}).apiUrl || '').trim().replace(/\/+$/, '');
    if (!u) throw new Error('Portal API is not configured. Set apiUrl in site/config.js after deploying the backend.');
    if (!/^https:\/\//i.test(u) && !/^http:\/\/localhost(?::\d+)?$/i.test(u)) {
      throw new Error('The API endpoint must use HTTPS (or localhost while testing).');
    }
    return u;
  }
  function bootstrap(section) {
    // OAuth returns a 64-character random session in a URL *fragment*, never query params.
    // Fragments are not transmitted with HTTP requests. Remove it from browser history.
    var token = new URLSearchParams(location.hash.substring(1)).get('rsagp_session') || '';
    if (token) {
      if (!/^[a-f0-9]{64}$/i.test(token)) token = '';
      history.replaceState(null, '', location.pathname + location.search);
    }
    var root = new URL(section === 'cabinet' ? './' : '../', location.href);
    return {
      session: token,
      loginUrl: '',
      error: '',
      cabinetUrl: root.href,
      citizenshipUrl: new URL('citizenship/', root).href,
      careersUrl: new URL('careers/', root).href
    };
  }
  async function call(action, args) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,70}$/.test(action)) throw new Error('Invalid API operation.');
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 90000);
    try {
      var response = await fetch(configuredUrl() + '/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: action, args: args || [] }),
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal
      });
      var data;
      try { data = await response.json(); }
      catch (_) { throw new Error('The backend returned an unreadable response. Check Worker, D1 and Discord deployment settings.'); }
      if (!response.ok || !data || data.ok !== true) {
        throw new Error((data && data.error) || ('Backend request failed (' + response.status + ').'));
      }
      return data.result;
    } catch (error) {
      if (error && error.name === 'AbortError') throw new Error('The request timed out. Try again or check the backend logs.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  window.RSAGPBridge = Object.freeze({ bootstrap: bootstrap, call: call });
})();
