import {now,uuid,str,bool,json,text,required,isDiscordId,isoDate} from './store.js';
import {requireRight,KEYS,snapshot} from './permissions.js';
import {careerDTO,applicationDTO,citizenDTO,proposalDTO,meetingDTO,attendeeDTO,actionDTO,pressDTO,letterDTO} from './queries.js';
import {robloxProfile,robloxAvatarUrls} from './roblox.js';
const ok=(message='Saved.',extras={})=>({success:true,message,...extras});
const iso=now;
const id=(prefix)=>prefix+'-'+uuid();
const find=async(s,b,k)=>{const r=await s.get(b,k);if(!r)throw Error('Record not found.');return r;};
const log=async(s,c,action,type,record,detail)=>s.audit(c.identity,action,type,record,detail);
const right=(c,r)=>requireRight(c,r);
const safeList=(arr,len=100)=>{if(!Array.isArray(arr)||arr.length>len)throw Error('Invalid list.');return [...new Set(arr.map(String))];};
export const operations=Object.create(null);
const add=(name,rightKey,fn)=>{operations[name]={right:rightKey,run:fn};};

// EDITABLE ROLE/PERSON ACCESS: Supreme Administrators are ONLY in a Worker secret.
add('saveAccessRole','superAdmin',async(s,c,[p])=>{
 const name=required(p?.name,'Role name',50);
 if(!/^[A-Za-z][A-Za-z0-9 &/\-]{1,49}$/.test(name)||['Supreme Admin','Supreme Administrator','Executive Admin'].includes(name))throw Error('Invalid or reserved role name.');
 const permissions=safeList(p.permissions,KEYS.length);if(permissions.some(k=>!KEYS.includes(k)))throw Error('Unknown permission.');
 const existing=await s.get('accessRoles',name);
 if(!existing&&(await s.all('accessRoles')).length>=70)throw Error('Maximum 70 custom role records.');
 const isBuiltIn=(await snapshot(s)).roles.find(r=>r.name===name)?.builtIn||false;
 await s.save('accessRoles',name,[name,text(p.description,240),JSON.stringify(permissions),p.active!==false,isBuiltIn,iso(),c.identity.id]);
 await log(s,c,'UPDATE_ACCESS_ROLE','Access Role',name,permissions.length+' permissions');return ok('Role saved.');
});
add('saveAccessUser','superAdmin',async(s,c,[p])=>{
 const uid=str(p?.id).trim();if(!isDiscordId(uid))throw Error('Enter a permanent Discord User ID.');
 const roles=safeList(p.roles),allow=safeList(p.allow,KEYS.length),deny=safeList(p.deny,KEYS.length);
 if([...allow,...deny].some(k=>!KEYS.includes(k)))throw Error('Unknown permission.');
 if(allow.some(k=>deny.includes(k)))throw Error('Permission cannot be allowed and denied at once.');
 const names=new Set((await snapshot(s)).roles.filter(x=>x.active).map(x=>x.name));
 if(roles.some(n=>!names.has(n)))throw Error('Unknown or inactive role.');
 await s.save('accessUsers',uid,[uid,text(p.name,80),JSON.stringify(roles),JSON.stringify(allow),JSON.stringify(deny),p.active!==false,iso(),c.identity.id]);
 await log(s,c,'UPDATE_USER_ACCESS','Discord User',uid,'Permissions changed');return ok('User permissions updated.');
});

