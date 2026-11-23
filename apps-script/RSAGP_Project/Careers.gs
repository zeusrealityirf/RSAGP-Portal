/** RSAGP Careers Desk — public Discord-authenticated applications.
 * Applications never grant Cabinet permissions or appoint a minister.
 * Appointments remain an explicit authorised action in the Cabinet Directory.
 */
const CAREERS_POSITIONS_=Object.freeze([
  {id:'defence',title:'Minister of Defence',portfolio:'Defence',summary:'Oversees the military and national defence.',icon:'shield',questions:[
    'A Roblox border patrol reports suspicious activity near a military base. What would you do first?',
    'How would you organise a fun but disciplined training session for new Defence personnel?',
    'Two soldiers are arguing during an operation. How would you calm the situation and keep everyone safe?'
  ]},
  {id:'finance',title:'Minister of Finance',portfolio:'Private Sector Development',summary:'Manages private sector development and supports the Roblox Nation economy.',icon:'coins',questions:[
    'A player wants to open a shop in the nation. How could your ministry help them get started fairly?',
    'You have a small project budget. Would you prioritise a new market, a business event, or something else? Explain.',
    'A business claims another business is receiving unfair advantages. How would you handle the complaint?'
  ]},
  {id:'home-affairs',title:'Minister of Home Affairs',portfolio:'Home Affairs',summary:'Handles citizenship, immigration, identification services, and public-service background checks.',icon:'id',questions:[
    'A new player joins the nation and asks how to become a citizen. How would you guide them?',
    'Someone applies for a government role but their account information does not match their application. What would you do?',
    'How would you make citizenship tests and ID requests simple for players while stopping duplicate applications?'
  ]},
  {id:'police',title:'Minister of Police',portfolio:'Police',summary:'Oversees the South African Police Service and public safety.',icon:'badge',questions:[
    'Two players report an argument at a public event. How would you direct officers to respond?',
    'What would you do if a police officer was using their roleplay powers unfairly?',
    'Give one idea for an enjoyable police-community event that improves trust.'
  ]},
  {id:'justice',title:'Minister of Justice and Constitutional Development',portfolio:'Justice and Constitutional Development',summary:'Oversees legal matters, justice policy, and constitutional issues.',icon:'scale',questions:[
    'A player says they were punished without getting a chance to explain. How should the government review this?',
    'Cabinet proposes a rule that appears unfair to new citizens. How would you raise your concern?',
    'How would you make an in-game court hearing fair, understandable, and enjoyable for everyone?'
  ]},
  {id:'international-relations',title:'Minister of International Relations and Cooperation',portfolio:'International Relations and Cooperation',summary:'Manages relations with other Roblox nations and international agreements.',icon:'globe',questions:[
    'Another Roblox nation invites your government to a diplomatic meeting. How would you prepare?',
    'An ambassador from another group posts an unfriendly message. How would you respond professionally?',
    'Suggest a friendly event or agreement that two Roblox nations could organise together.'
  ]}
]);
const CAREERS_COMMON_ = Object.freeze([
  'Why would you like to serve in this ministry? Tell us about your Roblox roleplay experience.',
  'How often can you be active each week, and how would you communicate if you were unavailable?'
]);
const CAREERS_STATUS_=Object.freeze(['Submitted','Under review','Shortlisted','Accepted','Declined','Withdrawn']);
const CAREER_POSITION_HEADERS_=['Position ID','Title','Portfolio','Description','Icon','Questions JSON','Open','Display Order','Updated At','Updated By'];
const CAREER_ICON_LIST_=Object.freeze(['shield','coins','id','badge','scale','globe','briefcase','landmark']);
const CAREER_ACTIVE_=Object.freeze(['Submitted','Under review','Shortlisted']);
function careerDefaults_(){return CAREERS_POSITIONS_.map((p,index)=>({
  id:p.id,title:p.title,portfolio:p.portfolio,summary:p.summary,icon:p.icon,
  questions:[...CAREERS_COMMON_,...p.questions],open:true,sort:index+1
}));}
function careerRow_(p){return [p.id,p.title,p.portfolio,p.summary,p.icon,JSON.stringify(p.questions),!!p.open,Number(p.sort)||99,new Date(),'SYSTEM'];}
function careerDTO_(row){return {
  id:String(row[0]||''),title:String(row[1]||''),portfolio:String(row[2]||''),summary:String(row[3]||''),icon:String(row[4]||'briefcase'),
  questions:parseJSON_(row[5],[]),open:bool_(row[6]),sort:Number(row[7])||99,
  updated:timestamp_(row[8]),updatedBy:String(row[9]||'')
};}
function careerCatalog_(ss){
  const book=ss||db_(),sh=book.getSheetByName('careerPositions');
  if(!sh||sh.getLastRow()<2)return careerDefaults_();
  const rows=table_(book,'careerPositions').map(careerDTO_);
  return rows.sort((a,b)=>a.sort-b.sort||a.title.localeCompare(b.title));
}
function getCareerPositions(){return careerCatalog_().filter(p=>p.open).map(({id,title,portfolio,summary,icon,questions})=>({id,title,portfolio,summary,icon,questions}));}

