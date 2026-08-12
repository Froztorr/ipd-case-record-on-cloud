let tab='today',fuId=null,pie=null;
let dcFilter='All',dcSearch='',dcFrom='',dcTo='';
let doneFilter='All',doneSearch='';
let vzDayFilter=null; // null='Overall', 'today', or an ISO date string (yyyy-mm-dd)
let stFrom='',stTo='';

const TYPES=['Stroke','Chronic med','Post op','Swallow','Cardiac','Pulmo','PO','Burn','ICU','Prehab','Hip fast'];
const TC={Stroke:'tc-s','Chronic med':'tc-c','Post op':'tc-p',Swallow:'tc-sw',Cardiac:'tc-ca',Pulmo:'tc-pu',PO:'tc-po',Burn:'tc-b',ICU:'tc-i',Prehab:'tc-pr','Hip fast':'tc-h'};
const TK={Stroke:'#ff7eb3','Chronic med':'#6c6fff','Post op':'#3ecf8e',Swallow:'#f5a623',Cardiac:'#ff6b6b',Pulmo:'#64d2ff',PO:'#bf94ff',Burn:'#ff9f0a',ICU:'#ff453a',Prehab:'#30d158','Hip fast':'#5ac8fa'};

// Data — always read from in-memory cache populated by Firestore listener
function load(){return window._cases||[]}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function uid_(){return Math.random().toString(36).slice(2,9)+Date.now().toString(36)}

const localDateStr = (d = new Date()) => { const pad = x => x < 10 ? '0' + x : x; return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const today=()=>localDateStr(new Date());
const fd=s=>{if(!s)return'–';const[y,m,d]=s.split('-');return`${d}/${m}/${y.slice(2)}`};
const addD=(s,n)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return localDateStr(d)};
const weekEnd=()=>{const d=new Date(),day=d.getDay();const n=day<=5?5-day:5+(7-day);const f=new Date(d);f.setDate(d.getDate()+(n===0&&day!==5?7:n));return localDateStr(f)};
const monthKey=s=>{if(!s)return'Unknown';const[y,m]=s.split('-');const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];return`${mn[parseInt(m,10)-1]} ${y}`};
const dayLbl=s=>{
  const t=today(),diff=Math.round((new Date(s+'T00:00:00')-new Date(t+'T00:00:00'))/86400000);
  if(diff===0)return'Today';if(diff===1)return'Tomorrow';if(diff===-1)return'Yesterday';
  return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(s+'T00:00:00').getDay()]+' '+fd(s);
};

const sortW = (arr) => arr.sort((a,b) => {
  const p = s => {
    if(!s) return {t:3, v:0, o:''};
    const w = String(s).split('/')[0].trim().toLowerCase();
    
    // Use startsWith to catch Micu1, Micu2, CCU, ICCU etc.
    if(w.startsWith('ccu')||w.startsWith('iccu')) return {t:0, v:4, o:w};
    if(w.startsWith('micu')) return {t:0, v:10, o:w};
    if(w.startsWith('สก')) return {t:1, v:parseInt(w.replace('สก',''))||0, o:w};
    
    const n = parseInt(w);
    return !isNaN(n) ? {t:0, v:n, o:w} : {t:2, v:0, o:w};
  };
  const wa=p(a.wd), wb=p(b.wd);
  if(wa.t!==wb.t) return wa.t-wb.t; // Order: Normal Numbers (0) -> สก (1) -> Others (2) -> Empty (3)
  if(wa.t<2 && wa.v!==wb.v) return wb.v-wa.v; // Descending sort (highest to lowest)
  return wa.o.localeCompare(wb.o); // Alphabetical tie-breaker
});

