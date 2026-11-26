import test from 'node:test';
import assert from 'node:assert/strict';
import {documentShell,originalCitizenshipCard,originalProposedBill,originalSignature} from '../worker/src/original-templates.js';
import {documentAction} from '../worker/src/documents.js';
const role={identity:{id:'111111111111111111',username:'Example User'},member:{name:'Example User',position:'Government Minister'},rights:{view:true,viewMeetings:true,exportMeetings:true,viewProposals:true,draftPress:true,writeLetters:true,manageCitizenship:true,canSignDocs:true,superAdmin:true}};
const rows={
 letters:{'LTR-SAMPLE':['LTR-SAMPLE','2026-11-24','111111111111111111','Department of Example Services','Ministry','Mr Resident','Important Letter','This is a sample letter.','Issued','2026-11-24']},
 meetings:{'MTS-SAMPLE':['MTS-SAMPLE','Cabinet Discussion','2026-11-25','10:30','Example Hall','Prime Minister','Scheduled','2026-11-24','111111111111111111',JSON.stringify(['PRP-SAMPLE']),'','Discuss next steps']},
 proposals:{'PRP-SAMPLE':['PRP-SAMPLE','2026-11-24','111111111111111111','Example User','Example','National Services Bill','Legislation','High','Background','Recommendations','100','Approve','Agenda Ready','','','','']},
 actDrafts:{'PRP-SAMPLE':['PRP-SAMPLE','A Bill concerning example services','The Legislature is considering these clauses',JSON.stringify([{heading:'Definitions',text:'This is a draft clause.'}]),'This is a sample only.','On a date determined after enactment']},
 citizenshipAttempts:{'CT-SAMPLE':['CT-SAMPLE','111111111111111111','Example User','invalid','ExampleCitizen',10,10,'Approved','2026-11-24','111111111111111111','2026-11-24','ZA-SAMPLE-CARD','']},
 press:{'PRS-SAMPLE':['PRS-SAMPLE','2026-11-24','111111111111111111','Important Announcement','Summary of announcement','Main statement','Quotation','Spokesperson','Published','','','','','2026-11-24','2026-11-24']}
};
const store={async get(bucket,id){return rows[bucket]?.[id]??null;},async all(bucket){return Object.values(rows[bucket]??{});}};
const env={};
const attrs={'letterHTML':['LTR-SAMPLE'],'agendaDocument':['MTS-SAMPLE'],'proposedActDocument':['PRP-SAMPLE'],'citizenCardHTML':['CT-SAMPLE'],'pressDocument':['PRS-SAMPLE']};
test('original stationery keeps crest, flag, reference strip and roleplay disclaimer',()=>{
 const html=documentShell('Office of the Presidency','Presidential Letter','president','LTR-42','2026-11-24','Issued','<h1>Title</h1>',originalSignature({pending:true}));
 assert.match(html,/class="letterhead presidential"/);
 assert.match(html,/class="flagline"/);
 assert.match(html,/class="control"/);
 assert.match(html,/data:image\/png;base64/);
 assert.match(html,/Fictional government record/);
});
test('restored citizenship template has the original cream-card layout and distinct fictional warning',()=>{
 const html=originalCitizenshipCard({robloxUsername:'Example Citizen',robloxId:'222',cardNumber:'CT-TEST',verified:'2026-11-24'});
 assert.match(html,/class="citizen-card"/);
 assert.match(html,/class="flag-ribbon"/);
 assert.match(html,/class="honeycomb"/);
 assert.match(html,/FICTIONAL CITIZEN RECORD · NOT LEGAL ID/);
 assert.match(html,/data:image\/png;base64/);
});
test('original legislative Bill layout has distinct cover and numbered clauses',()=>{
 const html=originalProposedBill({id:'PRP-42',title:'Sample Bill',created:'2026-11-24',portfolio:'Example Portfolio',priority:'High',status:'Agenda Ready'},
 {longTitle:'A Bill about examples',preamble:'This is a sample',clauses:[{heading:'Definitions',text:'An example'}],explanatoryNote:'Explains sample',commencement:'On approval'},originalSignature({pending:true}));
 assert.match(html,/class="cover-frame"/);
 assert.match(html,/class="pages"/);
 assert.match(html,/class="clause"/);
 assert.match(html,/DRAFT/);
});
for(const [action,args] of Object.entries(attrs)){
 test(action+' returns its original document layout and HTML/PNG/PDF export toolbar',async()=>{
  const result=await documentAction(action,store,env,role,args);
  assert.equal(result.success,true);
  assert.match(result.html,/rsagp-export-png/);
  assert.match(result.html,/rsagp-export-pdf/);
  assert.match(result.html,/data-rsagp-footer/);
  if(action==='citizenCardHTML')assert.match(result.html,/class="citizen-card"/);
  else if(action==='proposedActDocument')assert.match(result.html,/class="cover-frame"/);
  else assert.match(result.html,/class="letterhead ministerial"/);
 });
}
