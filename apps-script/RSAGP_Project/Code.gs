/**
 * Republic of South Africa | RSAGP Cabinet Workspace
 * Independent project. Not affiliated with the real Republic of South Africa.
 * Server-enforced Discord identity, Cabinet workflow, meeting agendas, press docs.
 * Deploy web app as: Execute as ME / Who has access: Anyone.
 */
const GOV = Object.freeze({
  sheets: {
    members: ['Discord ID','Discord Username','Name','Position','Portfolio','Roles','Active','Appointed At','Updated At','Updated By','Roblox User ID','Roblox Username'],
    proposals: ['ID','Created At','Author ID','Author','Portfolio','Title','Category','Priority','Background','Recommendation','Budget Impact','Decision Requested','Status','Reviewed By','Review Note','Reviewed At','Meeting ID'],
    actDrafts: ['Proposal ID','Long Title / Purpose','Preamble','Clauses JSON','Explanatory Note','Commencement','Updated At','Updated By'],
    meetings: ['ID','Title','Date','Time','Venue','Chair','Status','Created At','Created By','Proposal IDs JSON','Agenda Doc URL','Chair Notes'],
    press: ['ID','Created At','Author ID','Headline','Summary','Body','Quote','Spokesperson','Status','Approved By','Review Note','Doc URL','Updated At','Published At','Release Date'],
    actions: ['ID','Meeting ID','Task','Owner ID','Owner','Due Date','Status','Created At','Updated At','Created By'],
    decisions: ['ID','Meeting ID','Proposal ID','Decision','Rationale','Recorder ID','Recorded At'],
    audit: ['Timestamp','Actor ID','Actor','Action','Record Type','Record ID','Details'],
    signatures: ['Discord ID','Drive File ID','Mime Type','Updated At'],
    documentSignoffs: ['Document Key','Type','Document ID','Content SHA-256','Signatory Discord ID','Name','Position','Signed At','Snapshot Drive File ID','Mime Type'],
    letters: ['ID','Created At','Author ID','Ministry','Kind','Recipient','Subject','Body','Status','Updated At'],
    citizenshipQuestions: ['Question ID','Question','Option A','Option B','Option C','Option D','Correct','Active'],
    citizenshipAttempts: ['ID','Discord ID','Discord Username','Player Account ID','Citizen Username','Score','Total','Status','Submitted At','Verified By','Verified At','Card Reference','Review Notes'],
    appointments: ['ID','Category','Office','Holder Name','Discord ID','Discord Username','Branch','Notes','Active','Appointed At','Updated At','Updated By','Roblox User ID','Roblox Username'],
    jobApplications: ['Application ID','Discord ID','Discord Username','Roblox Username','Roblox User ID','Position ID','Position Title','Answers JSON','Reserved','Status','Submitted At','Updated At','Reviewer Discord ID','Reviewer Name','Review Notes'],
    careerPositions: ['Position ID','Title','Portfolio','Description','Icon','Questions JSON','Open','Display Order','Updated At','Updated By'],
    meetingAttendees: ['ID','Meeting ID','Source Type','Source ID','Discord ID','Display Name','Office / Position','Portfolio / Branch','Attendance Status','Secretariat Notes','Updated At','Updated By','Recorded Attendance','Recorded At','Recorded By','Attendance Notes'],
    accessRoles: ['Role Name','Description','Permissions JSON','Active','Built-in','Updated At','Updated By'],
    accessUsers: ['Discord ID','Display Name','Roles JSON','Allow JSON','Deny JSON','Active','Updated At','Updated By']
  },
  roles: ['President','Deputy President','Cabinet Secretary','Minister','Press Secretary'],
  proposalCategories: ['Public services','Economy & finance','Infrastructure','Community safety','Foreign relations','Legislation','Other'],
  priority: ['Routine','Important','Urgent'],
  agendaStatuses: ['Submitted','Agenda Ready','Returned','Declined'],
  pressStatuses: ['Draft','Submitted','Approved','Returned','Published'],
  actions: ['Not started','In progress','Blocked','Completed']
});

function properties_(){return PropertiesService.getScriptProperties();}
function config_(){
  // One properties-service round trip instead of six serial reads.
  const p=properties_().getProperties();return {
    clientId:String(p.DISCORD_CLIENT_ID||'').trim(),
    clientSecret:String(p.DISCORD_CLIENT_SECRET||'').trim(),
    webAppUrl:String(p.WEB_APP_URL||'').trim(),
    sheetId:String(p.GOV_SHEET_ID||'').trim(),
    presidents:String(p.PRESIDENT_DISCORD_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),
    supremeAdmins:String(p.SUPREME_ADMIN_DISCORD_IDS||'').split(',').map(x=>x.trim()).filter(Boolean),
    meetingDbId:String(p.GOV_MEETING_DB_ID||'').trim(),
    citizenDbId:String(p.GOV_CITIZEN_DB_ID||'').trim(),
    splitActive:p.GOV_SPLIT_ACTIVE==='true',
    multiActive:p.GOV_MULTI_ACTIVE==='true',
    multiIds:Object.fromEntries(['policy','meeting','actions','press','documents','citizen','careers','audit'].map(group=>
      [group,String(p['GOV_MULTI_'+group.toUpperCase()+'_ID']||'').trim()]))
  };
}
function setupPortal(){
  const p=properties_();let id=String(p.getProperty('GOV_SHEET_ID')||'').trim();
  if(!id){
    const created=SpreadsheetApp.create('RSAGP | Cabinet Database');
    id=created.getId();p.setProperty('GOV_SHEET_ID',id);
  }
  const ss=db_();
  Object.keys(GOV.sheets).forEach(name=>{
    let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);
    const headers=GOV.sheets[name];
    // Append-only schema upgrades: never reorder existing Cabinet records.
    if(name==='members'&&sh.getMaxColumns()<headers.length)
      sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    // Older meetingAttendees sheets may have only the original 12 columns.
    if(name==='meetingAttendees'&&sh.getMaxColumns()<headers.length)
      sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    // Older appointments sheets may not yet store Roblox avatar links for staff.
    if(name==='appointments'&&sh.getMaxColumns()<headers.length)
      sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
    else{
      const existing=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
      if(name==='members'&&headers.slice(0,10).every((v,i)=>existing[i]===v)&&!existing[10]&&!existing[11])
        sh.getRange(1,11,1,2).setValues([headers.slice(10)]);
      else if(name==='appointments' &&
              headers.slice(0,12).every((title,i)=>title===existing[i]) &&
              headers.slice(12).some((title,i)=>title!==existing[i+12])){
        // Safe, additive two-column migration for staff Roblox avatar links.
        if(existing.slice(12).some(x=>x))throw new Error('Unexpected avatar columns in appointments. Back up and inspect manually.');
        sh.getRange(1,13,1,2).setValues([headers.slice(12)]);
      }
      else if(name==='citizenshipAttempts') migrateCitizenshipHeaderLabels_(sh,existing,headers);
      else if(name==='meetingAttendees' &&
              headers.slice(0,12).every((title,i)=>title===existing[i]) &&
              headers.slice(12).some((title,i)=>title!==existing[i+12])){
        // Safe, additive four-column migration. Existing invitations and status
        // history remain in columns A:L without reordering or deletion.
        if(existing.slice(12).some(x=>x))throw new Error('Unexpected attendance columns in meetingAttendees. Back up and inspect manually.');
        sh.getRange(1,13,1,4).setValues([headers.slice(12)]);
        // A status previously marked Attended was already treated as an
        // attendance confirmation. Preserve it as Present with its old audit
        // timestamp and recorder, instead of losing that historical action.
        const count=sh.getLastRow()-1;
        if(count>0){
          const oldRows=sh.getRange(2,9,count,4).getValues();
          const previous=oldRows.map(r=>String(r[0])==='Attended'?['Present',r[2]||'',r[3]||'','']:['','','','']);
          sh.getRange(2,13,count,4).setValues(previous);
        }
      }
      else if(headers.some((title,i)=>title!==existing[i]))throw new Error('Sheet "'+name+'" has unexpected columns. Back up and inspect rather than overwriting it.');
    }
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#164b3a').setFontColor('#ffffff');
    // Discord identifiers must NEVER be stored as floating-point numbers.
    if(name==='members'){sh.getRange('A:A').setNumberFormat('@');sh.getRange('K:K').setNumberFormat('@');}
    if(name==='accessUsers')sh.getRange('A:A').setNumberFormat('@');
    if(name==='documentSignoffs'){sh.getRange('E:E').setNumberFormat('@');sh.getRange('A:A').setNumberFormat('@');}
    if(name==='appointments'){sh.getRange('E:E').setNumberFormat('@');sh.getRange('M:M').setNumberFormat('@');}
    if(name==='meetingAttendees')sh.getRange('E:E').setNumberFormat('@');
    if(name==='proposals')sh.getRange('C:C').setNumberFormat('@');
    if(name==='press')sh.getRange('C:C').setNumberFormat('@');
    if(name==='actions')sh.getRange('D:D').setNumberFormat('@');
    if(name==='decisions')sh.getRange('F:F').setNumberFormat('@');
    if(name==='audit')sh.getRange('B:B').setNumberFormat('@');
    if(name==='signatures')sh.getRange('A:A').setNumberFormat('@');
    if(name==='letters')sh.getRange('C:C').setNumberFormat('@');
    if(name==='citizenshipAttempts'){sh.getRange('B:B').setNumberFormat('@');sh.getRange('D:D').setNumberFormat('@');}
    if(name==='jobApplications'){sh.getRange('B:B').setNumberFormat('@');sh.getRange('E:E').setNumberFormat('@');sh.getRange('M:M').setNumberFormat('@');}
  });
  // Seed editable Careers vacancies on a fresh deployment only.
  const careerSheet=ss.getSheetByName('careerPositions');
  if(careerSheet&&careerSheet.getLastRow()===1){
    const seeded=careerDefaults_().map(careerRow_);
    careerSheet.getRange(2,1,seeded.length,GOV.sheets.careerPositions.length).setValues(seeded);
  }
  const quizSheet=ss.getSheetByName('citizenshipQuestions');
  if(quizSheet.getLastRow()===1){
    const seed=questionBankData_();
    quizSheet.getRange(2,1,seed.length,8).setValues(seed);
  }
  const presidents=config_().presidents;
  if(!presidents.length&&!config_().supremeAdmins.length)throw new Error('Set SUPREME_ADMIN_DISCORD_IDS or PRESIDENT_DISCORD_IDS in Script Properties before running setupPortal.');
  config_().supremeAdmins.forEach(id=>{if(!isDiscordId_(id))throw new Error('Invalid Supreme Admin Discord ID: '+id);});
  const sh=ss.getSheetByName('members');const existing=table_(ss,'members');
  presidents.forEach(id=>{
    if(!isDiscordId_(id))throw new Error('Invalid President Discord ID: '+id);
    if(!existing.some(r=>String(r[0])===id))sh.appendRow([id,'','President','President','Office of the Presidency','President',true,new Date(),new Date(),'SETUP']);
  });
  bumpDataVersion_();
  console.log('RSAGP Cabinet database ready: '+ss.getUrl());
  return {spreadsheetUrl:ss.getUrl(),message:'Database prepared. Deploy the web app and configure Discord OAuth.'};
}
/** A header-label-only migration. No citizenship records or column positions move. */
function migrateCitizenshipHeaderLabels_(sheet,existing,headers){
  if(headers.every((label,i)=>label===existing[i]))return false;
  const legacy=existing.slice();
  legacy[3]='Player Account ID';legacy[4]='Citizen Username';
  if(existing[3]==='Roblox ID'&&existing[4]==='Roblox Username'&&
      legacy.every((value,i)=>value===headers[i])){
    sheet.getRange(1,4,1,2).setValues([[headers[3],headers[4]]]);
    return true;
  }
  throw new Error('citizenshipAttempts has unexpected column names. Back up and inspect the sheet before proceeding.');
}
/** Optional, safe one-time label update for an existing deployment. */
function updateCitizenshipColumnLabels(){
  const sheet=db_().getSheetByName('citizenshipAttempts');
  if(!sheet)throw new Error('Missing citizenshipAttempts. Run setupPortal to create a new database.');
  const headers=GOV.sheets.citizenshipAttempts;
  const existing=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
  const changed=migrateCitizenshipHeaderLabels_(sheet,existing,headers);
  return changed?'Citizenship column labels updated; all data preserved.':'Citizenship column labels are already current.';
}
function installDefaultCitizenshipQuestionBank(){
  const ss=db_(),sh=ss.getSheetByName('citizenshipQuestions');
  if(!sh)throw new Error('Missing citizenshipQuestions sheet. Run setupPortal first.');
  const rows=questionBankData_();
  if(sh.getLastRow()>1)sh.getRange(2,1,sh.getLastRow()-1,8).clearContent();
  sh.getRange(2,1,rows.length,8).setValues(rows);
  return {success:true,message:'Default rotating South African civics question bank installed.',count:rows.length};
}
/** Safe editor check: validates configuration but never returns the actual IDs. */
function verifySupremeAdminConfiguration(){
  const ids=config_().supremeAdmins;
  if(!ids.length)throw new Error('Set SUPREME_ADMIN_DISCORD_IDS in Project Settings > Script Properties.');
  if(ids.some(id=>!isDiscordId_(id)))throw new Error('One or more Supreme Admin IDs are invalid; use permanent Discord User IDs separated by commas.');
  return 'Supreme Administrator configured: '+ids.length+' Discord account(s). Sign into the deployed portal with one of those accounts.';
}
function verifySetup(){
  const c=config_();if(!c.clientId||!c.clientSecret||!c.webAppUrl||!c.sheetId||(!c.presidents.length&&!c.supremeAdmins.length))throw new Error('Missing Script Properties. See README.md.');
  const ss=db_();
  Object.keys(GOV.sheets).forEach(name=>{if(!ss.getSheetByName(name))throw new Error('Missing '+name+' sheet. Run setupPortal.');});
  return 'Configuration valid. Spreadsheet: '+ss.getUrl();
}
/** Three optional Google Sheets workbooks, opened lazily per execution.
 * Normal installations remain fully functional with GOV_SHEET_ID alone.
 */