function card(c){
  const t=today(),ov=!c.dc&&c.fu&&c.fu<t,isT=c.fu===t;
  const flab=c.dc?`<span class="fd">DC ${fd(c.dcDate)}</span>`:
    !c.fu?`<span class="fd">No F/U set</span>`:
    ov?`<span class="fd ov">⚠ Overdue ${fd(c.fu)}</span>`:
    isT?`<span class="fd td">📅 F/U Today</span>`:
    `<span class="fd">F/U ${fd(c.fu)}</span>`;
  // Watch My Case — a shared-in card (someone handed this off to me) gets a pale
  // bright blue tint; a case I've handed off to someone else gets pale bright
  // green on my own side. See card-share styles in styles.css.
  const shareOn=c.share&&(c.share.status==='pending'||c.share.status==='active');
  const shareCls=c._shared?' wshare-in':shareOn?' wshare-out':'';
  const barColor=c._shared?'#38bdf8':c.share&&c.share.status==='active'?'#22c55e':c.share&&c.share.status==='pending'?'var(--am)':(TK[c.ty]||'#6c6fff');
  const showShareBtn=!c._shared&&(shareOn||(window.watchEnabled&&window.watchEnabled()));
  return`<div class="card${shareCls}" onclick="openDet('${c.id}')">
    <div class="ca" style="background:${barColor}"></div>
    <div class="cr1">
      <div class="cn" ontouchstart="nameHoldStart(event,'${c.id}')" ontouchend="nameHoldCancel(event)" ontouchcancel="nameHoldCancel(event)" onmousedown="nameHoldStart(event,'${c.id}')" onmouseup="nameHoldCancel(event)" onmouseleave="nameHoldCancel(event)">${esc(c.nm)||'–'}</div>
      <button class="opd-btn${(c.rem||[]).some(r=>!r.done)?' on':''}" onclick="event.stopPropagation();openRem('${c.id}')" title="Reminders">📝</button>
      <button class="opd-btn${_picIds.has(c.id)?' on':''}" onclick="event.stopPropagation();picClick('${c.id}')" title="Picture">📷</button>
      <button class="opd-btn${c.opd?' on':''}" onclick="event.stopPropagation();toggleOpd('${c.id}')" title="OPD appt set">✅</button>
      ${showShareBtn?`<button class="opd-btn${shareOn?' on':''}" onclick="event.stopPropagation();openShareSheet('${c.id}')" title="Watch My Case">🫱🏻‍🫲🏾</button>`:''}
      <button class="sbtn${c.st?' on':''}" onclick="event.stopPropagation();star('${c.id}')" aria-label="VIP">★</button>
    </div>
    <div class="cmeta">
      ${c.hn?`<span class="bh bhn">HN ${c.hn}</span>`:''}
      ${c.wd?`<span class="bh bwd">${c.wd}</span>`:''}
      ${c.ty?`<span class="bh btp ${TC[c.ty]||''}">${c.ty}</span>`:''}
      ${c._shared?`<span class="bh" style="background:rgba(56,189,248,.15);color:#38bdf8">🫱🏻‍🫲🏾 @${esc(c._ownerUsername||'?')}</span>`:''}
      ${c.share&&c.share.status==='active'?`<span class="bh" style="background:rgba(34,197,94,.15);color:#22c55e">🫱🏻‍🫲🏾 @${esc(c.share.toUsername)}</span>`:''}
      ${c.share&&c.share.status==='pending'?`<span class="bh" style="background:rgba(245,166,35,.15);color:var(--am)">⏳ @${esc(c.share.toUsername)}</span>`:''}
    </div>
    ${c.dx?`<div class="cdx">${esc(c.dx)}</div>`:''}
    ${c.nt?`<div class="cnotes">${esc(c.nt)}</div>`:''}
    <div class="cfoot">${flab}<div class="cbtns">
      <button class="mb mfu" onclick="event.stopPropagation();openFU('${c.id}')">Set F/U</button>
      ${c._shared?`<button class="mb" style="background:rgba(56,189,248,.18);color:#38bdf8" onclick="event.stopPropagation();giveBackCaseConfirm('${c.id}')">↩ Give back</button>`:
        c.dc?`<button class="mb mun" onclick="event.stopPropagation();undc('${c.id}')">↩ Reactivate</button>`:
              `<button class="mb mdc" onclick="event.stopPropagation();dc('${c.id}')">Discharge</button>`}
    </div></div>
  </div>`;
}

