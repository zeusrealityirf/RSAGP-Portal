import {str,bool,json} from './store.js';
import {memberDTO,appointmentDTO,requireRight,PAGE_RIGHTS,CATALOG} from './permissions.js';
export const careerDTO=r=>({id:str(r[0]),title:str(r[1]),portfolio:str(r[2]),summary:str(r[3]),icon:str(r[4])||'briefcase',questions:json(r[5],[]),open:bool(r[6]),sort:Number(r[7])||50,updated:str(r[8])});
export const applicationDTO=(r,answers=false)=>{const a={id:str(r[0]),discordId:str(r[1]),discordUsername:str(r[2]),robloxUsername:str(r[3]),robloxId:str(r[4]),positionId:str(r[5]),position:str(r[6]),status:str(r[9])||'Submitted',submitted:str(r[10]),updated:str(r[11]),reviewerId:str(r[12]),reviewer:str(r[13]),reviewNote:str(r[14])};if(answers)a.answers=json(r[7],[]);return a;};
export const citizenDTO=r=>({id:str(r[0]),discordId:str(r[1]),discordUser:str(r[2]),robloxId:str(r[3]),robloxUsername:str(r[4]),score:Number(r[5]),total:Number(r[6]),status:str(r[7]),submitted:str(r[8]),verifiedBy:str(r[9]),verified:str(r[10]),cardNumber:str(r[11]),reviewNote:str(r[12])});
export const proposalDTO=r=>({id:str(r[0]),created:str(r[1]),authorId:str(r[2]),author:str(r[3]),portfolio:str(r[4]),title:str(r[5]),category:str(r[6]),priority:str(r[7]),background:str(r[8]),recommendation:str(r[9]),budget:str(r[10]),decision:str(r[11]),status:str(r[12]),reviewedBy:str(r[13]),reviewNote:str(r[14]),reviewedAt:str(r[15]),meetingId:str(r[16])});
export const meetingDTO=r=>({id:str(r[0]),title:str(r[1]),date:str(r[2]).slice(0,10),time:str(r[3]).slice(0,5),venue:str(r[4]),chair:str(r[5]),status:str(r[6]),created:str(r[7]),createdBy:str(r[8]),proposalIds:json(r[9],[]),docUrl:str(r[10]),notes:str(r[11])});
export const attendeeDTO=r=>({id:str(r[0]),meetingId:str(r[1]),sourceType:str(r[2]),sourceId:str(r[3]),discordId:str(r[4]),name:str(r[5]),office:str(r[6]),branch:str(r[7]),status:str(r[8])||'Requested',notes:str(r[9]),attendance:str(r[12])||(str(r[8])==='Attended'?'Present':''),recordedAt:str(r[13]),recordedBy:str(r[14]),attendanceNotes:str(r[15])});
export const decisionDTO=r=>({id:str(r[0]),meetingId:str(r[1]),proposalId:str(r[2]),decision:str(r[3]),rationale:str(r[4]),recorderId:str(r[5]),created:str(r[6])});
export const pressDTO=r=>({id:str(r[0]),created:str(r[1]),authorId:str(r[2]),headline:str(r[3]),summary:str(r[4]),body:str(r[5]),quote:str(r[6]),spokesperson:str(r[7]),status:str(r[8]),approvedBy:str(r[9]),reviewNote:str(r[10]),docUrl:str(r[11]),updated:str(r[12]),published:str(r[13]),releaseDate:str(r[14]).slice(0,10)});
export const actionDTO=r=>({id:str(r[0]),meetingId:str(r[1]),task:str(r[2]),ownerId:str(r[3]),owner:str(r[4]),due:str(r[5]).slice(0,10),status:str(r[6]),created:str(r[7]),updated:str(r[8])});
export const letterDTO=r=>({id:str(r[0]),created:str(r[1]),authorId:str(r[2]),ministry:str(r[3]),kind:str(r[4]),recipient:str(r[5]),subject:str(r[6]),body:str(r[7]),status:str(r[8]),updated:str(r[9])});
const recent=(rows,n)=>rows.slice(-n).reverse();
export async function pageData(store,ctx,page){
 requireRight(ctx,'view');if(!PAGE_RIGHTS[page])throw Error('Unknown page.');requireRight(ctx,PAGE_RIGHTS[page]);
 const cache=new Map();const rows=async bucket=>{if(!cache.has(bucket))cache.set(bucket,await store.all(bucket));return cache.get(bucket);};
 const members=async()=> (await rows('members')).map(memberDTO).filter(x=>x.active||ctx.rights.manageMembers);
 const identity=ctx.identity;
 if(page==='overview'){
  const proposals=ctx.rights.viewProposals?(await rows('proposals')).map(proposalDTO):[];
  const meetings=ctx.rights.viewMeetings?(await rows('meetings')).map(meetingDTO):[];
  const press=ctx.rights.viewPress?(await rows('press')).map(pressDTO):[];
  const actions=ctx.rights.viewActions?(await rows('actions')).map(actionDTO):[];
  const next=meetings.filter(x=>x.status==='Scheduled'&&x.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
  return {counts:{members:ctx.rights.viewCabinet?(await rows('members')).filter(x=>bool(x[6])).length:0,proposals:proposals.filter(x=>x.status==='Submitted').length,meetings:meetings.filter(x=>x.status==='Scheduled').length,actions:actions.filter(x=>x.status!=='Completed').length},next,proposals:recent(proposals,5),press:recent(press.filter(x=>x.status==='Published'),4),tasks:recent(actions.filter(x=>x.ownerId===identity.id&&x.status!=='Completed'),4)};
 }
 if(page==='cabinet')return {members:await members()};
 if(page==='proposals')return {proposals:recent(await rows('proposals'),160).map(proposalDTO)};
 if(page==='meetings'){
  const meetings=recent(await rows('meetings'),80).map(meetingDTO);const ids=new Set(meetings.map(x=>x.id));
  return {meetings,proposals:(await rows('proposals')).map(proposalDTO).filter(x=>x.status==='Agenda Ready'),decisions:(await rows('decisions')).slice(-160).map(decisionDTO),members:(await rows('members')).map(memberDTO).filter(x=>x.active),offices:(await rows('appointments')).map(appointmentDTO).filter(x=>x.active&&x.category==='State office'),attendees:(await rows('meetingAttendees')).filter(x=>ids.has(str(x[1]))).map(attendeeDTO)};
 }
 if(page==='press')return {releases:recent(await rows('press'),160).map(pressDTO).filter(x=>x.status==='Published'||ctx.rights.draftPress||x.authorId===identity.id)};
 if(page==='actions')return {tasks:recent(await rows('actions'),160).map(actionDTO),members:await members(),meetings:(await rows('meetings')).slice(-80).map(meetingDTO)};
 if(page==='letters')return {hasSignature:!!(await store.get('signatures',identity.id))?.[1]?.startsWith('signatures/'),letters:recent(await rows('letters'),160).map(letterDTO).filter(x=>x.authorId===identity.id||ctx.rights.manageMembers)};
 if(page==='offices')return {offices:(await rows('appointments')).map(appointmentDTO).filter(x=>x.active||ctx.rights.manageOffices)};
 if(page==='administration')return {staff:(await rows('appointments')).map(appointmentDTO).filter(x=>x.category==='Administration'),members:(await rows('members')).map(memberDTO).filter(x=>x.active),audit:recent(await rows('audit'),15).map(r=>({at:str(r[0]),actor:str(r[2]),action:str(r[3]),detail:str(r[6])})),databaseSplitActive:false,databaseFolder:'',databases:[]};
 if(page==='citizenship')return {applications:recent(await rows('citizenshipAttempts'),160).map(citizenDTO)};
 if(page==='applications'){
  const apps=recent(await rows('jobApplications'),400).map(r=>applicationDTO(r,true));
  return {active:apps.filter(x=>['Submitted','Under review','Shortlisted'].includes(x.status)),history:apps.filter(x=>!['Submitted','Under review','Shortlisted'].includes(x.status)),positions:(await rows('careerPositions')).map(careerDTO).sort((a,b)=>a.sort-b.sort)};
 }
 if(page==='permissions')return {catalog:CATALOG,roles:ctx.roles,users:ctx.users,members:(await rows('members')).map(memberDTO).filter(x=>x.active).map(x=>({id:x.id,name:x.name||x.username,roles:x.roles}))};
 if(page==='audit')return {entries:recent(await rows('audit'),100).map(r=>({at:str(r[0]),actor:str(r[2]),action:str(r[3]),type:str(r[4]),id:str(r[5]),detail:str(r[6])}))};
 throw Error('Unknown page.');
}