const GOV_DB_GROUPS_=Object.freeze({
  meeting:['meetings','meetingAttendees','decisions','actions'],
  citizen:['citizenshipQuestions','citizenshipAttempts']
});
const GOV_SHEET_GROUP_=Object.freeze(Object.keys(GOV.sheets).reduce((map,name)=>{
  map[name]=GOV_DB_GROUPS_.meeting.includes(name)?'meeting':
    GOV_DB_GROUPS_.citizen.includes(name)?'citizen':'core';
  return map;
},{}));
// Each group owns only its relevant tabs. A new smaller core workbook
// will hold Cabinet identities and staff; the original database is retained as backup.
const GOV_MULTI_GROUPS_=Object.freeze({
  core:['members','appointments','accessRoles','accessUsers'],
  policy:['proposals','actDrafts'],
  meeting:['meetings','meetingAttendees','decisions'],
  actions:['actions'],
  press:['press'],
  documents:['letters','signatures','documentSignoffs'],
  citizen:['citizenshipQuestions','citizenshipAttempts'],
  careers:['careerPositions','jobApplications'],
  audit:['audit']
});
const GOV_MULTI_GROUP_FOR_SHEET_=Object.freeze(Object.keys(GOV.sheets).reduce((out,name)=>{
  out[name]=Object.keys(GOV_MULTI_GROUPS_).find(g=>GOV_MULTI_GROUPS_[g].includes(name))||'core';
  return out;
},{}));
const GOV_DB_HANDLES_={};
function governmentBook_(id){
  if(!id)throw new Error('A required RSAGP database ID is missing. Check Script Properties.');
  if(!GOV_DB_HANDLES_[id])GOV_DB_HANDLES_[id]=SpreadsheetApp.openById(id);
  return GOV_DB_HANDLES_[id];
}
function db_(){
  const c=config_();if(!c.sheetId)throw new Error('Database not configured. Run setupPortal.');
  const legacy={core:c.sheetId,meeting:c.splitActive?c.meetingDbId:c.sheetId,
    citizen:c.splitActive?c.citizenDbId:c.sheetId};
  if(!c.multiActive&&c.splitActive&&(!c.meetingDbId||!c.citizenDbId))
    throw new Error('Split database configuration is incomplete. Check the two database IDs.');
  if(c.multiActive&&Object.keys(GOV_MULTI_GROUPS_).some(g=>g!=='core'&&!c.multiIds[g]))
    throw new Error('Multi-database configuration is incomplete. Run verifyRSAGPMultiDatabaseSplit.');
  const getBook=name=>c.multiActive?
    governmentBook_(name in GOV.sheets? (c.multiIds[GOV_MULTI_GROUP_FOR_SHEET_[name]]||c.sheetId):c.sheetId):
    governmentBook_(legacy[GOV_SHEET_GROUP_[name]||'core']);
  return {
    getSheetByName(name){return getBook(name).getSheetByName(name);},
    insertSheet(name){return getBook(name).insertSheet(name);},
    getUrl(){return governmentBook_(c.sheetId).getUrl();}
  };
}
/** The database migration must never be callable by regular web-app visitors.
 * In the editor, the signed-in account must be the account executing the script.
 * This requires the userinfo.email OAuth scope in appsscript.json.
 */
function requireDatabaseEditor_(){
  const active=String(Session.getActiveUser().getEmail()||'').trim().toLowerCase();
  const effective=String(Session.getEffectiveUser().getEmail()||'').trim().toLowerCase();
  if(!active||!effective||active!==effective)
    throw new Error('Run this database maintenance function as the Apps Script owner from the editor.');
}
/** Copy—not move—meeting and citizen sheets. Explicitly opt in after backing up.
 * Uses a shared script lock to block conflicting portal mutations. If interrupted,
 * rerun safely; the primary workbook is NEVER modified or removed.
 */
function migrateToSplitDatabases(){
  requireDatabaseEditor_();
  const cfg=config_();if(!cfg.sheetId)throw new Error('Run setupPortal first.');
  if(cfg.multiActive)throw new Error('The newer multi-database split is active. Do not run the legacy migration.');
  if(cfg.splitActive)return verifySplitDatabases();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Portal is busy. Retry the migration during quiet hours.');
  try{
    const p=properties_(),core=governmentBook_(cfg.sheetId);
    const targetIds={};
    const definitions=[['meeting','GOV_MEETING_STAGING_ID','RSAGP | Cabinet Meetings & Attendance'],
      ['citizen','GOV_CITIZEN_STAGING_ID','RSAGP | Citizenship Records']];
    definitions.forEach(([group,key,title])=>{
      let id=String(p.getProperty(key)||'').trim();
      if(!id){const book=SpreadsheetApp.create(title);id=book.getId();p.setProperty(key,id);}
      targetIds[group]=id;
      const dest=governmentBook_(id);
      GOV_DB_GROUPS_[group].forEach(name=>{
        const source=core.getSheetByName(name);
        if(!source)throw new Error('Missing original '+name+' sheet. Run setupPortal first.');
        const existing=dest.getSheetByName(name);
        if(existing)dest.deleteSheet(existing); // Staging only; never edit the source
        const copied=source.copyTo(dest);
        copied.setName(name);
        verifyCopiedTab_(source,copied,name);
      });
      const empty=dest.getSheetByName('Sheet1');
      if(empty&&dest.getSheets().length>1&&empty.getLastRow()===0)dest.deleteSheet(empty);
    });
    // Only activate after BOTH workbooks pass the checks; originals remain in core.
    p.setProperties({GOV_MEETING_DB_ID:targetIds.meeting,
      GOV_CITIZEN_DB_ID:targetIds.citizen,GOV_SPLIT_ACTIVE:'true'});
    bumpDataVersion_();
    return verifySplitDatabases();
  }finally{lock.releaseLock();}
}
function verifyCopiedTab_(source,dest,name){
  const expected=GOV.sheets[name],rowCount=source.getLastRow();
  if(dest.getLastRow()!==rowCount)throw new Error('Copy failed: '+name+' row count differs. Split not activated.');
  const firstSrc=source.getRange(1,1,1,expected.length).getDisplayValues()[0];
  const firstDst=dest.getRange(1,1,1,expected.length).getDisplayValues()[0];
  if(firstSrc.join('\u001f')!==firstDst.join('\u001f'))throw new Error('Copy failed: '+name+' headers differ.');
  if(rowCount>1){
    for(const row of [...new Set([2,rowCount])]){
      const a=source.getRange(row,1,1,Math.min(expected.length,9)).getDisplayValues()[0];
      const b=dest.getRange(row,1,1,Math.min(expected.length,9)).getDisplayValues()[0];
      if(a.join('\u001f')!==b.join('\u001f'))throw new Error('Copy failed: '+name+' sample data differs.');
    }
  }
}
function verifySplitDatabases(){
  requireDatabaseEditor_();
  const c=config_();
  if(!c.splitActive)return {active:false,message:'Using the original single spreadsheet. Optional migration not yet enabled.'};
  const results=[];
  [['meeting',c.meetingDbId],['citizen',c.citizenDbId]].forEach(([group,id])=>{
    const book=governmentBook_(id);
    GOV_DB_GROUPS_[group].forEach(name=>{
      const sh=book.getSheetByName(name);
      if(!sh)throw new Error('Missing '+name+' in '+group+' workbook. Restore backup before editing.');
      results.push({sheet:name,rows:Math.max(0,sh.getLastRow()-1)});
    });
  });
  return {active:true,coreUrl:governmentBook_(c.sheetId).getUrl(),
    meetingUrl:governmentBook_(c.meetingDbId).getUrl(),
    citizenshipUrl:governmentBook_(c.citizenDbId).getUrl(),sheets:results};
}
/** The target folder belongs to the RSAGP operator. Existing sheets are copied,
 * never moved or deleted. Call from Apps Script editor as the deploying owner.
 * A maintenance lock blocks normal portal mutations between migration steps.
 * One group per execution avoids Apps Script's six-minute limit.
 */
const GOV_MULTI_FOLDER_ID_='1UEG-o84fCObtu495pduMHEWyy1wBItar';
const GOV_MULTI_TITLES_=Object.freeze({
  core:'RSAGP | Cabinet Directory & Staff',
  policy:'RSAGP | Policy & Legislation',
  meeting:'RSAGP | Cabinet Meetings & Attendance',
  actions:'RSAGP | Executive Actions',
  press:'RSAGP | Press Office',
  documents:'RSAGP | Documents & Signatures',
  citizen:'RSAGP | Citizenship Services',
  careers:'RSAGP | Government Careers',
  audit:'RSAGP | Security & Audit Trail'
});
const GOV_MULTI_ORDER_=Object.freeze(['core','policy','meeting','actions','press','documents','citizen','careers','audit']);
function rsagpMigrationStatus_(){
  const p=properties_().getProperties();
  const completed=String(p.GOV_MULTI_COPIED||'').split(',').filter(Boolean);
  return {folder:'https://drive.google.com/drive/folders/'+GOV_MULTI_FOLDER_ID_,
    active:p.GOV_MULTI_ACTIVE==='true',maintenance:p.GOV_MIGRATION_READONLY==='true',
    completed:completed,remaining:GOV_MULTI_ORDER_.filter(g=>!completed.includes(g)),
    workbooks:GOV_MULTI_ORDER_.map(group=>({group,
      spreadsheetId:String(p['GOV_MULTI_STAGING_'+group.toUpperCase()+'_ID']||''),
      copied:completed.includes(group)}))};
}
/** Run once. It creates 9 empty staging workbooks IN the specified folder,
 * retaining the original GOV_SHEET_ID workbook and any old split workbooks.
 */