function chips(types,cur,fn){
  return`<div class="fw" data-chipfn="${fn}">${['All',...types].map(t=>`<button class="chip${cur===t?' on':''}" data-val="${t.replace(/"/g,'&quot;')}">${t}</button>`).join('')}</div>`;
}

// Global chip click handler — avoids inline onclick with spaces in values
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-val]');
  if(!btn)return;
  const wrap=btn.closest('[data-chipfn]');
  if(!wrap)return;
  const fn=wrap.getAttribute('data-chipfn');
  const val=btn.getAttribute('data-val');
  if(fn==='setDoneFilter')setDoneFilter(val);
  else if(fn==='setDcFilter')setDcFilter(val);
});

function syncBar(){
  const online=navigator.onLine;
  return`<div class="sync"><div class="sync-dot${online?'':' busy'}" id="sync-dot-inline"></div>${online?'Synced to cloud':'Offline — changes saved locally'}</div>`;
}

/* ===== TODAY ===== */
function rToday(){
  const all=load(),t=today(),act=all.filter(c=>!c.dc);
  const ov=act.filter(c=>c.fu&&c.fu<t),td=act.filter(c=>c.fu===t),nd=act.filter(c=>!c.fu);
  sortW(ov); sortW(td); sortW(nd);
  let h=syncBar();
  const impCount=all.filter(c=>!c.dc&&c.fu&&c.fu>t&&c.fu<=weekEnd()).length;
  h+=`<div class="sbar">
    <div class="sc"><div class="sn" style="color:var(--am)">${td.length+ov.length}</div><div class="sl">Today</div></div>
    <div class="sc"><div class="sn" style="color:var(--a)">${impCount}</div><div class="sl">Impending</div></div>
    <div class="sc"><div class="sn" style="color:var(--g)">${act.length}</div><div class="sl">Active</div></div>
  </div>`;
  if(ov.length)h+=`<div class="sh">⚠️ Overdue (${ov.length})</div><div class="cards">${ov.map(card).join('')}</div>`;
  if(td.length)h+=`<div class="sh" style="margin-top:8px">📅 Today — ${fd(t)} (${td.length})</div><div class="cards">${td.map(card).join('')}</div>`;
  if(nd.length)h+=`<div class="sh" style="margin-top:8px">No F/U date (${nd.length})</div><div class="cards">${nd.map(card).join('')}</div>`;
  if(!ov.length&&!td.length&&!nd.length)h+=`<div class="empty"><div class="granny-wrap" style="margin-bottom:8px"><video class="granny" src="Video.mp4" preload="metadata" autoplay loop muted playsinline onclick="grannyTurbo()" id="granny-vid"></video></div><div class="et">${act.length?'All clear for today':'No active cases'}</div><div class="es">${act.length?act.length+' case(s) with future F/U':'Tap + to add a consult'}</div></div>`;
  set('v-today',h);
  if(window._iObs)document.querySelectorAll('#v-today video.granny').forEach(v=>_iObs.observe(v));
}

/* ===== IMPENDING ===== */
function rImp(){
  const t=today(),tom=addD(t,1),we=weekEnd();
  const cases=load().filter(c=>!c.dc&&c.fu&&c.fu>=tom&&c.fu<=we).sort((a,b)=>a.fu.localeCompare(b.fu));
  let h='';
  if(!cases.length){h=`<div class="empty"><div class="ei">📆</div><div class="et">No upcoming cases this week</div><div class="es">Cases with F/U from tomorrow to Friday appear here</div></div>`}
  else{const g={};cases.forEach(c=>{(g[c.fu]=g[c.fu]||[]).push(c)});h=Object.keys(g).sort().map(k=>`<div class="sh imp">📅 ${dayLbl(k)} <span style="color:var(--t3);font-size:11px">(${g[k].length})</span></div><div class="cards">${sortW(g[k]).map(card).join('')}</div>`).join('')}
  set('v-imp',h);
}

