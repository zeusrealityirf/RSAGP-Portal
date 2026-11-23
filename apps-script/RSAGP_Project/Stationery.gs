/** Print-ready stationery for the RSAGP Roblox Nation government portal. */
function docEsc_(v){return String(v===null||v===undefined?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function docPara_(v,cls){return '<p'+(cls?' class="'+docEsc_(cls)+'"':'')+'>'+docEsc_(v).replace(/\n/g,'<br>')+'</p>';}
function docMultiline_(v){return String(v||'').split(/\n\s*\n/).filter(Boolean).map(x=>docPara_(x)).join('');}
const RSAGP_DOCUMENT_BRAND_ = "Lem's South Africa";
// Defensive fallback: ALL standalone HTML exports receive a brand footer, even
// if a future document type forgets to include its own styled footer.
function rsagpEnsureDocumentFooter_(html){
  let output=String(html||'');
  if(/data-rsagp-footer\s*=/.test(output))return output;
  const footer='<div data-rsagp-footer="1" style="padding:14px 18px;text-align:center;'+
    'border-top:2px solid #b79b43;margin:24px auto 0;max-width:180mm;'+
    'font:600 11px/1.5 Arial,sans-serif;color:#214b38;page-break-inside:avoid">'+
    "Lem's South Africa · Roblox Nation"+
    '<div style="font-size:9px;color:#748676;letter-spacing:.4px">Fictional civic administration</div></div>';
  return /<\/body>/i.test(output)?output.replace(/<\/body>/i,footer+'</body>'):output+footer;
}
function htmlResult_(filename,html){
  const safeName=String(filename||'RSAGP_Document.html').replace(/[^\w.\-]/g,'_');
  const branded=rsagpEnsureDocumentFooter_(html);
  const converted=rsagpAddBrowserExportTools_(branded,safeName);
  return {success:true,filename:safeName,
    html:converted,kind:'html',
    message:'This document is built as HTML. Open it to save a PNG or use Print → Save as PDF.'};
}
function docSignatureBlock_(identity,member,useImage,image){
  const title=member?member.position:'Government official';const name=member?member.name:identity.username;
  return '<section class="signature-zone"><div class="sign-line">'+(useImage&&image?'<img src="'+image+'" alt="Verified signature uploaded by the signed-in member">':'')+'</div><b>'+docEsc_(name)+'</b><span>'+docEsc_(title)+'</span><small>Signed / prepared by authenticated member: '+docEsc_(identity.username)+'</small></section>';
}
function docShell_(office,label,kind,reference,date,status,content,signature){
 const presidential=kind==='president';const seal=presidential?GOV_SEAL_SRC_:SA_COAT_SRC_;
 const brand=presidential?'OFFICE OF THE PRESIDENT':String(office||'Government Department').toUpperCase();
 return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+docEsc_(label)+' | '+docEsc_(reference)+'</title><style>'+govDocCSS_()+'</style></head><body>'+
   '<div class="flagline"><i></i><i></i><i></i><i></i><i></i></div><main class="sheet">'+
   '<header class="letterhead '+(presidential?'presidential':'ministerial')+'"><img src="'+seal+'" alt="'+(presidential?'Supplied presidential seal':'South African coat of arms detail')+'"><div class="masthead"><div class="country-row"><div class="country">REPUBLIC OF SOUTH AFRICA <span>· ROBLOX NATION</span></div></div><div class="office">'+docEsc_(brand)+'</div><div class="dept">'+(presidential?'The Presidency':docEsc_(office))+'</div></div></header>'+
   '<div class="rule"><span></span><span></span><span></span></div>'+
   '<div class="control"><div><small>DOCUMENT REFERENCE</small><b>'+docEsc_(reference)+'</b></div><div><small>ISSUED / PREPARED</small><b>'+docEsc_(date)+'</b></div><div><small>DOCUMENT STATUS</small><b>'+docEsc_(status)+'</b></div></div>'+
   '<article class="doc-content">'+content+'</article>'+signature+
   '<footer data-rsagp-footer="1"><div class="footer-flag">●</div><div><strong>'+docEsc_(RSAGP_DOCUMENT_BRAND_)+'</strong> · REPUBLIC OF SOUTH AFRICA · ROBLOX NATION</div><small>Fictional government record · Roblox Nation</small></footer></main></body></html>';
}
function govDocCSS_(){return `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e7ece7;color:#183024;font:13px/1.68 "Georgia","Times New Roman",serif}
body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.flagline{height:8px;display:grid;grid-template-columns:2fr 1fr 2fr 1fr 2fr;background:#fff}
.flagline i:nth-child(1){background:#de3831}.flagline i:nth-child(2){background:#ffb81c}.flagline i:nth-child(3){background:#007a4d}.flagline i:nth-child(4){background:#fff}.flagline i:nth-child(5){background:#002395}
.sheet{width:210mm;min-height:297mm;margin:22px auto;background:#fff;box-shadow:0 30px 80px rgba(8,36,27,.22);position:relative;padding:20mm 23mm 18mm;display:flex;flex-direction:column;overflow:hidden}
/* vertical flag spine */
.sheet:before{content:'';position:absolute;top:0;left:0;height:100%;width:7px;background:linear-gradient(#de3831 0 28%,#ffb81c 28% 34%,#007a4d 34% 68%,#fff 68% 74%,#002395 74% 100%)}
/* very faint flag-pall watermark, clearly decorative */
.sheet:after{content:'';position:absolute;right:-70mm;top:50%;transform:translateY(-50%);width:150mm;height:150mm;pointer-events:none;opacity:.05;
  background:
    linear-gradient(135deg,#007a4d 0 44%,transparent 44%),
    linear-gradient(45deg,#002395 0 50%,#de3831 50%);
  -webkit-mask:radial-gradient(circle at 50% 50%,#000 60%,transparent 72%);mask:radial-gradient(circle at 50% 50%,#000 60%,transparent 72%)}
.sheet>*{position:relative;z-index:1}

/* letterhead */
.letterhead{display:flex;align-items:center;justify-content:center;gap:26px;margin:14px 0 18px;text-align:left}
.letterhead>img{width:86px;height:100px;object-fit:contain}
.letterhead.ministerial>img{width:116px;height:146px;object-fit:contain;object-position:center;flex:none}
.letterhead.presidential{flex-direction:column;gap:4px;text-align:center;margin:10px 0 14px}
.letterhead.presidential>img{width:268px;height:160px;object-fit:contain}
.letterhead .masthead{min-width:0}
.letterhead .country-row{display:flex;align-items:center;gap:12px}
.letterhead .country{font:700 10.5px/1.4 "Arial",sans-serif;letter-spacing:2.4px;color:#4f6158;text-transform:uppercase}
.letterhead .country span{color:#a98f3e;font-size:9px;letter-spacing:1.8px}
.letterhead .office{font:700 23px/1.1 "Georgia",serif;letter-spacing:-.2px;color:#063d2d;text-transform:uppercase;margin:5px 0 2px}
.letterhead .dept{font-size:12px;color:#5f7268;font-family:"Arial",sans-serif;letter-spacing:.3px}
.letterhead.presidential .office{font-size:22px;letter-spacing:.5px}
.letterhead.ministerial .masthead{max-width:380px}

/* flag rule under the letterhead (markup supplies 3 empty spans; the bar itself is the gradient) */
.rule{height:4px;margin-bottom:22px;border-radius:2px;overflow:hidden;background:linear-gradient(90deg,#de3831 0 26%,#ffb81c 26% 38%,#007a4d 38% 72%,#fff 72% 80%,#002395 80%)}
.rule span{display:none}

/* reference / date / status strip */
.control{display:grid;grid-template-columns:1.3fr 1fr 1.1fr;gap:14px;padding:14px 16px;background:#f6f9f4;border:1px solid #e0e8de;border-radius:7px}
.control small{font:700 8.5px/1 "Arial",sans-serif;letter-spacing:1.6px;color:#7c8c83;display:block;margin-bottom:6px;text-transform:uppercase}
.control b{font:600 11.5px "Arial",sans-serif;overflow-wrap:anywhere;color:#123f2f;letter-spacing:.2px}

/* body copy */
.doc-content{flex:1;padding-top:30px}
.doc-content h1{font:500 34px/1.14 "Georgia",serif;letter-spacing:-.5px;color:#123f2f;margin:0 0 18px}
.doc-content h2{font:600 20px "Georgia",serif;color:#17432f;border-left:4px solid #ffb81c;padding-left:11px;margin:30px 0 14px}
.doc-content p{margin:13px 0;white-space:normal}
.doc-content p.lead{font-size:15px;color:#3f6453;font-weight:600;line-height:1.6}
.doc-content blockquote{border-left:4px solid #007a4d;margin:24px 0;padding:14px 22px;background:#f6f9f4;color:#1f5139;font:italic 18px/1.6 "Georgia",serif}
.doc-content .addressee{color:#4f6b5c;font-size:14px;padding:0 0 22px;font-family:"Arial",sans-serif}
.release-heading{font:700 9.5px/1 "Arial",sans-serif;letter-spacing:2.6px;color:#b03a30;margin-bottom:14px;text-transform:uppercase}
.meeting-facts{background:#f6f9f4;border:1px solid #e0e8de;border-radius:7px;padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:13px}
.meeting-facts div{display:flex;flex-direction:column}
.meeting-facts b{font:700 9px "Arial",sans-serif;letter-spacing:1px;text-transform:uppercase;color:#6f8e7a;margin-bottom:3px}
.meeting-facts span{font-weight:700;font-family:"Arial",sans-serif;color:#17402e}
.note{font-style:italic;color:#637568}
.agenda-item{border-bottom:1px solid #e1e8df;display:grid;grid-template-columns:42px 1fr;gap:13px;padding:16px 0;break-inside:avoid}
.agenda-no{font:600 21px "Georgia",serif;color:#c29a2f}
.agenda-item h3{font:600 17px "Georgia",serif;margin:0;color:#234b38}
.agenda-item small{font-size:10px;color:#71857a;font-family:"Arial",sans-serif}
.agenda-item p{margin:6px 0;font-size:12.5px}
.ends{text-align:center;color:#5f7e71;font-size:12px;letter-spacing:3px;padding:26px;font-family:"Arial",sans-serif}

/* signatory */
.signature-zone{padding-top:34px;break-inside:avoid;width:290px;margin:30px 0 22px}
.signature-zone .sign-line{border-bottom:1.5px solid #0f4733;height:66px;display:flex;align-items:flex-end}
.signature-zone img{max-height:80px;max-width:258px;object-fit:contain;mix-blend-mode:multiply}
.signature-zone b{display:block;margin-top:10px;font-size:13px;font-family:"Georgia",serif;color:#123f2f}
.signature-zone span{display:block;color:#4f6b5c;font-family:"Arial",sans-serif;font-size:12px}
.signature-zone small{display:block;font-size:9.5px;color:#86968b;font-family:"Arial",sans-serif;margin-top:4px}

/* signature-era branded footer, consistent across stationery */
footer{margin-top:auto;border-top:1px solid #dde7dc;padding-top:14px;color:#5f7e6b;text-align:center;font:600 10px/1.5 "Arial",sans-serif;letter-spacing:.8px}
footer small{display:block;color:#93a398;margin-top:5px;letter-spacing:.2px;font-weight:400}footer strong{font-size:11px;color:#0b4a35;letter-spacing:1px}
.footer-flag{height:9px;color:#c29a2f;line-height:7px;font-size:12px}

@media screen and (max-width:850px){.sheet{width:auto;margin:0;min-height:100vh;padding:24px 22px 34px}.control{grid-template-columns:1fr 1fr}.letterhead .office{font-size:18px}.letterhead.ministerial>img{width:92px;height:116px}}
@media print{html,body{background:#fff}.flagline{display:none}.sheet{margin:0;box-shadow:none;page-break-after:auto;min-height:280mm;padding-top:16mm;padding-bottom:12mm}}
`;}
function signatureRow_(ss,id){return table_(ss,'signatures').find(r=>String(r[0])===id)||null;}
function getSignatureData_(id){
 const r=signatureRow_(db_(),id);if(!r||!r[1])return '';
 try{
  const blob=DriveApp.getFileById(String(r[1])).getBlob(),bytes=blob.getBytes();
  if(bytes.length>900000)return '';
  const mime=String(r[2]);if(!['image/png','image/jpeg'].includes(mime))return '';
  return 'data:'+mime+';base64,'+Utilities.base64Encode(bytes);
 }catch(e){return '';} // File may have been removed by owner; do not expose Drive errors.
}
function getMySignatureInfo(token){
 const c=userContext_(token);require_(c,'canSignDocs');
 const r=signatureRow_(db_(),c.identity.id);
 return {hasSignature:!!(r&&r[1]),updated:r?timestamp_(r[3]):'',preview:r&&r[1]?getSignatureData_(c.identity.id):''};
}
function saveMySignature(token,payload){
 const c=userContext_(token);require_(c,'canSignDocs');
 const mime=String(payload&&payload.mime||''),encoded=String(payload&&payload.base64||'');
 if(!['image/jpeg','image/png'].includes(mime)||!encoded||encoded.length>1250000||!/^[A-Za-z0-9+/=]+$/.test(encoded))throw new Error('Upload a PNG or JPG image smaller than 800 KB.');
 const bytes=Utilities.base64Decode(encoded);
 if(bytes.length<100||bytes.length>800000)throw new Error('Signature image must be between 100 bytes and 800 KB.');
 const isPng=bytes.length>8&&bytes.slice(0,8).map(b=>b&255).join(',')==='137,80,78,71,13,10,26,10';
 const isJpg=(bytes[0]&255)===255&&(bytes[1]&255)===216&&(bytes[2]&255)===255;
 if(mime==='image/png'&&!isPng||mime==='image/jpeg'&&!isJpg)throw new Error('The signature file type does not match its contents.');
 return withLock_(()=>{
  const ss=db_(),old=signatureRow_(ss,c.identity.id);let folderId=properties_().getProperty('GOV_SIGNATURE_FOLDER_ID');
  let folder;
  try{folder=folderId?DriveApp.getFolderById(folderId):null;}catch(e){folder=null;}
  if(!folder){folder=DriveApp.createFolder('RSAGP Government | Private Signatures');properties_().setProperty('GOV_SIGNATURE_FOLDER_ID',folder.getId());}
  const blob=Utilities.newBlob(bytes,mime,'Signature_'+c.identity.id+(isPng?'.png':'.jpg'));
  const file=folder.createFile(blob);file.setDescription('Private ministerial signature upload. Not publicly shared.');
  saveRow_(ss,'signatures',c.identity.id,[c.identity.id,file.getId(),mime,new Date()]);
  record_(ss,c.identity,'UPLOAD_SIGNATURE','Signature',c.identity.id,mime+' / '+bytes.length+' bytes');
  if(old&&old[1]){try{DriveApp.getFileById(String(old[1])).setTrashed(true);}catch(e){}}
  return {success:true,message:'Signature saved privately. It will appear on HTML documents you generate as the signatory.'};
 });
}
function removeMySignature(token){
 const c=userContext_(token);require_(c,'canSignDocs');
 return withLock_(()=>{const ss=db_(),old=signatureRow_(ss,c.identity.id);if(old&&old[1]){
  saveRow_(ss,'signatures',c.identity.id,[c.identity.id,'','',new Date()]);
  try{DriveApp.getFileById(String(old[1])).setTrashed(true);}catch(e){}
  record_(ss,c.identity,'REMOVE_SIGNATURE','Signature',c.identity.id,'');
 }return {success:true,message:'Your current signature has been removed.'};});
}
function letterDTO_(r){return {id:String(r[0]),created:timestamp_(r[1]),authorId:String(r[2]),ministry:String(r[3]),kind:String(r[4]),recipient:String(r[5]),subject:String(r[6]),body:String(r[7]),status:String(r[8]),updated:timestamp_(r[9])};}
function saveGovLetter(token,payload){
 const c=userContext_(token);require_(c,'writeLetters');
 const kind=String(payload.kind||'Ministry');
 if(!['Presidential','Ministry'].includes(kind))throw new Error('Select a valid type of letter.');
 if(kind==='Presidential'&&!c.rights.superAdmin)throw new Error('Only the President may issue presidential letters.');
 const to=required_(payload.recipient,'Recipient',130),subject=required_(payload.subject,'Subject',170),body=required_(payload.body,'Letter body',6000);
 return withLock_(()=>{
  const ss=db_(),rows=table_(ss,'letters'),old=payload.id?rows.find(x=>String(x[0])===String(payload.id)):null;
  if(payload.id&&!old)throw new Error('Letter not found.');
  if(old&&String(old[2])!==c.identity.id)throw new Error('Only the author can revise their letter.');
  if(old&&String(old[8])==='Issued')throw new Error('Issued letters cannot be modified. Create a new letter.');
  const id=old?String(old[0]):'LTR-'+id_();const status='Draft';
  const ministry=kind==='Presidential'?'Office of the Presidency':c.member.portfolio;
  saveRow_(ss,'letters',id,[id,old?old[1]:new Date(),c.identity.id,cell_(ministry),kind,cell_(to),cell_(subject),cell_(body),status,new Date()]);
  record_(ss,c.identity,'SAVE_LETTER','Letter',id,subject);
  return {success:true,id,message:'Letter saved as a draft.'};
 });
}
function issueGovLetter(token,id){
 const c=userContext_(token);require_(c,'writeLetters');
 return withLock_(()=>{const ss=db_(),rows=table_(ss,'letters'),row=rows.find(x=>String(x[0])===id);
  if(!row)throw new Error('Letter not found.');if(String(row[2])!==c.identity.id)throw new Error('Only the author may issue their letter.');
  if(String(row[4])==='Presidential'&&!c.rights.superAdmin)throw new Error('Only the President may issue presidential letters.');
  if(String(row[8])!=='Draft')throw new Error('Letter has already been issued.');
  row[8]='Issued';row[9]=new Date();saveRow_(ss,'letters',id,row);record_(ss,c.identity,'ISSUE_LETTER','Letter',id,'');
  return {success:true,message:'Letter issued. Generate a signed HTML copy.'};
 });
}
function letterHTML(token,id){
 const c=userContext_(token);require_(c,'writeLetters');const x=table_(db_(),'letters').map(letterDTO_).find(x=>x.id===id);
 if(!x)throw new Error('Letter not found.');if(x.authorId!==c.identity.id)throw new Error('Only the letter author can export a signed copy.');
 const president=x.kind==='Presidential';if(president&&!c.rights.superAdmin)throw new Error('Only the President can export presidential letters.');
 const issued=x.status==='Issued';
 const content='<div class="release-heading">'+(issued?'ISSUED CABINET CORRESPONDENCE':'WORKING DRAFT — NOT ISSUED')+'</div><h1>'+docEsc_(x.subject)+'</h1><div class="addressee">To: <b>'+docEsc_(x.recipient)+'</b></div>'+docMultiline_(x.body)+'<p style="margin-top:36px">Yours sincerely,</p>';
 const stamp=issued?'Issued letter':'Working draft — not issued';
 return htmlResult_(x.id+'_'+(president?'Presidential':'Ministry')+'_Letter.html',docShell_(x.ministry,president?'Presidential Letter':'Ministry Letter',president?'president':'ministry',x.id,x.updated.slice(0,10),stamp,content,issued?cabinetDocSignBlock_(db_(),'Letter',x.id):'<p class="note">Working draft — signature pending issuance.</p>'));
}