add('saveCabinetMember','manageMembers',async(s,c,[p])=>{
 const uid=required(p?.id,'Discord ID',22);if(!isDiscordId(uid))throw Error('Use a permanent Discord User ID.');
 const roles=safeList(p.roles,20),valid=new Set((await snapshot(s)).roles.filter(x=>x.active&&x.name!=='Group Staff').map(x=>x.name));
 if(!roles.length||roles.some(x=>!valid.has(x)))throw Error('Select valid cabinet roles.');
 if(roles.includes('President')&&!c.rights.superAdmin)throw Error('Only the Supreme Administrator can grant President access.');
 const old=await s.get('members',uid);
 if(old?.[5]?.split(',').includes('President')&&!c.rights.superAdmin)throw Error('Only Supreme Administrator may edit the President.');
 const presidents=str(c.env.PRESIDENT_DISCORD_IDS).split(',').map(x=>x.trim());
 if(presidents.includes(uid)&&(!roles.includes('President')||p.active===false))throw Error('A bootstrap President cannot be revoked here.');
 const adminIds=str(c.env.SUPREME_ADMIN_DISCORD_IDS).split(',').map(x=>x.trim());
 if(adminIds.includes(uid)&&!c.rights.superAdmin)throw Error('Supreme Administrator is protected.');
 const profile=str(p.robloxUsername).trim()?await robloxProfile(p.robloxUsername):null;
 const row=[uid,text(p.username,70),required(p.name,'Name',80),required(p.position,'Position',80),required(p.portfolio,'Portfolio',100),roles.join(','),p.active!==false,old?.[7]||iso(),iso(),c.identity.id,profile?.id||'',profile?.username||''];
 await s.save('members',uid,row);await log(s,c,'SAVE_MEMBER','Member',uid,row[3]);return ok('Cabinet appointment saved.');
});
add('saveAppointment',null,async(s,c,[p])=>{
 const category=str(p.category||'State office');if(!['State office','Administration'].includes(category))throw Error('Invalid office category.');
 if(category==='Administration')right(c,'manageGroupStaff');else right(c,'manageOffices');
 const office=required(p.office,'Office',130),name=required(p.name,'Holder name',90),discordId=text(p.discordId,22);
 if(discordId&&!isDiscordId(discordId))throw Error('Invalid Discord ID.');
 const old=p.id?await s.get('appointments',p.id):null;
 if(p.id&&!old)throw Error('Appointment not found.');
 if(old&&str(old[1])==='Administration')right(c,'manageGroupStaff');
 if(category==='Administration'&&!discordId)throw Error('Administration appointments require a Discord ID.');
 const idValue=old?str(old[0]):id('OFF');
 const profile=str(p.robloxUsername).trim()?await robloxProfile(p.robloxUsername):null;
 await s.save('appointments',idValue,[idValue,category,office,name,discordId,text(p.username,80),text(p.branch,130),text(p.notes,600),p.active!==false,old?.[9]||iso(),iso(),c.identity.id,profile?.id||'',profile?.username||'']);
 await log(s,c,'SAVE_APPOINTMENT','Office',idValue,office);return ok('Office saved.',{id:idValue});
});