/* ===== ALL CASES ===== */
function setDoneFilter(f){doneFilter=f;rDoneChips();rDoneCards()}
function rDone(){
  // Render controls once — search input stays in DOM, never recreated
  set('v-done',`
    <div class="sw"><span class="sico">🔍</span><input class="si" id="done-search-input" placeholder="Search..." type="search" autocomplete="off"></div>
    <div id="done-chips"></div>
    <div id="done-cards"></div>
  `);
  // Restore search value without triggering re-render
  const si=document.getElementById('done-search-input');
  if(si){si.value=doneSearch;si.addEventListener('input',e=>{doneSearch=e.target.value;rDoneCards()})}
  rDoneChips();
  rDoneCards();
}
function rDoneChips(){
  set('done-chips',chips(TYPES,doneFilter,'setDoneFilter'));
}
function rDoneCards(){
  let cases=load().filter(c=>!c.dc);
  if(doneSearch){const q=doneSearch.toLowerCase();cases=cases.filter(c=>[c.nm,c.hn,c.wd,c.dx].some(x=>(x||'').toLowerCase().includes(q)))}
  if(doneFilter!=='All')cases=cases.filter(c=>c.ty===doneFilter);
  let h='';
  if(!cases.length){h=`<div class="empty"><div class="ei">🏥</div><div class="et">No active cases</div><div class="es">Tap + to add a consult</div></div>`}
  else{
    const withDate=cases.filter(c=>c.fu).sort((a,b)=>a.fu.localeCompare(b.fu));
    const noDate=cases.filter(c=>!c.fu);
    if(withDate.length){const g={};withDate.forEach(c=>{(g[c.fu]=g[c.fu]||[]).push(c)});h+=Object.keys(g).sort().map(k=>`<div class="sh">📋 ${dayLbl(k)} (${g[k].length})</div><div class="cards">${sortW(g[k]).map(card).join('')}</div>`).join('')}
    if(noDate.length)h+=`<div class="sh">No F/U date (${noDate.length})</div><div class="cards">${sortW(noDate).map(card).join('')}</div>`;
  }
  set('done-cards',h);
}

/* ===== DISCHARGED ===== */
function setDcFilter(f){dcFilter=f;rDcChips();rDcCards()}
function dcApplyDate(){
  dcFrom=document.getElementById('dc-from')?.value||'';
  dcTo=document.getElementById('dc-to')?.value||'';
  rDcCards();
}
function rDc(){
  // Render controls once — inputs stay in DOM
  set('v-dc',`
    <div class="sw"><span class="sico">🔍</span><input class="si" id="dc-search-input" placeholder="Search discharged..." type="search" autocomplete="off"></div>
    <div id="dc-chips"></div>
    <div class="dr"><label>From</label><input class="fi" id="dc-from" type="date" value="${dcFrom}"><label>To</label><input class="fi" id="dc-to" type="date" value="${dcTo}"><button onclick="dcApplyDate()" style="padding:8px 12px;border-radius:8px;background:var(--a);border:none;color:#fff;font-size:13px;cursor:pointer;flex-shrink:0">🔍</button></div>
    <button class="expbtn" onclick="expCSV()">⬇ Export CSV</button>
    <div id="dc-cards"></div>
  `);
  const si=document.getElementById('dc-search-input');
  if(si){si.value=dcSearch;si.addEventListener('input',e=>{dcSearch=e.target.value;rDcCards()})}
  rDcChips();
  rDcCards();
}
function rDcChips(){
  set('dc-chips',chips(TYPES,dcFilter,'setDcFilter'));
}
function rDcCards(){
  let cases=load().filter(c=>c.dc);
  if(dcSearch){const q=dcSearch.toLowerCase();cases=cases.filter(c=>[c.nm,c.hn,c.wd,c.dx].some(x=>(x||'').toLowerCase().includes(q)))}
  if(dcFilter!=='All')cases=cases.filter(c=>c.ty===dcFilter);
  if(dcFrom||dcTo){cases=cases.filter(c=>{const d=c.dcDate||c.fu||'';return(!dcFrom||d>=dcFrom)&&(!dcTo||d<=dcTo)})}
  cases.sort((a,b)=>(b.dcDate||b.fu||'').localeCompare(a.dcDate||a.fu||''));
  let h='';
  if(!cases.length){
    h=`<div class="empty"><div class="ei">🏠</div><div class="et">No discharged patients</div><div class="es">${(dcFrom||dcTo)?'No matches for selected range':'Use Discharge on any active case'}</div></div>`;
  } else {
    const g={};cases.forEach(c=>{const k=monthKey(c.dcDate||c.fu);(g[k]=g[k]||[]).push(c)});
    const mn=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const sorted=Object.keys(g).sort((a,b)=>{const toN=s=>{const[m,y]=s.split(' ');return parseInt(y)*12+mn.indexOf(m)};return toN(b)-toN(a)});
    h+=sorted.map(k=>`<div class="mhdr">📦 ${k} <span>(${g[k].length})</span></div><div class="cards">${sortW(g[k]).map(card).join('')}</div>`).join('');
  }
  set('dc-cards',h);
}

