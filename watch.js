/* ═══════════════ WATCH MY CASE — UI ═══════════════
   Data + Firestore actions live in firebase.js (sendWatchRequest, acceptWatchRequest,
   declineWatchRequest, cancelWatchRequest, revokeWatchAccess, giveBackCase,
   watchEnabled/setWatchEnabled). This file is just the sheets/buttons on top. */

/* ── Status block + action button shown in the case detail sheet (app2.js openDet) ── */
function shareStatusBlockHTML(c){
  if(c._shared){
    return`<div class="dsec" style="background:rgba(56,189,248,.08);border-left:3px solid #38bdf8">
      <div class="dl" style="color:#38bdf8">🫱🏻‍🫲🏾 Watching for @${esc(c._ownerUsername||'')}</div>
      <div class="dv" style="font-size:12px;color:var(--t2);margin-top:3px">You can edit this case — you'll both see any changes.</div>
    </div>`;
  }
  if(c.share&&c.share.status==='pending'){
    return`<div class="dsec" style="background:rgba(245,166,35,.08);border-left:3px solid var(--am)">
      <div class="dl" style="color:var(--am)">⏳ Watch request sent to @${esc(c.share.toUsername)}</div>
    </div>`;
  }
  if(c.share&&c.share.status==='active'){
    return`<div class="dsec" style="background:rgba(34,197,94,.08);border-left:3px solid #22c55e">
      <div class="dl" style="color:#22c55e">🫱🏻‍🫲🏾 Watched by @${esc(c.share.toUsername)}</div>
    </div>`;
  }
  return'';
}
function shareActionButtonHTML(c){
  if(c._shared)return`<button class="ab" style="background:rgba(56,189,248,.18);color:#38bdf8" onclick="giveBackCaseConfirm('${c.id}')">↩ Give Back This Case</button>`;
  if(c.share&&c.share.status==='pending')return`<button class="ab ard" onclick="openShareSheet('${c.id}')">✕ Cancel Watch Request</button>`;
  if(c.share&&c.share.status==='active')return`<button class="ab ard" onclick="openShareSheet('${c.id}')">🔒 Revoke Watch Access</button>`;
  if(!(window.watchEnabled&&window.watchEnabled()))return'';
  return`<button class="ab" style="background:rgba(34,197,94,.18);color:#22c55e" onclick="openShareSheet('${c.id}')">🫱🏻‍🫲🏾 Watch My Case</button>`;
}
window.shareStatusBlockHTML=shareStatusBlockHTML;
window.shareActionButtonHTML=shareActionButtonHTML;

