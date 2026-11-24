import {bool,json,str} from './store.js';
export const CATALOG=[
 {name:'Workspace and registers',items:[['view','Open government workspace'],['viewCabinet','View Cabinet directory'],['viewOffices','View offices and staff'],['viewProposals','View policy submissions'],['viewMeetings','View Cabinet meetings'],['viewPress','View press office'],['viewActions','View action register'],['viewLetters','View documents and signatures'],['viewCitizenship','View citizenship review'],['viewApplications','View job applications'],['viewAudit','View audit trail']]},
 {name:'Cabinet and staff',items:[['manageMembers','Manage Cabinet appointments'],['manageOffices','Manage state offices'],['manageGroupStaff','Manage portal/group staff']]},
 {name:'Legislation and meetings',items:[['propose','Submit policy proposals and Bills'],['reviewProposals','Review policy proposals'],['manageMeetings','Schedule/edit/conclude meetings'],['inviteAttendees','Invite guests and officials'],['recordAttendance','Record Cabinet meeting attendance'],['recordDecisions','Record Cabinet decisions'],['exportMeetings','Export agendas and attendance registers'],['signAgendas','Sign Cabinet agendas'],['signAttendance','Sign attendance registers'],['signBills','Sign proposed Bills']]},
 {name:'Press, documents and actions',items:[['draftPress','Draft press releases'],['reviewPress','Approve press releases'],['publishPress','Publish press releases'],['signPress','Sign press releases'],['manageActions','Assign and update executive actions'],['writeLetters','Prepare and issue letters'],['canSignDocs','Upload/manage personal signature'],['signLetters','Sign issued letters']]},
 {name:'Citizenship and recruitment',items:[['manageCitizenship','Approve/decline citizenship requests'],['reviewApplications','Review job applications'],['manageCareerPositions','Edit recruitment vacancies and questions']]}
];
export const KEYS=CATALOG.flatMap(g=>g.items.map(x=>x[0]));
export const PAGE_RIGHTS={overview:'view',cabinet:'viewCabinet',offices:'viewOffices',proposals:'viewProposals',meetings:'viewMeetings',press:'viewPress',actions:'viewActions',letters:'viewLetters',citizenship:'viewCitizenship',applications:'viewApplications',audit:'viewAudit',administration:'superAdmin',permissions:'superAdmin'};
const IMPLIED={viewCabinet:['manageMembers'],viewOffices:['manageOffices','manageGroupStaff'],viewProposals:['propose','reviewProposals','signBills'],viewMeetings:['manageMeetings','inviteAttendees','recordAttendance','recordDecisions','exportMeetings','signAgendas','signAttendance'],viewPress:['draftPress','reviewPress','publishPress','signPress'],viewActions:['manageActions'],viewLetters:['writeLetters','canSignDocs','signLetters'],viewCitizenship:['manageCitizenship'],viewApplications:['reviewApplications','manageCareerPositions'],canSignDocs:['signAgendas','signAttendance','signBills','signPress','signLetters']};
const DEFAULT={
 'President':['view','manageMembers','manageOffices','reviewProposals','propose','manageMeetings','recordDecisions','draftPress','reviewPress','publishPress','manageActions','viewAudit','manageCitizenship','writeLetters','canSignDocs','reviewApplications','manageCareerPositions','inviteAttendees','recordAttendance','exportMeetings','signAgendas','signAttendance','signBills','signPress','signLetters'],
 'Deputy President':['view','manageMembers','manageOffices','reviewProposals','propose','manageMeetings','recordDecisions','draftPress','reviewPress','publishPress','manageActions','viewAudit','manageCitizenship','writeLetters','canSignDocs','reviewApplications','manageCareerPositions','inviteAttendees','recordAttendance','exportMeetings','signAgendas','signAttendance','signBills','signPress','signLetters'],
 'Cabinet Secretary':['view','propose','reviewProposals','manageMeetings','recordDecisions','draftPress','manageActions','manageCitizenship','canSignDocs','inviteAttendees','recordAttendance','exportMeetings','signAgendas','signAttendance','signBills'],
 'Minister':['view','propose','writeLetters','canSignDocs','signLetters'],
 'Press Secretary':['view','draftPress','publishPress'],
 'Group Staff':['view','viewCabinet','viewOffices']
};
export function defaults(){return Object.entries(DEFAULT).map(([name,permissions])=>({name,description:'Built-in Cabinet role',permissions,active:true,builtIn:true}));}
export const memberDTO=r=>({id:str(r[0]),username:str(r[1]),name:str(r[2]),position:str(r[3]),portfolio:str(r[4]),roles:str(r[5]).split(',').map(x=>x.trim()).filter(Boolean),active:bool(r[6]),appointed:str(r[7]),robloxId:str(r[10]),robloxUsername:str(r[11])});
export const appointmentDTO=r=>({id:str(r[0]),category:str(r[1]),office:str(r[2]),name:str(r[3]),discordId:str(r[4]),username:str(r[5]),branch:str(r[6]),notes:str(r[7]),active:bool(r[8]),appointed:str(r[9]),robloxId:str(r[12]),robloxUsername:str(r[13])});
export async function snapshot(store){
 const roles=defaults();
 for(const r of await store.all('accessRoles')) {
  const role={name:str(r[0]),description:str(r[1]),permissions:json(r[2],[]).filter(k=>KEYS.includes(k)),active:bool(r[3]),builtIn:bool(r[4])};
  const i=roles.findIndex(x=>x.name===role.name); if(i>=0)roles[i]=role;else roles.push(role);
 }
 const users=(await store.all('accessUsers')).map(r=>({id:str(r[0]),name:str(r[1]),roles:json(r[2],[]),allow:json(r[3],[]).filter(k=>KEYS.includes(k)),deny:json(r[4],[]).filter(k=>KEYS.includes(k)),active:bool(r[5])}));
 return {roles,users};
}
export async function context(store,env,identity) {
 const admins=str(env.SUPREME_ADMIN_DISCORD_IDS).split(',').map(x=>x.trim()).filter(Boolean);
 const presidents=str(env.PRESIDENT_DISCORD_IDS).split(',').map(x=>x.trim()).filter(Boolean);
 const supreme=admins.includes(identity.id),president=presidents.includes(identity.id);
 const memberRow=await store.get('members',identity.id);
 let member=memberRow && bool(memberRow[6])?memberDTO(memberRow):null;
 if (president) {member=member||{id:identity.id,username:identity.username,name:identity.username,position:'President',portfolio:'Office of the Presidency',roles:[],active:true};member.roles=[...new Set([...member.roles,'President'])];}
 if (supreme) {member=member||{id:identity.id,username:identity.username,name:identity.username,position:'Supreme Administrator',portfolio:'Government Administration',roles:[],active:true};member.roles=[...new Set([...member.roles,'Supreme Admin'])];}
 if (!member) {
  const app=(await store.all('appointments')).find(r=>str(r[1])==='Administration'&&str(r[4])===identity.id&&bool(r[8]));
  if(app){const a=appointmentDTO(app);member={id:identity.id,username:identity.username,name:a.name||identity.username,position:a.office||'Group Staff',portfolio:a.branch||'Portal Administration',roles:['Group Staff'],active:true,robloxId:a.robloxId,robloxUsername:a.robloxUsername};}
 }
 const s=await snapshot(store), assignment=s.users.find(x=>x.id===identity.id&&x.active);
 const names=[...new Set([...(member?.roles||[]),...(assignment?.roles||[])])];
 const grants=new Set();
 names.forEach(name=>s.roles.find(x=>x.name===name&&x.active)?.permissions.forEach(x=>grants.add(x)));
 assignment?.allow.forEach(x=>grants.add(x));
 Object.entries(IMPLIED).forEach(([key,children])=>{if(children.some(p=>grants.has(p)))grants.add(key);});
 if([...grants].some(x=>x!=='view'))grants.add('view');
 assignment?.deny.forEach(x=>grants.delete(x));
 Object.entries(IMPLIED).forEach(([parent,children])=>{if(parent.startsWith('view')&&!grants.has(parent))children.filter(x=>!(parent==='viewLetters'&&x==='canSignDocs')).forEach(x=>grants.delete(x));});
 if(!grants.has('view'))grants.clear();
 const rights=Object.fromEntries(KEYS.map(k=>[k,supreme||grants.has(k)]));
 rights.superAdmin=supreme;rights.managePermissions=supreme;rights.groupStaff=names.includes('Group Staff')&&!supreme;
 if(rights.view&&!member) member={id:identity.id,username:identity.username,name:identity.username,position:names[0]||'Authorised staff',portfolio:'Government Administration',roles:names,active:true};
 else if(member)member.roles=names;
 return {identity,member,rights,roles:s.roles,users:s.users};
}
export function requireRight(ctx,right){if(!ctx.rights[right])throw Error('You do not have permission to perform that action.');}