/* ===== VIP ===== */
function rVip(){
  const cases=load().filter(c=>c.st);
  set('v-vip',cases.length?`<div class="cards">${sortW(cases).map(card).join('')}</div>`:`<div class="empty"><div class="ei">⭐</div><div class="et">No VIP cases</div><div class="es">Tap ★ on any case</div></div>`);
}

/* ===== OPD (✅ discharged patients with ongoing OPD follow-up) ===== */
function rOpd(){
  const cases=load().filter(c=>c.opd);
  if(!cases.length){set('v-opd',`<div class="empty"><div class="ei">✅</div><div class="et">No OPD follow-ups</div><div class="es">Tap ✅ on any case to mark an OPD appointment</div></div>`);return}
  const withDate=cases.filter(c=>c.fu).sort((a,b)=>a.fu.localeCompare(b.fu));
  const noDate=cases.filter(c=>!c.fu);
  let h='';
  if(withDate.length){
    const g={};withDate.forEach(c=>{(g[c.fu]=g[c.fu]||[]).push(c)});
    h+=Object.keys(g).sort().map(k=>`<div class="sh">✅ ${dayLbl(k)} (${g[k].length})</div><div class="cards">${sortW(g[k]).map(card).join('')}</div>`).join('');
  }
  if(noDate.length)h+=`<div class="sh">No F/U date (${noDate.length})</div><div class="cards">${sortW(noDate).map(card).join('')}</div>`;
  set('v-opd',h);
}

