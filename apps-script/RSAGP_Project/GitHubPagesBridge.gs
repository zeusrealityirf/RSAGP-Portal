/**
 * HTTP API adapter for the unchanged RSAGP backend, used only via the Cloudflare
 * Worker. The Worker solves browser CORS; Apps Script retains all data, audit,
 * session, Discord verification and server-side permission checks.
 *
 * SECURITY: Explicit allowlist. Never replace with generic evaluation of names,
 * expose setup/migration functions, or trust the front end to enforce roles.
 */
const RSAGP_PAGES_ACTIONS_ = Object.freeze([
  'beginLogin','signOut','currentUser','pageData',
  'getRobloxAvatarMap','setMyRobloxAvatar',
  'saveCareerPosition','setCareerPositionOpen','reviewJobApplication',
  'saveAccessRole','saveAccessUser','saveAppointment','saveCabinetMember',
  'submitProposal','reviewProposal','createMeeting','editMeeting',
  'updateMeetingAgenda','setMeetingAttendees','addMeetingGuest',
  'recordMeetingAttendance','recordMeetingDecision','savePressRelease',
  'reviewPressRelease','publishPressRelease','createAction','updateActionStatus',
  'getActDraft','proposedActDocument','getMySignatureInfo','saveMySignature',
  'removeMySignature','getCabinetDocumentSignoffStatus','signCabinetDocument',
  'letterHTML','citizenCardHTML','agendaDocument','meetingAttendanceDocument',
  'pressDocument','issueGovLetter','closeMeeting','updateMeetingAttendeeStatus',
  'saveGovLetter','reviewCitizenshipApplication',
  'getCareerPositions','careersHome','submitJobApplication',
  'withdrawJobApplication','citizenContext','checkRobloxUsername','takeCitizenshipTest'
]);
function doPost(e) {
  let result;
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Request body missing.');
    if (e.postData.contents.length > 1800000) throw new Error('Request too large.');
    const input = JSON.parse(e.postData.contents);
    const name = String(input.action || '');
    if (!RSAGP_PAGES_ACTIONS_.includes(name)) throw new Error('This API operation is not available.');
    if (!Array.isArray(input.args) || input.args.length > 8) throw new Error('Invalid API arguments.');
    const method = globalThis[name];
    if (typeof method !== 'function') throw new Error('API method is not installed: ' + name);
    result = {ok:true, result:method(...input.args)};
  } catch (error) {
    // Error messages are safe to show, but never echo request bodies or tokens.
    result = {ok:false, error:String(error && error.message || error).slice(0,300)};
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
