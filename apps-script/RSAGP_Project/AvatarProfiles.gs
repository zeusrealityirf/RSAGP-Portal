/** Roblox avatars are DISPLAY-ONLY and do not replace verified Discord identity.
 * This link does not prove ownership of the Roblox account.
 */
function setMyRobloxAvatar(token,username){
  const c=userContext_(token);require_(c,'view');
  const ss=db_(),members=table_(ss,'members'),appointments=table_(ss,'appointments');
  const existingMember=members.find(r=>String(r[0])===c.identity.id);
  const existingStaff=appointments.find(r=>String(r[1])==='Administration'&&String(r[4])===c.identity.id&&bool_(r[8]));
  if(!existingMember&&!existingStaff&&!c.rights.superAdmin&&!(c.member?.roles||[]).includes('President'))
    throw new Error('Only a Cabinet member or active government staff member may set this profile avatar. Ask administration to add your appointment.');
  const name=String(username||'').trim();
  const resolved=name?robloxProfile_(name):null;
  return withLock_(()=>{
    const currentMember=table_(ss,'members').find(r=>String(r[0])===c.identity.id);
    const currentStaff=table_(ss,'appointments').find(r=>String(r[1])==='Administration'&&String(r[4])===c.identity.id&&bool_(r[8]));
    if(currentStaff&&!currentMember&&!c.rights.superAdmin&&!(c.member?.roles||[]).includes('President')){
      const row=currentStaff.slice();while(row.length<14)row.push('');
      row[10]=new Date();row[11]=c.identity.id;row[12]=resolved?resolved.id:'';row[13]=resolved?cell_(resolved.username):'';
      saveRow_(ss,'appointments',String(row[0]),row);
      record_(ss,c.identity,'SET_DISPLAY_AVATAR','Appointment',String(row[0]),resolved?'Avatar for player '+resolved.username:'Cleared avatar');
      return {success:true,robloxId:row[12],robloxUsername:row[13],
        message:resolved?'Avatar saved. Profile image may take a moment to load.':'Roblox avatar removed. Default avatar restored.'};
    }
    const row=currentMember?currentMember.slice():[
      c.identity.id,cell_(c.identity.username),cell_(c.member?.name||c.identity.username),
      cell_(c.member?.position||'Cabinet member'),cell_(c.member?.portfolio||''),
      (c.member?.roles||[]).filter(r=>GOV.roles.includes(r)).join(','),true,new Date(),new Date(),c.identity.id,'',''
    ];
    row[8]=new Date();row[9]=c.identity.id;
    row[10]=resolved?resolved.id:'';row[11]=resolved?cell_(resolved.username):'';
    saveRow_(ss,'members',c.identity.id,row);
    record_(ss,c.identity,'SET_DISPLAY_AVATAR','Member',c.identity.id,resolved?'Avatar for player '+resolved.username:'Cleared avatar');
    return {success:true,robloxId:row[10],robloxUsername:row[11],
      message:resolved?'Avatar saved. Profile image may take a moment to load.':'Roblox avatar removed. Default avatar restored.'};
  });
}
function getRobloxAvatarMap(token,discordIds){
  const c=userContext_(token,true);require_(c,'view');
  if(!Array.isArray(discordIds)||discordIds.length>50)throw new Error('Request up to 50 account avatars.');
  const ids=[...new Set(discordIds.map(String).filter(isDiscordId_))];
  const ss=db_(),members=table_(ss,'members'),appointments=table_(ss,'appointments');
  const accounts={};
  members.forEach(row=>{
    const discordId=String(row[0]),robloxId=String(row[10]||'');
    if(ids.includes(discordId)&&bool_(row[6])&&/^[0-9]{1,20}$/.test(robloxId))accounts[discordId]=robloxId;
  });
  appointments.forEach(row=>{
    const discordId=String(row[4]||''),robloxId=String(row[12]||'');
    if(ids.includes(discordId)&&bool_(row[8])&&/^[0-9]{1,20}$/.test(robloxId)&&!accounts[discordId])accounts[discordId]=robloxId;
  });
  const cache=CacheService.getScriptCache(),result={},missing=[];
  Object.keys(accounts).forEach(id=>{
    const hit=cache.get('rsagp_avatar_'+accounts[id]);
    if(hit&&/^https:\/\/(?:[a-z0-9-]+\.)*rbxcdn\.com\//i.test(hit))result[id]=hit;
    else missing.push(accounts[id]);
  });
  const unique=[...new Set(missing)].slice(0,50);
  if(unique.length){
    try{
      const url='https://thumbnails.roblox.com/v1/users/avatar?userIds='+encodeURIComponent(unique.join(','))+'&size=150x150&format=Png&isCircular=false';
      const response=UrlFetchApp.fetch(url,{muteHttpExceptions:true});
      if(response.getResponseCode()===200){
        const items=parseJSON_(response.getContentText(),{}).data||[];
        const byId={};
        items.forEach(item=>{
          const image=String(item.imageUrl||'');
          if(/^https:\/\/(?:[a-z0-9-]+\.)*rbxcdn\.com\//i.test(image)){
            const robloxId=String(item.targetId||'');byId[robloxId]=image;
            try{cache.put('rsagp_avatar_'+robloxId,image,3600);}catch(e){}
          }
        });
        Object.keys(accounts).forEach(id=>{if(byId[accounts[id]])result[id]=byId[accounts[id]];});
      }
    }catch(e){} // A failed Roblox thumbnail lookup must not block navigation.
  }
  return result;
}
