/** Linked citizenship examination for the RSAGP citizen desk. */
const CITIZENSHIP_PASS_PERCENT_ = 80;
const CITIZENSHIP_ROTATING_COUNT_ = 10;

function citizenshipDTO_(r){return {id:String(r[0]),discordId:String(r[1]),discordUser:String(r[2]),robloxId:String(r[3]),robloxUsername:String(r[4]),score:Number(r[5]),total:Number(r[6]),status:String(r[7]),submitted:timestamp_(r[8]),verifiedBy:String(r[9]||''),verified:timestamp_(r[10]),cardNumber:String(r[11]||''),reviewNote:String(r[12]||'')};}
function activeQuestions_(ss){return table_(ss,'citizenshipQuestions').filter(r=>bool_(r[7]));}
function questionBankData_(){return [
 ['CIV-SA-01','What is the supreme law of South Africa?','The Constitution','A Cabinet circular','A ministry handbook','A municipal by-law','A',true],
 ['CIV-SA-02','How many provinces does South Africa have?','7','8','9','10','C',true],
 ['CIV-SA-03','Which city is the administrative seat of the national executive and most government departments?','Bloemfontein','Pretoria','Cape Town','Johannesburg','B',true],
 ['CIV-SA-04','Which institution makes national laws in South Africa?','The National Treasury','Parliament','The Constitutional Court','The South African Reserve Bank','B',true],
 ['CIV-SA-05','Who signs bills into law after Parliament has passed them?','The Chief Justice','The President','The Minister of Home Affairs','The Speaker of the National Assembly','B',true],
 ['CIV-SA-06','At what age may South African citizens usually vote in national elections?','16','17','18','21','C',true],
 ['CIV-SA-07','How many official languages does South Africa have?','9','10','11','12','D',true],
 ['CIV-SA-08','Which branch of government interprets the law and the Constitution?','Judicial branch','Executive branch','Legislative branch','Provincial cabinet','A',true],
 ['CIV-SA-09','Which court is the highest court on constitutional matters?','Supreme Court of Appeal','Magistrates\' Court','High Court','Constitutional Court','D',true],
 ['CIV-SA-10','Which chapter of the Constitution protects fundamental rights such as equality and freedom of expression?','Bill of Rights','National budget','Cabinet code','Municipal regulations','A',true],
 ['CIV-SA-11','The national executive consists primarily of the President, Deputy President and:','Cabinet ministers','Judges','Mayors','Premiers only','A',true],
 ['CIV-SA-12','Which sphere of government is responsible for local services such as municipal waste collection and many local roads?','National government','Provincial government','Local government','Traditional councils only','C',true],
 ['CIV-SA-13','What does the Public Protector mainly do?','Command the police','Investigate improper conduct in state affairs','Run elections','Issue passports','B',true],
 ['CIV-SA-14','Which independent body manages national and provincial elections in South Africa?','The IEC','The NPA','SAPS','Stats SA','A',true],
 ['CIV-SA-15','What is a key responsibility of Members of Parliament?','Adopt laws and hold the executive accountable','Issue court sentences','Print money','Approve private game bans','A',true],
 ['CIV-SA-16','What is the purpose of a national budget?','To appoint judges','To show how public money will be raised and spent','To register voters','To amend the Constitution automatically','B',true],
 ['CIV-SA-17','If a person believes their constitutional rights were violated, what is usually the lawful response?','Use the courts or other lawful complaint mechanisms','Ignore it completely','Threaten officials','Change the Constitution personally','A',true],
 ['CIV-SA-18','Which institution is primarily responsible for prosecuting criminal cases on behalf of the state?','National Prosecuting Authority','Parliament','IEC','South African Weather Service','A',true],
 ['CIV-SA-19','What does "rule of law" mean?','Only ministers must obey the law','Everyone, including the government, is subject to the law','Only courts can break the law','Laws do not apply during elections','B',true],
 ['CIV-SA-20','Which sphere of government is headed by a premier?','National','Provincial','Local','Judicial','B',true],
 ['CIV-SA-21','Which document is typically used to record an official Cabinet decision inside the RSAGP portal?','A formal decisions and actions register','A private direct message','An unrelated game chat log','No record is needed','A',true],
 ['CIV-SA-22','Before a citizenship card is issued in the RSAGP portal, what else must happen after the applicant passes the test?','Nothing else','The player account must be independently verified and approved','The applicant must pay real money','The player becomes a real-world citizen','B',true],
 ['CIV-SA-23','What does South Africa\'s separation of powers aim to do?','Give all power to one office','Divide state power to promote accountability and balance','Eliminate elections','Replace courts with Parliament','B',true],
 ['CIV-SA-24','If you disagree with a public decision in a constitutional democracy, what is the most appropriate response?','Use lawful participation, petitions, elections or court processes','Spread false claims','Threaten other people','Ignore all laws','A',true]
];}
function questionSeed_(identityId){return Utilities.formatDate(new Date(),'Etc/UTC','yyyyMMdd')+'|'+String(identityId||'anon');}
function hashSeed_(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function shuffleWithSeed_(rows,seedText){const out=rows.slice();let seed=hashSeed_(seedText)||1;function rnd(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}for(let i=out.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));const t=out[i];out[i]=out[j];out[j]=t;}return out;}
function rotatingQuestions_(ss,identityId){const all=activeQuestions_(ss);if(all.length<=CITIZENSHIP_ROTATING_COUNT_)return all;return shuffleWithSeed_(all,questionSeed_(identityId)).slice(0,CITIZENSHIP_ROTATING_COUNT_);}
function citizenContext(token){
 const identity=session_(token),ss=db_(),rows=table_(ss,'citizenshipAttempts');
 const latest=rows.filter(r=>String(r[1])===identity.id).slice(-1).map(citizenshipDTO_)[0]||null;
 return {identity,latest,passPercent:CITIZENSHIP_PASS_PERCENT_,questions:rotatingQuestions_(ss,identity.id).map(r=>({id:String(r[0]),question:String(r[1]),options:[r[2],r[3],r[4],r[5]].map(String)}))};
}
function robloxProfile_(username){
 const requested=required_(username,'Citizen username',20);
 if(!/^[A-Za-z0-9_]{3,20}$/.test(requested))throw new Error('Enter a valid player username (3–20 letters, numbers or underscores).');
 const key='mz_roblox_'+requested.toLowerCase(),cache=CacheService.getScriptCache();const hit=cache.get(key);if(hit)return parseJSON_(hit,{});
 const response=UrlFetchApp.fetch('https://users.roblox.com/v1/usernames/users',{method:'post',contentType:'application/json',payload:JSON.stringify({usernames:[requested],excludeBannedUsers:true}),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('Player profile lookup is temporarily unavailable.');
 const rows=parseJSON_(response.getContentText(),{}).data||[],r=rows[0];
 if(!r||!/^[0-9]{1,20}$/.test(String(r.id)))throw new Error('Player username not found.');
 const result={id:String(r.id),username:String(r.name||requested)};cache.put(key,JSON.stringify(result),600);return result;
}
function checkRobloxUsername(token,username){session_(token);return robloxProfile_(username);}
function takeCitizenshipTest(token,payload){
 const identity=session_(token),username=required_(payload.robloxUsername,'Citizen username',20);
 const answers=payload.answers;if(!answers||typeof answers!=='object'||Array.isArray(answers))throw new Error('Please complete the citizenship exam.');
 const ss=db_(),qs=rotatingQuestions_(ss,identity.id),attempts=table_(ss,'citizenshipAttempts').filter(r=>String(r[1])===identity.id);
 if(qs.length<4)throw new Error('The citizenship exam has not been configured. Contact Cabinet Secretariat.');
 if(attempts.some(r=>['Pending Review','Approved'].includes(String(r[7]))))throw new Error('You already have a pending or approved citizenship application.');
 if(attempts.filter(r=>Date.now()-new Date(r[8]).getTime()<86400000).length>=3)throw new Error('Maximum three attempts per 24 hours. Please try again later.');
 if(qs.some(r=>!['A','B','C','D'].includes(String(answers[String(r[0])]||''))))throw new Error('Please answer every question.');
 const profile=robloxProfile_(username);
 const score=qs.reduce((sum,r)=>sum+(String(answers[String(r[0])])===String(r[6])?1:0),0);
 const passed=score*100>=qs.length*CITIZENSHIP_PASS_PERCENT_;
 return withLock_(()=>{
  const fresh=table_(ss,'citizenshipAttempts').filter(r=>String(r[1])===identity.id);
  if(fresh.some(r=>['Pending Review','Approved'].includes(String(r[7]))))throw new Error('You already have a pending or approved application.');
  const id='CIT-'+id_();const status=passed?'Pending Review':'Failed';
  ss.getSheetByName('citizenshipAttempts').appendRow([id,identity.id,cell_(identity.username),profile.id,cell_(profile.username),score,qs.length,status,new Date(),'','','','']);
  record_(ss,identity,passed?'CITIZENSHIP_EXAM_PASS':'CITIZENSHIP_EXAM_FAIL','Citizenship',id,score+'/'+qs.length);
  return {success:true,id,score,total:qs.length,status,message:passed?'Test passed. Cabinet must verify ownership of the player account before issuing the card.':'Not passed. You may retry, up to three times in 24 hours.'};
 });
}
function reviewCitizenshipApplication(token,attemptId,decision,verificationNote){
 const c=userContext_(token);require_(c,'manageCitizenship');
 if(!['Approved','Rejected'].includes(decision))throw new Error('Choose Approved or Rejected.');
 const note=required_(verificationNote,'Verification notes',600);
 if(decision==='Approved'&&note.length<15)throw new Error('Describe how player account ownership was independently verified (at least 15 characters).');
 return withLock_(()=>{
  const ss=db_(),rs=table_(ss,'citizenshipAttempts'),row=rs.find(r=>String(r[0])===attemptId);
  if(!row||String(row[7])!=='Pending Review')throw new Error('Only pending applications can be reviewed.');
  if(String(row[1])===c.identity.id)throw new Error('You cannot approve your own citizenship application.');
  if(decision==='Approved' && String(row[3]) && rs.some(r=>String(r[3])===String(row[3]) && String(r[7])==='Approved'))throw new Error('This player account already has an approved citizenship card.');
  row[7]=decision;row[9]=c.identity.id;row[10]=new Date();row[11]=decision==='Approved'?'RSA-CIT-'+new Date().getUTCFullYear()+'-'+id_().slice(0,8):'';row[12]=cell_(note);
  saveRow_(ss,'citizenshipAttempts',attemptId,row);
  record_(ss,c.identity,'REVIEW_CITIZENSHIP','Citizenship',attemptId,decision+' · '+note.slice(0,80));
  return {success:true,message:decision==='Approved'?'Citizenship card approved. The applicant can download their card.':'Application rejected with feedback.'};
 });
}
function robloxAvatarImage_(id){
 if(!/^[0-9]{1,20}$/.test(String(id)))return '';
 try{
  const uri='https://thumbnails.roblox.com/v1/users/avatar?userIds='+encodeURIComponent(id)+'&size=420x420&format=Png&isCircular=false';
  const r=UrlFetchApp.fetch(uri,{muteHttpExceptions:true});if(r.getResponseCode()!==200)return '';
  const data=parseJSON_(r.getContentText(),{}).data||[];const url=String(data[0]?.imageUrl||'');
  if(!/^https:\/\/([a-zA-Z0-9-]+\.)*rbxcdn\.com\//.test(url))return '';
  const png=UrlFetchApp.fetch(url,{muteHttpExceptions:true});if(png.getResponseCode()!==200)return '';
  const bytes=png.getBlob().getBytes();if(bytes.length>500000||bytes.length<100)return '';
  return 'data:image/png;base64,'+Utilities.base64Encode(bytes);
 }catch(e){return '';} // Cards still work with a neutral portrait placeholder.
}
/**
 * Export the approved RSAGP citizenship card as a self-contained printable HTML file.
 * Inspired by the supplied cream South African document reference, but intentionally
 * distinct from a real passport/identity document. No MRZ or travel-document fields.
 * The Roblox avatar and national flag artwork are embedded as data URIs so they work
 * in a downloaded HTML file even without an external image host.
 */
function citizenCardHTML(token,id){
  const identity=session_(token),context=userContext_(token);
  const row=table_(db_(),'citizenshipAttempts').find(r=>String(r[0])===String(id));
  if(!row||String(row[7])!=='Approved')throw new Error('Only approved citizenship applications have a card.');
  if(String(row[1])!==identity.id&&!context.rights.manageCitizenship)
    throw new Error('You can only download your own citizenship card.');

  const card=citizenshipDTO_(row);
  const photo=robloxAvatarImage_(card.robloxId);
  const portrait=photo
    ? '<img class="avatar-image" src="'+photo+'" alt="Player avatar portrait">'
    : '<div class="avatar-fallback"><span>PLAYER</span><strong>AVATAR</strong></div>';
  const verifiedDate=new Date(String(card.verified||''));
  const issued=Number.isNaN(verifiedDate.getTime())
    ? (String(card.verified||'').slice(0,10)||'—')
    : String(verifiedDate.getUTCDate()).padStart(2,'0')+' '+
      ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][verifiedDate.getUTCMonth()]+' '+
      verifiedDate.getUTCFullYear();
  const safeName=docEsc_(card.robloxUsername);
  const safeAccount=docEsc_(card.robloxId);
  const safeReference=docEsc_(card.cardNumber);
  const safeIssue=docEsc_(issued);

  const html=`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RSAGP Citizenship Card | ${safeName}</title>
<style>${citizenCardCSS_()}</style>
</head><body>
<div class="page">
  <main class="citizen-card" role="document" aria-label="RSAGP citizenship card">
    <div class="fine-paper" aria-hidden="true"></div>
    <div class="honeycomb" aria-hidden="true"></div>
    <img class="emblem-watermark" src="${SA_COAT_SRC_}" alt="" aria-hidden="true">
    <div class="flag-ribbon" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

    <header class="card-header">
      <div class="flag-box"><img src="${SA_FLAG_SRC_}" alt="South African flag"></div>
      <div class="headline">
        <p class="eyebrow">RSAGP · ROBLOX NATION</p>
        <h1>REPUBLIC OF SOUTH AFRICA</h1>
        <div class="subtitle"><span></span><strong>CITIZENSHIP CARD</strong><span></span></div>
      </div>
      <div class="arms-box"><img src="${SA_COAT_SRC_}" alt="South African coat of arms"></div>
    </header>

    <div class="card-content">
      <aside class="portrait-panel">
        <div class="portrait-frame">${portrait}</div>
        <div class="portrait-wave" aria-hidden="true">
          <svg viewBox="0 0 226 34" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 7 Q28 -1 57 8 T114 8 T171 8 T228 8"/>
            <path d="M0 17 Q28 9 57 18 T114 18 T171 18 T228 18"/>
            <path d="M0 27 Q28 19 57 28 T114 28 T171 28 T228 28"/>
          </svg>
        </div>
        <span class="avatar-label">PLAYER AVATAR · ACCOUNT LINKED</span>
      </aside>

      <section class="data-panel">
        <div class="information-grid">
          <div class="info-block wide"><label>Citizen username <em>/ Burgernaam</em></label><b class="citizen-name">${safeName}</b></div>
          <div class="info-block"><label>Citizen account number</label><b>${safeAccount}</b></div>
          <div class="info-block"><label>Portal citizenship</label><b>SOUTH AFRICAN</b></div>
          <div class="info-block"><label>Card reference</label><b class="ref">${safeReference}</b></div>
          <div class="info-block"><label>Date issued</label><b>${safeIssue}</b></div>
          <div class="info-block"><label>Registration status</label><b class="approved"><span class="dot"></span> APPROVED</b></div>
        </div>
        <div class="authority-row">
          <div><label>Issuing authority</label><strong>ROBLOX</strong></div>
          <div class="approval-stamp">RSAGP<br><small>VERIFIED PORTAL RECORD</small></div>
        </div>
      </section>
    </div>

    <div class="card-bottom">
      <div class="record-band">
        <span>REGISTERED CITIZENSHIP PROFILE</span>
        <strong>${safeReference}</strong>
      </div>
      <div class="bottom-note" data-rsagp-footer="1">
        <span>${docEsc_(RSAGP_DOCUMENT_BRAND_)} · ROBLOX NATION</span>
        <strong>FICTIONAL CITIZEN RECORD · NOT LEGAL ID</strong>
      </div>
    </div>
  </main>
  <p class="print-hint">Designed for your RSAGP account. Print with background graphics enabled. For Roblox Nation use only; not valid identification or a travel document.</p>
</div></body></html>`;
  return htmlResult_(String(card.cardNumber||'RSAGP')+'_Citizenship_Card.html',html);
}

function citizenCardCSS_(){return `
@page{size:landscape;margin:0}
:root{--ink:#202820;--forest:#174932;--muted:#54735e;--gold:#d8ab49;--paper:#fbf8e9}
*{box-sizing:border-box}
html,body{margin:0;padding:0;color:var(--ink);font-family:Verdana,"Segoe UI",Arial,sans-serif}
body{background:#e8eae7;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:17px;padding:28px}
.citizen-card{width:1040px;height:665px;flex:none;position:relative;overflow:hidden;border-radius:25px;background:linear-gradient(113deg,#fcf9e9 0%,#fefdf3 48%,#fbf7e7 100%);border:1px solid #d1c69b;box-shadow:0 22px 64px #213b2952}
.fine-paper{position:absolute;inset:0;pointer-events:none;opacity:.56;background-image:
  repeating-radial-gradient(ellipse at 2% 8%,transparent 0 5px,#c7bb803a 5.3px 5.85px,transparent 6.1px 9px),
  repeating-radial-gradient(ellipse at 92% 15%,transparent 0 5.5px,#9fbb9360 5.8px 6.2px,transparent 6.4px 10px),
  repeating-radial-gradient(ellipse at 48% 101%,transparent 0 7px,#dec68c4a 7.3px 8px,transparent 8.3px 13px);
  background-size:345px 340px,400px 390px,440px 350px}
.honeycomb{position:absolute;inset:0;opacity:.25;pointer-events:none;background:repeating-linear-gradient(62deg,transparent 0 36px,#c4b07233 37px 37.5px,transparent 38px 72px)}
.emblem-watermark{position:absolute;right:46px;bottom:69px;height:260px;width:210px;object-fit:contain;opacity:.075;filter:sepia(1);pointer-events:none}
.flag-ribbon{position:absolute;inset:0 0 auto;height:9px;display:grid;grid-template-columns:22% 4% 42% 10% 22%}
.flag-ribbon i:nth-child(1){background:#de3831}.flag-ribbon i:nth-child(2){background:#fff}.flag-ribbon i:nth-child(3){background:#007a4d}.flag-ribbon i:nth-child(4){background:#ffb612}.flag-ribbon i:nth-child(5){background:#002395}
.card-header{position:relative;z-index:1;display:grid;grid-template-columns:128px 1fr 105px;column-gap:18px;align-items:center;padding:34px 38px 14px}
.flag-box{width:118px;height:78px;border-radius:7px;overflow:hidden;border:1px solid #e6e1bf;box-shadow:0 3px 10px #1237201a}
.flag-box img{width:100%;height:100%;object-fit:cover}
.headline{text-align:center;min-width:0}
.eyebrow{margin:0 0 4px;font-size:10px;letter-spacing:3px;font-weight:700;color:#6b886c}
.headline h1{font-family:Georgia,"Times New Roman",serif;font-size:34px;line-height:1.14;letter-spacing:1.1px;color:#262b20;margin:0;white-space:nowrap}
.subtitle{display:flex;align-items:center;gap:14px;justify-content:center;margin-top:12px;color:var(--forest)}
.subtitle span{height:2px;width:74px;background:#456d45}.subtitle strong{font-size:19px;letter-spacing:4px;font-style:italic}
.arms-box{text-align:center;height:94px;display:flex;align-items:center;justify-content:center}
.arms-box img{max-width:95px;max-height:94px;object-fit:contain}
.card-content{position:relative;z-index:1;display:grid;grid-template-columns:257px 1fr;gap:27px;padding:19px 39px 0}
.portrait-panel{display:flex;flex-direction:column;align-items:center}
.portrait-frame{height:266px;width:232px;display:grid;place-items:center;border:5px solid #fafcf4;background:linear-gradient(160deg,#e0e7d8,#a6b6a5);box-shadow:0 4px 14px #24462d2c,0 0 0 1px #d3d8c5;overflow:hidden;border-radius:6px}
.avatar-image{width:100%;height:100%;object-fit:contain;image-rendering:auto}
.avatar-fallback{height:100%;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(140deg,#e4ebdf,#b8cfc0);color:#638770}
.avatar-fallback span{font-size:12px;letter-spacing:3px}.avatar-fallback strong{font-size:30px;letter-spacing:1px}
.portrait-wave{width:222px;height:38px;margin-top:6px}
.portrait-wave svg{width:100%;height:100%}.portrait-wave path{fill:none;stroke:#556b51;stroke-width:1.6px;opacity:.6}
.avatar-label{font-size:9px;font-weight:700;letter-spacing:1.1px;color:#68816c}
.data-panel{padding-top:3px;min-width:0}
.information-grid{display:grid;grid-template-columns:1fr 1fr;gap:25px 25px}
.info-block{min-width:0}
.info-block label,.authority-row label{display:block;color:#386c48;font:italic 13px Georgia,serif;letter-spacing:.3px;margin-bottom:7px}
.info-block label em{font-weight:400}
.info-block b{display:block;font-size:20px;letter-spacing:.2px;color:#27302b;overflow-wrap:anywhere;line-height:1.15}
.info-block .citizen-name{font-size:28px;letter-spacing:1.2px;text-transform:uppercase}
.info-block .ref{font-size:17px;overflow-wrap:anywhere}
.approved{color:#116f49!important;font-size:19px!important}
.dot{width:10px;height:10px;display:inline-block;border-radius:50%;background:#139363;vertical-align:middle}
.authority-row{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-top:26px;border-top:1px solid #d2cda8;padding-top:17px}
.authority-row strong{font-size:22px;letter-spacing:3px}
.approval-stamp{color:#64866b;border:2px double #809a7a;border-radius:12px;padding:8px 13px;transform:rotate(-5deg);text-align:center;font:900 18px Georgia,serif;line-height:1;opacity:.77}
.approval-stamp small{font:700 8px Verdana,sans-serif;letter-spacing:.7px}
.card-bottom{position:absolute;z-index:1;left:0;right:0;bottom:0;border-top:3px solid #d2ae4c;background:linear-gradient(#fbf8ec,#f8f2d6)}
.record-band{min-height:42px;display:flex;justify-content:space-between;gap:16px;align-items:center;padding:10px 41px;border-bottom:1px solid #c5caab75}
.record-band span{font-size:12px;letter-spacing:2px;color:#527257;font-weight:700}
.record-band strong{font-size:13px;letter-spacing:2.2px;color:#253c2e}
.bottom-note{display:flex;align-items:center;justify-content:space-between;padding:11px 41px;gap:30px}
.bottom-note span{font-size:9px;letter-spacing:1px;color:#50715c;font-weight:700}
.bottom-note strong{font-size:11px;letter-spacing:1.3px;color:#a64c3e}
.print-hint{text-align:center;max-width:700px;font-size:12px;color:#58685a;margin:0}
/* Responsive record view: readable and vertical on phones, fixed layout when printing. */
@media screen and (max-width:1090px) and (min-width:841px){
  body{overflow-x:auto}.page{align-items:flex-start}.citizen-card{transform:scale(.8);transform-origin:top left;margin-bottom:-133px}
}
@media screen and (max-width:840px){
  html,body{overflow-x:hidden}
  .page{min-height:100dvh;display:flex;align-items:center;justify-content:flex-start;padding:16px 12px 35px;gap:12px}
  .citizen-card{width:100%;max-width:540px;height:auto;min-height:0;transform:none;margin:0;
    border-radius:18px;overflow:hidden;box-shadow:0 12px 35px #24462d24}
  .card-header{display:grid;grid-template-columns:52px minmax(0,1fr) 50px;gap:7px;padding:25px 13px 14px}
  .flag-box{width:50px;height:33px;border-radius:4px}
  .headline h1{white-space:normal;font-size:clamp(14px,4.8vw,24px);letter-spacing:.1px;line-height:1.15}
  .eyebrow{font-size:7px;letter-spacing:1px}
  .subtitle{margin-top:4px;gap:4px}.subtitle span{width:11px}
  .subtitle strong{font-size:10px;letter-spacing:1.1px}
  .arms-box{height:50px}.arms-box img{max-width:46px;max-height:48px}
  .card-content{display:flex;flex-direction:column;gap:12px;padding:12px 17px 22px}
  .portrait-panel{align-self:center;max-width:100%;gap:1px}
  .portrait-frame{width:155px;height:174px;border-width:4px}
  .portrait-wave{height:18px;width:165px;margin-top:3px}
  .avatar-label{font-size:8px;letter-spacing:.5px}
  .data-panel{padding-top:8px;width:100%}
  .information-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:17px 11px}
  .info-block label,.authority-row label{font-size:11px;line-height:1.25;margin-bottom:4px}
  .info-block b{font-size:15px;line-height:1.3}
  .info-block .citizen-name{font-size:19px;letter-spacing:.2px}
  .info-block .ref{font-size:12px;overflow-wrap:anywhere}
  .approved{font-size:14px!important}
  .authority-row{margin-top:20px;padding-top:14px}
  .authority-row strong{font-size:15px;letter-spacing:1px}
  .approval-stamp{font-size:12px;padding:7px;max-width:108px}
  .approval-stamp small{font-size:6px}
  .card-bottom{position:relative;left:auto;right:auto;bottom:auto}
  .record-band{padding:12px 17px;gap:8px;min-height:0;flex-wrap:wrap}
  .record-band span{font-size:9px;letter-spacing:.5px}
  .record-band strong{font-size:11px;letter-spacing:.6px;overflow-wrap:anywhere}
  .bottom-note{padding:11px 17px;gap:7px;flex-wrap:wrap;align-items:flex-start}
  .bottom-note span,.bottom-note strong{font-size:9px;letter-spacing:.4px}
  .print-hint{font-size:12px;max-width:540px;line-height:1.5}
}
@media screen and (max-width:360px){
  .card-header{grid-template-columns:41px minmax(0,1fr) 37px;gap:5px;padding-left:9px;padding-right:9px}
  .flag-box{width:40px;height:27px}.arms-box img{max-width:36px}
  .subtitle strong{font-size:9px;letter-spacing:.3px}
  .card-content{padding-left:13px;padding-right:13px}
  .information-grid{grid-template-columns:minmax(0,1fr);gap:13px}
  .info-block b{font-size:15px}
}
@media print{html,body{background:#fff}.page{padding:0;min-height:0;display:block}.citizen-card{width:100%;height:auto;aspect-ratio:1040/665;transform:none!important;margin:0!important;border-radius:0;box-shadow:none;border:0}.print-hint{display:none}}
`;}
