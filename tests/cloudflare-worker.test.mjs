import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import backend from '../worker/src/index.js';
import {sha256} from '../worker/src/auth.js';
import {Store} from '../worker/src/store.js';
const sqlite = new DatabaseSync(':memory:');
for (const p of ['../worker/migrations/0001_initial.sql','../worker/migrations/0002_workflow_integrity.sql']) sqlite.exec(readFileSync(new URL(p,import.meta.url),'utf8'));
const mockDb = {
 prepare(sql) {
  const stmt = sqlite.prepare(sql);
  return {
   bind(...args) {
    return {
     async all() { return {results:stmt.all(...args)}; },
     async first() { return stmt.get(...args) || null; },
     async run() { const r=stmt.run(...args); return {meta:{changes:Number(r.changes)}}; }
    };
   }
  };
 }
};
const ADMIN='999999999999999999',APPLICANT='111111111111111111',OTHER='222222222222222222';
const env={DB:mockDb,SITE_ORIGIN:'https://zeusrealityirf.github.io',SITE_URL:'https://zeusrealityirf.github.io/RSAGP-Portal/',SUPREME_ADMIN_DISCORD_IDS:ADMIN,DISCORD_CLIENT_ID:'client',DISCORD_CLIENT_SECRET:'secret'};
const tokens=new Map([[ADMIN,'a'.repeat(64)],[APPLICANT,'b'.repeat(64)],[OTHER,'c'.repeat(64)]]);
for(const [uid,t] of tokens)sqlite.prepare('INSERT INTO sessions(token_hash,user_id,username,avatar,expires_at) VALUES(?,?,?,?,?)').run(await sha256(t),uid,'User-'+uid.slice(0,3),'',Date.now()+7200000);
const store=new Store(mockDb);
await store.create('careerPositions','minister-of-defence',['minister-of-defence','Minister of Defence','Defence','Lead defence','shield',JSON.stringify(['Q1','Q2','Q3','Q4','Q5']),true,1,new Date().toISOString(),'seed']);
const oldFetch=globalThis.fetch;
globalThis.fetch=async (url,opts)=>{
 if(String(url).includes('users.roblox.com'))return new Response(JSON.stringify({data:[{id:234567891,name:'MockPlayer'}]}),{status:200});
 throw new Error('Unexpected external request during test');
};
const endpoint='https://rsagp-api.example.workers.dev/api';
const send=async(action,args,origin=env.SITE_ORIGIN)=>{
 const req=new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Origin':origin},body:JSON.stringify({action,args})});
 const r=await backend.fetch(req,env);return {status:r.status,...await r.json()};
};
const auth=uid=>tokens.get(uid);
test('health and origin check',async()=>{
 const r=await backend.fetch(new Request('https://example.workers.dev/health'),env);
 assert.equal((await r.json()).service,'RSAGP Worker D1 backend');
 assert.equal((await send('getCareerPositions',[],'https://evil.example')).status,403);
 const opts=await backend.fetch(new Request(endpoint,{method:'OPTIONS',headers:{Origin:env.SITE_ORIGIN}}),env);
 assert.equal(opts.status,204);
});
test('public positions and authenticated applicant home',async()=>{
 const p=await send('getCareerPositions',[]);assert.equal(p.result.length,1);
 const invalid=await send('careersHome',['d'.repeat(64)]);assert.equal(invalid.ok,false);
 const mine=await send('careersHome',[auth(APPLICANT)]);assert.deepEqual(mine.result.applications,[]);
});
test('unauthorised member cannot alter positions or view applications',async()=>{
 assert.equal((await send('setCareerPositionOpen',[auth(APPLICANT),'minister-of-defence',false])).ok,false);
 assert.equal((await send('pageData',[auth(APPLICANT),'applications'])).ok,false);
 assert.equal((await send('saveAccessUser',[auth(APPLICANT),{id:APPLICANT,roles:[],allow:['view'],deny:[]}])).ok,false);
});
test('recruitment and acceptance closes vacancy; audit remains protected',async()=>{
 const ans=Array(5).fill('A sufficiently detailed answer that is long enough.');
 const app=await send('submitJobApplication',[auth(APPLICANT),{positionId:'minister-of-defence',robloxUsername:'MockPlayer',answers:ans}]);
 assert.equal(app.ok,true,JSON.stringify(app));
 const duplicate=await send('submitJobApplication',[auth(APPLICANT),{positionId:'minister-of-defence',robloxUsername:'MockPlayer',answers:ans}]);
 assert.equal(duplicate.ok,false);
 const own=await send('careersHome',[auth(APPLICANT)]);assert.equal(own.result.applications.length,1);
 assert.equal(own.result.applications[0].answers,undefined,'Applicant listing does not expose answer content');
 const reviewed=await send('reviewJobApplication',[auth(ADMIN),app.result.id,{status:'Accepted',note:'Good fit'}]);
 assert.equal(reviewed.ok,true,JSON.stringify(reviewed));
 assert.equal((await store.get('careerPositions','minister-of-defence'))[6],false);
 assert.equal((await send('getCareerPositions',[])).result.length,0);
 const audit=await send('pageData',[auth(ADMIN),'audit']);assert.equal(audit.ok,true);assert.ok(audit.result.entries.length>0);
});
test('custom permissions and per-user deny enforced by server',async()=>{
 const role=await send('saveAccessRole',[auth(ADMIN),{name:'Interview Team',permissions:['view','viewApplications','reviewApplications'],active:true,description:'Recruiters'}]);
 assert.equal(role.ok,true,JSON.stringify(role));
 const grant=await send('saveAccessUser',[auth(ADMIN),{id:OTHER,name:'Other',roles:['Interview Team'],allow:[],deny:['reviewApplications'],active:true}]);
 assert.equal(grant.ok,true,JSON.stringify(grant));
 const me=await send('currentUser',[auth(OTHER)]);
 assert.equal(me.result.rights.viewApplications,true);assert.equal(me.result.rights.reviewApplications,false);
});
test('new HTML documents preserve PNG/PDF toolbar',async()=>{
 const create=await send('saveGovLetter',[auth(ADMIN),{kind:'Ministry',recipient:'Roleplay citizen',subject:'Sample letter',body:'Test body'}]);
 assert.equal(create.ok,true,JSON.stringify(create));
 const issued=await send('issueGovLetter',[auth(ADMIN),create.result.id]);assert.equal(issued.ok,true);
 const doc=await send('letterHTML',[auth(ADMIN),create.result.id]);assert.equal(doc.ok,true,JSON.stringify(doc));
 assert.match(doc.result.html,/rsagp-export-png/);assert.match(doc.result.html,/rsagp-export-pdf/);
});
test('signout expires session and prevents further protected calls',async()=>{
 assert.equal((await send('signOut',[auth(OTHER)])).result,true);
 assert.equal((await send('currentUser',[auth(OTHER)])).ok,false);
});
test.after(()=>{globalThis.fetch=oldFetch;sqlite.close();});
