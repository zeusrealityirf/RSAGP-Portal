import {EXPORT_CSS,EXPORT_JS} from './export-tools.js';
import {escapeDocument as safe, paragraphDocument as docPara, multiParagraphDocument as docMultiline, documentShell as docShell, originalSignature, originalProposedBill, originalCitizenshipCard} from './original-templates.js';
import {now,uuid,str,bool,json,required,text} from './store.js';
import {requireRight} from './permissions.js';
import {proposalDTO,meetingDTO,attendeeDTO,pressDTO,letterDTO,citizenDTO} from './queries.js';
import {sha256} from './auth.js';
import {robloxAvatarUrls} from './roblox.js';
const esc=x=>str(x).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const paragraph=x=>esc(x).split(/\n\s*\n/).map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('');
const requiredRight=(c,r)=>requireRight(c,r);
function output(filename,html){
 filename=str(filename||'RSAGP_Document.html').replace(/[^\w.\-]/g,'_');
 const bar=`<aside id="rsagp-export-tools" aria-label="Export document"><div class="rsagp-export-heading"><span>RSAGP · ROBLOX NATION</span><strong>Export document</strong></div><div class="rsagp-export-actions"><select id="rsagp-export-page" aria-label="PNG page" hidden></select><button id="rsagp-export-png" type="button">Save PNG</button><button id="rsagp-export-pdf" type="button">Save PDF</button></div><div class="rsagp-export-status" id="rsagp-export-status" role="status" aria-live="polite">PNG converts HTML into an image. PDF uses the browser print dialog.</div><a id="rsagp-export-image-link" hidden target="_blank" rel="noopener">Open PNG</a></aside>`;
 const script='<script id="rsagp-export-script">window.RSAGP_HTML_EXPORT_NAME='+JSON.stringify(filename)+';'+EXPORT_JS.replace(/<\/script/gi,'<\\/script')+'</script>';
 return {success:true,filename,html:html.replace('</head>','<style>'+EXPORT_CSS+'</style></head>').replace('</body>',bar+script+'</body>'),kind:'html',message:'Open HTML to save PNG or use Print → Save as PDF.'};
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
 if(!status.valid)return originalSignature({pending:true,changed:!!status.row});
 const r=status.row,data=await signatureData(env,str(r[8]),str(r[9]));
 if(!data)return originalSignature({missingImage:true});
 return originalSignature({name:str(r[5]),title:str(r[6]),date:str(r[7]),version:str(r[3]).slice(0,12),image:data});
}
async function robloxAvatarData(robloxId){
 const id=str(robloxId).trim();
 if(!/^\d{1,20}$/.test(id))return '';
 try{
  const thumbnails=await robloxAvatarUrls([id], '420x420');
  const url=str(thumbnails[id]);
  if(!url)return '';
  const target=new URL(url);
  if(target.protocol!=='https:'||!/(^|\.)rbxcdn\.com$/i.test(target.hostname))return '';
  const image=await fetch(target.toString());
  if(!image.ok||!['image/png','image/jpeg'].includes(str(image.headers.get('content-type')).split(';')[0]))return '';
  const bytes=new Uint8Array(await image.arrayBuffer());
  if(bytes.length<100||bytes.length>500000)return '';
  let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
  return 'data:'+str(image.headers.get('content-type')).split(';')[0]+';base64,'+btoa(binary);
 }catch{return '';}
}
function facts(items){
 return '<div class="meeting-facts">'+items.map(([k,v])=>'<div><b>'+safe(k)+'</b><span>'+safe(v)+'</span></div>').join('')+'</div>';
}
function attendeeTable(people,heads,columns){
 return '<table style="width:100%;border-collapse:collapse;font:11px/1.5 Arial,sans-serif;margin:14px 0 26px"><thead><tr>'+heads.map(h=>'<th style="text-align:left;padding:8px 6px;border-bottom:2px solid #007a4d">'+safe(h)+'</th>').join('')+'</tr></thead><tbody>'+people.map(a=>'<tr>'+columns(a).map(v=>'<td style="padding:8px 6px;border-bottom:1px solid #dce5dc;vertical-align:top">'+safe(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
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
  const presidential=x.kind==='Presidential';
  if(presidential&&!c.rights.superAdmin)throw Error('Presidential letters require Supreme Administrator.');
  const issued=x.status==='Issued';
  const content='<div class="release-heading">'+(issued?'ISSUED CABINET CORRESPONDENCE':'WORKING DRAFT — NOT ISSUED')+'</div><h1>'+safe(x.subject)+'</h1><div class="addressee">To: <b>'+safe(x.recipient)+'</b></div>'+docMultiline(x.body)+'<p style="margin-top:36px">Yours sincerely,</p>';
  const signature=issued?await signBlock(store,env,'Letter',x.id):'<p class="note">Working draft — signature pending issuance.</p>';
  const html=docShell(x.ministry,presidential?'Presidential Letter':'Ministry Letter',presidential?'president':'ministry',x.id,x.updated.slice(0,10),issued?'Issued letter':'Working draft — not issued',content,signature);
  return output(x.id+'_'+(presidential?'Presidential':'Ministry')+'_Letter.html',html);
 }
 if(action==='pressDocument'){
  requiredRight(c,'draftPress');const x=pressDTO(await findDoc(store,'press',a));
  if(x.authorId!==c.identity.id&&!c.rights.reviewPress&&!c.rights.publishPress)throw Error('Not authorised to export this press release.');
  const released=x.status==='Published';
  const content='<div class="release-heading">'+(released?'PRESS RELEASE':'PRESS RELEASE • WORKING DRAFT')+'</div>'+docPara(x.summary,'lead')+'<h1>'+safe(x.headline)+'</h1>'+docMultiline(x.body)+(x.quote?'<blockquote>“'+safe(x.quote)+'”</blockquote>':'')+'<div class="ends">— END —</div><p><b>Issued by:</b> '+safe(x.spokesperson)+'</p>';
  const signature=released?await signBlock(store,env,'Press',x.id):'<p class="note">Working draft — signature not available until publication.</p>';
  return output('Press_'+x.id+'.html',docShell('Government Communications','Media Statement','ministry',x.id,x.releaseDate,released?'Published release':'NOT APPROVED FOR PUBLICATION',content,signature));
 }
 if(action==='agendaDocument'||action==='meetingAttendanceDocument'){
  requiredRight(c,'exportMeetings');const meeting=meetingDTO(await findDoc(store,'meetings',a));
  const attendees=(await store.all('meetingAttendees')).filter(x=>str(x[1])===str(a)&&str(x[8])!=='Withdrawn').map(attendeeDTO);
  if(action==='agendaDocument'){
   if(meeting.status==='Cancelled')throw Error('Cancelled meetings cannot generate agendas.');
   const lookup=new Map((await store.all('proposals')).map(proposalDTO).map(x=>[x.id,x]));
   const rows=[docPara('01  Opening and welcome'),docPara('02  Attendance and apologies'),docPara('03  Adoption of previous minutes'),docPara('04  Matters arising')];
   meeting.proposalIds.forEach((id,i)=>{const p=lookup.get(id);if(!p)return;
    rows.push('<section class="agenda-item"><span class="agenda-no">'+String(i+5).padStart(2,'0')+'</span><div><h3>'+safe(p.title)+'</h3><small>'+safe(p.portfolio)+' · '+safe(p.priority)+' · '+safe(p.id)+'</small><p>'+safe(p.recommendation)+'</p><p><b>Decision requested:</b> '+safe(p.decision)+'</p>'+(p.budget?'<p><b>Resource impact:</b> '+safe(p.budget)+'</p>':'')+'</div></section>');
   });
   const attendeeSection=attendees.length?('<h2>Requested attendees and representation</h2><p style="font-size:11px;color:#617064">The following attendance has been requested or recorded by Cabinet Secretariat. Attendance is not automatically confirmed.</p>'+
    attendeeTable(attendees,['Attendee','Office / position','Representation','Invitation / RSVP','Recorded attendance'],x=>[x.name,x.office,x.branch||x.sourceType,x.status+(x.notes?' · '+x.notes:''),(x.attendance||'Not yet recorded')+(x.attendanceNotes?' · '+x.attendanceNotes:'')])+
    (attendees.some(x=>x.attendance)?'<p style="font-size:11px;color:#617064">Attendance recorded by Cabinet Secretariat; entries marked as not recorded remain unverified.</p>':'')):
    '<p class="note">Requested attendance: to be confirmed by Cabinet Secretariat.</p>';
   rows.push(docPara('Closing business · Any other matters · Next meeting · Adjournment'));
   const content='<h1>'+safe(meeting.title)+'</h1>'+facts([['Date',meeting.date],['Time (SAST)',meeting.time],['Venue',meeting.venue],['Chair',meeting.chair]])+
    (meeting.notes?'<p class="note">Secretariat: '+safe(meeting.notes)+'</p>':'')+attendeeSection+'<h2>Order of Business</h2>'+rows.join('');
   return output('Cabinet_Agenda_'+meeting.date+'_'+meeting.id+'.html',docShell('Cabinet Secretariat','Cabinet Meeting Agenda','ministry',meeting.id,meeting.date,'Draft for Cabinet deliberation',content,await signBlock(store,env,'Agenda',meeting.id)));
  }
  if(!attendees.length)throw Error('There are no invited attendees to include in the register.');
  const count=kind=>attendees.filter(x=>x.attendance===kind).length;
  const totals='<p style="font:700 12px Arial,sans-serif;color:#164b3a">Invited: '+attendees.length+' · Present: '+count('Present')+' · Absent: '+count('Absent')+' · Excused: '+count('Excused')+' · Unrecorded: '+count('')+'</p>';
  const table=attendeeTable(attendees,['Participant','Office / Position','RSVP','Attendance','Notes','Recorded by / At'],x=>[x.name,x.office,x.status,x.attendance||'Not recorded',x.attendanceNotes||'',x.recordedAt?(x.recordedBy+' / '+x.recordedAt.slice(0,16).replace('T',' ')+' UTC'):'—']);
  const content='<h1>Meeting Attendance Register</h1>'+facts([['Meeting',meeting.title],['Date',meeting.date],['Time (SAST)',meeting.time],['Venue',meeting.venue]])+totals+table+'<p class="note">Unrecorded participants have not been verified as present or absent. This register is maintained by Cabinet Secretariat.</p>';
  return output('Cabinet_Attendance_'+meeting.date+'_'+meeting.id+'.html',docShell('Cabinet Secretariat','Cabinet Meeting Attendance Register','ministry',meeting.id,meeting.date,'Secretariat record',content,await signBlock(store,env,'Attendance',meeting.id)));
 }
 if(action==='proposedActDocument'){
  requiredRight(c,'viewProposals');const p=proposalDTO(await findDoc(store,'proposals',a));
  if(p.category!=='Legislation')throw Error('Only Bills can be exported as a proposed Act.');
  const d=await findDoc(store,'actDrafts',a),clauses=json(d[3],[]);
  if(!clauses.length)throw Error('No Bill clauses saved.');
  const bill={longTitle:str(d[1]),preamble:str(d[2]),clauses,explanatoryNote:str(d[4]),commencement:str(d[5])};
  return output('Proposed_Bill_'+p.id+'.html',originalProposedBill(p,bill,await signBlock(store,env,'Bill',p.id)));
 }
 if(action==='citizenCardHTML'){
  const r=citizenDTO(await findDoc(store,'citizenshipAttempts',a));
  if(r.discordId!==c.identity.id&&!c.rights.manageCitizenship)throw Error('Not authorised to export this card.');
  if(r.status!=='Approved')throw Error('Application has not been approved.');
  const photo=await robloxAvatarData(r.robloxId);
  return output((r.cardNumber||'RSAGP')+'_Citizenship_Card.html',originalCitizenshipCard(r,photo));
 }
 throw Error('Document operation not implemented.');
}
async function findDoc(store,bucket,id){const r=await store.get(bucket,id);if(!r)throw Error('Document record not found.');return r;}
function table(headers,rows){return '<table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';}
export const documentNames=new Set(['getMySignatureInfo','saveMySignature','removeMySignature','getCabinetDocumentSignoffStatus','signCabinetDocument','letterHTML','pressDocument','agendaDocument','meetingAttendanceDocument','proposedActDocument','citizenCardHTML']);