/** Server-rendered public vacancy cards. The page is usable before its JS starts.
 * Always escape editable position content: Cabinet admins may edit job titles/text.
 */
function careerHtmlEscape_(value){return String(value===undefined||value===null?'':value).replace(/[&<>\"']/g,ch=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
})[ch]);}
function careerPublicMarkup_(positions,loginHref){
  if(!Array.isArray(positions)||!positions.length)
    return '<div class="empty" style="grid-column:1/-1">No vacancies are currently accepting applications. Once recruitment reopens, available positions will appear here.</div>';
  return positions.map((p,i)=>{
    const icon=['shield-check','chart-no-axes-column','contact-round','shield-check','landmark','globe-2'][i%6];
    const svg=icon==='landmark'?'<path d="M3 10h18M5 10V20M9 10V20M15 10V20M19 10V20M3 20h18M12 2 3 8v2h18V8L12 2Z"/>':
      '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>';
    const signin=careerHtmlEscape_(loginHref||'#');
    const mark='<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+svg+'</svg>';
    return '<article class="job"><div class="job-icon">'+mark+'</div><span class="number">PORTFOLIO '+String(i+1).padStart(2,'0')+'</span><h3>'+careerHtmlEscape_(p.title)+'</h3><p>'+careerHtmlEscape_(p.summary)+'</p><footer><span class="status">Open for applications</span><a class="btn btn-primary btn-sm" href="'+signin+'" target="_top">Sign in to apply</a></footer></article>';
  }).join('');
}
/** Read-only editor diagnostic; does not alter any applications or vacancy settings. */
function diagnoseCareersDesk(){
  requireDatabaseEditor_();
  const ss=db_(),positions=ss.getSheetByName('careerPositions'),apps=ss.getSheetByName('jobApplications');
  const catalog=careerCatalog_(ss);
  const report={positionsTabExists:!!positions,applicationsTabExists:!!apps,
    advertisedPositions:catalog.filter(p=>p.open).length,allPositions:catalog.length,
    storedPositions:positions?Math.max(0,positions.getLastRow()-1):0,
    storedApplications:apps?Math.max(0,apps.getLastRow()-1):0,
    note:'If open positions = 0, reopen a vacancy in Job Applications. If a tab is missing, run setupCareersDesk.'};
  Logger.log(JSON.stringify(report,null,2));
  return report;
}

