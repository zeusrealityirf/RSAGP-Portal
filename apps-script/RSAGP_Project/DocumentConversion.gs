/**
 * RSAGP Document Conversion — HTML is always the source of truth.
 * All exports are standalone HTML documents. This enhancer adds optional,
 * self-contained PNG capture and browser Print / Save as PDF controls to the
 * already-generated HTML; it never writes PNG/PDF to Google Drive or Sheets.
 */
function rsagpAddBrowserExportTools_(html, filename) {
  const input=String(html||'');
  if (!/<\/head\s*>/i.test(input) || !/<\/body\s*>/i.test(input)) return input;
  if (input.indexOf('id="rsagp-export-tools"')!==-1) return input;
  const safe=String(filename||'RSAGP_Document.html').replace(/[^A-Za-z0-9_.-]/g,'_');
  const styles='<style id="rsagp-export-styles">'+rsagpBrowserExportCSS_()+'</style>';
  const toolbar='<aside id="rsagp-export-tools" aria-label="Export document">'+
    '<div class="rsagp-export-heading"><span>RSAGP · ROBLOX NATION</span><strong>Export document</strong></div>'+
    '<div class="rsagp-export-actions">'+
    '<select id="rsagp-export-page" aria-label="PNG page" hidden></select>'+
    '<button id="rsagp-export-png" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6m-8 4v7m-3-3 3 3 3-3"/></svg> Save PNG</button>'+
    '<button id="rsagp-export-pdf" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg> Save PDF</button>'+
    '</div><div class="rsagp-export-status" id="rsagp-export-status" role="status" aria-live="polite">'+
    'PNG converts this HTML to an image. PDF uses your browser’s print dialog.</div>'+
    '<a id="rsagp-export-image-link" hidden target="_blank" rel="noopener">Open generated PNG</a></aside>';
  const script='<script id="rsagp-export-script">window.RSAGP_HTML_EXPORT_NAME='+JSON.stringify(safe)+';'+rsagpBrowserExportJS_()+'</script>';
  return input.replace(/<\/head\s*>/i,()=>styles+'</head>')
    .replace(/<\/body\s*>/i,()=>toolbar+script+'</body>');
}
function rsagpBrowserExportCSS_() {return String.raw`
#rsagp-export-tools{position:fixed!important;right:16px!important;bottom:16px!important;left:auto!important;
  z-index:2147483000!important;width:min(352px,calc(100vw - 28px))!important;max-width:352px!important;
  color:#22383d!important;background:rgba(255,255,255,.985)!important;border:1px solid #dce6e1!important;
  border-top:4px solid #dbae57!important;border-radius:17px!important;padding:13px 14px!important;
  box-shadow:0 12px 36px rgba(5,44,31,.24)!important;text-align:left!important;
  font-family:Verdana,Arial,sans-serif!important;font-size:12px!important;line-height:1.45!important;
  box-sizing:border-box!important;transform:none!important;opacity:1!important;filter:none!important;}
#rsagp-export-tools *{box-sizing:border-box!important;font-family:Verdana,Arial,sans-serif!important}
#rsagp-export-tools .rsagp-export-heading{display:flex!important;align-items:center!important;
  justify-content:space-between!important;gap:8px!important;margin:0 0 9px!important}
#rsagp-export-tools .rsagp-export-heading span{font-size:10px!important;color:#788977!important;
  font-weight:700!important;letter-spacing:1px!important}
#rsagp-export-tools .rsagp-export-heading strong{font-size:13px!important;color:#17353c!important}
#rsagp-export-tools .rsagp-export-actions{display:flex!important;gap:7px!important;flex-wrap:wrap!important;align-items:center!important}
#rsagp-export-tools button,#rsagp-export-tools select{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;flex:1 1 100px!important;
  min-width:0!important;min-height:42px!important;border-radius:9px!important;cursor:pointer!important;
  font-size:12px!important;font-weight:700!important;margin:0!important;padding:8px 9px!important;
  line-height:1.2!important;text-align:center!important;box-shadow:none!important;letter-spacing:0!important}
#rsagp-export-tools button:first-of-type{background:#0c6e55!important;color:white!important;border:1px solid #0c6e55!important}
#rsagp-export-tools button:nth-of-type(2){background:#f9f1dd!important;color:#6c542d!important;border:1px solid #e8dcbf!important}
#rsagp-export-tools button:disabled{opacity:.6!important;cursor:progress!important}
#rsagp-export-tools select{width:100%!important;flex-basis:100%!important;border:1px solid #d2ddd4!important;
 background:#fff!important;color:#194530!important}
#rsagp-export-tools select[hidden],#rsagp-export-tools [hidden]{display:none!important}
#rsagp-export-tools .rsagp-export-status{font-size:11px!important;color:#52675a!important;
  margin-top:9px!important;line-height:1.45!important}
#rsagp-export-tools .rsagp-export-status.error{color:#9c2929!important}
#rsagp-export-tools a{font-size:11px!important;color:#006545!important;font-weight:700!important;
 text-decoration:underline!important;margin-top:6px!important;display:inline-block!important}
@media screen and (max-width:600px){#rsagp-export-tools{left:10px!important;right:10px!important;
  bottom:max(10px,env(safe-area-inset-bottom))!important;width:auto!important;max-width:none!important;
  padding:11px!important;border-radius:14px!important}}
@media print{#rsagp-export-tools,#rsagp-export-styles,#rsagp-export-script{display:none!important}
  body{box-shadow:none!important}}
`;} 
function rsagpBrowserExportJS_() {return String.raw`
(function(){
 'use strict';
 const status=document.getElementById('rsagp-export-status');
 const pngButton=document.getElementById('rsagp-export-png');
 const pdfButton=document.getElementById('rsagp-export-pdf');
 const pagePicker=document.getElementById('rsagp-export-page');
 const imageLink=document.getElementById('rsagp-export-image-link');
 if(!status||!pngButton||!pdfButton||!pagePicker||!imageLink)return;
 let downloadURL='';
 const basename=String(window.RSAGP_HTML_EXPORT_NAME||document.title||'RSAGP_Document.html')
   .replace(/\.html?$/i,'').replace(/[^A-Za-z0-9_.-]/g,'_');
 function setStatus(message,isError){status.textContent=message;status.classList.toggle('error',!!isError);}
 function findPages(){
   const card=document.querySelector('.citizen-card');if(card)return [card];
   const cover=document.querySelector('section.cover'),parts=document.querySelector('section.pages');
   if(cover&&parts)return [cover,parts];
   const sheet=document.querySelector('.sheet');if(sheet)return [sheet];
   return [document.querySelector('main')||document.body];
 }
 const pages=findPages();
 if(pages.length>1){pages.forEach((el,i)=>{
   const option=document.createElement('option');option.value=String(i);
   option.textContent='PNG page '+(i+1)+(el.classList.contains('cover')?' — cover':'');
   pagePicker.appendChild(option);
 });pagePicker.hidden=false;}
 pdfButton.addEventListener('click',()=>{
   setStatus('Choose Save as PDF in your browser print window. Enable background graphics for best results.');
   try{window.print();}catch(e){setStatus('Use your browser menu → Print → Save as PDF.',true);}
 });
 function splitCSSArguments(s){
   const tokens=[];let level=0,current='';
   for(const ch of s){if(ch==='(')level++;if(ch===')')level--;
     if(ch===','&&level===0){tokens.push(current.trim());current='';}else current+=ch;}
   if(current)tokens.push(current.trim());return tokens;
 }
 function extractGradient(image){
   const start=image.indexOf('linear-gradient(');if(start<0)return null;
   const from=start+'linear-gradient('.length;let level=1,end=from;
   while(end<image.length&&level>0){if(image[end]==='(')level++;else if(image[end]===')')level--;end++;}
   if(level!==0)return null;
   const args=splitCSSArguments(image.slice(from,end-1));
   if(args.length<2)return null;
   let direction=args[0],colors=args;
   if(/^(to\s|[-+]?\d+(?:\.\d+)?deg)/i.test(direction)){colors=args.slice(1);}else direction='180deg';
   if(!colors.length)return null;
   return {direction,colors};
 }
 function parseColorStop(entry){
   const m=entry.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[a-f0-9]{3,8}|transparent|[a-z]+)(?:\s+(\d+(?:\.\d+)?)(%|px))?/i);
   if(!m)return null;
   return {color:m[1],percent:m[2]?Number(m[2])/100:null};
 }
 function gradientFor(ctx,style,x,y,w,h){
   const data=extractGradient(style.backgroundImage||'');if(!data)return null;
   let dx=0,dy=1;
   if(/^to right/i.test(data.direction)){dx=1;dy=0;}
   else if(/^to left/i.test(data.direction)){dx=-1;dy=0;}
   else if(/^to top/i.test(data.direction)){dx=0;dy=-1;}
   else if(/^to bottom right/i.test(data.direction)){dx=.707;dy=.707;}
   else if(/^to bottom left/i.test(data.direction)){dx=-.707;dy=.707;}
   else if(/deg/.test(data.direction)){
     const deg=(parseFloat(data.direction)||180)*Math.PI/180;dx=Math.sin(deg);dy=-Math.cos(deg);
   }
   const cx=x+w/2,cy=y+h/2;
   const gr=ctx.createLinearGradient(cx-dx*w/2,cy-dy*h/2,cx+dx*w/2,cy+dy*h/2);
   const stops=data.colors.map(parseColorStop).filter(Boolean);
   if(stops.length<2)return null;
   stops.forEach((stop,i)=>{
     let loc=stop.percent===null?i/(stops.length-1):stop.percent;
     loc=Math.max(0,Math.min(1,loc));
     try{gr.addColorStop(loc,stop.color);}catch(e){}
   });
   return gr;
 }
 function drawRect(ctx,x,y,w,h,r,fill){
   if(w<=0||h<=0)return;
   ctx.beginPath();
   r=Math.max(0,Math.min(r,w/2,h/2));
   if(r&&ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
   if(fill){ctx.fillStyle=fill;ctx.fill();}
 }
 function drawBox(ctx,el,rect,base,style){
   const x=rect.left-base.left,y=rect.top-base.top,w=rect.width,h=rect.height;
   if(w<=0||h<=0)return;
   const radius=Math.max(0,parseFloat(style.borderTopLeftRadius)||0);
   const bg=style.backgroundColor;
   if(bg&&!/rgba?\(0,\s*0,\s*0,\s*0\)|transparent/.test(bg))drawRect(ctx,x,y,w,h,radius,bg);
   const gradient=gradientFor(ctx,style,x,y,w,h);
   if(gradient)drawRect(ctx,x,y,w,h,radius,gradient);
   const sides=[['Top','top'],['Right','right'],['Bottom','bottom'],['Left','left']];
   for(const [side,axis] of sides){
     const width=parseFloat(style['border'+side+'Width'])||0;
     const color=style['border'+side+'Color'];
     if(width>0&&style['border'+side+'Style']!=='none'&&color&&color!=='transparent'){
       ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();
       if(axis==='top'){ctx.moveTo(x,y+width/2);ctx.lineTo(x+w,y+width/2);}
       if(axis==='bottom'){ctx.moveTo(x,y+h-width/2);ctx.lineTo(x+w,y+h-width/2);}
       if(axis==='left'){ctx.moveTo(x+width/2,y);ctx.lineTo(x+width/2,y+h);}
       if(axis==='right'){ctx.moveTo(x+w-width/2,y);ctx.lineTo(x+w-width/2,y+h);}
       ctx.stroke();
     }
   }
 }
 function drawWords(ctx,node,parent,base){
   const content=node.textContent||'';
   if(!content.trim())return;
   const style=getComputedStyle(parent);
   if(style.visibility==='hidden'||style.display==='none'||parseFloat(style.opacity)===0)return;
   const size=parseFloat(style.fontSize)||14;
   const weight=style.fontWeight||'400';
   const variant=style.fontStyle||'normal';
   ctx.font=variant+' '+weight+' '+size+'px '+style.fontFamily;
   ctx.fillStyle=style.color||'#202020';
   ctx.textBaseline='alphabetic';
   const lineHeight=parseFloat(style.lineHeight)||size*1.2;
   const tokens=content.match(/\S+|\s+/g)||[];
   let offset=0;
   const range=document.createRange();
   for(const token of tokens){
     const start=offset;offset+=token.length;
     if(!token.trim())continue;
     try{range.setStart(node,start);range.setEnd(node,offset);}catch(e){continue;}
     const rects=range.getClientRects();
     if(!rects.length)continue;
     let value=token;
     if(style.textTransform==='uppercase')value=value.toUpperCase();
     else if(style.textTransform==='lowercase')value=value.toLowerCase();
     // Tokens are drawn at their measured DOM position, preserving line breaks.
     const r=rects[0];
     const x=r.left-base.left,y=r.top-base.top;
     ctx.fillText(value,x,y+(r.height-lineHeight)/2+size*.87);
   }
 }
 function drawImage(ctx,img,rect,base){
   if(!img.complete||!img.naturalWidth||!img.naturalHeight)return;
   const url=img.currentSrc||img.src||'';
   // External images without CORS permission cannot be exported safely.
   if(!/^data:image\//i.test(url)&&!url.startsWith('blob:'))return;
   const cs=getComputedStyle(img);
   const x=rect.left-base.left,y=rect.top-base.top,w=rect.width,h=rect.height;
   if(w<=0||h<=0)return;
   const fit=cs.objectFit;
   let dw=w,dh=h,dx=x,dy=y;
   if(fit==='contain'||fit==='scale-down'){
     const s=Math.min(w/img.naturalWidth,h/img.naturalHeight);
     dw=img.naturalWidth*s;dh=img.naturalHeight*s;
     dx+=(w-dw)/2;dy+=(h-dh)/2;
   }else if(fit==='cover'){
     const s=Math.max(w/img.naturalWidth,h/img.naturalHeight);
     dw=img.naturalWidth*s;dh=img.naturalHeight*s;dx+=(w-dw)/2;dy+=(h-dh)/2;
   }
   ctx.save();
   const radius=parseFloat(cs.borderRadius)||0;
   if(radius){drawRect(ctx,x,y,w,h,radius,null);ctx.clip();}
   try{ctx.drawImage(img,dx,dy,dw,dh);}catch(e){}
   ctx.restore();
 }
 function scan(ctx,node,base){
   if(node.nodeType===Node.TEXT_NODE){if(node.parentElement)drawWords(ctx,node,node.parentElement,base);return;}
   if(node.nodeType!==Node.ELEMENT_NODE)return;
   const el=node;
   if(el.closest('#rsagp-export-tools'))return;
   if(el.tagName==='SCRIPT'||el.tagName==='STYLE'||el.tagName==='NOSCRIPT'||el.tagName==='TEMPLATE')return;
   const style=getComputedStyle(el);
   if(style.display==='none'||style.visibility==='hidden'||parseFloat(style.opacity)===0)return;
   const rect=el.getBoundingClientRect();
   if(rect.width===0||rect.height===0)return;
   drawBox(ctx,el,rect,base,style);
   if(el.tagName==='IMG'){drawImage(ctx,el,rect,base);return;}
   if(el.tagName==='INPUT'||el.tagName==='TEXTAREA'){
     ctx.font=(parseFloat(style.fontSize)||14)+'px '+style.fontFamily;
     ctx.fillStyle=style.color;ctx.fillText(el.value||'',rect.left-base.left+8,rect.top-base.top+20);return;
   }
   for(const child of el.childNodes)scan(ctx,child,base);
 }
 async function exportCanvas(el){
   if(document.fonts&&document.fonts.ready)try{await document.fonts.ready;}catch(e){}
   await Promise.all(Array.from(el.querySelectorAll('img')).map(img=>{
     if(img.complete)return Promise.resolve();
     return new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,5000);});
   }));
   const r=el.getBoundingClientRect();
   const width=Math.ceil(Math.max(r.width,el.scrollWidth,el.offsetWidth)),height=Math.ceil(Math.max(r.height,el.scrollHeight,el.offsetHeight));
   if(width<10||height<10)throw new Error('Document is empty.');
   const scale=Math.max(1,Math.min(2,Math.sqrt(12000000/(width*height))));
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);
   const ctx=canvas.getContext('2d',{alpha:false});
   ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.setTransform(scale,0,0,scale,0,0);
   scan(ctx,el,r);
   return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Browser could not encode PNG.')),'image/png'));
 }
 async function exportPng(){
   pngButton.disabled=true;imageLink.hidden=true;
   try{
     setStatus('Drawing PNG from this document. No external converter required…');
     const i=Math.max(0,Math.min(pages.length-1,Number(pagePicker.value||0)));
     const blob=await exportCanvas(pages[i]);
     if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL=URL.createObjectURL(blob);
     const suffix=pages.length>1?'-page-'+String(i+1).padStart(2,'0'):'';
     imageLink.href=downloadURL;imageLink.download=basename+suffix+'.png';
     imageLink.textContent='Download '+basename+suffix+'.png';imageLink.hidden=false;
     if(!/iPhone|iPad|iPod|Android/i.test(navigator.userAgent||''))imageLink.click();
     setStatus('PNG ready! If it did not save automatically, tap Download PNG below.');
   }catch(e){setStatus((e&&e.message)||'PNG conversion failed. HTML and PDF are still available.',true);}
   finally{pngButton.disabled=false;}
 }
 pngButton.addEventListener('click',exportPng);
 window.addEventListener('beforeunload',()=>{if(downloadURL)URL.revokeObjectURL(downloadURL);});
})();
`;}
