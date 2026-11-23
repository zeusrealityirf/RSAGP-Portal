/**
 * Cabinet legislative drafting module. Uses the Gazette's typographic hierarchy
 * as a design reference, but NEVER represents a Cabinet proposal as enacted law.
 * All drafts have a prominent Proposed Bill / Cabinet Draft identifier.
 */
const ACT_DRAFT_HEADERS_ = Object.freeze([
  'Proposal ID','Long Title / Purpose','Preamble','Clauses JSON',
  'Explanatory Note','Commencement','Updated At','Updated By'
]);
function cleanActText_(value,label,max){
  const text=String(value===undefined||value===null?'':value).trim();
  if(text.length>max)throw new Error(label+' must be '+max+' characters or fewer.');
  return text;
}
function validatedActDraft_(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Complete the proposed Act details.');
  const purpose=required_(payload.longTitle,'Long title / purpose',1800);
  const preamble=cleanActText_(payload.preamble,'Preamble',2800);
  const explanatoryNote=cleanActText_(payload.explanatoryNote,'Explanatory note',3500);
  const commencement=cleanActText_(payload.commencement,'Commencement',500)||'On a date determined after enactment';
  const clauses=payload.clauses;
  if(!Array.isArray(clauses)||clauses.length<1||clauses.length>30)
    throw new Error('A proposed Act needs between 1 and 30 numbered clauses.');
  const cleaned=clauses.map((c,i)=>{
    if(!c||typeof c!=='object')throw new Error('Clause '+(i+1)+' is invalid.');
    return {heading:required_(c.heading,'Clause '+(i+1)+' heading',180),
      text:required_(c.text,'Clause '+(i+1)+' text',3500)};
  });
  const serialized=JSON.stringify(cleaned);
  if(serialized.length>45000)throw new Error('Draft clauses are too long for a spreadsheet cell.');
  return {longTitle:purpose,preamble,explanatoryNote,commencement,clauses:cleaned};
}
function saveActDraft_(ss,proposalId,draft,identity){
  const sh=ss.getSheetByName('actDrafts');
  if(!sh)throw new Error('The Act drafts database is missing. Run setupPortal once from the Apps Script editor.');
  const id=String(proposalId);
  const row=[id,cell_(draft.longTitle),cell_(draft.preamble),JSON.stringify(draft.clauses),
    cell_(draft.explanatoryNote),cell_(draft.commencement),new Date(),identity.id];
  saveRow_(ss,'actDrafts',id,row);
}
function actDraftDTO_(r){
  const clauses=parseJSON_(r[3],[]);
  return {proposalId:String(r[0]),longTitle:String(r[1]||''),preamble:String(r[2]||''),
    clauses:Array.isArray(clauses)?clauses:[],explanatoryNote:String(r[4]||''),
    commencement:String(r[5]||''),updated:timestamp_(r[6])};
}
function getActDraft(token,proposalId){
  const c=userContext_(token,true);require_(c,'viewProposals');
  const ss=db_(),p=table_(ss,'proposals').find(r=>String(r[0])===String(proposalId));
  if(!p||String(p[6])!=='Legislation')throw new Error('Legislative proposal not found.');
  const r=table_(ss,'actDrafts').find(row=>String(row[0])===String(proposalId));
  if(!r)return {proposalId:String(proposalId),longTitle:'',preamble:'',clauses:[],explanatoryNote:'',commencement:''};
  return actDraftDTO_(r);
}
function actDraftCSS_(){return `
@page{size:A4;margin:18mm 17mm 21mm}
*{box-sizing:border-box}
html{background:#d8dcdb}body{margin:0;color:#171717;font-family:Georgia,'Times New Roman',serif}
main{width:210mm;min-height:297mm;margin:25px auto;background:white;box-shadow:0 8px 45px #1c26292e}
.cover{padding:15mm 16mm;min-height:297mm;display:flex;flex-direction:column;page-break-after:always}
.cover-frame{border:1px solid #333;min-height:255mm;padding:22mm 12mm 10mm;display:flex;flex-direction:column;align-items:center}
.crest{width:100px;height:118px;object-fit:contain}.top-country{text-align:center;letter-spacing:2px;font:700 12px Arial,sans-serif;margin:18px 0 10px}
.cover-rule{border:0;border-top:3px double #222;width:85%;margin:12mm auto 18mm}.cover h1{font-size:40px;letter-spacing:5px;text-align:center;margin:0 0 10mm}
.cover h2{font-size:24px;text-align:center;max-width:135mm;line-height:1.4;margin:2mm auto 9mm}
.caption{text-align:center;letter-spacing:2px;text-transform:uppercase;font:700 11px Arial,sans-serif}
.proposal-state{margin:12px auto;border:2px solid #1b1b1b;padding:9px 22px;font:700 12px Arial,sans-serif;letter-spacing:1.7px;text-transform:uppercase}
.docket{margin-top:auto;width:100%;border-top:2px solid #222;padding-top:10mm;display:grid;grid-template-columns:1fr 1fr;gap:8mm;font:12px Arial,sans-serif}
.docket b{display:block;font-size:10px;letter-spacing:1.3px;color:#444;margin-bottom:4px;text-transform:uppercase}
.docket .wide{grid-column:1/-1}.cover-note{font:11px Arial,sans-serif;text-align:center;line-height:1.55;color:#555;margin:11mm auto 0;max-width:140mm}
.pages{padding:17mm 20mm 26mm;min-height:297mm}
.running{display:flex;justify-content:space-between;gap:15mm;font:10px Arial,sans-serif;border-bottom:2px solid #222;padding-bottom:7px;margin-bottom:16mm;text-transform:uppercase;letter-spacing:.25px}
.explanatory{max-width:152mm;margin:0 auto 12mm;line-height:1.55}.explanatory h3{text-align:center;font-size:13px;letter-spacing:1px;margin:0 0 8mm}
.explanatory p{margin:0 0 5mm;white-space:pre-wrap}.fine-rule{width:54mm;border-top:1px solid #333;margin:0 auto 13mm}
.bill-label{text-align:center;font-size:29px;letter-spacing:4px;font-weight:bold;margin:0 0 8mm}
.long-title{text-align:justify;font-weight:bold;line-height:1.5;margin:0 auto 12mm;max-width:156mm}
.preamble{font-style:italic;text-align:justify;white-space:pre-wrap;line-height:1.55;margin-bottom:9mm}
.enactment{font-weight:600;line-height:1.5;margin:10mm 0 8mm;font-size:14px}
.clause{display:grid;grid-template-columns:11mm 1fr;gap:3mm;margin:0 0 10mm;page-break-inside:avoid;break-inside:avoid;font-size:13px;line-height:1.6}
.clause .number{text-align:right;font-weight:700}.clause h4{font-size:13px;margin:0 0 3mm}.clause p{margin:0;text-align:justify;white-space:pre-wrap}
.commencement{margin-top:12mm;padding-top:6mm;border-top:1px solid #777;font-size:13px;line-height:1.6;page-break-inside:avoid}
.bill-cover-footer{margin-top:12mm;text-align:center;border-top:1px solid #d0d0d0;padding-top:6mm;font:10px/1.5 Arial,sans-serif;letter-spacing:.5px;color:#586359}.bill-cover-footer strong{color:#254f36}.bill-cover-footer span{display:block;color:#777;font-size:9px;margin-top:3px}
.bottom-note{border-top:1px solid #bbb;margin-top:18mm;padding-top:5mm;color:#666;font:10px Arial,sans-serif;text-transform:uppercase;letter-spacing:.75px;text-align:center}
.bottom-note strong{color:#264f35;font-weight:700}
.signature-zone{margin:15mm 0 8mm;break-inside:avoid;max-width:95mm;font-family:Arial,sans-serif}.signature-zone .sign-line{height:23mm;display:flex;align-items:flex-end;border-bottom:1px solid #444}.signature-zone img{max-height:21mm;max-width:90mm;object-fit:contain}.signature-zone b{display:block;font-size:11px;margin-top:3mm}.signature-zone span{display:block;font-size:10px;color:#555}.signature-zone small{font-size:9px;color:#777}
@media print{html{background:white}main{margin:0;box-shadow:none;width:auto;min-height:0}.cover{min-height:260mm;padding:0}.cover-frame{min-height:250mm}.pages{padding:0;min-height:0}.running{margin-bottom:12mm}}
@media screen and (max-width:820px){main{width:100%;min-height:auto;margin:0}.cover,.pages{padding:8vw 6vw;min-height:auto}.cover-frame{min-height:75vh;padding:50px 20px}.cover h1{font-size:28px}.cover h2{font-size:19px}.docket{gap:18px}.pages{padding-bottom:50px}}
`;}
function proposedActDocument(token,proposalId){
  const c=userContext_(token,true);require_(c,'viewProposals');
  const ss=db_(),r=table_(ss,'proposals').find(row=>String(row[0])===String(proposalId));
  if(!r||String(r[6])!=='Legislation')throw new Error('Only legislative proposals can be exported as draft Acts.');
  const draftRow=table_(ss,'actDrafts').find(row=>String(row[0])===String(proposalId));
  if(!draftRow)throw new Error('This legacy legislative proposal has no Act clauses yet. Ask the author to edit and save the Act details.');
  const a=actDraftDTO_(draftRow),p=proposalDTO_(r);
  if(!a.clauses.length)throw new Error('Proposed Act contains no clauses.');
  const safe=docEsc_,coverDate=String(p.created).slice(0,10)||new Date().toISOString().slice(0,10);
  const clauses=a.clauses.map((cl,i)=>'<section class="clause"><div class="number">'+(i+1)+'.</div><div><h4>'+safe(cl.heading)+'</h4><p>'+safe(cl.text)+'</p></div></section>').join('');
  const label='PROPOSED BILL — CABINET DRAFT';
  const page1='<section class="cover"><div class="cover-frame"><img class="crest" src="'+SA_COAT_SRC_+'" alt="South African coat of arms"><div class="top-country">REPUBLIC OF SOUTH AFRICA</div><div class="caption">Roblox Nation · Cabinet legislative proposals register</div><hr class="cover-rule"><h1>BILL</h1><h2>'+safe(p.title)+'</h2><div class="proposal-state">'+label+'</div><p class="cover-note">Prepared for Cabinet consideration. This document is a draft proposal and does not constitute an Act of Parliament.</p><div class="docket"><div><b>Cabinet reference</b>'+safe(p.id)+'</div><div><b>Submitted</b>'+safe(coverDate)+'</div><div><b>Originating portfolio</b>'+safe(p.portfolio)+'</div><div><b>Priority</b>'+safe(p.priority)+'</div><div class="wide"><b>Review status</b>'+safe(p.status)+'</div></div><div class="bill-cover-footer"><strong>'+safe(RSAGP_DOCUMENT_BRAND_)+'</strong> · Roblox Nation <span>Fictional Cabinet legislative draft</span></div></div></section>';
  const page2='<section class="pages"><div class="running"><span>RSAGP · Roblox Nation · Cabinet legislative drafting</span><span>'+safe(p.id)+' · '+label+'</span></div>'+
    '<div class="explanatory"><h3>GENERAL EXPLANATORY NOTE</h3><p>'+safe(a.explanatoryNote||'This draft sets out a proposed legislative measure for Cabinet consideration.')+'</p></div><div class="fine-rule"></div>'+
    '<h2 class="bill-label">BILL</h2><div class="long-title">'+safe(a.longTitle)+'</div>'+
    (a.preamble?'<div class="preamble">'+safe(a.preamble)+'</div>':'')+
    '<div class="enactment">It is proposed that the following provisions be considered for enactment, subject to the applicable legislative process:—</div>'+
    clauses+'<div class="commencement"><strong>Commencement.</strong> '+safe(a.commencement)+'</div>'+
    '<h3 style="font:700 11px Arial,sans-serif;margin-top:15mm">Cabinet draft reviewed by</h3>'+cabinetDocSignBlock_(ss,'Bill',p.id)+
    '<div class="bottom-note" data-rsagp-footer="1"><strong>'+safe(RSAGP_DOCUMENT_BRAND_)+'</strong> · Roblox Nation · Draft legislative proposal · Not enacted · '+safe(p.id)+'</div></section>';
  const html='<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safe(p.title)+' — Proposed Bill</title><style>'+actDraftCSS_()+'</style></head><body><main>'+page1+page2+'</main></body></html>';
  return htmlResult_('Proposed_Bill_'+p.id+'.html',html);
}