add('saveCareerPosition','manageCareerPositions',async(s,c,[p])=>{
 const jobId=str(p?.id);if(!/^[a-z][a-z0-9-]{1,59}$/.test(jobId))throw Error('Invalid position reference.');
 if(!(await s.get('careerPositions',jobId)))throw Error('Position not found.');
 if(!Array.isArray(p.questions)||p.questions.length!==5)throw Error('Provide exactly five questions.');
 const questions=p.questions.map((x,i)=>required(x,'Question '+(i+1),350));
 const icon=['shield','coins','id','badge','scale','globe','briefcase','landmark'].includes(p.icon)?p.icon:'briefcase';
 const row=[jobId,required(p.title,'Position title',110),required(p.portfolio,'Portfolio',110),required(p.summary,'Description',360),icon,JSON.stringify(questions),p.open===true,Math.max(1,Math.min(99,Math.floor(Number(p.sort)||50))),iso(),c.identity.id];
 await s.save('careerPositions',jobId,row);await log(s,c,'UPDATE_CAREER_POSITION','Career Position',jobId,row[1]);return ok('Position updated.');
});
add('setCareerPositionOpen','manageCareerPositions',async(s,c,[jobId,open])=>{
 const row=await find(s,'careerPositions',jobId);row[6]=open===true;row[8]=iso();row[9]=c.identity.id;
 await s.save('careerPositions',jobId,row);await log(s,c,'CHANGE_CAREER_VACANCY','Career Position',jobId,row[6]?'Reopened':'Closed');return ok('Vacancy status updated.');
});
add('submitJobApplication',null,async(s,c,[p])=>{
 if(!p||typeof p!=='object')throw Error('Please complete your application.');
 const position=careerDTO(await find(s,'careerPositions',p.positionId));
 if(!position.open)throw Error('This vacancy is closed.');
 if(!Array.isArray(p.answers)||p.answers.length!==5||position.questions.length!==5)throw Error('Answer all five questions.');
 const answers=p.answers.map((a,i)=>{const t=required(a,'Answer '+(i+1),1100);if(t.length<18)throw Error('Please write at least 18 characters for answer '+(i+1)+'.');return {question:position.questions[i],answer:t};});
 const profile=await robloxProfile(required(p.robloxUsername,'Roblox username',20));
 const mine=(await s.all('jobApplications')).filter(r=>str(r[1])===c.identity.id);
 if(mine.some(r=>str(r[5])===position.id&&['Submitted','Under review','Shortlisted'].includes(str(r[9]))))throw Error('An active application for this position already exists.');
 const today=Date.now();
 if(mine.filter(r=>today-Date.parse(r[10])<7*86400000).length>=3)throw Error('Maximum three applications per seven days.');
 if(mine.some(r=>str(r[5])===position.id&&today-Date.parse(r[10])<7*86400000))throw Error('Wait seven days before applying again for this position.');
 const latest=await find(s,'careerPositions',position.id);
 if(!bool(latest[6])||JSON.stringify(json(latest[5]))!==JSON.stringify(position.questions))throw Error('Vacancy changed. Please refresh.');
 const appId=id('JOB'),stamp=iso();
 await s.create('jobApplications',appId,[appId,c.identity.id,c.identity.username,profile.username,profile.id,position.id,position.title,JSON.stringify(answers),'','Submitted',stamp,stamp,'','','']);
 await log(s,c,'SUBMIT_JOB_APPLICATION','Job Application',appId,position.title);
 return ok('Application submitted.',{id:appId});
});
add('withdrawJobApplication',null,async(s,c,[appId])=>{
 const r=await find(s,'jobApplications',appId);
 if(str(r[1])!==c.identity.id)throw Error('Application not found.');
 if(!['Submitted','Under review','Shortlisted'].includes(str(r[9])))throw Error('This application cannot be withdrawn.');
 r[9]='Withdrawn';r[11]=iso();await s.save('jobApplications',appId,r);
 await log(s,c,'WITHDRAW_JOB_APPLICATION','Job Application',appId,str(r[6]));return ok('Application withdrawn.');
});
add('reviewJobApplication','reviewApplications',async(s,c,[appId,p])=>{
 const status=str(p?.status),note=text(p?.note,1100);
 if(!['Under review','Shortlisted','Accepted','Declined'].includes(status))throw Error('Invalid application status.');
 if(status==='Declined'&&note.length<12)throw Error('Please provide a reason for declining.');
 const r=await find(s,'jobApplications',appId);
 if(str(r[1])===c.identity.id)throw Error('You cannot review your own application.');
 if(!['Submitted','Under review','Shortlisted'].includes(str(r[9])))throw Error('The application has already been completed.');
 if(status==='Accepted'){
  const position=await find(s,'careerPositions',r[5]);if(!bool(position[6]))throw Error('This vacancy has already been filled.');
  // Database trigger closes the vacancy atomically on acceptance. See migration 0002.
 }
 r[9]=status;r[11]=iso();r[12]=c.identity.id;r[13]=c.member?.name||c.identity.username;r[14]=note;
 try{await s.save('jobApplications',appId,r);}catch(e){if(/Vacancy/i.test(String(e)))throw Error('Vacancy was already filled or does not exist.');throw e;}
 await log(s,c,'REVIEW_JOB_APPLICATION','Job Application',appId,status+' '+str(r[6]));
 return ok(status==='Accepted'?'Application accepted and vacancy closed.':'Application marked '+status+'.');
});

add('checkRobloxUsername',null,async(s,c,[username])=>robloxProfile(username));
add('setMyRobloxAvatar',null,async(s,c,[username])=>{
 right(c,'view');
 const member=await s.get('members',c.identity.id);
 const appointment=(await s.all('appointments')).find(r=>str(r[4])===c.identity.id&&bool(r[8]));
 if(!member&&!appointment)throw Error('No Cabinet or administration profile found.');
 const profile=str(username).trim()?await robloxProfile(username):null;
 if(member){member[10]=profile?.id||'';member[11]=profile?.username||'';await s.save('members',c.identity.id,member);}
 if(appointment){appointment[12]=profile?.id||'';appointment[13]=profile?.username||'';await s.save('appointments',appointment[0],appointment);}
 await log(s,c,'SET_AVATAR','Profile',c.identity.id,profile?.username||'Removed');return ok('Avatar updated.',{robloxId:profile?.id||'',robloxUsername:profile?.username||''});
});
add('getRobloxAvatarMap','view',async(s,c,[ids])=>{
 const wanted=safeList(ids,50).filter(isDiscordId);
 const members=await s.all('members'),appointments=await s.all('appointments');
 const accountIds={};
 for(const account of wanted){
  const m=members.find(r=>str(r[0])===account&&bool(r[6]));
  const a=appointments.find(r=>str(r[4])===account&&bool(r[8]));
  const playerId=str(m?.[10]||a?.[12]);
  if(/^\d{1,20}$/.test(playerId))accountIds[account]=playerId;
 }
 // Batch all avatar IDs in one call instead of one Roblox network request per person.
 const thumbnails=await robloxAvatarUrls(Object.values(accountIds));
 const out={};
 for(const [account,playerId] of Object.entries(accountIds))if(thumbnails[playerId])out[account]=thumbnails[playerId];
 return out;
});