/* ===== STATS ===== */
function rStats(){
  const t=today();
  if(!stFrom)stFrom=addD(t,-30);
  if(!stTo)stTo=t;
  let h=`<div class="dr"><label>From</label><input class="fi" type="date" value="${stFrom}" onchange="stFrom=this.value;rStats()"><label>To</label><input class="fi" type="date" value="${stTo}" onchange="stTo=this.value;rStats()"></div>`;
  // Count by firstVisit date — excludes follow-up visits for accurate stats
  const cases=load().filter(c=>{
    const d=c.firstVisit||(c.created||'').split('T')[0];
    return d>=stFrom&&d<=stTo;
  });
  const cnt={};TYPES.forEach(t=>cnt[t]=0);cases.forEach(c=>{if(cnt[c.ty]!==undefined)cnt[c.ty]++});
  const total=cases.length;
  h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:8px">📊 Counts first visit date only — follow-up visits excluded</div>`;
  h+=`<table class="stbl"><thead><tr><th>Category</th><th style="text-align:right">n</th><th style="text-align:right">%</th></tr></thead><tbody>`;
  TYPES.forEach(t=>{if(!cnt[t])return;const p=((cnt[t]/total)*100).toFixed(1);h+=`<tr><td><span class="dot" style="background:${TK[t]}"></span>${t}</td><td style="text-align:right;font-weight:600">${cnt[t]}</td><td style="text-align:right;color:var(--t3)">${p}%</td></tr>`});
  h+=`<tr><td><b>Total new consults</b></td><td style="text-align:right">${total}</td><td style="text-align:right">–</td></tr></tbody></table>`;
  if(total>0)h+=`<div class="cwrap"><div class="ctitle" style="text-align:center">Distribution by category</div><div style="display:flex;justify-content:center"><canvas id="pieC" style="max-width:200px;max-height:200px"></canvas></div><div class="leg" id="leg"></div></div>`;
  else h+=`<div class="empty"><div class="ei">📊</div><div class="et">No new consults in range</div></div>`;
  set('v-stats',h);
  if(total>0)setTimeout(()=>{
    const at=TYPES.filter(t=>cnt[t]>0);
    if(pie){pie.destroy();pie=null}
    const ctx=document.getElementById('pieC');if(!ctx)return;
    pie=new Chart(ctx,{type:'doughnut',data:{labels:at,datasets:[{data:at.map(t=>cnt[t]),backgroundColor:at.map(t=>TK[t]),borderWidth:2,borderColor:'#1a1d27',hoverOffset:5}]},options:{responsive:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>{const p=((c.parsed/total)*100).toFixed(1);return` ${c.label}: ${c.parsed} (${p}%)`}}}},cutout:'52%'}});
    const leg=document.getElementById('leg');
    if(leg)leg.innerHTML=at.map(t=>`<div class="li"><div class="ld" style="background:${TK[t]}"></div>${t} (${cnt[t]})</div>`).join('');
  },80);
}

/* ===== BADGES ===== */
function badges(){
  const all=load(),t=today(),tom=addD(t,1),we=weekEnd();
  const b=(id,n)=>{const e=document.getElementById(id);if(!e)return;e.textContent=n;e.classList.toggle('h',!n)};
  b('b-today',all.filter(c=>!c.dc&&(c.fu===t||(c.fu&&c.fu<t))).length);
  b('b-imp',all.filter(c=>!c.dc&&c.fu&&c.fu>=tom&&c.fu<=we).length);
  b('b-done',all.filter(c=>!c.dc).length);
  b('b-dc',all.filter(c=>c.dc).length);
  b('b-vip',all.filter(c=>c.st).length);
  b('b-opd',all.filter(c=>c.opd).length);
  b('b-rem',all.filter(c=>!c.dc).reduce((n,c)=>n+((c.rem||[]).filter(r=>!r.done).length),0));
  if(window.applyTabPrefs)applyTabPrefs();
  if(window.renderWatchInbox)window.renderWatchInbox();
}
window.badges=badges;

/* ===== UPDATE LOG ===== */
const UPDATE_LOG_VERSION='2026-08-12-watch-my-case-v1';
const UPDATE_LOG_ITEMS=[
  {date:'12/08/26',title:'🫱🏻‍🫲🏾 Watch My Case(s)',desc:'Hand a patient off to a colleague while you\'re on elective or off service. Turn it on in ⚙️ Settings, then tap the handshake icon on any case to send a request — they can follow up and edit, and you\'ll both see the case until they give it back.'},
  {date:'04/08/26',title:'Copy patient name + HN',desc:'Hold a patient name for 1 second to copy “Name HN” to clipboard.'}
];
function updateLogKey(){return _uid?`rehab_update_seen_${_uid}_${UPDATE_LOG_VERSION}`:null}
function showUpdateLogIfNeeded(){
  const key=updateLogKey();if(!key||localStorage.getItem(key))return;
  const body=document.getElementById('update-log-body');
  const wrap=document.getElementById('update-log-wrap');
  if(!body||!wrap)return;
  body.innerHTML=UPDATE_LOG_ITEMS.map(x=>`<div style="margin-bottom:10px"><div style="font-size:12px;color:var(--t3);font-weight:700">${x.date}</div><div style="font-size:14px;color:var(--t);font-weight:700;margin-top:2px">${x.title}</div><div style="font-size:13px;color:var(--t2);line-height:1.45;margin-top:3px">${x.desc}</div></div>`).join('');
  wrap.classList.add('on');
}
function dismissUpdateLog(){
  const key=updateLogKey();if(key)localStorage.setItem(key,'1');
  const wrap=document.getElementById('update-log-wrap');if(wrap)wrap.classList.remove('on');
}

