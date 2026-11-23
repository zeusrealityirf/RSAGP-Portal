/**
 * RSAGP permission manager. All grants are resolved server-side from Discord IDs.
 * SUPREME_ADMIN_DISCORD_IDS and Script Properties are deliberately NOT editable here.
 * A denied permission always overrides any non-Supreme role grant.
 */
const ACCESS_GROUPS_ = Object.freeze([
 {name:'Workspace and registers',items:[
  ['view','Open government workspace'],['viewCabinet','View Cabinet directory'],
  ['viewOffices','View offices and staff'],['viewProposals','View policy submissions'],
  ['viewMeetings','View Cabinet meetings'],['viewPress','View press office'],
  ['viewActions','View action register'],['viewLetters','View documents and signatures'],
  ['viewCitizenship','View citizenship review'],['viewApplications','View job applications'],
  ['viewAudit','View audit trail']]},
 {name:'Cabinet and staff',items:[
  ['manageMembers','Manage Cabinet appointments'],['manageOffices','Manage state offices'],
  ['manageGroupStaff','Manage portal/group staff']]},
 {name:'Legislation and meetings',items:[
  ['propose','Submit policy proposals and Bills'],['reviewProposals','Review policy proposals'],
  ['manageMeetings','Schedule/edit/conclude meetings'],['inviteAttendees','Invite guests and officials'],
  ['recordAttendance','Record Cabinet meeting attendance'],['recordDecisions','Record Cabinet decisions'],
  ['exportMeetings','Export agendas and attendance registers'],
  ['signAgendas','Sign Cabinet agendas'],['signAttendance','Sign attendance registers'],
  ['signBills','Sign proposed Bills']]},
 {name:'Press, documents and actions',items:[
  ['draftPress','Draft press releases'],['reviewPress','Approve press releases'],
  ['publishPress','Publish press releases'],['signPress','Sign press releases'],
  ['manageActions','Assign and update executive actions'],
  ['writeLetters','Prepare and issue letters'],['canSignDocs','Upload/manage personal signature'],
  ['signLetters','Sign issued letters']]},
 {name:'Citizenship and recruitment',items:[
  ['manageCitizenship','Approve/decline citizenship requests'],
  ['reviewApplications','Review job applications'],['manageCareerPositions','Edit recruitment vacancies and questions']]}
]);
const ACCESS_KEYS_=Object.freeze(ACCESS_GROUPS_.reduce((acc,g)=>acc.concat(g.items.map(x=>x[0])),[]));
const ACCESS_SET_=new Set(ACCESS_KEYS_);
const ACCESS_PAGE_RIGHTS_=Object.freeze({
  overview:'view',cabinet:'viewCabinet',offices:'viewOffices',proposals:'viewProposals',
  meetings:'viewMeetings',press:'viewPress',actions:'viewActions',letters:'viewLetters',
  citizenship:'viewCitizenship',applications:'viewApplications',audit:'viewAudit',
  administration:'superAdmin',permissions:'superAdmin'
});
const ACCESS_IMPLIED_=Object.freeze({
  viewCabinet:['manageMembers'],viewOffices:['manageOffices','manageGroupStaff'],
  viewProposals:['propose','reviewProposals','signBills'],
  viewMeetings:['manageMeetings','inviteAttendees','recordAttendance','recordDecisions','exportMeetings','signAgendas','signAttendance'],
  viewPress:['draftPress','reviewPress','publishPress','signPress'],
  viewActions:['manageActions'],viewLetters:['writeLetters','canSignDocs','signLetters'],
  viewCitizenship:['manageCitizenship'],
  viewApplications:['reviewApplications','manageCareerPositions'],
  canSignDocs:['signAgendas','signAttendance','signBills','signPress','signLetters']
});
// Defaults preserve permissions from the previous portal. All can be edited by Supreme Admin.
const ACCESS_DEFAULT_ROLE_PERMS_=Object.freeze({
 'President':['view','manageMembers','manageOffices','reviewProposals','propose','manageMeetings','recordDecisions','draftPress','reviewPress','publishPress','manageActions','viewAudit','manageCitizenship','writeLetters','canSignDocs','reviewApplications','manageCareerPositions'],
 'Deputy President':['view','manageMembers','manageOffices','reviewProposals','propose','manageMeetings','recordDecisions','draftPress','reviewPress','publishPress','manageActions','viewAudit','manageCitizenship','writeLetters','canSignDocs','reviewApplications','manageCareerPositions'],
 'Cabinet Secretary':['view','propose','reviewProposals','manageMeetings','recordDecisions','draftPress','manageActions','manageCitizenship','canSignDocs'],
 'Minister':['view','propose','writeLetters','canSignDocs'],
 'Press Secretary':['view','draftPress','publishPress'],
 'Group Staff':['view','viewCabinet','viewOffices']
});
const ACCESS_DEFAULT_EXTRAS_=Object.freeze({
 'President':['inviteAttendees','recordAttendance','exportMeetings','signAgendas','signAttendance','signBills','signPress','signLetters'],
 'Deputy President':['inviteAttendees','recordAttendance','exportMeetings','signAgendas','signAttendance','signBills','signPress','signLetters'],
 'Cabinet Secretary':['inviteAttendees','recordAttendance','exportMeetings','signAgendas','signAttendance','signBills'],
 'Minister':['signLetters']
});
function accessDefaultRole_(name){return [...new Set([...(ACCESS_DEFAULT_ROLE_PERMS_[name]||[]),...(ACCESS_DEFAULT_EXTRAS_[name]||[])])];}
function accessRoleName_(name){
 const n=String(name||'').trim();
 if(!/^[A-Za-z][A-Za-z0-9 &/\-]{1,49}$/.test(n))throw new Error('Role names must be 2–50 letters, numbers, spaces, & / or hyphens.');
 if(['Supreme Admin','Supreme Administrator','Executive Admin'].includes(n))throw new Error('Supreme Administrator is configured only in Script Properties.');
 return n;
}
function accessValidateKeys_(keys,label){
 if(!Array.isArray(keys)||keys.length>ACCESS_KEYS_.length)throw new Error('Invalid '+label+' permission list.');
 const out=[...new Set(keys.map(String))];
 if(out.some(k=>!ACCESS_SET_.has(k)))throw new Error('Unknown '+label+' permission.');
 return out;
}
function accessRoleRow_(r){return {name:String(r[0]),description:String(r[1]||''),permissions:accessValidateStored_(r[2]),active:bool_(r[3]),builtIn:bool_(r[4])};}
function accessUserRow_(r){return {id:String(r[0]),name:String(r[1]||''),roles:accessArray_(r[2]),allow:accessValidateStored_(r[3]),deny:accessValidateStored_(r[4]),active:bool_(r[5])};}
function accessArray_(json){const arr=parseJSON_(json,[]);return Array.isArray(arr)?arr.map(String):[];}
function accessValidateStored_(json){return accessArray_(json).filter(x=>ACCESS_SET_.has(x));}
function accessSnapshot_(ss){
 const roles=Object.keys(ACCESS_DEFAULT_ROLE_PERMS_).map(n=>({name:n,description:'Built-in Cabinet role',permissions:accessDefaultRole_(n),active:true,builtIn:true}));
 const sh=ss.getSheetByName('accessRoles');
 if(sh){table_(ss,'accessRoles').map(accessRoleRow_).forEach(r=>{const i=roles.findIndex(x=>x.name===r.name);if(i>=0)roles[i]=r;else roles.push(r);});}
 const users=ss.getSheetByName('accessUsers')?table_(ss,'accessUsers').map(accessUserRow_):[];
 return {roles,users};
}
function accessEffective_(member,identity,ss,supreme){
 const snapshot=accessSnapshot_(ss);
 const assignment=snapshot.users.find(x=>x.id===identity.id&&x.active);
 const names=[...new Set([...(member?.roles||[]),...(assignment?.roles||[])])];
 const grants=new Set();
 names.forEach(name=>{
  const role=snapshot.roles.find(r=>r.name===name&&r.active);
  if(role)role.permissions.forEach(k=>grants.add(k));
 });
 (assignment?.allow||[]).forEach(k=>grants.add(k));
 // A permission may bring its related workspace panel into view.
 Object.keys(ACCESS_IMPLIED_).forEach(k=>{if(ACCESS_IMPLIED_[k].some(p=>grants.has(p)))grants.add(k);});
 if([...grants].some(k=>k!=='view'))grants.add('view');
 (assignment?.deny||[]).forEach(k=>grants.delete(k));
 // Denying a page also prevents direct API calls that mutate the same section.
 // Keep signature storage independent: a press signatory may legitimately have
 // no access to the correspondence register.
 Object.entries(ACCESS_IMPLIED_).forEach(([parent,children])=>{
  if(parent.startsWith('view')&&!grants.has(parent))
    children.filter(child=>!(parent==='viewLetters'&&child==='canSignDocs')).forEach(child=>grants.delete(child));
 });
 // Workspace-wide Deny means no editable action can survive via a direct URL.
 if(!grants.has('view'))grants.clear();
 const rights={};ACCESS_KEYS_.forEach(k=>rights[k]=supreme||grants.has(k));
 rights.superAdmin=!!supreme;rights.managePermissions=!!supreme;
 rights.groupStaff=names.includes('Group Staff')&&!supreme;
 return {rights,roles:names,assignment};
}
function accessRolesForUI_(ss){return accessSnapshot_(ss).roles.filter(r=>r.active).map(r=>r.name).filter(n=>n!=='Group Staff');}
/** Run once from the Apps Script editor after upgrading. Idempotent. */
function setupAccessControl(){
 rsagpAssertWritable_();const cfg=config_();if(!cfg.sheetId)throw new Error('Run setupPortal once first.');
 const lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw new Error('Access setup is busy; retry shortly.');
 try{
  const ss=db_();['accessRoles','accessUsers'].forEach(name=>{
    let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
    const headers=GOV.sheets[name];if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
    else if(headers.some((h,i)=>sh.getRange(1,i+1).getDisplayValue()!==h))throw new Error('Unexpected '+name+' headers. Back up and inspect the tab.');
    sh.setFrozenRows(1);sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#164b3a').setFontColor('#fff');
  });
  const roleSheet=ss.getSheetByName('accessRoles'),existing=new Set(table_(ss,'accessRoles').map(r=>String(r[0])));
  const seed=Object.keys(ACCESS_DEFAULT_ROLE_PERMS_).filter(n=>!existing.has(n)).map(n=>[n,'Built-in role',JSON.stringify(accessDefaultRole_(n)),true,true,new Date(),'SYSTEM']);
  if(seed.length)roleSheet.getRange(roleSheet.getLastRow()+1,1,seed.length,7).setValues(seed);
  ss.getSheetByName('accessUsers').getRange('A:A').setNumberFormat('@');
  bumpDataVersion_();return {success:true,roles:existing.size+seed.length,message:'Permission manager ready. Existing permissions preserved.'};
 }finally{lock.releaseLock();}
}
function accessRequireSupreme_(token){const c=userContext_(token);if(!c.rights.superAdmin)throw new Error('Only a Script Property-configured Supreme Administrator can manage permissions.');return c;}
function saveAccessRole(token,payload){
 const c=accessRequireSupreme_(token),name=accessRoleName_(payload.name),permissions=accessValidateKeys_(payload.permissions,'role');
 const description=text_(payload.description||'',240),active=payload.active!==false;
 return withLock_(()=>{
  const ss=db_(),sh=ss.getSheetByName('accessRoles');if(!sh)throw new Error('Run setupAccessControl once.');
  const rows=table_(ss,'accessRoles'),old=rows.find(r=>String(r[0])===name);
  if(!old&&rows.length>=70)throw new Error('Maximum 70 roles. Disable unused roles before adding more.');
  const row=[name,cell_(description),JSON.stringify(permissions),active,old?bool_(old[4]):Object.prototype.hasOwnProperty.call(ACCESS_DEFAULT_ROLE_PERMS_,name),new Date(),c.identity.id];
  saveRow_(ss,'accessRoles',name,row);record_(ss,c.identity,'UPDATE_ACCESS_ROLE','Access Role',name,'Active '+active+'; '+permissions.length+' permissions');
  return {success:true,message:'Role saved. Changes apply to all users assigned this role.'};
 });
}
function saveAccessUser(token,payload){
 const c=accessRequireSupreme_(token),id=String(payload.id||'').trim();
 if(!isDiscordId_(id))throw new Error('Enter a permanent 17–22 digit Discord User ID.');
 const name=text_(payload.name||'',80),roles=Array.isArray(payload.roles)?[...new Set(payload.roles.map(String))]:[];
 const allow=accessValidateKeys_(payload.allow,'allow'),deny=accessValidateKeys_(payload.deny,'deny');
 if(allow.some(k=>deny.includes(k)))throw new Error('The same permission cannot be both allowed and denied.');
 const active=payload.active!==false;
 return withLock_(()=>{
  const ss=db_(),sh=ss.getSheetByName('accessUsers');if(!sh)throw new Error('Run setupAccessControl once.');
  const valid=new Set(accessSnapshot_(ss).roles.filter(r=>r.active).map(r=>r.name));
  if(roles.some(n=>!valid.has(n)))throw new Error('One or more selected roles are inactive or unknown.');
  const old=table_(ss,'accessUsers').find(r=>String(r[0])===id);
  const row=[id,cell_(name),JSON.stringify(roles),JSON.stringify(allow),JSON.stringify(deny),active,new Date(),c.identity.id];
  saveRow_(ss,'accessUsers',id,row);record_(ss,c.identity,'UPDATE_USER_ACCESS','Discord User',id,`Roles ${roles.join(', ')}; allow ${allow.length}; deny ${deny.length}; active ${active}`);
  return {success:true,message:'User permissions updated. New permissions apply to subsequent requests.'};
 });
}
function permissionManagerData_(ss){
 const d=accessSnapshot_(ss),staff=table_(ss,'members').map(memberDTO_);
 const members=staff.filter(x=>x.active).map(m=>({id:m.id,name:m.name||m.username,roles:m.roles}));
 return {catalog:ACCESS_GROUPS_,roles:d.roles,users:d.users,members};
}