function rotatedQuestions(rows,uid){
 const active=rows.filter(r=>bool(r[7]));const day=new Date().toISOString().slice(0,10).replace(/-/g,'');let h=2166136261;
 for(const ch of day+'|'+uid){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}let seed=h>>>0;
 const out=active.slice();for(let i=out.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out.slice(0,10);
}
add('citizenContext',null,async(s,c)=>{
 const mine=(await s.all('citizenshipAttempts')).filter(r=>str(r[1])===c.identity.id);
 return {identity:c.identity,latest:mine.length?citizenDTO(mine.at(-1)):null,passPercent:80,questions:rotatedQuestions(await s.all('citizenshipQuestions'),c.identity.id).map(r=>({id:str(r[0]),question:str(r[1]),options:r.slice(2,6).map(str)}))};
});
add('takeCitizenshipTest',null,async(s,c,[p])=>{
 const username=required(p?.robloxUsername,'Citizen username',20),answers=p?.answers;
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('Complete the citizenship exam.');
 const questions=rotatedQuestions(await s.all('citizenshipQuestions'),c.identity.id);
 if(questions.length<4)throw Error('Citizenship exam is not configured.');
 if(questions.some(r=>!['A','B','C','D'].includes(str(answers[r[0]]))))throw Error('Please answer every question.');
 const mine=(await s.all('citizenshipAttempts')).filter(r=>str(r[1])===c.identity.id);
 if(mine.some(r=>['Pending Review','Approved'].includes(str(r[7]))))throw Error('You already have a pending or approved application.');
 if(mine.filter(r=>Date.now()-Date.parse(r[8])<86400000).length>=3)throw Error('Maximum three attempts per 24 hours.');
 const profile=await robloxProfile(username),score=questions.filter(r=>str(answers[r[0]])===str(r[6])).length;
 const passed=score*100>=questions.length*80,status=passed?'Pending Review':'Failed',appId=id('CIT');
 await s.create('citizenshipAttempts',appId,[appId,c.identity.id,c.identity.username,profile.id,profile.username,score,questions.length,status,iso(),'','','','']);
 await log(s,c,passed?'CITIZENSHIP_EXAM_PASS':'CITIZENSHIP_EXAM_FAIL','Citizenship',appId,score+'/'+questions.length);
 return ok(passed?'Test passed. Awaiting independent verification.':'Exam not passed.',{id:appId,score,total:questions.length,status});
});
add('reviewCitizenshipApplication','manageCitizenship',async(s,c,[appId,decision,notes])=>{
 if(!['Approved','Rejected'].includes(decision))throw Error('Invalid decision.');
 const note=required(notes,'Verification notes',600);if(decision==='Approved'&&note.length<15)throw Error('Describe independent account ownership verification.');
 const r=await find(s,'citizenshipAttempts',appId);
 if(str(r[7])!=='Pending Review')throw Error('Only pending citizenship applications can be reviewed.');
 if(str(r[1])===c.identity.id)throw Error('You cannot approve your own application.');
 if(decision==='Approved'&&(await s.all('citizenshipAttempts')).some(x=>str(x[3])===str(r[3])&&str(x[7])==='Approved'))throw Error('Player account already approved.');
 r[7]=decision;r[9]=c.identity.id;r[10]=iso();r[11]=decision==='Approved'?'RSA-CIT-'+new Date().getUTCFullYear()+'-'+uuid().slice(0,8):'';r[12]=note;
 await s.save('citizenshipAttempts',appId,r);await log(s,c,'REVIEW_CITIZENSHIP','Citizenship',appId,decision);return ok('Citizenship application '+decision.toLowerCase()+'.');
});

const categories=['Public services','Economy & finance','Infrastructure','Community safety','Foreign relations','Legislation','Other'];
const priorities=['Routine','Important','Urgent'];
add('submitProposal','propose',async(s,c,[p])=>{
 const title=required(p?.title,'Proposal title',150),background=required(p.background,'Background',2500),recommendation=required(p.recommendation,'Recommendation',3000),decision=required(p.decision,'Decision requested',1000);
 if(!categories.includes(p.category)||!priorities.includes(p.priority))throw Error('Invalid category or priority.');
 const old=p.id?await s.get('proposals',p.id):null;
 if(p.id&&!old)throw Error('Proposal not found.');
 if(old&&(str(old[2])!==c.identity.id||!['Returned','Submitted'].includes(str(old[12]))))throw Error('Only the author can revise this proposal.');
 const proposalId=old?str(old[0]):id('POL');
 await s.save('proposals',proposalId,[proposalId,old?.[1]||iso(),c.identity.id,c.identity.username,c.member?.portfolio||'',title,p.category,p.priority,background,recommendation,text(p.budget,500),decision,'Submitted','','','',old?.[16]||'']);
 if(p.category==='Legislation'){
  const d=p.actDraft;
  if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Complete the proposed Act details.');
  const clauses=d.clauses;
  if(!Array.isArray(clauses)||clauses.length<1||clauses.length>30)throw Error('A Bill needs between 1 and 30 numbered clauses.');
  const cleaned=clauses.map((x,i)=>({heading:required(x?.heading,'Clause heading '+(i+1),180),text:required(x?.text,'Clause text '+(i+1),3500)}));
  const draft=[proposalId,required(d.longTitle,'Long title',1800),text(d.preamble,2800),JSON.stringify(cleaned),text(d.explanatoryNote,3500),text(d.commencement,500)||'On a date determined after enactment',iso(),c.identity.id];
  await s.save('actDrafts',proposalId,draft);
 }
 await log(s,c,'SUBMIT_PROPOSAL','Proposal',proposalId,title);return ok('Proposal submitted.',{id:proposalId});
});
add('reviewProposal','reviewProposals',async(s,c,[proposalId,status,note])=>{
 if(!['Agenda Ready','Returned','Declined'].includes(status))throw Error('Invalid review status.');
 const r=await find(s,'proposals',proposalId);
 if(!['Submitted','Agenda Ready'].includes(str(r[12])))throw Error('Only submitted or agenda-ready proposals can be reviewed.');
 r[12]=status;r[13]=c.identity.id;r[14]=text(note,1000);r[15]=iso();await s.save('proposals',proposalId,r);
 await log(s,c,'REVIEW_PROPOSAL','Proposal',proposalId,status);return ok('Proposal reviewed.');
});
add('getActDraft','viewProposals',async(s,c,[proposalId])=>{
 const p=await find(s,'proposals',proposalId);
 if(str(p[6])!=='Legislation')throw Error('Not a proposed Bill.');
 const r=await s.get('actDrafts',proposalId);
 return r?{proposalId:str(r[0]),longTitle:str(r[1]),preamble:str(r[2]),clauses:json(r[3],[]),explanatoryNote:str(r[4]),commencement:str(r[5]),updated:str(r[6])}:{proposalId:str(proposalId),longTitle:'',preamble:'',clauses:[],explanatoryNote:'',commencement:''};
});

add('createMeeting','manageMeetings',async(s,c,[p])=>{
 const title=required(p?.title,'Meeting title',120),venue=required(p.venue,'Venue',160),chair=required(p.chair,'Chair',100);
 if(!isoDate(p.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(str(p.time)))throw Error('Enter a valid date and time.');
 const meetingId=id('CAB');await s.create('meetings',meetingId,[meetingId,title,p.date,p.time,venue,chair,'Scheduled',iso(),c.identity.id,'[]','',text(p.notes,1500)]);
 await log(s,c,'SCHEDULE_MEETING','Meeting',meetingId,title);return ok('Meeting scheduled.',{id:meetingId});
});
add('editMeeting','manageMeetings',async(s,c,[meetingId,p])=>{
 const r=await find(s,'meetings',meetingId);
 if(!isoDate(p.date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(str(p.time)))throw Error('Invalid date or time.');
 const status=str(p.status||'Scheduled');if(!['Scheduled','Cancelled','Concluded'].includes(status))throw Error('Invalid status.');
 if(str(r[6])==='Concluded'&&status!=='Concluded')throw Error('Concluded meetings cannot be reopened.');
 if(str(r[6])!=='Concluded'&&status==='Concluded')throw Error('Use Conclude to finalise meetings.');
 Object.assign(r,{1:required(p.title,'Meeting title',120),2:p.date,3:p.time,4:required(p.venue,'Venue',160),5:required(p.chair,'Chair',100),6:status,10:'',11:text(p.notes,1500)});
 await s.save('meetings',meetingId,r);await log(s,c,'EDIT_MEETING','Meeting',meetingId,r[1]);return ok('Meeting updated.');
});
add('updateMeetingAgenda','manageMeetings',async(s,c,[meetingId,ids])=>{
 const selected=safeList(ids,40),r=await find(s,'meetings',meetingId);
 if(['Concluded','Cancelled'].includes(str(r[6])))throw Error('Meeting is closed.');
 const approved=new Set((await s.all('proposals')).filter(x=>str(x[12])==='Agenda Ready').map(x=>str(x[0])));
 if(selected.some(x=>!approved.has(x)))throw Error('Select only agenda-ready proposals.');
 r[9]=JSON.stringify(selected);await s.save('meetings',meetingId,r);await log(s,c,'SET_AGENDA','Meeting',meetingId,selected.length+' items');return ok('Agenda updated.');
});
add('closeMeeting','manageMeetings',async(s,c,[meetingId])=>{
 const r=await find(s,'meetings',meetingId);if(str(r[6])==='Cancelled')throw Error('Cancelled meeting cannot be concluded.');
 r[6]='Concluded';await s.save('meetings',meetingId,r);await log(s,c,'CONCLUDE_MEETING','Meeting',meetingId,'');return ok('Meeting concluded.');
});
add('setMeetingAttendees','inviteAttendees',async(s,c,[meetingId,keys])=>{
 const m=await find(s,'meetings',meetingId);if(['Cancelled','Concluded'].includes(str(m[6])))throw Error('Meeting is closed.');
 const wanted=safeList(keys,80);if(wanted.some(k=>!/^((Cabinet:\d{17,22})|(Office:OFF-[A-Z0-9]+))$/.test(k)))throw Error('Invalid invitee.');
 const members=(await s.all('members')).filter(r=>bool(r[6]));const offices=(await s.all('appointments')).filter(r=>bool(r[8])&&str(r[1])==='State office');
 const directory={};for(const r of members)directory['Cabinet:'+r[0]]={type:'Cabinet',sourceId:r[0],discordId:r[0],name:r[2],office:r[3],branch:r[4]};
 for(const r of offices)directory['Office:'+r[0]]={type:'Office',sourceId:r[0],discordId:r[4],name:r[3],office:r[2],branch:r[6]};
 if(wanted.some(k=>!directory[k]))throw Error('An invitee is inactive or missing.');
 const current=(await s.all('meetingAttendees')).filter(r=>str(r[1])===str(meetingId));
 if(wanted.length+current.filter(r=>str(r[2])==='Guest'&&str(r[8])!=='Withdrawn').length>100)throw Error('Too many invitees.');
 const found=new Set();
 for(const r of current){if(str(r[2])==='Guest')continue;const key=(r[2]==='Cabinet'?'Cabinet:':'Office:')+str(r[3]);
  if(wanted.includes(key)){found.add(key);const p=directory[key],changed=str(r[4])!==str(p.discordId)||str(r[5])!==str(p.name),wasWithdrawn=r[8]==='Withdrawn';
   Object.assign(r,{4:p.discordId,5:p.name,6:p.office,7:p.branch,8:changed||wasWithdrawn?'Requested':r[8],10:iso(),11:c.identity.id});if(changed||wasWithdrawn)r.splice(12,4,'','','','');
  }else {r[8]='Withdrawn';r[10]=iso();r[11]=c.identity.id;}
  await s.save('meetingAttendees',r[0],r);
 }
 for(const key of wanted.filter(k=>!found.has(k))){const p=directory[key],attId=id('ATT');await s.create('meetingAttendees',attId,[attId,meetingId,p.type,p.sourceId,p.discordId,p.name,p.office,p.branch,'Requested','',iso(),c.identity.id,'','','','']);}
 await log(s,c,'SET_MEETING_ATTENDEES','Meeting',meetingId,wanted.length+' invitees');return ok('Requested attendees saved.',{count:wanted.length});
});
add('addMeetingGuest','inviteAttendees',async(s,c,[meetingId,p])=>{
 const m=await find(s,'meetings',meetingId);if(['Cancelled','Concluded'].includes(str(m[6])))throw Error('Meeting is closed.');
 const name=required(p.name,'Guest name',90),office=required(p.office,'Guest office',110),discordId=text(p.discordId,22);
 if(discordId&&!isDiscordId(discordId))throw Error('Invalid guest Discord ID.');
 const participants=(await s.all('meetingAttendees')).filter(r=>str(r[1])===str(meetingId)&&str(r[8])!=='Withdrawn');
 if(participants.length>=100)throw Error('Meeting has maximum attendees.');
 if(participants.some(r=>str(r[5]).toLowerCase()===name.toLowerCase()&&str(r[6]).toLowerCase()===office.toLowerCase()))throw Error('Guest already invited.');
 const attId=id('ATT');await s.create('meetingAttendees',attId,[attId,meetingId,'Guest','',discordId,name,office,text(p.branch,100),'Requested',text(p.notes,400),iso(),c.identity.id,'','','','']);
 await log(s,c,'ADD_MEETING_GUEST','Meeting',meetingId,name);return ok('Guest invited.',{id:attId});
});
add('updateMeetingAttendeeStatus','inviteAttendees',async(s,c,[attId,status])=>{
 if(!['Requested','Confirmed','Declined','Apologies','Attended','Withdrawn'].includes(status))throw Error('Invalid attendance status.');
 const r=await find(s,'meetingAttendees',attId);const m=await find(s,'meetings',r[1]);if(str(m[6])==='Cancelled')throw Error('Meeting is cancelled.');
 r[8]=status;r[10]=iso();r[11]=c.identity.id;if(status==='Attended'){r[12]='Present';r[13]=iso();r[14]=c.identity.id;}
 await s.save('meetingAttendees',attId,r);await log(s,c,'UPDATE_ATTENDANCE','Meeting',r[1],status);return ok('Attendance status updated.');
});
add('recordMeetingAttendance','recordAttendance',async(s,c,[meetingId,entries])=>{
 if(!Array.isArray(entries)||entries.length<1||entries.length>100)throw Error('Select one to 100 attendees.');
 const m=await find(s,'meetings',meetingId);if(str(m[6])==='Cancelled')throw Error('Meeting cancelled.');
 const ids=new Set();let changed=0;
 for(const e of entries){if(ids.has(e.id))throw Error('Duplicate attendee.');ids.add(e.id);if(!['Present','Absent','Excused','Unrecorded'].includes(e.attendance))throw Error('Invalid attendance.');
  const r=await find(s,'meetingAttendees',e.id);if(str(r[1])!==str(meetingId)||str(r[8])==='Withdrawn')throw Error('Attendee is not invited.');
  const value=e.attendance==='Unrecorded'?'':e.attendance,notes=text(e.notes,300);
  if(str(r[12])===value&&str(r[15])===notes)continue;
  r[12]=value;r[13]=value?iso():'';r[14]=value?c.identity.id:'';r[15]=notes;await s.save('meetingAttendees',e.id,r);changed++;
 }
 if(changed)await log(s,c,'RECORD_MEETING_ATTENDANCE','Meeting',meetingId,changed+' records');return ok('Attendance recorded.',{changed});
});
add('recordMeetingDecision','recordDecisions',async(s,c,[p])=>{
 const meetingId=required(p.meetingId,'Meeting',50),decision=str(p.decision),rationale=required(p.rationale,'Decision summary',1200),proposalId=text(p.proposalId,50);
 if(!['Approved','Deferred','Rejected','Action required'].includes(decision))throw Error('Invalid decision.');
 const m=await find(s,'meetings',meetingId);if(proposalId&&!json(m[9],[]).includes(proposalId))throw Error('Proposal is not on the agenda.');
 const decId=id('DEC');await s.create('decisions',decId,[decId,meetingId,proposalId,decision,rationale,c.identity.id,iso()]);
 await log(s,c,'RECORD_DECISION','Meeting',meetingId,decision);return ok('Decision recorded.',{id:decId});
});

add('savePressRelease','draftPress',async(s,c,[p])=>{
 const headline=required(p.headline,'Headline',180),summary=required(p.summary,'Summary',350),body=required(p.body,'Release body',6000),spokesperson=required(p.spokesperson,'Spokesperson',120);
 const releaseDate=str(p.releaseDate)||new Date().toISOString().slice(0,10);if(!isoDate(releaseDate))throw Error('Invalid release date.');
 const old=p.id?await s.get('press',p.id):null;if(p.id&&!old)throw Error('Release not found.');
 if(old&&str(old[2])!==c.identity.id&&!c.rights.reviewPress)throw Error('Only the author or reviewer may revise this release.');
 if(old&&!['Draft','Returned','Submitted'].includes(str(old[8])))throw Error('Published/approved releases cannot be changed.');
 const releaseId=old?str(old[0]):id('PRS'),status=p.submit?'Submitted':'Draft';
 await s.save('press',releaseId,[releaseId,old?.[1]||iso(),old?.[2]||c.identity.id,headline,summary,body,text(p.quote,1200),spokesperson,status,'','','',iso(),'',releaseDate]);
 await log(s,c,'SAVE_PRESS','Press',releaseId,status);return ok(status==='Submitted'?'Release submitted for review.':'Draft saved.',{id:releaseId});
});
add('reviewPressRelease','reviewPress',async(s,c,[releaseId,status,note])=>{
 if(!['Approved','Returned'].includes(status))throw Error('Invalid decision.');
 const r=await find(s,'press',releaseId);if(str(r[8])!=='Submitted')throw Error('Only submitted releases can be reviewed.');
 r[8]=status;r[9]=c.identity.id;r[10]=text(note,1000);r[11]='';r[12]=iso();
 await s.save('press',releaseId,r);await log(s,c,'REVIEW_PRESS','Press',releaseId,status);return ok('Release reviewed.');
});
add('publishPressRelease','publishPress',async(s,c,[releaseId])=>{
 const r=await find(s,'press',releaseId);if(str(r[8])!=='Approved')throw Error('Release must be approved.');
 r[8]='Published';r[11]='';r[12]=iso();r[13]=iso();await s.save('press',releaseId,r);
 await log(s,c,'PUBLISH_PRESS','Press',releaseId,'Published');return ok('Release published.');
});
add('createAction','manageActions',async(s,c,[p])=>{
 const task=required(p.task,'Action',500),ownerId=required(p.ownerId,'Owner',22),due=str(p.due),meetingId=text(p.meetingId,50);
 if(!isDiscordId(ownerId)||!isoDate(due))throw Error('Select a valid member and due date.');
 const member=await find(s,'members',ownerId);if(!bool(member[6]))throw Error('Member not active.');
 if(meetingId)await find(s,'meetings',meetingId);
 const actionId=id('ACT');await s.create('actions',actionId,[actionId,meetingId,task,ownerId,str(member[2]),due,'Not started',iso(),iso(),c.identity.id]);
 await log(s,c,'NEW_ACTION','Action',actionId,task);return ok('Action added.',{id:actionId});
});
add('updateActionStatus','view',async(s,c,[actionId,status])=>{
 if(!['Not started','In progress','Blocked','Completed'].includes(status))throw Error('Invalid action status.');
 const r=await find(s,'actions',actionId);if(str(r[3])!==c.identity.id&&!c.rights.manageActions)throw Error('Only the owner or leadership may update this action.');
 r[6]=status;r[8]=iso();await s.save('actions',actionId,r);await log(s,c,'ACTION_STATUS','Action',actionId,status);return ok('Action updated.');
});
add('saveGovLetter','writeLetters',async(s,c,[p])=>{
 const kind=str(p.kind||'Ministry');if(!['Presidential','Ministry','Gazette'].includes(kind))throw Error('Invalid letter type.');
 if(kind==='Presidential'&&!c.rights.superAdmin)throw Error('Presidential letters require Supreme Administrator.');
 const recipient=required(p.recipient,'Recipient',130),subject=required(p.subject,'Subject',170),body=required(p.body,'Body',6000);
 const old=p.id?await s.get('letters',p.id):null;if(p.id&&!old)throw Error('Letter not found.');
 if(old&&str(old[2])!==c.identity.id)throw Error('Only the author can edit a letter.');
 if(old&&str(old[8])==='Issued')throw Error('Issued letters cannot be edited.');
 const letterId=old?str(old[0]):id('LTR');
 await s.save('letters',letterId,[letterId,old?.[1]||iso(),c.identity.id,kind==='Presidential'?'Office of the Presidency':c.member?.portfolio||'',kind,recipient,subject,body,'Draft',iso()]);
 await log(s,c,'SAVE_LETTER','Letter',letterId,subject);return ok('Letter saved as draft.',{id:letterId});
});
add('issueGovLetter','writeLetters',async(s,c,[letterId])=>{
 const r=await find(s,'letters',letterId);if(str(r[2])!==c.identity.id)throw Error('Only the author may issue this letter.');
 if(str(r[4])==='Presidential'&&!c.rights.superAdmin)throw Error('Presidential letters require Supreme Administrator.');
 if(str(r[8])!=='Draft')throw Error('Letter already issued.');
 r[8]='Issued';r[9]=iso();await s.save('letters',letterId,r);await log(s,c,'ISSUE_LETTER','Letter',letterId,'Issued');return ok('Letter issued.');
});