function prepareRSAGPMultiDatabaseSplit(){
  requireDatabaseEditor_();
  const c=config_();if(c.multiActive)return verifyRSAGPMultiDatabaseSplit();
  if(!c.sheetId)throw new Error('Run setupPortal first. No source database ID is configured.');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Portal busy; prepare during a maintenance window.');
  try{
    const p=properties_();
    const folder=DriveApp.getFolderById(GOV_MULTI_FOLDER_ID_);
    if(!folder)throw new Error('The RSAGP Sheets Drive folder is not accessible.');
    const folderAccess=folder.getSharingAccess();
    if(folderAccess===DriveApp.Access.ANYONE||folderAccess===DriveApp.Access.ANYONE_WITH_LINK)
      throw new Error('This folder is public. Restrict access to authorised administrators before migrating private Cabinet and citizenship records.');
    p.setProperty('GOV_MIGRATION_READONLY','true');
    GOV_MULTI_ORDER_.forEach(group=>{
      const key='GOV_MULTI_STAGING_'+group.toUpperCase()+'_ID';
      let id=String(p.getProperty(key)||'').trim();
      if(!id){
        const book=SpreadsheetApp.create(GOV_MULTI_TITLES_[group]);
        id=book.getId();p.setProperty(key,id);
      }
      if(id===c.sheetId||id===c.meetingDbId||id===c.citizenDbId)
        throw new Error('Staging target points to a live database. Stop and inspect '+key+'.');
      DriveApp.getFileById(id).moveTo(folder);
    });
    return rsagpMigrationStatus_();
  }finally{lock.releaseLock();}
}
/** Repeat this in the editor until remaining is empty.
 * It copies and verifies ONE group at a time. No live source sheet is edited.
 */
function copyNextRSAGPMultiDatabaseGroup(){
  requireDatabaseEditor_();
  if(config_().multiActive)throw new Error('Multi-database mode is already active.');
  if(properties_().getProperty('GOV_MIGRATION_READONLY')!=='true')
    throw new Error('First run prepareRSAGPMultiDatabaseSplit to enable safe maintenance mode.');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Portal busy. Retry in a moment.');
  try{
    const p=properties_(),state=rsagpMigrationStatus_();
    if(!state.remaining.length)return {message:'All groups copied. Run activateRSAGPMultiDatabaseSplit.',...state};
    const group=state.remaining[0],id=p.getProperty('GOV_MULTI_STAGING_'+group.toUpperCase()+'_ID');
    if(!id)throw new Error('Missing staging workbook for '+group+'. Run prepareRSAGPMultiDatabaseSplit.');
    const source=db_(); // Uses the currently ACTIVE old routing, even when legacy split is active.
    const dest=governmentBook_(id);
    GOV_MULTI_GROUPS_[group].forEach(name=>{
      const from=source.getSheetByName(name);
      if(!from)throw new Error('Missing source tab '+name+'. Run setupPortal before migration.');
      const previous=dest.getSheetByName(name);
      if(previous){
        // Never delete the last remaining staging sheet.
        if(dest.getSheets().length===1)dest.insertSheet('__staging_keep__');
        dest.deleteSheet(previous);
      }
      const to=from.copyTo(dest);to.setName(name);
      verifyCopiedTab_(from,to,name);
    });
    dest.getSheets().forEach(sh=>{
      if(['Sheet1','__staging_keep__'].includes(sh.getName())&&sh.getLastRow()===0&&dest.getSheets().length>1)
        dest.deleteSheet(sh);
    });
    const done=[...state.completed,group];
    p.setProperty('GOV_MULTI_COPIED',done.join(','));
    return {copied:group,message:'Copied and verified '+group+'.',...rsagpMigrationStatus_()};
  }finally{lock.releaseLock();}
}
/** Recheck every copied group before atomically switching all record routing.
 * Audit and permissions are also routed to their correct new workbooks.
 */
function activateRSAGPMultiDatabaseSplit(){
  requireDatabaseEditor_();
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(30000))throw new Error('Portal busy. Retry.');
  try{
    const p=properties_(),c=config_();
    if(c.multiActive)return verifyRSAGPMultiDatabaseSplit();
    if(p.getProperty('GOV_MIGRATION_READONLY')!=='true')throw new Error('Migration is not in maintenance mode.');
    const state=rsagpMigrationStatus_();
    if(state.remaining.length)throw new Error('First copy these groups: '+state.remaining.join(', '));
    const source=db_(),updates={};
    GOV_MULTI_ORDER_.forEach(group=>{
      const id=p.getProperty('GOV_MULTI_STAGING_'+group.toUpperCase()+'_ID');
      if(!id)throw new Error('Missing staging database ID: '+group);
      const dest=governmentBook_(id);
      GOV_MULTI_GROUPS_[group].forEach(name=>{
        const oldSheet=source.getSheetByName(name),newSheet=dest.getSheetByName(name);
        if(!oldSheet||!newSheet)throw new Error('Missing '+name+' during verification.');
        verifyCopiedTab_(oldSheet,newSheet,name);
      });
      updates['GOV_MULTI_'+group.toUpperCase()+'_ID']=id;
    });
    updates.GOV_ORIGINAL_SHEET_ID=c.sheetId;
    updates.GOV_SHEET_ID=p.getProperty('GOV_MULTI_STAGING_CORE_ID');
    updates.GOV_MULTI_ACTIVE='true';updates.GOV_MIGRATION_READONLY='false';
    p.setProperties(updates);
    bumpDataVersion_();
    return verifyRSAGPMultiDatabaseSplit();
  }finally{lock.releaseLock();}
}
function verifyRSAGPMultiDatabaseSplit(){
  requireDatabaseEditor_();
  const c=config_(),status=rsagpMigrationStatus_();
  if(!c.multiActive)return {active:false,...status};
  const out=[];
  GOV_MULTI_ORDER_.forEach(group=>{
    const id=group==='core'?c.sheetId:c.multiIds[group],book=governmentBook_(id);
    GOV_MULTI_GROUPS_[group].forEach(name=>{
      const sh=book.getSheetByName(name);
      if(!sh)throw new Error('Missing '+name+' in '+group+' workbook.');
      const header=sh.getRange(1,1,1,GOV.sheets[name].length).getDisplayValues()[0];
      if(header.some((v,i)=>v!==GOV.sheets[name][i]))throw new Error('Unexpected header in '+name+'.');
      out.push({group,tab:name,rows:Math.max(0,sh.getLastRow()-1)});
    });
  });
  return {active:true,folder:status.folder,coreUrl:governmentBook_(c.sheetId).getUrl(),
    databases:GOV_MULTI_ORDER_.map(group=>({group,url:governmentBook_(group==='core'?c.sheetId:c.multiIds[group]).getUrl()})),sheets:out};
}
/** For an interrupted pre-activation migration: unblock submissions without
 * altering the original live database. To resume later, prepare again and
 * copy all groups afresh in a quiet window.
 */
/** One-button maintenance helper: repeatedly run from the Apps Script editor.
 * The first run creates folder workbooks, each subsequent run copies a group,
 * and the final run verifies/activates all nine without losing old records.
 */