/* ===== LONG-PRESS COPY PATIENT NAME + HN ===== */
async function copyText(txt){
  // iOS Safari is strict: use a real selectable textarea, visibly in the DOM,
  // and keep it focused/selected before execCommand fallback.
  const ta=document.createElement('textarea');
  ta.value=txt;
  ta.setAttribute('readonly','readonly');
  ta.style.cssText='position:fixed;top:40%;left:12px;right:12px;width:calc(100% - 24px);height:44px;z-index:9999;font-size:16px;opacity:.01;background:white;color:black;-webkit-user-select:text;user-select:text;pointer-events:auto;';
  document.body.appendChild(ta);
  try{
    ta.focus({preventScroll:true});
    ta.select();
    ta.setSelectionRange(0,ta.value.length);
    const ok=document.execCommand('copy');
    if(ok){document.body.removeChild(ta);return true}
  }catch(e){}
  try{
    if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(txt);document.body.removeChild(ta);return true}
  }catch(e){}
  document.body.removeChild(ta);
  return false;
}
let _nameHoldTimer=null,_nameHoldCopied=false;
function nameHoldCancel(e){
  if(e){e.stopPropagation();if(_nameHoldCopied)e.preventDefault()}
  if(_nameHoldTimer){clearTimeout(_nameHoldTimer);_nameHoldTimer=null}
  setTimeout(()=>{_nameHoldCopied=false},80);
}
function nameHoldStart(e,id){
  e.stopPropagation();
  nameHoldCancel();
  _nameHoldTimer=setTimeout(()=>{
    _nameHoldTimer=null;_nameHoldCopied=true;
    const c=load().find(x=>x.id===id);if(!c)return;
    const txt=`${c.nm||''}${c.hn?' '+c.hn:''}`.trim();
    if(!txt)return;
    copyText(txt).then(ok=>toast(ok?'📋 Copied '+txt:'Tap name once, then Copy if iPhone blocks auto-copy'));
  },1000);
}

/* ===== TAB ===== */
function go(t){
  tab=t;
  ['today','imp','done','viz','dc','opd','vip','rem','stats'].forEach(x=>{
    document.getElementById('t-'+x).classList.toggle('on',x===t);
    document.getElementById('v-'+x).classList.toggle('on',x===t);
  });
  // Always full render on tab switch — scaffold needs to be rebuilt
  fullRender();
}

function fullRender(){
  if(tab==='today')rToday();
  else if(tab==='imp')rImp();
  else if(tab==='done')rDone();
  else if(tab==='dc')rDc();
  else if(tab==='opd')rOpd();
  else if(tab==='vip')rVip();
  else if(tab==='viz')rViz();
  else if(tab==='rem')rRem();
  else rStats();
  badges();
}

function render(){
  // Smart render — only update cards if already on done/dc (avoids destroying search input)
  if(tab==='today')rToday();
  else if(tab==='imp')rImp();
  else if(tab==='done'){
    if(document.getElementById('done-cards'))rDoneCards();
    else rDone();
  }
  else if(tab==='dc'){
    if(document.getElementById('dc-cards'))rDcCards();
    else rDc();
  }
  else if(tab==='opd')rOpd();
  else if(tab==='vip')rVip();
  else if(tab==='viz')rViz();
  else if(tab==='rem')rRem();
  else rStats();
  badges();
}
window.render=render;
