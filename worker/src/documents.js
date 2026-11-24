import {EXPORT_CSS,EXPORT_JS} from './export-tools.js';
import {now,uuid,str,bool,json,required,text} from './store.js';
import {requireRight} from './permissions.js';
import {proposalDTO,meetingDTO,attendeeDTO,pressDTO,letterDTO,citizenDTO} from './queries.js';
import {sha256} from './auth.js';
const esc=x=>str(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const paragraph=x=>esc(x).split(/\n\s*\n/).map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('');
const requiredRight=(c,r)=>requireRight(c,r);
function output(filename,html){
 filename=str(filename||'RSAGP_Document.html').replace(/[^\w.\-]/g,'_');
 const bar=`<aside id="rsagp-export-tools" aria-label="Export document"><div class="rsagp-export-heading"><span>RSAGP · ROBLOX NATION</span><strong>Export document</strong></div><div class="rsagp-export-actions"><select id="rsagp-export-page" aria-label="PNG page" hidden></select><button id="rsagp-export-png" type="button">Save PNG</button><button id="rsagp-export-pdf" type="button">Save PDF</button></div><div class="rsagp-export-status" id="rsagp-export-status" role="status" aria-live="polite">PNG converts HTML into an image. PDF uses the browser print dialog.</div><a id="rsagp-export-image-link" hidden target="_blank" rel="noopener">Open PNG</a></aside>`;
 const script='<script id="rsagp-export-script">window.RSAGP_HTML_EXPORT_NAME='+JSON.stringify(filename)+';'+EXPORT_JS.replace(/<\/script/gi,'<\\/script')+'</script>';
 return {success:true,filename,html:html.replace('</head>','<style>'+EXPORT_CSS+'</style></head>').replace('</body>',bar+script+'</body>'),kind:'html',message:'Open HTML to save PNG or use Print → Save as PDF.'};
}
function shell(office,title,reference,date,status,content,signoff=''){
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · ${esc(reference)}</title><style>
 :root{--flag-bar:#007a4d}body{background:#edf1ec;color:#22342d;font:15px/1.65 Georgia,serif;margin:0}.sheet{max-width:790px;min-height:950px;padding:62px 65px;background:#fff;margin:26px auto;box-shadow:0 6px 28px #003b2518;box-sizing:border-box}.head{border-top:8px solid #007a4d;border-bottom:1px solid #d2ddd2;padding:18px 0 24px;margin-bottom:35px}.label{color:#007a4d;text-transform:uppercase;letter-spacing:.13em;font:700 12px Arial,sans-serif}.sub{font:11px Arial,sans-serif;color:#53685e;margin-top:7px}h1{font-size:27px;line-height:1.35;margin-top:25px}h2{font-size:18px;margin-top:28px}p{white-space:normal}table{width:100%;border-collapse:collapse;font:12px/1.5 Arial,sans-serif;margin:15px 0 25px}th,td{padding:8px 6px;border-bottom:1px solid #dce4de;text-align:left;vertical-align:top}th{background:#edf4ef}.stamp{color:#6f603c;background:#fff7dc;border:1px solid #efdcab;display:inline-block;padding:5px 10px;font:700 11px Arial,sans-serif}.sig{margin-top:42px;border-top:1px solid #d9e2dc;padding-top:18px;font:12px Arial,sans-serif}.sig img{max-width:180px;max-height:75px;display:block}.foot{border-top:1px solid #dce5db;margin-top:60px;padding-top:12px;font:10px Arial,sans-serif;color:#6a7e70}@media print{body{background:#fff}.sheet{box-shadow:none;margin:0;max-width:none;min-height:auto;padding:20mm}@page{size:A4;margin:0}}
 </style></head><body><main class="sheet"><header class="head"><div class="label">${esc(office)}</div><div class="sub">RSAGP · Roblox roleplay government · Not a real government-issued document</div></header><div class="stamp">${esc(status)}</div><h1>${esc(title)}</h1><div class="sub">Reference ${esc(reference)} · ${esc(date)}</div>${content}${signoff}<footer class="foot" data-rsagp-footer="1">Lem's South Africa · RSAGP · Roblox Nation · Roleplay document · ${esc(reference)}</footer></main></body></html>`;
}
const signTypeBucket={Agenda:'meetings',Attendance:'meetings',Bill:'proposals',Press:'press',Letter:'letters'};
async function snapshot(store,kind,id){
 if(!signTypeBucket[kind]||!/^[A-Za-z0-9_\-]{5,70}$/.test(str(id)))throw Error('Unknown Cabinet document.');
 const row=await store.get(signTypeBucket[kind],id);if(!row)throw Error('Document does not exist.');
 if(kind==='Agenda'||kind==='Attendance'){
  if(str(row[6])==='Cancelled')throw Error('Cancelled meetings cannot be signed.');
  const attendance=(await store.all('meetingAttendees')).filter(r=>str(r[1])===id&&str(r[8])!=='Withdrawn');
  if(kind==='Attendance'&&(!attendance.length||attendance.some(r=>!r[12]&&str(r[8])!=='Attended')))throw Error('Record attendance for all invitees first.');
  const agenda=kind==='Agenda'?(await store.all('proposals')).filter(r=>json(row[9],[]).includes(str(r[0]))):[];
  return {row,source:[row,attendance,agenda]};
 }
 if(kind==='Bill'){
  if(str(row[6])!=='Legislation')throw Error('Only proposed Bills may be signed.');
  const draft=await store.get('actDrafts',id);if(!draft)throw Error('No numbered Bill clauses have been saved.');
  return {row,source:[row,draft]};
 }
 return {row,source:[row]};
}
const maySign=(c,kind,row)=>!!c.rights.canSignDocs&&({Agenda:()=>c.rights.signAgendas,Attendance:()=>c.rights.signAttendance,Bill:()=>c.rights.signBills&&str(row[12])==='Agenda Ready',Press:()=>c.rights.signPress&&str(row[8])==='Published',Letter:()=>c.rights.signLetters&&str(row[2])===c.identity.id&&str(row[8])==='Issued'}[kind]||(()=>false))();
async function docState(store,kind,id){const snap=await snapshot(store,kind,id),digest=await sha256(JSON.stringify(snap.source)),r=await store.get('documentSignoffs',kind+'|'+id);return {snap,digest,row:r,valid:!!r&&str(r[3])===digest};}
async function signatureData(env,key,mime){
 if(!key||!['image/png','image/jpeg'].includes(str(mime))||!env.FILES)return '';
 const obj=await env.FILES.get(key);if(!obj||obj.size>900000)return '';
 const bytes=new Uint8Array(await obj.arrayBuffer());let s='';for(const b of bytes)s+=String.fromCharCode(b);
 return 'data:'+mime+';base64,'+btoa(s);
}
async function signBlock(store,env,kind,id){
 const status=await docState(store,kind,id);
 if(!status.valid)return '<div class="sig">Unsigned or document changed since signing</div>';
 const r=status.row,data=await signatureData(env,str(r[8]),str(r[9]));
 return `<div class="sig">${data?'<img alt="Recorded private signature" src="'+data+'">':''}<b>${esc(r[5])}</b> · ${esc(r[6])}<div class="sub">Digitally recorded sign-off: ${esc(r[7])}</div></div>`;
}
export async function documentAction(action,store,env,c,args){
 const [a,b]=args;
 if(action==='getMySignatureInfo'){
  requiredRight(c,'canSignDocs');const r=await store.get('signatures',c.identity.id);
  return {hasSignature:!!r?.[1]?.startsWith('signatures/'),updated:str(r?.[3]),preview:r?.[1]?await signatureData(env,r[1],r[2]):''};
 }
 if(action==='saveMySignature'){
  requiredRight(c,'canSignDocs');if(!env.FILES)throw Error('Cloudflare R2 bucket is not configured.');
  const mime=str(a?.mime),encoded=str(a?.base64);
  if(!['image/png','image/jpeg'].includes(mime)||encoded.length>1250000||!encoded||!/^[a-zA-Z0-9+/=]+$/.test(encoded))throw Error('Upload PNG/JPG smaller than 800 KB.');
  const data=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));if(data.length<100||data.length>800000)throw Error('Signature size is invalid.');
  if(mime==='image/png'&&!(data[0]===137&&data[1]===80&&data[2]===78&&data[3]===71)||mime==='image/jpeg'&&!(data[0]===255&&data[1]===216&&data[2]===255))throw Error('Signature content does not match declared type.');
  const existing=await store.get('signatures',c.identity.id),key='signatures/'+c.identity.id+'/'+crypto.randomUUID()+(mime==='image/png'?'.png':'.jpg');
  await env.FILES.put(key,data,{httpMetadata:{contentType:mime}});
  await store.save('signatures',c.identity.id,[c.identity.id,key,mime,now()]);
  if(existing?.[1]?.startsWith('signatures/'))await env.FILES.delete(existing[1]);
  await store.audit(c.identity,'UPLOAD_SIGNATURE','Signature',c.identity.id,mime);return {success:true,message:'Signature stored privately.'};
 }
 if(action==='removeMySignature'){
  requiredRight(c,'canSignDocs');const existing=await store.get('signatures',c.identity.id);
  await store.save('signatures',c.identity.id,[c.identity.id,'','',now()]);
  if(existing?.[1]?.startsWith('signatures/')&&env.FILES)await env.FILES.delete(existing[1]);
  await store.audit(c.identity,'REMOVE_SIGNATURE','Signature',c.identity.id,'');return {success:true,message:'Signature removed.'};
 }
 if(action==='getCabinetDocumentSignoffStatus'||action==='signCabinetDocument'){
  requiredRight(c,'view');const kind=str(a),docId=str(b);
  const viewRight={Agenda:'viewMeetings',Attendance:'viewMeetings',Bill:'viewProposals',Press:'viewPress',Letter:'viewLetters'}[kind];
  if(!viewRight)throw Error('Unknown document type.');requiredRight(c,viewRight);
  const state=await docState(store,kind,docId),hasSignature=!!(await store.get('signatures',c.identity.id))?.[1];
  if(action==='getCabinetDocumentSignoffStatus')return {type:kind,documentId:docId,signed:state.valid,needsResign:!!state.row&&!state.valid,signatory:state.valid?{username:str(state.row[5]),position:str(state.row[6]),signedAt:str(state.row[7])}:null,canSign:maySign(c,kind,state.snap.row),hasSignature};
  if(!maySign(c,kind,state.snap.row))throw Error('You are not authorised to sign this document at this stage.');
  if(!hasSignature||!env.FILES)throw Error('Upload your private signature first.');
  const mine=await store.get('signatures',c.identity.id);if(!str(mine?.[1]).startsWith('signatures/'))throw Error('Legacy Google Drive signatures must be re-uploaded to private R2 storage.');const blob=await env.FILES.get(str(mine[1]));
  if(!blob||blob.size>900000)throw Error('Signature is missing or invalid. Upload it again.');
  const key='signed/'+kind.toLowerCase()+'/'+encodeURIComponent(docId)+'/'+crypto.randomUUID();
  await env.FILES.put(key,await blob.arrayBuffer(),{httpMetadata:{contentType:str(mine[2])}});
  const row=[kind+'|'+docId,kind,docId,state.digest,c.identity.id,c.member?.name||c.identity.username,c.member?.position||'Authorised signatory',now(),key,mine[2]];
  await store.save('documentSignoffs',row[0],row);
  await store.audit(c.identity,'SIGN_DOCUMENT','Cabinet Document',row[0],state.digest.slice(0,12));
  if(state.row?.[8]?.startsWith('signed/'))await env.FILES.delete(state.row[8]);
  return {success:true,message:'Document sign-off saved. Re-export the document to include it.',type:kind,id:docId};
 }
 if(action==='letterHTML'){
  requiredRight(c,'writeLetters');const x=letterDTO(await findDoc(store,'letters',a));
  if(x.authorId!==c.identity.id)throw Error('Only the author may export this letter.');
  if(x.kind==='Presidential'&&!c.rights.superAdmin)throw Error('Presidential letters require Supreme Administrator.');
  const signed=x.status==='Issued'?await signBlock(store,env,'Letter',x.id):'<div class="sig">Draft — not issued</div>';
  return output(x.id+'_Letter.html',shell(x.ministry,x.subject,x.id,x.updated.slice(0,10),x.status,'<p><b>To: '+esc(x.recipient)+'</b></p>'+paragraph(x.body)+'<p>Yours sincerely,</p>',signed));
 }
 if(action==='pressDocument'){
  requiredRight(c,'draftPress');const x=pressDTO(await findDoc(store,'press',a));
  if(x.authorId!==c.identity.id&&!c.rights.reviewPress&&!c.rights.publishPress)throw Error('Not authorised to export this press release.');
  return output('Press_'+x.id+'.html',shell('Government Communications',x.headline,x.id,x.releaseDate,x.status,'<p><b>'+esc(x.summary)+'</b></p>'+paragraph(x.body)+(x.quote?'<blockquote>'+esc(x.quote)+'</blockquote>':'')+'<p>Spokesperson: '+esc(x.spokesperson)+'</p>',x.status==='Published'?await signBlock(store,env,'Press',x.id):''));
 }
 if(action==='agendaDocument'||action==='meetingAttendanceDocument'){
  requiredRight(c,'exportMeetings');const meeting=meetingDTO(await findDoc(store,'meetings',a));
  const attendees=(await store.all('meetingAttendees')).filter(x=>str(x[1])===str(a)&&str(x[8])!=='Withdrawn').map(attendeeDTO);
  if(action==='agendaDocument'){
   const proposals=(await store.all('proposals')).filter(r=>meeting.proposalIds.includes(str(r[0]))).map(proposalDTO);
   const content='<p><b>Time:</b> '+esc(meeting.time)+' SAST · <b>Venue:</b> '+esc(meeting.venue)+' · <b>Chair:</b> '+esc(meeting.chair)+'</p>'+paragraph(meeting.notes)+'<h2>Agenda items</h2>'+(proposals.length?proposals.map((x,i)=>'<h2>'+(i+1)+'. '+esc(x.title)+'</h2><p>'+esc(x.recommendation)+'</p>').join(''):'<p>None</p>')+'<h2>Invited attendees</h2>'+table(['Name','Office','RSVP'],attendees.map(x=>[x.name,x.office,x.status]));
   return output('Cabinet_Agenda_'+meeting.id+'.html',shell('Cabinet Secretariat',meeting.title,meeting.id,meeting.date,'Draft for deliberation',content,await signBlock(store,env,'Agenda',meeting.id)));
  }
  if(!attendees.length)throw Error('No attendees are invited.');
  const content='<p><b>Meeting:</b> '+esc(meeting.title)+' · '+esc(meeting.time)+' SAST · '+esc(meeting.venue)+'</p>'+table(['Name','Office','RSVP','Recorded attendance','Notes'],attendees.map(x=>[x.name,x.office,x.status,x.attendance||'Unrecorded',x.attendanceNotes]));
  return output('Cabinet_Attendance_'+meeting.id+'.html',shell('Cabinet Secretariat','Attendance Register',meeting.id,meeting.date,'Secretariat record',content,await signBlock(store,env,'Attendance',meeting.id)));
 }
 if(action==='proposedActDocument'){
  requiredRight(c,'viewProposals');const p=proposalDTO(await findDoc(store,'proposals',a));if(p.category!=='Legislation')throw Error('Only Bills can be exported as a proposed Act.');
  const d=await findDoc(store,'actDrafts',a),clauses=json(d[3],[]);if(!clauses.length)throw Error('No Bill clauses saved.');
  const content='<p><b>PROPOSED BILL — NOT ENACTED</b></p><h2>'+esc(d[1])+'</h2>'+paragraph(d[2])+clauses.map((x,i)=>'<h2>'+(i+1)+'. '+esc(x.heading)+'</h2>'+paragraph(x.text)).join('')+'<p>Commencement: '+esc(d[5])+'</p>';
  return output('Proposed_Bill_'+p.id+'.html',shell('Legislative Drafts',p.title,p.id,p.created.slice(0,10),'Cabinet draft — not law',content,await signBlock(store,env,'Bill',p.id)));
 }
 if(action==='citizenCardHTML'){
  const r=citizenDTO(await findDoc(store,'citizenshipAttempts',a));
  if(r.discordId!==c.identity.id&&!c.rights.manageCitizenship)throw Error('Not authorised to export this card.');
  if(r.status!=='Approved')throw Error('Application has not been approved.');
  const content='<p><b>Roblox username:</b> '+esc(r.robloxUsername)+'</p><p><b>Player account ID:</b> '+esc(r.robloxId)+'</p><p><b>Card reference:</b> '+esc(r.cardNumber)+'</p><p>This card relates only to the RSAGP Roblox roleplay community and does not establish real citizenship.</p>';
  return output('Citizen_Card_'+r.id+'.html',shell('Citizenship Services','Roleplay Citizenship Card',r.cardNumber,r.verified.slice(0,10),'Approved for roleplay',content));
 }
 throw Error('Document operation not implemented.');
}
async function findDoc(store,bucket,id){const r=await store.get(bucket,id);if(!r)throw Error('Document record not found.');return r;}
function table(headers,rows){return '<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
export const documentNames=new Set(['getMySignatureInfo','saveMySignature','removeMySignature','getCabinetDocumentSignoffStatus','signCabinetDocument','letterHTML','pressDocument','agendaDocument','meetingAttendanceDocument','proposedActDocument','citizenCardHTML']);
