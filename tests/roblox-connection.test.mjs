import test from 'node:test';
import assert from 'node:assert/strict';
import {robloxProfile, robloxAvatarUrls} from '../worker/src/roblox.js';
const realFetch = globalThis.fetch;
const original = (url, options={}) => { throw new Error('No external network calls allowed during tests: '+url); };
test.after(()=>{globalThis.fetch = realFetch;});

test('official Roblox username lookup returns confirmed exact account ID, accepts leading @ and caches result', async()=>{
  let calls = 0;
  globalThis.fetch = async(url,opts)=>{
    calls++;
    assert.equal(String(url),'https://users.roblox.com/v1/usernames/users');
    assert.equal(opts.method,'POST');
    assert.deepEqual(JSON.parse(opts.body),{usernames:['PortalPlayerA'],excludeBannedUsers:true});
    return new Response(JSON.stringify({data:[{name:'PortalPlayerA',id:123456789}]}),{status:200});
  };
  assert.deepEqual(await robloxProfile('@PortalPlayerA'),{id:'123456789',username:'PortalPlayerA'});
  assert.deepEqual(await robloxProfile('portalplayera'),{id:'123456789',username:'PortalPlayerA'});
  assert.equal(calls,1,'validated profile reused without another Roblox request');
});

test('does not trust a different or fuzzy Roblox username',async()=>{
  globalThis.fetch = async()=>new Response(JSON.stringify({data:[{name:'SomeOtherUser',id:55555}]}),{status:200});
  await assert.rejects(robloxProfile('PortalPlayerB'),/not found/);
  await assert.rejects(robloxProfile('Display Name'),/Use your Roblox username/);
});

test('Roblox 403 and 429 are handled distinctly and never bypassed with a second endpoint',async()=>{
  let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('Access denied',{status:403});};
  await assert.rejects(robloxProfile('PortalPlayerC'),/HTTP 403/);
  assert.equal(calls,1);
  globalThis.fetch=async()=>{calls++;return new Response('Limit',{status:429});};
  await assert.rejects(robloxProfile('PortalPlayerD'),/rate-limiting/);
  assert.equal(calls,2);
});

test('temporary primary errors can fall back to exact official Roblox search',async()=>{
  let calls=0;
  globalThis.fetch=async(url,opts)=>{
    calls++;
    if(String(url).includes('/v1/usernames/users'))return new Response('Outage',{status:503});
    assert.match(String(url),/users\.roblox\.com\/v1\/users\/search\?keyword=PortalPlayerE/);
    return new Response(JSON.stringify({data:[{name:'PortalPlayerE_fan',id:100},{name:'PortalPlayerE',id:235}]}),{status:200});
  };
  assert.deepEqual(await robloxProfile('PortalPlayerE'),{id:'235',username:'PortalPlayerE'});
  assert.equal(calls,2);
});

test('batch thumbnails: one fetch for many ids, only Completed HTTPS rbxcdn image URLs',async()=>{
  let calls=0;
  globalThis.fetch=async url=>{
    calls++;
    assert.match(String(url),/userIds=100%2C200%2C300%2C400/);
    return new Response(JSON.stringify({data:[
      {targetId:100,state:'Completed',imageUrl:'https://tr.rbxcdn.com/avatar-a.png'},
      {targetId:200,state:'Pending',imageUrl:null},
      {targetId:300,state:'Completed',imageUrl:'https://evil.example/fake.png'},
      {targetId:400,state:'Completed',imageUrl:'https://rbxcdn.com/avatar-d.png'}
    ]}),{status:200});
  };
  const result=await robloxAvatarUrls(['100','200','300','400','100']);
  assert.equal(result['100'],'https://tr.rbxcdn.com/avatar-a.png');
  assert.equal(result['400'],'https://rbxcdn.com/avatar-d.png');
  assert.equal(result['200'],undefined);
  assert.equal(result['300'],undefined);
  assert.equal(calls,1);
});

test('failed avatar service does not break portal rendering',async()=>{
  globalThis.fetch=async()=>{throw new Error('ECONNRESET');};
  assert.deepEqual(await robloxAvatarUrls(['999987654321']),{});
});

test('avatar endpoint rejects overlarge requests without contacting Roblox',async()=>{
  globalThis.fetch=original;
  assert.deepEqual(await robloxAvatarUrls(Array(51).fill('123')),{});
});
