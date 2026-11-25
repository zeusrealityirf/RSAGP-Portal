/** Roblox public profile and thumbnail transport for Cloudflare Workers.
 * Discord remains the sole authentication identity for the RSAGP portal.
 * A public Roblox username lookup is NOT proof of account ownership.
 * No session cookies, user credentials, or Roblox proxy services are used.
 */
const VALID_USERNAME = /^[A-Za-z0-9_]{3,20}$/;
const VALID_ID = /^\d{1,20}$/;
const VALID_SIZE = new Set(['150x150', '420x420']);
const PROFILE_TTL = 10 * 60 * 1000;
const AVATAR_TTL = 15 * 60 * 1000;
const MAX_CACHE_ENTRIES = 400;
const profileCache = new Map();
const avatarCache = new Map();

function getCached(cache, key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) { cache.delete(key); return null; }
  return hit.value;
}
function storeCached(cache, key, value, ttl) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + ttl });
}
function problem(code, message) {
  const e = new Error(message);
  e.robloxCode = code;
  return e;
}
function checkedUsername(input) {
  const name = String(input ?? '').trim().replace(/^@/, '');
  if (!VALID_USERNAME.test(name)) throw problem('invalid', 'Use your Roblox username (3–20 letters, numbers or underscores), not your display name or profile link.');
  return name;
}
async function requestRoblox(url, options = {}) {
  let resp;
  try {
    resp = await fetch(url, {
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn('RSAGP Roblox request failed', { path: new URL(url).pathname, reason: String(e?.name || 'NetworkError') });
    throw problem('network', 'Roblox could not be reached right now. Please try again shortly.');
  }
  if (!resp.ok) console.warn('RSAGP Roblox upstream status', { path: new URL(url).pathname, status: resp.status });
  if (resp.status === 429) throw problem('rate', 'Roblox is temporarily rate-limiting profile checks. Please try again in a few minutes.');
  if (resp.status === 401 || resp.status === 403) throw problem('denied', `Roblox refused the profile request (HTTP ${resp.status}). Please try again later; an administrator can check the Worker logs.`);
  if (!resp.ok) throw problem('upstream', `Roblox profile service returned HTTP ${resp.status}. Please try again shortly.`);
  try { return await resp.json(); }
  catch { throw problem('upstream', 'Roblox returned an unreadable response. Please try again shortly.'); }
}
function exactProfile(rows, username) {
  if (!Array.isArray(rows)) throw problem('upstream', 'Roblox returned an unexpected profile response.');
  const row = rows.find(r => VALID_ID.test(String(r?.id ?? '')) && typeof r?.name === 'string' && r.name.toLowerCase() === username.toLowerCase());
  return row ? { id: String(row.id), username: row.name } : null;
}
/** Resolve an EXACT account username; never accept fuzzy search/display-name matches. */
export async function robloxProfile(input) {
  const name = checkedUsername(input), key = name.toLowerCase();
  const cached = getCached(profileCache, key);
  if (cached) return { ...cached };
  let profile;
  try {
    const data = await requestRoblox('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [name], excludeBannedUsers: true }),
    });
    profile = exactProfile(data?.data, name);
    if (!profile) throw problem('missing', `Roblox username @${name} was not found. Check the account username, not the display name.`);
  } catch (err) {
    // Search is a supported fallback for transient failures only; do not bypass 403/429.
    if (!['network', 'upstream'].includes(err?.robloxCode)) throw err;
    try {
      const data = await requestRoblox(`https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(name)}&limit=10`, { method: 'GET' });
      profile = exactProfile(data?.data, name);
      if (!profile) throw problem('upstream', `Roblox search did not confirm @${name}. Please retry when the profile service is available.`);
    } catch (fallbackErr) {
      if (fallbackErr?.robloxCode === 'missing') throw fallbackErr;
      if (fallbackErr?.robloxCode === 'rate' || fallbackErr?.robloxCode === 'denied') throw fallbackErr;
      throw err; // Preserve the primary request error if fallback also fails.
    }
  }
  storeCached(profileCache, key, profile, PROFILE_TTL);
  return { ...profile };
}

function safeThumbnail(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/(^|\.)rbxcdn\.com$/i.test(parsed.hostname)) return '';
    return parsed.toString();
  } catch { return ''; }
}
/** Up to 50 IDs in ONE Roblox API request; thumbnails are optional and best-effort. */
export async function robloxAvatarUrls(ids, size = '150x150') {
  if (!Array.isArray(ids) || ids.length > 50 || !VALID_SIZE.has(size)) return {};
  const unique = [...new Set(ids.map(String).filter(id => VALID_ID.test(id)))];
  const out = {}, missing = [];
  for (const id of unique) {
    const cached = getCached(avatarCache, `${size}:${id}`);
    if (cached) out[id] = cached;
    else missing.push(id);
  }
  if (missing.length) {
    try {
      const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${encodeURIComponent(missing.join(','))}&size=${size}&format=Png&isCircular=false`;
      const data = await requestRoblox(url, { method: 'GET' });
      for (const row of (Array.isArray(data?.data) ? data.data : [])) {
        const id = String(row?.targetId ?? ''), image = safeThumbnail(row?.imageUrl);
        if (!missing.includes(id) || !image || (row?.state && row.state !== 'Completed')) continue;
        out[id] = image;
        storeCached(avatarCache, `${size}:${id}`, image, AVATAR_TTL);
      }
    } catch { /* Avatar failure must never prevent navigation or document generation. */ }
  }
  return out;
}
