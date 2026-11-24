/** RSAGP fully serverless API — NO Google Apps Script/Sheets calls.
 * Github Pages front end -> Cloudflare Worker -> D1 and private R2.
 * All protected actions authenticate a Discord session and recompute rights.
 */
import {Store,str} from './store.js';
import {loginUrl,oauthCallback,verify,signOut} from './auth.js';
import {context,requireRight} from './permissions.js';
import {careerDTO,applicationDTO,pageData} from './queries.js';
import {operations} from './operations.js';
import {documentNames,documentAction} from './documents.js';
export default {
 async fetch(request,env) {
  const url=new URL(request.url),origin=request.headers.get('Origin')||'';
  const allowed=str(env.SITE_ORIGIN).replace(/\/+$/,''),dev=str(env.LOCAL_DEV_ORIGIN).replace(/\/+$/,'');
  const validOrigin=!!origin && (origin===allowed || (dev && origin===dev));
  const headers={
   'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store','Vary':'Origin',
   'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
   'Access-Control-Allow-Origin':validOrigin?origin:allowed,
   'Access-Control-Allow-Methods':'POST, OPTIONS',
   'Access-Control-Allow-Headers':'Content-Type',
   'Access-Control-Max-Age':'600'
  };
  const respond=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
  try {
   if(url.pathname==='/health' && request.method==='GET')return respond({ok:true,service:'RSAGP Worker D1 backend'});
   if(url.pathname==='/auth/callback' && request.method==='GET')return await oauthCallback(env,request);
   if(url.pathname==='/auth/discord' && request.method==='GET'){
    const destination=url.searchParams.get('view')||'cabinet';
    return Response.redirect(await loginUrl(env,request,destination),302);
   }
   if(url.pathname!=='/api')return respond({ok:false,error:'Not found.'},404);
   if(!validOrigin)return respond({ok:false,error:'Origin not allowed.'},403);
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(request.method!=='POST')return respond({ok:false,error:'Method not allowed.'},405);
   if(!env.DB)return respond({ok:false,error:'Cloudflare D1 binding DB is missing.'},503);
   if(Number(request.headers.get('Content-Length')||0)>1800000)return respond({ok:false,error:'Request too large.'},413);
   const body=await request.text();if(body.length>1800000)return respond({ok:false,error:'Request too large.'},413);
   let input;try{input=JSON.parse(body);}catch{return respond({ok:false,error:'Invalid JSON.'},400);}
   if(!input || !/^[A-Za-z][A-Za-z0-9_]{0,70}$/.test(str(input.action))||!Array.isArray(input.args)||input.args.length>8)return respond({ok:false,error:'Invalid API action or arguments.'},400);
   const {action,args}=input;
   const store=new Store(env.DB);
   let result;
   if(action==='beginLogin')result=await loginUrl(env,request,args[0]);
   else if(action==='signOut')result=await signOut(env,args[0]);
   else if(action==='getCareerPositions')result=(await store.all('careerPositions')).map(careerDTO).filter(x=>x.open).sort((a,b)=>a.sort-b.sort).map(({id,title,portfolio,summary,icon,questions})=>({id,title,portfolio,summary,icon,questions}));
   else {
    const identity=await verify(env,args[0]);
    if(action==='careersHome') {
     const mine=(await store.all('jobApplications')).filter(r=>str(r[1])===identity.id).slice(-30).reverse().map(r=>applicationDTO(r,false));
     result={identity,positions:(await store.all('careerPositions')).map(careerDTO).filter(p=>p.open).sort((a,b)=>a.sort-b.sort).map(({id,title,portfolio,summary,icon,questions})=>({id,title,portfolio,summary,icon,questions})),applications:mine};
    }else if(action==='citizenContext'||action==='takeCitizenshipTest'||action==='submitJobApplication'||action==='withdrawJobApplication'||action==='checkRobloxUsername'){
     result=await operations[action].run(store,{identity,rights:{}},args.slice(1));
    }else {
     // ALL role-sensitive calls rebuild rights from D1 per request. No UI-provided grants are trusted.
     const c=await context(store,env,identity);c.env=env;
     if(action==='currentUser')result={identity:c.identity,member:c.member,rights:c.rights,roles:c.roles.filter(x=>x.active&&x.name!=='Group Staff').map(x=>x.name)};
     else if(action==='pageData')result=await pageData(store,c,args[1]);
     else if(documentNames.has(action))result=await documentAction(action,store,env,c,args.slice(1));
     else if(operations[action]) {
      const operation=operations[action];if(operation.right)requireRight(c,operation.right);
      result=await operation.run(store,c,args.slice(1));
     } else return respond({ok:false,error:'This API operation is not available.'},404);
    }
   }
   return respond({ok:true,result});
  }catch(e){
   const msg=str(e?.message||'').slice(0,240);
   // Avoid exposing database drivers, secrets or network traces to public callers.
   const safe=/^(?:D1_|SQLITE_|Database|TypeError:|Internal|fetch failed|Unexpected)/i.test(msg)?'Server error. Check Cloudflare Worker logs.':(msg||'Request failed.');
   return respond({ok:false,error:safe},400);
  }
 }
};
