import { isDiscordId } from './store.js';
const randHex = (count=32) => Array.from(crypto.getRandomValues(new Uint8Array(count)), x=>x.toString(16).padStart(2,'0')).join('');
const hex = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export const sha256 = hex;
const root = env => String(env.SITE_URL || '').replace(/\/+$/, '/') || '';
const callback = request => new URL('/auth/callback',request.url).href;
export async function loginUrl(env,request,destination='cabinet') {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) throw Error('Discord OAuth secrets are not configured in Cloudflare.');
  const view = ['cabinet','careers','citizenship'].includes(destination) ? destination : 'cabinet';
  const state=randHex(), expires=Date.now()+10*60*1000;
  await env.DB.prepare('INSERT INTO oauth_states(state_hash,destination,expires_at) VALUES (?,?,?)').bind(await hex(state),view,expires).run();
  const params = new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,redirect_uri:callback(request),response_type:'code',scope:'identify',state});
  return 'https://discord.com/oauth2/authorize?'+params.toString();
}
export async function oauthCallback(env,request) {
  const url = new URL(request.url); const code=url.searchParams.get('code'); const state=url.searchParams.get('state');
  if (!code || !state || !/^[0-9a-f]{64}$/.test(state)) throw Error('Discord authentication was cancelled or the state is invalid.');
  const hash=await hex(state); const row=await env.DB.prepare('SELECT destination,expires_at FROM oauth_states WHERE state_hash=?').bind(hash).first();
  if (!row || row.expires_at<Date.now()) throw Error('Login expired. Please start again.');
  // One-time OAuth state, deleted BEFORE exchanging the code.
  const result=await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash=? AND expires_at>=?').bind(hash,Date.now()).run();
  if (!result.meta?.changes) throw Error('Login state has already been used.');
  const credentials=new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:callback(request)});
  const tokenResponse=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:credentials});
  if (!tokenResponse.ok) throw Error('Discord token exchange failed.');
  const info=await tokenResponse.json();
  const userResponse=await fetch('https://discord.com/api/v10/users/@me',{headers:{Authorization:'Bearer '+info.access_token}});
  if (!userResponse.ok) throw Error('Discord profile retrieval failed.');
  const user=await userResponse.json();
  if (!isDiscordId(user.id)) throw Error('Discord returned an invalid account.');
  const session=randHex(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,username,avatar,expires_at) VALUES (?,?,?,?,?)').bind(await hex(session),String(user.id),String(user.global_name||user.username||''),(user.avatar?'https://cdn.discordapp.com/avatars/'+user.id+'/'+user.avatar+'.png?size=128':'https://cdn.discordapp.com/embed/avatars/0.png'),Date.now()+12*60*60*1000).run();
  const page={cabinet:'',careers:'careers/',citizenship:'citizenship/'}[row.destination]||'';
  const target=new URL(page,root(env));
  // Fragment never reaches the Pages server. Browser bridge immediately strips it.
  target.hash='rsagp_session='+session;
  return Response.redirect(target.href,302);
}
export async function verify(env,token) {
  if (!/^[a-f0-9]{64}$/.test(String(token||''))) throw Error('Please sign in with Discord.');
  const row=await env.DB.prepare('SELECT user_id,username,avatar,expires_at FROM sessions WHERE token_hash=?').bind(await hex(token)).first();
  if (!row || row.expires_at<Date.now()) throw Error('Session expired. Please sign in with Discord again.');
  return {id:row.user_id,username:row.username,avatar:row.avatar};
}
export async function signOut(env,token) {
  if (/^[a-f0-9]{64}$/.test(String(token||''))) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await hex(token)).run();
  return true;
}
