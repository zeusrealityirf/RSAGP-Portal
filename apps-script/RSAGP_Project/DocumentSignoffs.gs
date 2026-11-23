/** Version-bound, explicit document sign-off; invoked from the signed-in Cabinet UI.
 * Uploaded handwriting images are copied to a private immutable signing snapshot.
 * A revision of the document content invalidates the visible prior sign-off.
 */
const CABINET_SIGNABLE_TYPES_ = Object.freeze(['Agenda','Attendance','Bill','Press','Letter']);
function cabinetSignKey_(kind,id){return kind+'|'+id;}
function cabinetDocHash_(value){
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(value),Utilities.Charset.UTF_8);
  return bytes.map(n=>('0'+(n&255).toString(16)).slice(-2)).join('');
}
function cabinetDocSnapshot_(ss,kind,id){
  if(!CABINET_SIGNABLE_TYPES_.includes(kind)||!/^[A-Za-z0-9_-]{5,70}$/.test(String(id||'')))throw new Error('Unknown Cabinet document.');
  const name=kind==='Agenda'||kind==='Attendance'?'meetings':kind==='Bill'?'proposals':kind==='Press'?'press':'letters';
  const row=table_(ss,name).find(r=>String(r[0])===String(id));
  if(!row)throw new Error('The Cabinet document no longer exists.');
  if(kind==='Agenda'||kind==='Attendance'){
    if(String(row[6])==='Cancelled')throw new Error('Cancelled meetings cannot be signed.');
    const attendance=table_(ss,'meetingAttendees').filter(r=>String(r[1])===id&&String(r[8])!=='Withdrawn');
    if(kind==='Attendance'){
      if(!attendance.length)throw new Error('No attendees are recorded for this meeting.');
      if(attendance.some(r=>!String(r[12]||'')&&String(r[8])!=='Attended'))throw new Error('Record attendance for all invited participants before signing the register.');
    }
    const proposalIds=parseJSON_(row[9],[]);
    const proposals=kind==='Agenda'?table_(ss,'proposals').filter(r=>proposalIds.includes(String(r[0]))):[];
    return {source:[row,attendance,proposals],row};
  }
  if(kind==='Bill'){
    if(String(row[6])!=='Legislation')throw new Error('Only legislation proposals can be signed as draft Bills.');
    const draft=table_(ss,'actDrafts').find(r=>String(r[0])===id);
    if(!draft)throw new Error('No numbered clauses have been saved for this Bill.');
    return {source:[row,draft],row};
  }
  return {source:[row],row};
}
function cabinetCanSignDoc_(c,kind,row){
  if(!c.rights.canSignDocs)return false;
  if(kind==='Agenda')return !!c.rights.signAgendas;
  if(kind==='Attendance')return !!c.rights.signAttendance;
  if(kind==='Bill')return !!c.rights.signBills&&String(row[12])==='Agenda Ready';
  if(kind==='Press')return !!c.rights.signPress&&String(row[8])==='Published';
  if(kind==='Letter')return !!c.rights.signLetters&&String(row[2])===c.identity.id&&String(row[8])==='Issued';
  return false;
}
function cabinetStoredSignoff_(ss,kind,id){return table_(ss,'documentSignoffs').find(r=>String(r[0])===cabinetSignKey_(kind,id))||null;}
function cabinetLiveSignoff_(ss,kind,id){
  const snapshot=cabinetDocSnapshot_(ss,kind,id);
  const digest=cabinetDocHash_(snapshot.source),row=cabinetStoredSignoff_(ss,kind,id);
  return {snapshot,digest,row,valid:!!row&&String(row[3])===digest};
}
function getCabinetDocumentSignoffStatus(token,kind,id){
  const c=userContext_(token);require_(c,'view');
  if((kind==='Agenda'||kind==='Attendance')&&!c.rights.viewMeetings ||
     kind==='Bill'&&!c.rights.viewProposals ||
     kind==='Press'&&!c.rights.viewPress ||
     kind==='Letter'&&!c.rights.viewLetters)throw new Error('You do not have permission to view sign-off for this document.');
  const ss=db_(),data=cabinetLiveSignoff_(ss,kind,String(id));
  const mine=signatureRow_(ss,c.identity.id);
  return {type:kind,documentId:id,signed:data.valid,needsResign:!!data.row&&!data.valid,
    signatory:data.valid?{username:String(data.row[5]),position:String(data.row[6]),signedAt:timestamp_(data.row[7])}:null,
    canSign:cabinetCanSignDoc_(c,kind,data.snapshot.row),hasSignature:!!(mine&&mine[1])};
}
function signCabinetDocument(token,kind,id){
  const c=userContext_(token);require_(c,'view');
  if(!CABINET_SIGNABLE_TYPES_.includes(kind))throw new Error('Unknown document type.');
  const docId=required_(id,'Document ID',70);
  // Mutations use a fresh role check, and the hash is calculated under a lock.
  return withLock_(()=>{
    const ss=db_(),found=cabinetLiveSignoff_(ss,kind,docId);
    if(!cabinetCanSignDoc_(c,kind,found.snapshot.row))throw new Error('You are not authorised to sign this document at its current workflow stage.');
    const uploaded=signatureRow_(ss,c.identity.id);
    if(!uploaded||!uploaded[1])throw new Error('Upload a PNG/JPG signature under Documents & signatures first.');
    const src=DriveApp.getFileById(String(uploaded[1]));
    const blob=src.getBlob(),mime=String(uploaded[2]);
    if(!['image/png','image/jpeg'].includes(mime)||blob.getBytes().length>900000)throw new Error('Your uploaded signature is not valid. Please upload it again.');
    // The signatory's current image may later be replaced. Preserve the exact
    // signed snapshot in the owner's private Drive, never in a public URL.
    const folderId=properties_().getProperty('GOV_SIGNATURE_FOLDER_ID');
    const folder=folderId?DriveApp.getFolderById(folderId):null;
    if(!folder)throw new Error('Signature storage is not configured. Upload your signature again.');
    const saved=src.makeCopy('RSAGP_Signed_'+kind+'_'+docId+'_'+Date.now(),folder);
    saved.setDescription('Private signature snapshot for a version-bound Cabinet document.');
    const key=cabinetSignKey_(kind,docId),old=found.row;
    const row=[key,kind,docId,found.digest,c.identity.id,cell_(c.member?.name||c.identity.username),cell_(c.member?.position||'Authorised Cabinet Signatory'),new Date(),saved.getId(),mime];
    saveRow_(ss,'documentSignoffs',key,row);
    record_(ss,c.identity,'SIGN_DOCUMENT','Cabinet Document',key,'Version '+found.digest.slice(0,12));
    // Older private snapshot may be retired after successful replacement.
    if(old&&old[8]){try{DriveApp.getFileById(String(old[8])).setTrashed(true);}catch(e){}}
    return {success:true,message:'Signed document saved. Download its HTML again to include the signature.',type:kind,id:docId};
  });
}
function cabinetSignedImage_(fileId,mime){
  try{
    if(!['image/png','image/jpeg'].includes(mime))return '';
    const bytes=DriveApp.getFileById(String(fileId)).getBlob().getBytes();
    if(bytes.length<100||bytes.length>900000)return '';
    return 'data:'+mime+';base64,'+Utilities.base64Encode(bytes);
  }catch(e){return '';}
}
function cabinetDocSignBlock_(ss,kind,id){
  const state=cabinetLiveSignoff_(ss,kind,id);
  if(!state.valid)return '<section class="signature-zone"><div class="sign-line"></div><b>Authorised signatory</b><span>Signature pending'+(state.row?' — document revised':'')+'</span></section>';
  const r=state.row,image=cabinetSignedImage_(r[8],String(r[9]));
  if(!image)return '<section class="signature-zone"><b>Signature image unavailable</b><span>Contact Cabinet Secretariat to restore the signed record.</span></section>';
  const name=docEsc_(r[5]),title=docEsc_(r[6]),date=docEsc_(timestamp_(r[7]).replace('T',' ').slice(0,16)+' UTC');
  return '<section class="signature-zone"><div class="sign-line"><img src="'+image+'" alt="Uploaded signatory handwriting"></div><b>'+name+'</b><span>'+title+'</span><small>Recorded sign-off: '+date+' · Version '+docEsc_(String(r[3]).slice(0,12))+'</small></section>';
}