/** Server-side permissions: the public site never controls vacancies. */
function saveCareerPosition(token,payload){
  const c=userContext_(token);require_(c,'manageCareerPositions');
  if(!payload||typeof payload!=='object')throw new Error('Position details are required.');
  const title=required_(payload.title,'Position title',110),portfolio=required_(payload.portfolio,'Portfolio',110),
    summary=required_(payload.summary,'Description',360);
  if(!Array.isArray(payload.questions)||payload.questions.length!==5)throw new Error('Provide exactly five application questions.');
  const questions=payload.questions.map((q,i)=>required_(q,'Question '+(i+1),350));
  const icon=CAREER_ICON_LIST_.includes(payload.icon)?payload.icon:'briefcase';
  const open=payload.open===true;
  const sort=Math.max(1,Math.min(99,Math.floor(Number(payload.sort)||50)));
  const id=String(payload.id||'');
  if(!/^[a-z][a-z0-9-]{1,59}$/.test(id))throw new Error('Invalid position reference.');
  return withLock_(()=>{
    const ss=db_(),sh=ss.getSheetByName('careerPositions');
    if(!sh)throw new Error('Run setupCareersDesk once before editing vacancies.');
    const rows=table_(ss,'careerPositions');
    const existing=rows.find(r=>String(r[0])===id);
    if(!existing)throw new Error('Position was not found.');
    const row=[id,cell_(title),cell_(portfolio),cell_(summary),icon,JSON.stringify(questions),open,sort,new Date(),c.identity.id];
    saveRow_(ss,'careerPositions',id,row);
    record_(ss,c.identity,'UPDATE_CAREER_POSITION','Career Position',id,title+' · '+(open?'Open':'Closed'));
    return {success:true,message:open?'Position updated and open for applications.':'Position updated and closed to new applications.'};
  });
}
function setCareerPositionOpen(token,id,isOpen){
  const c=userContext_(token);require_(c,'manageCareerPositions');
  return withLock_(()=>{
    const ss=db_(),row=table_(ss,'careerPositions').find(r=>String(r[0])===String(id));
    if(!row)throw new Error('Position not found. Run setupCareersDesk if upgrading an older portal.');
    row[6]=isOpen===true;row[8]=new Date();row[9]=c.identity.id;
    saveRow_(ss,'careerPositions',id,row);
    record_(ss,c.identity,'CHANGE_CAREER_VACANCY','Career Position',id,row[6]?'Reopened':'Closed');
    return {success:true,message:row[6]?'Position reopened for applications.':'Position closed and hidden from public vacancies.'};
  });
}
function careersPosition_(id,ss){return careerCatalog_(ss).find(p=>p.id===String(id||''))||null;}
function jobApplicationDTO_(r,includeAnswers){
  const item={id:String(r[0]||''),discordId:String(r[1]||''),discordUsername:String(r[2]||''),robloxUsername:String(r[3]||''),robloxId:String(r[4]||''),positionId:String(r[5]||''),position:String(r[6]||''),status:String(r[9]||'Submitted'),submitted:timestamp_(r[10]),updated:timestamp_(r[11]),reviewerId:String(r[12]||''),reviewer:String(r[13]||''),reviewNote:String(r[14]||'')};
  if(includeAnswers)item.answers=parseJSON_(r[7],[]);
  return item;
}
function careersHome(token){
  const identity=session_(token),rows=table_(db_(),'jobApplications');
  return {identity:{id:identity.id,username:identity.username,avatar:identity.avatar||''},
    positions:getCareerPositions(),
    applications:rows.filter(r=>String(r[1])===identity.id).slice(-30).reverse().map(r=>jobApplicationDTO_(r,false))};
}
function submitJobApplication(token,payload){
  const identity=session_(token);
  if(!payload||typeof payload!=='object')throw new Error('Please complete your application.');
  const position=careersPosition_(payload.positionId);
  if(!position||!position.open)throw new Error('This position is no longer accepting applications. Refresh the available positions.');
  const username=required_(payload.robloxUsername,'Roblox username',20);
  const supplied=payload.answers;
  if(!Array.isArray(supplied)||supplied.length!==5)throw new Error('Answer all five questions before submitting.');
  const prompts=position.questions;
  const answers=supplied.map((value,i)=>{
    const answer=required_(value,'Answer '+(i+1),1100);
    if(answer.length<18)throw new Error('Please write a little more for question '+(i+1)+' (at least 18 characters).');
    return {question:prompts[i],answer:cell_(answer)};
  });
  // Roblox ID is a public display-account lookup, not proof of account ownership.
  const profile=robloxProfile_(username);
  return withLock_(()=>{
    const ss=db_(),rows=table_(ss,'jobApplications');
    const current=careersPosition_(position.id,ss);
    if(!current||!current.open)throw new Error('This vacancy has closed. Please choose a different position.');
    if(JSON.stringify(current.questions)!==JSON.stringify(prompts))throw new Error('These application questions have changed. Please refresh and answer the latest questions.');
    const mine=rows.filter(r=>String(r[1])===identity.id);
    if(mine.some(r=>String(r[5])===position.id&&CAREER_ACTIVE_.includes(String(r[9]))))
      throw new Error('You already have an active application for this position. Check your application status.');
    const now=Date.now();
    if(mine.filter(r=>now-new Date(r[10]).getTime()<7*86400000).length>=3)
      throw new Error('Maximum three applications per seven days. Please try again later.');
    const lastForPosition=mine.filter(r=>String(r[5])===position.id).slice(-1)[0];
    if(lastForPosition&&now-new Date(lastForPosition[10]).getTime()<7*86400000)
      throw new Error('Please wait seven days before applying again for the same position.');
    const id='JOB-'+id_();
    ss.getSheetByName('jobApplications').appendRow([id,identity.id,cell_(identity.username),cell_(profile.username),profile.id,position.id,position.title,JSON.stringify(answers),'','Submitted',new Date(),new Date(),'','','']);
    record_(ss,identity,'SUBMIT_JOB_APPLICATION','Job Application',id,position.title);
    return {success:true,id,message:'Application submitted. You can follow its progress in My Applications.'};
  });
}
function withdrawJobApplication(token,id){
  const identity=session_(token);
  return withLock_(()=>{
    const ss=db_(),row=table_(ss,'jobApplications').find(r=>String(r[0])===String(id));
    if(!row||String(row[1])!==identity.id)throw new Error('Application not found.');
    if(!['Submitted','Under review','Shortlisted'].includes(String(row[9])))throw new Error('This application can no longer be withdrawn.');
    row[9]='Withdrawn';row[11]=new Date();
    saveRow_(ss,'jobApplications',id,row);record_(ss,identity,'WITHDRAW_JOB_APPLICATION','Job Application',id,row[6]);
    return {success:true,message:'Application withdrawn.'};
  });
}
function reviewJobApplication(token,id,payload){
  const c=userContext_(token);require_(c,'reviewApplications');
  if(!payload||typeof payload!=='object')throw new Error('Review details are required.');
  const status=String(payload.status||'');
  if(!['Under review','Shortlisted','Accepted','Declined'].includes(status))throw new Error('Choose a valid review status.');
  const note=text_(payload.note,1100);
  if(status==='Declined'&&note.length<12)throw new Error('Please give the applicant a short reason for declining.');
  return withLock_(()=>{
    const ss=db_(),row=table_(ss,'jobApplications').find(r=>String(r[0])===String(id));
    if(!row)throw new Error('Application not found.');
    if(String(row[1])===c.identity.id)throw new Error('You cannot review your own application.');
    if(!['Submitted','Under review','Shortlisted'].includes(String(row[9])))throw new Error('This application has already been completed or withdrawn.');
    // Validate vacancy before touching the application so a missing sheet cannot leave half a decision.
    const acceptedPosition=status==='Accepted' ? table_(ss,'careerPositions').find(r=>String(r[0])===String(row[5])) : null;
    if(status==='Accepted'&&!acceptedPosition)throw new Error('Missing vacancy record; run setupCareersDesk and retry.');
    row[9]=status;row[11]=new Date();row[12]=c.identity.id;row[13]=cell_(c.member?.name||c.identity.username);row[14]=cell_(note);
    saveRow_(ss,'jobApplications',id,row);
    if(status==='Accepted'){
      const position=acceptedPosition;
      position[6]=false;position[8]=new Date();position[9]=c.identity.id;
      saveRow_(ss,'careerPositions',String(position[0]),position);
      record_(ss,c.identity,'FILL_CAREER_VACANCY','Career Position',row[5],'Closed after application '+id+' was accepted');
    }
    record_(ss,c.identity,'REVIEW_JOB_APPLICATION','Job Application',id,status+' · '+String(row[6]));
    return {success:true,message:status==='Accepted'?'Application accepted and archived; vacancy automatically closed. Appoint the candidate separately in Cabinet Directory.':'Application marked '+status+'. Appointments must be made separately in the Cabinet Directory.'};
  });
}
function careersApplicationsForReview_(ss){
  const apps=latestRows_(ss,'jobApplications',400).reverse().map(row=>jobApplicationDTO_(row,true));
  return {active:apps.filter(a=>CAREER_ACTIVE_.includes(a.status)),
    history:apps.filter(a=>!CAREER_ACTIVE_.includes(a.status)),positions:careerCatalog_(ss)};
}
/** Safe one-time update for existing projects. Retains every historic application. */
function setupCareersDesk(){
  requireDatabaseEditor_();
  const ss=db_();
  [ ['jobApplications',GOV.sheets.jobApplications], ['careerPositions',CAREER_POSITION_HEADERS_] ].forEach(([name,headers])=>{
    let sh=ss.getSheetByName(name);
    if(!sh)sh=ss.insertSheet(name);
    if(sh.getMaxColumns()<headers.length)sh.insertColumnsAfter(sh.getMaxColumns(),headers.length-sh.getMaxColumns());
    if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);}
    else{
      const existing=sh.getRange(1,1,1,headers.length).getDisplayValues()[0];
      if(existing.some((value,i)=>value!==headers[i]))throw new Error('Unexpected columns in '+name+'. Review sheet before continuing.');
    }
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,headers.length).setBackground('#164b3a').setFontWeight('bold').setFontColor('#ffffff');
    if(name==='jobApplications')['B:B','E:E','M:M'].forEach(range=>sh.getRange(range).setNumberFormat('@'));
    if(name==='careerPositions'&&sh.getLastRow()===1){
      const data=careerDefaults_().map(careerRow_);
      sh.getRange(2,1,data.length,headers.length).setValues(data);
    }
  });
  bumpDataVersion_();
  return {success:true,message:'Government Careers database and editable vacancies ready. Existing applications preserved.'};
}
