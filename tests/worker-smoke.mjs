import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';
const env={SITE_ORIGIN:'https://example.github.io',LOCAL_DEV_ORIGIN:'http://localhost:8080',GAS_WEB_APP_URL:'https://script.google.com/macros/s/test123/exec'};
const req=(origin,method='POST',body={action:'getCareerPositions',args:[]}) => new Request('https://rsagp-api.example.workers.dev/api',{
  method,headers:{Origin:origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})
});
const forbidden=await worker.fetch(req('https://not-allowed.example'),env);
assert.equal(forbidden.status,403);
const preflight=await worker.fetch(req('https://example.github.io','OPTIONS'),env);
assert.equal(preflight.status,204);
let forwarded;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 forwarded={url,options};
 return new Response(JSON.stringify({ok:true,result:[{id:'test',open:true}]}),{status:200});
};
try {
 const response=await worker.fetch(req('https://example.github.io'),env);
 assert.equal(response.status,200);
 assert.equal(response.headers.get('access-control-allow-origin'),'https://example.github.io');
 assert.equal((await response.json()).result[0].id,'test');
 assert.equal(forwarded.url,env.GAS_WEB_APP_URL);
 assert.equal(JSON.parse(forwarded.options.body).action,'getCareerPositions');
} finally { globalThis.fetch=originalFetch; }
console.log('Worker origin/preflight/forwarding smoke tests passed.');