function advanceRSAGPMultiDatabaseMigration(){
  requireDatabaseEditor_();
  const s=rsagpMigrationStatus_();
  if(s.active)return verifyRSAGPMultiDatabaseSplit();
  if(!s.maintenance)return prepareRSAGPMultiDatabaseSplit();
  if(s.remaining.length)return copyNextRSAGPMultiDatabaseGroup();
  return activateRSAGPMultiDatabaseSplit();
}
function cancelRSAGPMultiDatabasePreparation(){
  requireDatabaseEditor_();
  if(config_().multiActive)throw new Error('Already active. Cannot discard live database routing.');
  properties_().setProperties({GOV_MIGRATION_READONLY:'false',GOV_MULTI_COPIED:''});
  return 'Maintenance mode disabled. Original database remains active; staging copies were preserved.';
}
function rsagpAssertWritable_(){
  if(properties_().getProperty('GOV_MIGRATION_READONLY')==='true')
    throw new Error('RSAGP is in scheduled database maintenance. Please retry after migration finishes.');
}
function table_(ss,name){const sh=ss.getSheetByName(name);if(!sh)throw new Error('Missing sheet '+name+'; run setupPortal.');const last=sh.getLastRow();return last<2?[]:sh.getRange(2,1,last-1,GOV.sheets[name].length).getValues();}
function latestRows_(ss,name,limit){
  const sh=ss.getSheetByName(name);if(!sh)throw new Error('Missing sheet '+name+'; run setupPortal.');
  const last=sh.getLastRow();if(last<2)return [];
  const count=Math.min(last-1,limit),start=last-count+1;
  return sh.getRange(start,1,count,GOV.sheets[name].length).getValues();
}
function rowIndex_(rows,id){return rows.findIndex(r=>String(r[0])===String(id));}
function saveRow_(ss,name,id,row){
  rsagpAssertWritable_();
  const sh=ss.getSheetByName(name),last=sh.getLastRow();
  let number=last+1;
  if(last>1){
    // Search only the ID column rather than loading every payload cell.
    const match=sh.getRange(2,1,last-1,1).createTextFinder(String(id)).matchEntireCell(true).findNext();
    if(match)number=match.getRow();
  }
  sh.getRange(number,1,1,row.length).setValues([row]);return number;
}
function record_(ss,who,action,type,id,detail){ss.getSheetByName('audit').appendRow([new Date(),who.id,who.username,action,type,id,String(detail||'').slice(0,500)]);bumpDataVersion_();}
function withLock_(fn){rsagpAssertWritable_();const lock=LockService.getScriptLock();if(!lock.tryLock(12000))throw new Error('The database is busy. Please retry.');try{rsagpAssertWritable_();return fn();}finally{lock.releaseLock();}}
function text_(v,max){const x=String(v===undefined||v===null?'':v).trim();if(x.length>max)throw new Error('Text exceeds '+max+' characters.');return x;}
function required_(v,label,max){const s=text_(v,max);if(!s)throw new Error(label+' is required.');return s;}
function cell_(v){const s=String(v);return /^[=+\-@\t\r]/.test(s)?"'"+s:s;}
function id_(){return Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();}
function isDiscordId_(id){return /^\d{17,22}$/.test(String(id));}
function isoDate_(v){const s=String(v||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}
function bool_(v){return v===true||String(v).toLowerCase()==='true';}
function dateString_(v){if(v instanceof Date)return Utilities.formatDate(v,'Etc/UTC','yyyy-MM-dd');return String(v||'');}
function timeString_(v){if(v instanceof Date)return Utilities.formatDate(v,'Etc/UTC','HH:mm');return String(v||'');}
function timestamp_(v){return v instanceof Date?v.toISOString():String(v||'');}
function parseJSON_(value,fallback){try{return JSON.parse(String(value||''));}catch(e){return fallback;}}
function webAppUrl_(){const s=config_().webAppUrl;if(!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(s))throw new Error('Set WEB_APP_URL to the deployed /exec link, without trailing slash or query parameters.');return s;}

// Discord OAuth2: state is generated on the server and consumed exactly once.
function loginUrl_(view){
  const c=config_();if(!c.clientId||!c.clientSecret||!c.webAppUrl)return '';
  const state=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('gov_oauth_'+state,['cabinet','citizenship','careers'].includes(view)?view:'cabinet',600);
  return 'https://discord.com/oauth2/authorize?'+[
    'response_type=code','client_id='+encodeURIComponent(c.clientId),
    'redirect_uri='+encodeURIComponent(webAppUrl_()),'scope=identify',
    'state='+encodeURIComponent(state)
  ].join('&');
}
function finishOAuth_(code,state){
  if(!/^[a-f\d]{64}$/i.test(String(state||'')))throw new Error('Login security check failed. Please try again.');
  const cache=CacheService.getScriptCache(),key='gov_oauth_'+state;
  const view=cache.get(key);
  if(!['cabinet','citizenship','careers'].includes(view))throw new Error('Login expired or was already used. Please sign in again.');
  cache.remove(key);
  const c=config_();const r=UrlFetchApp.fetch('https://discord.com/api/oauth2/token',{
    method:'post',contentType:'application/x-www-form-urlencoded',muteHttpExceptions:true,
    payload:{client_id:c.clientId,client_secret:c.clientSecret,grant_type:'authorization_code',code:code,redirect_uri:webAppUrl_()}
  });
  if(r.getResponseCode()!==200)throw new Error('Discord could not complete authorisation. Check the redirect URI and client credentials.');
  const tokenInfo=parseJSON_(r.getContentText(),{});if(!tokenInfo.access_token)throw new Error('Discord did not return an access token.');
  const personResp=UrlFetchApp.fetch('https://discord.com/api/users/@me',{
    headers:{Authorization:'Bearer '+tokenInfo.access_token},muteHttpExceptions:true
  });
  if(personResp.getResponseCode()!==200)throw new Error('Discord identity lookup failed.');
  const person=parseJSON_(personResp.getContentText(),{});if(!isDiscordId_(person.id))throw new Error('Discord returned an invalid account ID.');
  const avatar=person.avatar?'https://cdn.discordapp.com/avatars/'+person.id+'/'+person.avatar+'.png?size=128':'https://cdn.discordapp.com/embed/avatars/0.png';
  const session=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put('gov_session_'+session,JSON.stringify({id:String(person.id),username:String(person.global_name||person.username||'Discord member').slice(0,70),avatar}),21600);
  return {session,view};
}
function jsonForScript_(value){return JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');}
function doGet(e){
  const p=e&&e.parameter?e.parameter:{};
  let view=['cabinet','citizenship','careers'].includes(p.view)?p.view:'cabinet';
  const boot={session:'',loginUrl:'',error:'',citizenshipUrl:'',cabinetUrl:'',careersUrl:''};
  try{
    if(p.error)boot.error='Discord authorisation was cancelled. Please try again.';
    else if(p.code&&p.state){const result=finishOAuth_(p.code,p.state);boot.session=result.session;view=result.view;}
    if(!boot.session)boot.loginUrl=loginUrl_(view);
  }catch(err){boot.error=String(err.message||err);try{boot.loginUrl=loginUrl_(view);}catch(e){}}
  // GitHub Pages hosting mode: after Discord completes OAuth on this existing
  // Apps Script callback, hand the session to the static site using a fragment.
  // The link is deliberately clicked by the user: Apps Script HtmlService
  // sandboxing may block automatic top-level navigation.
  const pagesUrl = String(properties_().getProperty('GITHUB_PAGES_URL') || '').trim();
  if (boot.session && pagesUrl) {
    if (!/^https:\/\/[a-z0-9.-]+(?::443)?(?:\/[a-z0-9._~%\/-]*)?\/?$/i.test(pagesUrl))
      throw new Error('GITHUB_PAGES_URL must be an HTTPS website address.');
    const base = pagesUrl.replace(/\/+$/, '') + '/';
    const target = base + (view === 'careers' ? 'careers/' : view === 'citizenship' ? 'citizenship/' : '')
      + '#rsagp_session=' + encodeURIComponent(boot.session);
    const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<meta name="referrer" content="no-referrer"><title>RSAGP sign-in complete</title></head>'
      + '<body style="font-family:system-ui,sans-serif;background:#f3f6f0;color:#063d2d;display:grid;place-items:center;min-height:80vh">'
      + '<main style="text-align:center;background:#fff;padding:36px;border-radius:16px;max-width:500px">'
      + '<h1>Discord sign-in complete</h1><p>Continue to your secure RSAGP session on GitHub Pages.</p>'
      + '<a target="_top" rel="noreferrer" href="'+target+'" style="display:inline-block;padding:14px 22px;background:#007a4d;color:white;border-radius:8px;text-decoration:none">Continue to portal</a>'
      + '<p style="font-size:12px">Do not copy or share this private sign-in link.</p></main></body></html>';
    return HtmlService.createHtmlOutput(html).setTitle('RSAGP | Sign-in complete');
  }
  const root=String(config_().webAppUrl||'');boot.cabinetUrl=root;boot.citizenshipUrl=root?root+'?view=citizenship':'';boot.careersUrl=root?root+'?view=careers':'';
  const t=HtmlService.createTemplateFromFile(view==='citizenship'?'CitizenPortal':view==='careers'?'CareersPortal':'Index');
  t.bootstrapJson=jsonForScript_(boot);
  if(view==='careers'){
    const openPositions=getCareerPositions();
    t.careersJson=jsonForScript_(openPositions);
    t.careersMarkup=careerPublicMarkup_(openPositions,boot.loginUrl||'#');
    t.careersCount=openPositions.length+' available position'+(openPositions.length===1?'':'s');
    // The login button must work even if client-side JavaScript is delayed or blocked.
    t.careersLoginHref=careerHtmlEscape_(boot.loginUrl||'#');
  }
  // Trusted bundled image data: emit without Apps Script URL escaping.
  t.coatSrc=SA_COAT_SRC_;t.flagSrc=SA_FLAG_SRC_;
  return t.evaluate().setTitle(view==='citizenship'?'Republic of South Africa | Citizenship Desk':view==='careers'?'RSAGP | Government Careers':'Republic of South Africa | Cabinet Desk').addMetaTag('viewport','width=device-width, initial-scale=1');
}
/** Check the bundled art and rendered Apps Script template in the editor. */
function verifyPortalBranding(){
  const assets=[['Coat of arms',SA_COAT_SRC_],['National flag',SA_FLAG_SRC_],['Presidential seal',GOV_SEAL_SRC_]];
  assets.forEach(entry=>{
    if(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(entry[1]))
      throw new Error(entry[0]+' is not a valid bundled PNG data URL. Check BrandAssets.gs / Branding.gs.');
    const bytes=Utilities.base64Decode(entry[1].split(',')[1]);
    if(bytes.slice(0,8).map(v=>v&255).join(',')!=='137,80,78,71,13,10,26,10')
      throw new Error(entry[0]+' could not be decoded as PNG.');
  });
  ['Index','CitizenPortal','CareersPortal'].forEach(page=>{
    const t=HtmlService.createTemplateFromFile(page);
    t.bootstrapJson=jsonForScript_({session:'',loginUrl:'',error:''});
    if(page==='CareersPortal'){
      const positions=getCareerPositions();
      t.careersJson=jsonForScript_(positions);
      t.careersMarkup=careerPublicMarkup_(positions,'#');
      t.careersCount=positions.length+' available position'+(positions.length===1?'':'s');
      t.careersLoginHref='#';
    }
    t.coatSrc=SA_COAT_SRC_;t.flagSrc=SA_FLAG_SRC_;
    const html=t.evaluate().getContent();
    if((html.match(/src="data:image\/png;base64,/g)||[]).length<2)
      throw new Error(page+' is not rendering its branded images; deploy the corrected '+page+'.html.');
  });
  return 'Branding OK: crest, flag and presidential seal decode; both web-app templates render embedded PNG images.';
}
function session_(token){
  if(!/^[a-f\d]{64}$/i.test(String(token||'')))throw new Error('Please sign in with Discord.');
  const v=CacheService.getScriptCache().get('gov_session_'+token);
  if(!v)throw new Error('Session expired. Please sign in again.');
  return parseJSON_(v,{});
}
function beginLogin(view){return loginUrl_(['cabinet','citizenship','careers'].includes(view)?view:'cabinet');}
function signOut(token){if(/^[a-f\d]{64}$/i.test(String(token||'')))CacheService.getScriptCache().remove('gov_session_'+token);return true;}
/** Read paths may cache role lookups for 15 seconds; all edits use a fresh server check.
 * Changing SUPREME_ADMIN_DISCORD_IDS takes effect on the next request because
 * membership in that Script Property is checked BEFORE consulting the role cache.
 */
function userContext_(token,readOnly){
  const identity=session_(token),cfg=config_(),supreme=cfg.supremeAdmins.includes(identity.id);
  const presidentBootstrap=cfg.presidents.includes(identity.id);
  const cache=CacheService.getScriptCache();
  let cacheKey='';
  if(readOnly){
    cacheKey='gov_role_v3_'+dataVersion_()+'_'+identity.id+'_'+Number(supreme)+'_'+Number(presidentBootstrap);
    try{const raw=cache.get(cacheKey);if(raw){const entry=JSON.parse(raw);return {identity,member:entry.member,rights:entry.rights};}}catch(e){}
  }
  const ss=db_(),rows=table_(ss,'members'),r=rows.find(x=>String(x[0])===identity.id);
  let member=r&&bool_(r[6])?memberDTO_(r):null;
  if(presidentBootstrap){
    member=member||{id:identity.id,username:identity.username,name:identity.username,
      position:'President',portfolio:'Office of the Presidency',roles:['President'],active:true};
    member.roles=[...new Set([...member.roles,'President'])];member.active=true;
  }
  if(supreme){
    member=member||{id:identity.id,username:identity.username,name:identity.username,
      position:'Supreme Administrator',portfolio:'Government Administration',roles:[],active:true};
    member.roles=[...new Set([...member.roles,'Supreme Admin'])];member.active=true;
  }
  // An active Administration appointment gives limited read-only Group Staff
  // access. It cannot grant Cabinet permissions or change Supreme Admin rights.
  let groupStaff=false;
  if(!member){
    const staffRow=table_(ss,'appointments').find(a=>String(a[1])==='Administration'&&String(a[4])===identity.id&&bool_(a[8]));
    groupStaff=!!staffRow;
    if(groupStaff){
      const staff=appointmentDTO_(staffRow);
      member={id:identity.id,username:identity.username,name:staff.name||identity.username,
        position:staff.office||'Group Staff',portfolio:staff.branch||'Portal Administration',roles:['Group Staff'],active:true,
        robloxId:staff.robloxId||'',robloxUsername:staff.robloxUsername||''};
    }
  }
  // Resolve editable roles and individual allow/deny overrides in the core database.
  // Script Property Supreme Admin is deliberately outside this editable policy.
  const access=accessEffective_(member,identity,ss,supreme);
  if(access.rights.view&&!member){
    member={id:identity.id,username:identity.username,name:identity.username,
      position:access.roles[0]||'Authorised staff',portfolio:'Government Administration',
      roles:access.roles,active:true};
  }else if(member){
    member.roles=access.roles;
  }
  const rights=access.rights;

  if(readOnly&&cacheKey){try{cache.put(cacheKey,JSON.stringify({member,rights}),15);}catch(e){}}
  return {identity,member,rights};
}
function require_(ctx,key){if(!ctx.rights[key])throw new Error('You do not have permission to perform that action.');}
function currentUser(token){const c=userContext_(token,true);return {identity:c.identity,member:c.member,rights:c.rights,roles:accessRolesForUI_(db_())};}
function memberDTO_(r){return {id:String(r[0]),username:String(r[1]||''),name:String(r[2]||''),position:String(r[3]||''),portfolio:String(r[4]||''),roles:String(r[5]||'').split(',').map(x=>x.trim()).filter(Boolean),active:bool_(r[6]),appointed:dateString_(r[7]),robloxId:String(r[10]||''),robloxUsername:String(r[11]||'')};}
function proposalDTO_(r){return {id:String(r[0]),created:timestamp_(r[1]),authorId:String(r[2]),author:String(r[3]),portfolio:String(r[4]),title:String(r[5]),category:String(r[6]),priority:String(r[7]),background:String(r[8]),recommendation:String(r[9]),budget:String(r[10]),decision:String(r[11]),status:String(r[12]),reviewedBy:String(r[13]||''),reviewNote:String(r[14]||''),reviewedAt:timestamp_(r[15]),meetingId:String(r[16]||'')};}
function meetingDTO_(r){return {id:String(r[0]),title:String(r[1]),date:dateString_(r[2]),time:timeString_(r[3]),venue:String(r[4]),chair:String(r[5]),status:String(r[6]),created:timestamp_(r[7]),createdBy:String(r[8]),proposalIds:parseJSON_(r[9],[]),docUrl:String(r[10]||''),notes:String(r[11]||'')};}
function meetingAttendeeDTO_(r){
 const result=String(r[12]||'')||(String(r[8])==='Attended'?'Present':'');
 return {id:String(r[0]),meetingId:String(r[1]),sourceType:String(r[2]),sourceId:String(r[3]),discordId:String(r[4]||''),name:String(r[5]||''),office:String(r[6]||''),branch:String(r[7]||''),status:String(r[8]||'Requested'),notes:String(r[9]||''),
   attendance:result,recordedAt:timestamp_(r[13]),recordedBy:String(r[14]||''),attendanceNotes:String(r[15]||'')};
}
function pressDTO_(r){return {id:String(r[0]),created:timestamp_(r[1]),authorId:String(r[2]),headline:String(r[3]),summary:String(r[4]),body:String(r[5]),quote:String(r[6]),spokesperson:String(r[7]),status:String(r[8]),approvedBy:String(r[9]||''),reviewNote:String(r[10]||''),docUrl:String(r[11]||''),updated:timestamp_(r[12]),published:timestamp_(r[13]),releaseDate:dateString_(r[14])};}
function actionDTO_(r){return {id:String(r[0]),meetingId:String(r[1]||''),task:String(r[2]),ownerId:String(r[3]),owner:String(r[4]),due:dateString_(r[5]),status:String(r[6]),created:timestamp_(r[7]),updated:timestamp_(r[8])};}
function decisionDTO_(r){return {id:String(r[0]),meetingId:String(r[1]),proposalId:String(r[2]),decision:String(r[3]),rationale:String(r[4]),recorderId:String(r[5]),created:timestamp_(r[6])};}
function appointmentDTO_(r){return {id:String(r[0]),category:String(r[1]||''),office:String(r[2]||''),name:String(r[3]||''),discordId:String(r[4]||''),username:String(r[5]||''),branch:String(r[6]||''),notes:String(r[7]||''),active:bool_(r[8]),appointed:dateString_(r[9]),robloxId:String(r[12]||''),robloxUsername:String(r[13]||'')};}

// Shared, write-busted cache so repeat page loads don't re-read the spreadsheet.
// Any write bumps the version (see record_ / bumpDataVersion_), which changes every
// cache key, so cached payloads can never outlive the data they were built from.
// Persistent revision prevents an evicted CacheService key from resurrecting stale page data.
function dataVersion_(){
  const p=properties_();const cache=CacheService.getScriptCache();
  try{const version=cache.get('gov_dataver');if(version)return version;}catch(e){}
  const version=p.getProperty('GOV_DATA_REV')||'0';
  try{cache.put('gov_dataver',version,21600);}catch(e){}
  return version;
}
function bumpDataVersion_(){
  const v=String(Date.now())+'_'+Utilities.getUuid().slice(0,7);
  properties_().setProperty('GOV_DATA_REV',v);
  try{CacheService.getScriptCache().put('gov_dataver',v,21600);}catch(e){}
}

// Only load the worksheet needed by the page; no giant initial dashboard payload.
function pageData(token,page,forceRefresh){
  const c=userContext_(token,true);require_(c,'view');
  const pageRight=ACCESS_PAGE_RIGHTS_[page];
  if(!pageRight)throw new Error('Unknown page.');
  require_(c,pageRight);
  const cache=CacheService.getScriptCache(),rev=dataVersion_();
  const key='pd_v3_'+rev+'_'+page+'_'+c.identity.id;
  try{const hit=forceRefresh?null:cache.get(key);if(hit){
    if(hit.startsWith('J'))return JSON.parse(hit.slice(1));
    if(hit.startsWith('Z'))return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(hit.slice(1)))).getDataAsString());
  }}catch(e){}
  const out=pageDataCompute_(c,page);
  try{
    const plain=JSON.stringify(out);let encoded='J'+plain;
    if(plain.length>45000){
      const zipped='Z'+Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(plain)).getBytes());
      if(zipped.length<encoded.length)encoded=zipped;
    }
    const ttl=page==='overview'?45:120;
    if(encoded.length<85000&&dataVersion_()===rev)cache.put(key,encoded,ttl);
  }catch(e){}
  return out;
}
function pageDataCompute_(c,page){
  const ss=db_(),limit=160,readMemo={};
  const read=name=>(readMemo[name]||(readMemo[name]=table_(ss,name)));
  const latest=(name,count)=>latestRows_(ss,name,count);
  const members=()=>read('members').map(memberDTO_).filter(m=>m.active||c.rights.manageMembers);
  if(page==='overview'){
    // Never expose counts or summaries from a section the user cannot view.
    const proposals=c.rights.viewProposals?read('proposals').map(proposalDTO_):[],
      meetings=c.rights.viewMeetings?read('meetings').map(meetingDTO_):[],
      press=c.rights.viewPress?read('press').map(pressDTO_):[],
      actions=c.rights.viewActions?read('actions').map(actionDTO_):[];
    const next=meetings.filter(m=>m.status==='Scheduled'&&m.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
    return {counts:{members:c.rights.viewCabinet?read('members').filter(r=>bool_(r[6])).length:0,proposals:proposals.filter(x=>x.status==='Submitted').length,meetings:meetings.filter(x=>x.status==='Scheduled').length,actions:actions.filter(x=>x.status!=='Completed').length},
      next,proposals:proposals.slice(-5).reverse(),press:press.filter(x=>x.status==='Published').slice(-4).reverse(),tasks:actions.filter(x=>x.ownerId===c.identity.id&&x.status!=='Completed').slice(-4)};
  }
  if(page==='cabinet')return {members:members()};
  if(page==='proposals')return {proposals:latest('proposals',limit).reverse().map(proposalDTO_)};
  if(page==='meetings'){
    const meetings=latest('meetings',Math.min(limit,80)).reverse().map(meetingDTO_);
    const ids=new Set(meetings.map(m=>m.id));
    return {meetings,proposals:read('proposals').map(proposalDTO_).filter(x=>x.status==='Agenda Ready'),decisions:latest('decisions',limit).map(decisionDTO_),
      members:read('members').map(memberDTO_).filter(m=>m.active),
      offices:read('appointments').map(appointmentDTO_).filter(a=>a.active&&a.category==='State office'),
      attendees:read('meetingAttendees').filter(r=>ids.has(String(r[1]))).map(meetingAttendeeDTO_)};
  }
  if(page==='press')return {releases:latest('press',limit).reverse().map(pressDTO_).filter(x=>x.status==='Published'||c.rights.draftPress||x.authorId===c.identity.id)};
  if(page==='actions')return {tasks:latest('actions',limit).reverse().map(actionDTO_),members:members(),meetings:latest('meetings',80).map(meetingDTO_)};
  if(page==='letters'){const sig=signatureRow_(ss,c.identity.id);return {hasSignature:!!(sig&&sig[1]),letters:latest('letters',limit).reverse().map(letterDTO_).filter(x=>x.authorId===c.identity.id||c.rights.manageMembers)}};
  if(page==='offices')return {offices:read('appointments').map(appointmentDTO_).filter(a=>a.active||c.rights.manageOffices)};
  if(page==='administration'){require_(c,'superAdmin');const cfg=config_();return {staff:read('appointments').map(appointmentDTO_).filter(a=>a.category==='Administration'),members:read('members').map(memberDTO_).filter(m=>m.active),audit:latest('audit',15).reverse().map(r=>({at:timestamp_(r[0]),actor:String(r[2]),action:String(r[3]),detail:String(r[6])})),databaseSplitActive:cfg.multiActive,databaseFolder:'https://drive.google.com/drive/folders/'+GOV_MULTI_FOLDER_ID_,databases:cfg.multiActive?[{name:'Cabinet Directory & Offices',url:'https://docs.google.com/spreadsheets/d/'+cfg.sheetId+'/edit'},...GOV_MULTI_ORDER_.filter(g=>g!=='core').map(g=>({name:GOV_MULTI_TITLES_[g],url:'https://docs.google.com/spreadsheets/d/'+cfg.multiIds[g]+'/edit'}))]:[]};}
  if(page==='citizenship'){require_(c,'manageCitizenship');return {applications:latest('citizenshipAttempts',limit).reverse().map(citizenshipDTO_)}};
  if(page==='applications'){require_(c,'viewApplications');return careersApplicationsForReview_(ss);}
  if(page==='permissions'){require_(c,'superAdmin');return permissionManagerData_(ss);}
  if(page==='audit'){require_(c,'viewAudit');return {entries:latest('audit',100).reverse().map(r=>({at:timestamp_(r[0]),actor:String(r[2]),action:String(r[3]),type:String(r[4]),id:String(r[5]),detail:String(r[6])}))};}
  throw new Error('Unknown page.');
}

function saveCabinetMember(token,payload){
  const c=userContext_(token);require_(c,'manageMembers');
  const id=required_(payload.id,'Discord ID',22),name=required_(payload.name,'Name',80),position=required_(payload.position,'Position',80),portfolio=required_(payload.portfolio,'Portfolio',100);
  if(!isDiscordId_(id))throw new Error('Use the permanent 17–22 digit Discord User ID.');
  // Display-only profile link: Roblox account ownership is not asserted by this field.
  const requestedRoblox=String(payload.robloxUsername||'').trim();
  const resolvedRoblox=requestedRoblox?robloxProfile_(requestedRoblox):null;
  const roles=[...new Set((Array.isArray(payload.roles)?payload.roles:[]).map(String))];
  if(!roles.length||roles.some(r=>!accessRolesForUI_(db_()).includes(r)))throw new Error('Select valid cabinet access roles.');
  if(roles.includes('President')&&!c.rights.superAdmin)throw new Error('Only the configured Supreme Admin can grant the President role.');
  return withLock_(()=>{
    const ss=db_(),existing=table_(ss,'members'),old=existing.find(r=>String(r[0])===id);
    if(old&&String(old[5]).split(',').includes('President')&&!c.rights.superAdmin)throw new Error('Only the President can change this member.');
    const active=payload.active!==false;
    if(config_().presidents.includes(id)&&(!roles.includes('President')||!active))throw new Error('Bootstrap President access cannot be revoked in the portal.');
    if(config_().supremeAdmins.includes(id)&&!c.rights.superAdmin)throw new Error('Only a Supreme Admin can edit a configured Supreme Admin account.');
    const row=[id,cell_(text_(payload.username,70)),cell_(name),cell_(position),cell_(portfolio),roles.join(','),active,old?old[7]:new Date(),new Date(),c.identity.id,
      resolvedRoblox?resolvedRoblox.id:'',resolvedRoblox?cell_(resolvedRoblox.username):''];
    saveRow_(ss,'members',id,row);record_(ss,c.identity,'SAVE_MEMBER','Member',id,position+' · '+roles.join(', '));
    return {success:true,message:'Cabinet appointment saved.'};
  });
}
function saveAppointment(token,payload){
  const c=userContext_(token);
  if(!c.rights.manageOffices&&!c.rights.manageGroupStaff)throw new Error('You cannot manage state offices or group staff.');
  const categories=['State office','Administration'];
  const category=String(payload.category||'');if(!categories.includes(category))throw new Error('Choose a valid category.');
  if(category==='Administration'&&!c.rights.manageGroupStaff)throw new Error('You need Manage group staff permission.');
  if(category==='State office'&&!c.rights.manageOffices)throw new Error('You need Manage state offices permission.');
  const office=required_(payload.office,'Office / title',100),name=required_(payload.name,'Holder name',80);
  const discordId=text_(payload.discordId,22);if(discordId&&!isDiscordId_(discordId))throw new Error('Discord ID must be the permanent 17–22 digit User ID, or left blank.');
  const requestedRoblox=String(payload.robloxUsername||'').trim();
  const resolvedRoblox=requestedRoblox?robloxProfile_(requestedRoblox):null;
  const branch=text_(payload.branch,80),notes=text_(payload.notes,600),active=payload.active!==false;
  return withLock_(()=>{
    const ss=db_(),id=payload.id?String(payload.id):'OFF-'+id_(),rows=table_(ss,'appointments'),old=rows.find(r=>String(r[0])===id);
    if(payload.id&&!old)throw new Error('Appointment not found.');
    if(old&&String(old[1])==='Administration'&&!c.rights.manageGroupStaff)throw new Error('Only the Supreme Admin can edit existing group staff.');
    if(category==='Administration'&&!discordId)throw new Error('A Discord ID is required to assign a group staff member.');
    const row=[id,category,cell_(office),cell_(name),discordId,cell_(text_(payload.username,70)),cell_(branch),cell_(notes),active,old?old[9]:new Date(),new Date(),c.identity.id,
      resolvedRoblox?resolvedRoblox.id:'',resolvedRoblox?cell_(resolvedRoblox.username):''];
    saveRow_(ss,'appointments',id,row);record_(ss,c.identity,'SAVE_APPOINTMENT','Appointment',id,category+' · '+office);
    return {success:true,id,message:'Appointment saved.'};
  });
}
function submitProposal(token,payload){
  const c=userContext_(token);require_(c,'propose');
  const title=required_(payload.title,'Proposal title',150),category=String(payload.category||''),priority=String(payload.priority||''),background=required_(payload.background,'Background',2500),recommendation=required_(payload.recommendation,'Recommendation',3000),budget=text_(payload.budget,500),decision=required_(payload.decision,'Requested decision',1000);
  if(!GOV.proposalCategories.includes(category)||!GOV.priority.includes(priority))throw new Error('Choose a valid category and priority.');
  // Validate legislative material before taking the spreadsheet lock. A draft
  // is stored alongside the original Cabinet proposal, not as an enacted Act.
  const act=category==='Legislation'?validatedActDraft_(payload.actDraft):null;
  return withLock_(()=>{
    const ss=db_(),id=payload.id?String(payload.id):'POL-'+id_(),rows=table_(ss,'proposals'),i=rows.findIndex(r=>String(r[0])===id),old=i>=0?rows[i]:null;
    if(old&&(String(old[2])!==c.identity.id||!['Returned','Submitted'].includes(String(old[12]))))throw new Error('Only the author can revise a submitted or returned proposal.');
    const created=old?old[1]:new Date(),row=[id,created,c.identity.id,cell_(c.identity.username),cell_(c.member.portfolio),cell_(title),category,priority,cell_(background),cell_(recommendation),cell_(budget),cell_(decision),'Submitted','','','',old?old[16]:''];
    if(act&&!ss.getSheetByName('actDrafts'))throw new Error('Act drafts sheet missing. Run setupPortal from the Apps Script editor.');
    saveRow_(ss,'proposals',id,row);
    if(act)saveActDraft_(ss,id,act,c.identity);
    record_(ss,c.identity,old?'RESUBMIT_PROPOSAL':'NEW_PROPOSAL','Proposal',id,title);
    return {success:true,id,message:'Proposal submitted for Cabinet Secretary review.'};
  });
}
function reviewProposal(token,id,status,note){
  const c=userContext_(token);require_(c,'reviewProposals');
  if(!['Agenda Ready','Returned','Declined'].includes(status))throw new Error('Invalid review decision.');
  return withLock_(()=>{
    const ss=db_(),rows=table_(ss,'proposals'),i=rowIndex_(rows,id);if(i<0)throw new Error('Proposal not found.');
    const row=rows[i];if(!['Submitted','Agenda Ready'].includes(String(row[12])))throw new Error('Only submitted/agenda-ready proposals can be reviewed.');
    row[12]=status;row[13]=c.identity.id;row[14]=cell_(text_(note,1000));row[15]=new Date();
    saveRow_(ss,'proposals',id,row);record_(ss,c.identity,'REVIEW_PROPOSAL','Proposal',id,status);return {success:true};
  });
}
function createMeeting(token,payload){
  const c=userContext_(token);require_(c,'manageMeetings');
  const title=required_(payload.title,'Meeting title',120),date=String(payload.date||''),time=String(payload.time||''),venue=required_(payload.venue,'Venue / Discord channel',160),chair=required_(payload.chair,'Chair',100),notes=text_(payload.notes,1500);
  if(!isoDate_(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Enter a valid date and 24-hour time.');
  return withLock_(()=>{const ss=db_(),id='CAB-'+id_();ss.getSheetByName('meetings').appendRow([id,cell_(title),date,time,cell_(venue),cell_(chair),'Scheduled',new Date(),c.identity.id,'[]','',cell_(notes)]);record_(ss,c.identity,'SCHEDULE_MEETING','Meeting',id,title);return {success:true,id};});
}
/** Edit the meeting schedule without changing attendee, agenda or decision IDs. */
function editMeeting(token,meetingId,payload){
  const c=userContext_(token);require_(c,'manageMeetings');
  const id=required_(meetingId,'Meeting',50);
  const title=required_(payload.title,'Meeting title',120),date=String(payload.date||''),
    time=String(payload.time||''),venue=required_(payload.venue,'Venue / Discord channel',160),
    chair=required_(payload.chair,'Chair',100),notes=text_(payload.notes,1500);
  const status=String(payload.status||'Scheduled');
  if(!isoDate_(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw new Error('Enter a real date and 24-hour South African time.');
  if(!['Scheduled','Cancelled','Concluded'].includes(status))throw new Error('Invalid meeting status.');
  return withLock_(()=>{
    const ss=db_(),rows=table_(ss,'meetings'),i=rowIndex_(rows,id);
    if(i<0)throw new Error('Cabinet meeting no longer exists. Refresh the meetings page.');
    const r=rows[i],previousStatus=String(r[6]);
    if(previousStatus==='Concluded'&&status!=='Concluded')throw new Error('Concluded meetings cannot be reopened from the editor.');
    if(previousStatus!=='Concluded'&&status==='Concluded')throw new Error('Use Conclude to finalise a meeting.');
    const before=[r[1],dateString_(r[2]),timeString_(r[3]),r[4],r[5],r[6],r[11]].map(String);
    const after=[title,date,time,venue,chair,status,notes];
    if(before.every((v,j)=>v===after[j]))return {success:true,message:'No meeting details changed.'};
    const changed=before.map((v,j)=>v!==after[j]?['title','date','time','venue','chair','status','notes'][j]:null).filter(Boolean);
    r[1]=cell_(title);r[2]=date;r[3]=time;r[4]=cell_(venue);r[5]=cell_(chair);r[6]=status;r[11]=cell_(notes);
    // Previously exported agendas are immutable snapshots; clear stale legacy links.
    r[10]='';
    saveRow_(ss,'meetings',id,r);
    record_(ss,c.identity,'EDIT_MEETING','Meeting',id,changed.join(', '));
    return {success:true,id,message:'Meeting details updated. Export a new agenda to reflect the changes.'};
  });
}
function updateMeetingAgenda(token,meetingId,proposalIds){
  const c=userContext_(token);require_(c,'manageMeetings');
  if(!Array.isArray(proposalIds)||proposalIds.length>40)throw new Error('Select up to 40 proposals.');
  const selected=[...new Set(proposalIds.map(String))];
  return withLock_(()=>{
    const ss=db_(),meetings=table_(ss,'meetings'),i=rowIndex_(meetings,meetingId);if(i<0)throw new Error('Meeting not found.');
    const m=meetings[i];if(['Concluded','Cancelled'].includes(String(m[6])))throw new Error('This meeting is closed.');
    const proposals=table_(ss,'proposals'),approved=new Set(proposals.filter(x=>String(x[12])==='Agenda Ready').map(x=>String(x[0])));
    if(selected.some(id=>!approved.has(id)))throw new Error('Select only approved-for-agenda proposals.');
    m[9]=JSON.stringify(selected);saveRow_(ss,'meetings',meetingId,m);
    record_(ss,c.identity,'SET_AGENDA','Meeting',meetingId,selected.length+' items');return {success:true};
  });
}
/** Meeting guests are separate from Cabinet appointments. Inviting an official
 * does not grant them Cabinet voting, portal permissions or any government role.
 * All mutations require current manageMeetings permission.
 */
function meetingForAttendance_(ss,id,allowConcluded){
  const m=table_(ss,'meetings').find(r=>String(r[0])===String(id));
  if(!m)throw new Error('Cabinet meeting not found.');
  const status=String(m[6]);
  if(status==='Cancelled'||(!allowConcluded&&status!=='Scheduled'))throw new Error('This meeting is not open for invitations.');
  return m;
}
function meetingInviteeCandidates_(ss){
  const cabinet=table_(ss,'members').filter(r=>bool_(r[6])).map(r=>({
    key:'Cabinet:'+String(r[0]),type:'Cabinet',sourceId:String(r[0]),discordId:String(r[0]),
    name:String(r[2]||r[1]||r[0]),office:String(r[3]||'Cabinet member'),branch:String(r[4]||'Cabinet')
  }));
  const offices=table_(ss,'appointments').filter(r=>r[1]==='State office'&&bool_(r[8])).map(r=>({
    key:'Office:'+String(r[0]),type:'State office',sourceId:String(r[0]),discordId:String(r[4]||''),
    name:String(r[3]||''),office:String(r[2]||''),branch:String(r[6]||'')
  }));
  return [...cabinet,...offices];
}
/** Select requested attendees from current Cabinet and active state offices.
 * Existing attendance status is preserved if the officeholder is unchanged;
 * removed selections are retained as Withdrawn for audit/history.
 * Custom one-off guests are managed separately and never removed here.
 */
function setMeetingAttendees(token,meetingId,keys){
  const c=userContext_(token);require_(c,'inviteAttendees');
  if(!Array.isArray(keys)||keys.length>80)throw new Error('Select up to 80 invitees.');
  const wanted=[...new Set(keys.map(String))];
  if(wanted.some(x=>!/^((Cabinet:\d{17,22})|(Office:OFF-[A-Z0-9]+))$/.test(x)))
    throw new Error('An invited Cabinet member or office has an invalid reference.');
  return withLock_(()=>{
    const ss=db_();meetingForAttendance_(ss,meetingId,false);
    const directory=Object.fromEntries(meetingInviteeCandidates_(ss).map(x=>[x.key,x]));
    if(wanted.some(key=>!directory[key]))throw new Error('An invitee is inactive or no longer exists. Refresh the meeting page.');
    const sheet=ss.getSheetByName('meetingAttendees');
    if(!sheet)throw new Error('Missing meetingAttendees sheet. Run setupPortal once.');
    const existing=table_(ss,'meetingAttendees');
    const customCount=existing.filter(r=>String(r[1])===String(meetingId)&&String(r[2])==='Guest'&&String(r[8])!=='Withdrawn').length;
    if(wanted.length+customCount>100)throw new Error('A meeting can have no more than 100 active requested attendees.');
    const chosen=new Set(wanted);const found=new Set();const appended=[];
    let changes=0;
    existing.forEach((r,i)=>{
      if(String(r[1])!==String(meetingId)||String(r[2])==='Guest')return;
      const key=(r[2]==='Cabinet'?'Cabinet:':'Office:')+String(r[3]);
      if(chosen.has(key)){
        found.add(key);const person=directory[key];
        const changedHolder=String(r[4]||'')!==person.discordId||String(r[5]||'')!==person.name;
        const wasWithdrawn=r[8]==='Withdrawn';
        const status=wasWithdrawn||changedHolder?'Requested':r[8];
        if(r[4]!==person.discordId||r[5]!==person.name||r[6]!==person.office||r[7]!==person.branch||r[8]!==status){
          r[4]=person.discordId;r[5]=cell_(person.name);r[6]=cell_(person.office);r[7]=cell_(person.branch);
          r[8]=status;r[10]=new Date();r[11]=c.identity.id;
          if(changedHolder||wasWithdrawn){
            r[12]='';r[13]='';r[14]='';r[15]='';
            sheet.getRange(i+2,1,1,16).setValues([r.slice(0,16)]);
          }else sheet.getRange(i+2,1,1,12).setValues([r.slice(0,12)]);
          changes++;
        }
      }else if(r[8]!=='Withdrawn'){
        r[8]='Withdrawn';r[10]=new Date();r[11]=c.identity.id;
        sheet.getRange(i+2,1,1,12).setValues([r]);changes++;
      }
    });
    wanted.filter(key=>!found.has(key)).forEach(key=>{
      const person=directory[key];
      appended.push(['ATT-'+id_(),meetingId,person.type,person.sourceId,person.discordId,
        cell_(person.name),cell_(person.office),cell_(person.branch),'Requested','',new Date(),c.identity.id,'','','','']);
    });
    if(appended.length){sheet.getRange(sheet.getLastRow()+1,1,appended.length,16).setValues(appended);changes+=appended.length;}
    if(changes)record_(ss,c.identity,'SET_MEETING_ATTENDEES','Meeting',meetingId,changes+' invitations updated');
    return {success:true,message:'Requested attendees saved.',count:wanted.length};
  });
}
/** Invite a one-off guest not yet listed in the state offices directory. */
function addMeetingGuest(token,meetingId,payload){
  const c=userContext_(token);require_(c,'inviteAttendees');
  const name=required_(payload.name,'Guest name',90),office=required_(payload.office,'Guest position / title',110),
    branch=text_(payload.branch,100),discordId=text_(payload.discordId,22),notes=text_(payload.notes,400);
  if(discordId&&!isDiscordId_(discordId))throw new Error('Use a permanent Discord ID or leave it blank.');
  return withLock_(()=>{
    const ss=db_();meetingForAttendance_(ss,meetingId,false);
    const existing=table_(ss,'meetingAttendees').filter(r=>String(r[1])===String(meetingId)&&r[8]!=='Withdrawn');
    if(existing.length>=100)throw new Error('This meeting already has the maximum number of attendees.');
    if(existing.some(r=>String(r[5]).toLowerCase()===name.toLowerCase()&&String(r[6]).toLowerCase()===office.toLowerCase()))
      throw new Error('This attendee is already requested for the meeting.');
    const id='ATT-'+id_();ss.getSheetByName('meetingAttendees').appendRow([
      id,meetingId,'Guest','',discordId,cell_(name),cell_(office),cell_(branch),'Requested',cell_(notes),new Date(),c.identity.id,'','','',''
    ]);
    record_(ss,c.identity,'ADD_MEETING_GUEST','Meeting',meetingId,office+' · '+name);
    return {success:true,id,message:'Guest added to the requested-attendee list.'};
  });
}
/** Secretariat status updates; not an authenticated guest RSVP facility. */
function updateMeetingAttendeeStatus(token,attendeeId,status){
  const c=userContext_(token);require_(c,'inviteAttendees');
  const allowed=['Requested','Confirmed','Declined','Apologies','Attended','Withdrawn'];
  if(!allowed.includes(String(status)))throw new Error('Choose a valid attendance status.');
  return withLock_(()=>{
    const ss=db_(),rows=table_(ss,'meetingAttendees'),i=rowIndex_(rows,attendeeId);
    if(i<0)throw new Error('Attendee record was not found.');
    meetingForAttendance_(ss,String(rows[i][1]),true);
    rows[i][8]=status;rows[i][10]=new Date();rows[i][11]=c.identity.id;
    if(status==='Attended'){rows[i][12]='Present';rows[i][13]=new Date();rows[i][14]=c.identity.id;}
    saveRow_(ss,'meetingAttendees',attendeeId,rows[i]);
    record_(ss,c.identity,'UPDATE_ATTENDANCE','Meeting',String(rows[i][1]),String(rows[i][5])+' · '+status);
    return {success:true,message:'Attendance status updated.'};
  });
}

/** Explicit post-meeting attendance ledger, independent of RSVP status.
 * Recording presence does not turn a Requested invitation into a Confirmed RSVP.
 * Preserves the separate invitation history, documents editor and timestamp.
 */
function recordMeetingAttendance(token,meetingId,entries){
  const c=userContext_(token);require_(c,'recordAttendance');
  if(!Array.isArray(entries)||entries.length<1||entries.length>100)
    throw new Error('Select one to 100 attendees to record.');
  const ids=entries.map(item=>String(item&&item.id||''));
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate attendee records were submitted.');
  const allowed=['Present','Absent','Excused','Unrecorded'];
  const validated=entries.map(item=>{
    const attendance=String(item&&item.attendance||'');
    if(!/^ATT-[A-Za-z0-9-]{4,45}$/.test(String(item&&item.id||'')))throw new Error('Invalid attendance record ID.');
    if(!allowed.includes(attendance))throw new Error('Choose Present, Absent, Excused or Unrecorded.');
    return {id:String(item.id),attendance,notes:text_(item.notes,300)};
  });
  return withLock_(()=>{
    const ss=db_();meetingForAttendance_(ss,meetingId,true);
    const rows=table_(ss,'meetingAttendees'),byId=new Map();
    rows.forEach((r,i)=>{if(String(r[1])===String(meetingId) && String(r[8])!=='Withdrawn')byId.set(String(r[0]),i);});
    if(validated.some(entry=>!byId.has(entry.id)))throw new Error('An attendee is not invited to this meeting or has been withdrawn. Refresh the meeting.');
    const sh=ss.getSheetByName('meetingAttendees');
    if(!sh||sh.getRange(1,13).getDisplayValue()!==GOV.sheets.meetingAttendees[12])
      throw new Error('Attendance columns are missing. Run setupPortal once before recording attendance.');
    const changed=[];
    validated.forEach(item=>{
      const i=byId.get(item.id),r=rows[i];
      const old=String(r[12]||'')||(String(r[8])==='Attended'?'Present':'');
      const value=item.attendance==='Unrecorded'?'':item.attendance;
      if(old===value&&String(r[15]||'')===item.notes)return;
      r[12]=value;r[13]=value?new Date():'';r[14]=value?c.identity.id:'';r[15]=cell_(item.notes);
      // Only change the four attendance columns. RSVP and invitee data remain intact.
      sh.getRange(i+2,13,1,4).setValues([r.slice(12,16)]);
      changed.push({name:String(r[5]),result:value||'Unrecorded'});
    });
    if(changed.length)record_(ss,c.identity,'RECORD_MEETING_ATTENDANCE','Meeting',meetingId,
      changed.length+' record(s) · '+changed.map(r=>r.name+': '+r.result).join('; ').slice(0,360));
    return {success:true,changed:changed.length,message:changed.length+' attendance record(s) saved.'};
  });
}

function recordMeetingDecision(token,payload){
  const c=userContext_(token);require_(c,'recordDecisions');
  const meetingId=required_(payload.meetingId,'Meeting',50),decision=String(payload.decision||''),rationale=required_(payload.rationale,'Decision summary',1200),proposalId=text_(payload.proposalId,50);
  if(!['Approved','Deferred','Rejected','Action required'].includes(decision))throw new Error('Select a decision.');
  return withLock_(()=>{
    const ss=db_(),meeting=table_(ss,'meetings').find(x=>String(x[0])===meetingId);if(!meeting)throw new Error('Meeting does not exist.');
    const agenda=parseJSON_(meeting[9],[]);if(proposalId&&!agenda.includes(proposalId))throw new Error('The proposal is not on this meeting agenda.');
    const id='DEC-'+id_();ss.getSheetByName('decisions').appendRow([id,meetingId,proposalId,decision,cell_(rationale),c.identity.id,new Date()]);record_(ss,c.identity,'RECORD_DECISION','Meeting',meetingId,decision+' · '+proposalId);return {success:true,id};
  });
}
function closeMeeting(token,id){const c=userContext_(token);require_(c,'manageMeetings');return withLock_(()=>{const ss=db_(),rows=table_(ss,'meetings'),i=rowIndex_(rows,id);if(i<0)throw new Error('Meeting not found.');if(String(rows[i][6])==='Cancelled')throw new Error('Meeting cancelled.');rows[i][6]='Concluded';saveRow_(ss,'meetings',id,rows[i]);record_(ss,c.identity,'CONCLUDE_MEETING','Meeting',id,'');return {success:true};});}

function agendaDocument(token,meetingId){
  const c=userContext_(token);require_(c,'exportMeetings');
  const ss=db_(),r=table_(ss,'meetings').find(r=>String(r[0])===meetingId);
  if(!r)throw new Error('Meeting not found.');
  const m=meetingDTO_(r);if(m.status==='Cancelled')throw new Error('Cancelled meetings cannot generate agendas.');
  const selectedIds=new Set(m.proposalIds);
  const lookup=Object.fromEntries(table_(ss,'proposals').map(proposalDTO_).filter(p=>selectedIds.has(p.id)).map(p=>[p.id,p]));
  const rows=[docPara_('01  Opening and welcome'),docPara_('02  Attendance and apologies'),docPara_('03  Adoption of previous minutes'),docPara_('04  Matters arising')];
  m.proposalIds.forEach((id,i)=>{const p=lookup[id];if(!p)return;
    rows.push('<section class="agenda-item"><span class="agenda-no">'+String(i+5).padStart(2,'0')+'</span><div><h3>'+docEsc_(p.title)+'</h3><small>'+docEsc_(p.portfolio)+' · '+docEsc_(p.priority)+' · '+docEsc_(p.id)+'</small><p>'+docEsc_(p.recommendation)+'</p><p><b>Decision requested:</b> '+docEsc_(p.decision)+'</p>'+(p.budget?'<p><b>Resource impact:</b> '+docEsc_(p.budget)+'</p>':'')+'</div></section>');
  });
  const guests=table_(ss,'meetingAttendees').filter(r=>String(r[1])===meetingId&&String(r[8])!=='Withdrawn').map(meetingAttendeeDTO_);
  const attendeeSection=guests.length?('<h2>Requested attendees and representation</h2>'+ 
    '<p style="font-size:11px;color:#617064">The following attendance has been requested or recorded by Cabinet Secretariat. Attendance is not automatically confirmed.</p>'+ 
    '<table style="width:100%;border-collapse:collapse;font:12px/1.5 Arial,sans-serif;margin:10px 0 25px"><thead><tr>'+ 
    ['Attendee','Office / position','Representation','Invitation / RSVP','Recorded attendance'].map(h=>'<th style="text-align:left;border-bottom:2px solid #007a4d;padding:8px 7px">'+h+'</th>').join('')+ '</tr></thead><tbody>'+ 
    guests.map(a=>'<tr>'+[a.name,a.office,a.branch||a.sourceType,a.status+(a.notes?' · '+a.notes:''),
      (a.attendance||'Not yet recorded')+(a.attendanceNotes?' · '+a.attendanceNotes:'')].map(t=>'<td style="padding:8px 7px;border-bottom:1px solid #dde7dc">'+docEsc_(t)+'</td>').join('')+'</tr>').join('')+ '</tbody></table>'+ 
    (guests.some(a=>a.attendance)?'<p style="font-size:11px;color:#617064">Attendance recorded by Cabinet Secretariat; entries marked as not recorded remain unverified.</p>':'')):
    '<p class="note">Requested attendance: to be confirmed by Cabinet Secretariat.</p>';
  rows.push(docPara_('Closing business · Any other matters · Next meeting · Adjournment'));
  return htmlResult_('Cabinet_Agenda_'+m.date+'_'+m.id+'.html',
    docShell_('Cabinet Secretariat','Cabinet Meeting Agenda','ministry',m.id,m.date,'Draft for Cabinet deliberation',
      '<h1>'+docEsc_(m.title)+'</h1><div class="meeting-facts"><div><b>Date</b><span>'+docEsc_(m.date)+'</span></div><div><b>Time (SAST)</b><span>'+docEsc_(m.time)+'</span></div><div><b>Venue</b><span>'+docEsc_(m.venue)+'</span></div><div><b>Chair</b><span>'+docEsc_(m.chair)+'</span></div></div>'+(m.notes?'<p class="note">Secretariat: '+docEsc_(m.notes)+'</p>':'')+attendeeSection+'<h2>Order of Business</h2>'+rows.join(''),
      cabinetDocSignBlock_(ss,'Agenda',m.id)));
}
/** Download an independent attendance record for the meeting minutes/archive. */
function meetingAttendanceDocument(token,meetingId){
  const c=userContext_(token);require_(c,'exportMeetings');
  const ss=db_(),row=table_(ss,'meetings').find(r=>String(r[0])===String(meetingId));
  if(!row)throw new Error('Cabinet meeting not found.');
  const m=meetingDTO_(row),people=table_(ss,'meetingAttendees')
    .filter(r=>String(r[1])===String(meetingId)&&String(r[8])!=='Withdrawn').map(meetingAttendeeDTO_);
  if(!people.length)throw new Error('There are no invited attendees to include in the register.');
  const count=result=>people.filter(a=>a.attendance===result).length;
  const totals='<p style="font:700 12px Arial,sans-serif;color:#164b3a">'+
    'Invited: '+people.length+' · Present: '+count('Present')+' · Absent: '+count('Absent')+
    ' · Excused: '+count('Excused')+' · Unrecorded: '+count('')+'</p>';
  const heads=['Participant','Office / Position','RSVP','Attendance','Notes','Recorded by / At'];
  const table='<table style="width:100%;border-collapse:collapse;font:11px/1.5 Arial,sans-serif;margin:14px 0 26px">'+
    '<thead><tr>'+heads.map(x=>'<th style="text-align:left;padding:8px 6px;border-bottom:2px solid #007a4d">'+docEsc_(x)+'</th>').join('')+'</tr></thead><tbody>'+people.map(a=>
    '<tr>'+[a.name,a.office,a.status,a.attendance||'Not recorded',a.attendanceNotes||'',
      a.recordedAt?(a.recordedBy+' / '+a.recordedAt.slice(0,16).replace('T',' ')+' UTC'):'—']
      .map(x=>'<td style="padding:8px 6px;border-bottom:1px solid #dce5dc;vertical-align:top">'+docEsc_(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  const content='<h1>Meeting Attendance Register</h1><div class="meeting-facts"><div><b>Meeting</b><span>'+docEsc_(m.title)+'</span></div><div><b>Date</b><span>'+docEsc_(m.date)+'</span></div><div><b>Time (SAST)</b><span>'+docEsc_(m.time)+'</span></div><div><b>Venue</b><span>'+docEsc_(m.venue)+'</span></div></div>'+totals+table+
    '<p class="note">Unrecorded participants have not been verified as present or absent. This register is maintained by Cabinet Secretariat.</p>';
  return htmlResult_('Cabinet_Attendance_'+m.date+'_'+m.id+'.html',
    docShell_('Cabinet Secretariat','Cabinet Meeting Attendance Register','ministry',m.id,m.date,'Secretariat record',content,
      cabinetDocSignBlock_(ss,'Attendance',m.id)));
}

function savePressRelease(token,payload){
  const c=userContext_(token);require_(c,'draftPress');
  const headline=required_(payload.headline,'Headline',180),summary=required_(payload.summary,'Summary',350),body=required_(payload.body,'Release body',6000),quote=text_(payload.quote,1200),spokesperson=required_(payload.spokesperson,'Spokesperson',120),releaseDate=String(payload.releaseDate||new Date().toISOString().slice(0,10));
  if(!isoDate_(releaseDate))throw new Error('Choose a valid release date.');
  return withLock_(()=>{
    const ss=db_(),old=payload.id?table_(ss,'press').find(x=>String(x[0])===String(payload.id)):null;
    if(payload.id&&!old)throw new Error('Release not found.');
    if(old&&(String(old[2])!==c.identity.id&&!c.rights.reviewPress))throw new Error('Only the author or approving leadership can revise this release.');
    if(old&&!['Draft','Returned','Submitted'].includes(String(old[8])))throw new Error('An approved or published release cannot be silently edited.');
    const id=old?String(old[0]):'PRS-'+id_(),status=payload.submit?'Submitted':'Draft';
    const row=[id,old?old[1]:new Date(),old?old[2]:c.identity.id,cell_(headline),cell_(summary),cell_(body),cell_(quote),cell_(spokesperson),status,'','','',new Date(),'',releaseDate];
    saveRow_(ss,'press',id,row);record_(ss,c.identity,'SAVE_PRESS','Press',id,status+' · '+headline);return {success:true,id,message:status==='Submitted'?'Press release submitted for approval.':'Draft saved.'};
  });
}
function reviewPressRelease(token,id,status,note){
  const c=userContext_(token);require_(c,'reviewPress');if(!['Approved','Returned'].includes(status))throw new Error('Invalid review status.');
  return withLock_(()=>{const ss=db_(),rows=table_(ss,'press'),i=rowIndex_(rows,id);if(i<0)throw new Error('Release not found.');if(String(rows[i][8])!=='Submitted')throw new Error('Only submitted releases can be reviewed.');rows[i][8]=status;rows[i][9]=c.identity.id;rows[i][10]=cell_(text_(note,1000));rows[i][11]='';rows[i][12]=new Date();saveRow_(ss,'press',id,rows[i]);record_(ss,c.identity,'REVIEW_PRESS','Press',id,status);return {success:true};});
}
function publishPressRelease(token,id){
  const c=userContext_(token);require_(c,'publishPress');
  return withLock_(()=>{const ss=db_(),rows=table_(ss,'press'),i=rowIndex_(rows,id);if(i<0)throw new Error('Release not found.');if(String(rows[i][8])!=='Approved')throw new Error('Leadership must approve the release before publication.');rows[i][8]='Published';rows[i][11]='';rows[i][13]=new Date();rows[i][12]=new Date();saveRow_(ss,'press',id,rows[i]);record_(ss,c.identity,'PUBLISH_PRESS','Press',id,'Approved for external sharing');return {success:true};});
}
function pressDocument(token,id){
  const c=userContext_(token);require_(c,'draftPress');
  const x=table_(db_(),'press').map(pressDTO_).find(r=>r.id===id);if(!x)throw new Error('Release not found.');
  if(x.authorId!==c.identity.id&&!c.rights.reviewPress&&!c.rights.publishPress)throw new Error('Not authorised to generate this statement.');
  const released=x.status==='Published';
  const body='<div class="release-heading">'+(released?'PRESS RELEASE':'PRESS RELEASE • WORKING DRAFT')+'</div>'+docPara_(x.summary,'lead')+'<h1>'+docEsc_(x.headline)+'</h1>'+docMultiline_(x.body)+(x.quote?'<blockquote>“'+docEsc_(x.quote)+'”</blockquote>':'')+'<div class="ends">— END —</div><p><b>Issued by:</b> '+docEsc_(x.spokesperson)+'</p>';
  return htmlResult_('Press_'+x.id+'.html',docShell_('Government Communications','Media Statement','ministry',x.id,x.releaseDate,released?'Published release':'NOT APPROVED FOR PUBLICATION',body,
    released?cabinetDocSignBlock_(db_(),'Press',x.id):'<p class="note">Working draft — signature not available until publication.</p>'));
}
function createAction(token,payload){
  const c=userContext_(token);require_(c,'manageActions');const task=required_(payload.task,'Action',500),ownerId=required_(payload.ownerId,'Owner',22),due=String(payload.due||''),meetingId=text_(payload.meetingId,50);
  if(!isDiscordId_(ownerId)||!isoDate_(due))throw new Error('Select a valid Cabinet member and due date.');
  return withLock_(()=>{const ss=db_(),members=table_(ss,'members'),m=members.find(x=>String(x[0])===ownerId&&bool_(x[6]));if(!m)throw new Error('Select an active Cabinet member.');if(meetingId&&!table_(ss,'meetings').some(x=>String(x[0])===meetingId))throw new Error('Meeting not found.');const id='ACT-'+id_();ss.getSheetByName('actions').appendRow([id,meetingId,cell_(task),ownerId,cell_(m[2]),due,'Not started',new Date(),new Date(),c.identity.id]);record_(ss,c.identity,'NEW_ACTION','Action',id,task);return {success:true,id};});
}
function updateActionStatus(token,id,status){
  const c=userContext_(token);require_(c,'view');if(!GOV.actions.includes(status))throw new Error('Invalid action status.');
  return withLock_(()=>{const ss=db_(),rows=table_(ss,'actions'),i=rowIndex_(rows,id);if(i<0)throw new Error('Action not found.');if(String(rows[i][3])!==c.identity.id&&!c.rights.manageActions)throw new Error('Only the assigned owner or leadership can update this task.');rows[i][6]=status;rows[i][8]=new Date();saveRow_(ss,'actions',id,rows[i]);record_(ss,c.identity,'ACTION_STATUS','Action',id,status);return {success:true};});
}