/* ── Send request / manage status sheet — opened from a case's 🫱🏻‍🫲🏾 button ── */
let _wsendCaseId=null;
function openShareSheet(id){
  _wsendCaseId=id;
  renderShareSheet();
  open('ov-watch-send');
}
window.openShareSheet=openShareSheet;
function renderShareSheet(){
  const c=(window._cases||[]).find(x=>x.id===_wsendCaseId);
  if(!c)return;
  document.getElementById('wsend-title').textContent='🫱🏻‍🫲🏾 '+(c.nm||'Watch My Case');
  const body=document.getElementById('wsend-body');
  if(c.share&&c.share.status==='pending'){
    body.innerHTML=`
      <div style="font-size:13px;color:var(--t2);text-align:center;margin-bottom:14px">⏳ Request sent to <b>@${esc(c.share.toUsername)}</b><br>Waiting for them to accept.</div>
      <button class="ab ard" onclick="doCancelWatch()">✕ Cancel Request</button>`;
  }else if(c.share&&c.share.status==='active'){
    body.innerHTML=`
      <div style="font-size:13px;color:var(--t2);text-align:center;margin-bottom:14px">🫱🏻‍🫲🏾 <b>@${esc(c.share.toUsername)}</b> is watching this case.<br>They can edit and follow up — you'll both see changes until they give it back.</div>
      <button class="ab ard" onclick="doRevokeWatch()">🔒 Revoke Access</button>`;
  }else{
    body.innerHTML=`
      <div style="font-size:12px;color:var(--t3);margin-bottom:10px">Hand this patient off to a colleague while you're on elective or off service. They'll be able to follow up, edit, and set follow-up dates — you'll both see the case until they give it back.</div>
      <div class="fg"><label class="fl">Colleague's Username</label>
       <input class="fi" id="wsend-user" placeholder="e.g. jsmith" type="text" autocomplete="off" onkeydown="if(event.key==='Enter')doSendWatch()">
      </div>
      <button class="sbmt" onclick="doSendWatch()">Send Request</button>
      <div id="wsend-err" style="color:var(--r);font-size:13px;text-align:center;min-height:16px;margin-top:6px"></div>`;
    setTimeout(()=>document.getElementById('wsend-user')?.focus(),200);
  }
}
async function doSendWatch(){
  const inp=document.getElementById('wsend-user');
  const btn=document.querySelector('#wsend-body .sbmt');
  if(btn){btn.disabled=true;btn.textContent='Sending...'}
  const res=await window.sendWatchRequest(_wsendCaseId,inp?inp.value:'');
  if(btn){btn.disabled=false;btn.textContent='Send Request'}
  if(!res.ok){const err=document.getElementById('wsend-err');if(err)err.textContent=res.msg;return}
  toast(res.msg);
  cls('ov-watch-send');
}
async function doCancelWatch(){
  await window.cancelWatchRequest(_wsendCaseId);
  cls('ov-watch-send');
}
async function doRevokeWatch(){
  showConf('🔒','Revoke access?',"Your colleague will lose access to this case immediately.",'Revoke',async()=>{
    await window.revokeWatchAccess(_wsendCaseId);
    cls('ov-watch-send');
  });
}
window.doSendWatch=doSendWatch;window.doCancelWatch=doCancelWatch;window.doRevokeWatch=doRevokeWatch;

/* ── Give back a shared-in case ── */
function giveBackCaseConfirm(id){
  const c=(window._cases||[]).find(x=>x.id===id);
  showConf('🫱🏻‍🫲🏾','Give this case back?',
    `${c?esc(c.nm):'This patient'} will return to ${c&&c._ownerUsername?'@'+esc(c._ownerUsername):'the owner'}'s app and you'll lose access.`,
    'Give Back',async()=>{await window.giveBackCase(id);cls('ov-det');cls('ov-watch-send')});
}
window.giveBackCaseConfirm=giveBackCaseConfirm;

/* ── Incoming requests inbox ── */
function openWatchInbox(){renderWatchInbox();open('ov-watch-inbox')}
window.openWatchInbox=openWatchInbox;
function renderWatchInbox(){
  const reqs=window._incomingWatchRequests||[];
  const badge=document.getElementById('b-watch');
  if(badge){badge.textContent=reqs.length;badge.classList.toggle('h',!reqs.length)}
  const body=document.getElementById('winbox-body');
  if(!body)return;
  if(!reqs.length){
    body.innerHTML=`<div class="empty"><div class="ei">🫱🏻‍🫲🏾</div><div class="et">No pending requests</div><div class="es">Requests to watch a colleague's case appear here</div></div>`;
    return;
  }
  body.innerHTML=reqs.map(r=>`
    <div class="card" style="cursor:default;margin-bottom:8px">
      <div class="cn" style="margin-bottom:4px">${esc(r.caseNm||'Patient')}${r.caseHn?` <span class="bh bhn">HN ${esc(r.caseHn)}</span>`:''}</div>
      <div style="font-size:12px;color:var(--t2);margin-bottom:10px">@${esc(r.ownerUsername)} wants you to watch this case while they're away.</div>
      <div style="display:flex;gap:8px">
        <button class="ab agr" style="flex:1;padding:9px" onclick="window.declineWatchRequest('${r.id}')">Decline</button>
        <button class="ab" style="flex:1;padding:9px;background:rgba(56,189,248,.18);color:#38bdf8" onclick="window.acceptWatchRequest('${r.id}')">Accept</button>
      </div>
    </div>`).join('');
}
window.renderWatchInbox=renderWatchInbox;
