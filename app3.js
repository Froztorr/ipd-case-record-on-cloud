async function adminDeleteOne(username,uid){
  showConf('🗑',`Delete "${username}"?`,`Permanently removes their account and all patient records.`,
    'Delete',async()=>{
      try{
        const s=await db.collection('users').doc(uid).collection('cases').get();
        await Promise.all(s.docs.map(d=>d.ref.delete()));
        await db.collection('accounts').doc(username).delete();
        toast('🗑 Deleted '+username);openAdmin();
      }catch(e){toast('⚠ Failed');console.error(e)}
    });
}

async function adminDeleteInactive(){
  showConf('⚠️','Delete ALL inactive?','Permanently removes all accounts inactive 6+ months and their data.',
    'Delete All',async()=>{
      try{
        const now=new Date(),sma=new Date(now);sma.setMonth(sma.getMonth()-6);
        const snap=await db.collection('accounts').get();
        let n=0;
        for(const doc of snap.docs){
          const acc=doc.data();
          const cs=await db.collection('users').doc(acc.uid).collection('cases').get();
          let last=acc.created?new Date(acc.created):new Date(0);
          cs.docs.forEach(c=>{const u=c.data().upd||c.data().created;if(u&&new Date(u)>last)last=new Date(u)});
          if(last<sma){await Promise.all(cs.docs.map(d=>d.ref.delete()));await doc.ref.delete();n++}
        }
        toast(`🗑 Deleted ${n} inactive account(s)`);openAdmin();
      }catch(e){toast('⚠ Failed');console.error(e)}
    });
}

async function adminChangePw(){
  const pw=document.getElementById('admin-newpw')?.value;
  if(!pw||pw.length<4){toast('⚠ Password too short');return}
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('admin::rehab::'+pw));
  const hash=Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,12);
  localStorage.setItem('rehab_admin_hash',hash);
  toast('✅ Admin password updated');
  document.getElementById('admin-newpw').value='';
}

/* ═══════════════ TAB SETTINGS (⚙️) ═══════════════ */
const TAB_IDS=['rem','today','imp','done','viz','dc','opd','vip','stats'];
const TAB_LABELS={rem:'📝 Reminder',today:'📋 Today',imp:'⏰ Impending',done:'📋 All Cases',viz:'🏥 Visualize',dc:'🏠 Discharged',opd:'✅ OPD',vip:'⭐ VIP',stats:'📊 Stats'};
function tabPrefs(){try{return JSON.parse(localStorage.getItem('rehab_tabs'))||{}}catch{return{}}}
function remActiveCount(){return load().filter(c=>!c.dc).reduce((n,c)=>n+((c.rem||[]).filter(r=>!r.done).length),0)}
function tabVisible(id){
  if(tabPrefs()[id]===false)return false;
  if(id==='rem')return remActiveCount()>0; // auto-hide Reminder tab when nothing is active
  return true;
}
function applyTabPrefs(){
  TAB_IDS.forEach(id=>{const el=document.getElementById('t-'+id);if(el)el.style.display=tabVisible(id)?'':'none'});
  if(!tabVisible(tab)){const first=TAB_IDS.find(tabVisible);if(first)go(first)}
}
function openSettings(){renderSettings();document.getElementById('keep-pics-chk').checked=keepPicsOnDischarge();open('ov-settings')}
function renderSettings(){
  const pr=tabPrefs();
  set('settings-body',TAB_IDS.map(id=>`
   <div class="set-row">
    <div style="font-size:14px;font-weight:600">${TAB_LABELS[id]}</div>
    <input type="checkbox" class="set-chk" ${pr[id]!==false?'checked':''} onchange="toggleTabPref('${id}',this.checked)">
   </div>`).join(''));
}
function toggleTabPref(id,show){
  const pr=tabPrefs();pr[id]=show;
  if(!TAB_IDS.some(x=>pr[x]!==false)){toast('⚠ At least one tab must stay visible');pr[id]=true}
  localStorage.setItem('rehab_tabs',JSON.stringify(pr));
  applyTabPrefs();renderSettings();
}

/* ═══════════════ DATE PICKER FIX (PC) ═══════════════ */
// The native <input type=date> always renders its own text in the OS/browser locale (often
// mm/dd/yyyy) and that's not overridable — not even while a value is being typed or right after
// a calendar pick. So on desktop we hide the native input entirely (kept only to drive the
// calendar popup + hold the real ISO value) and put a normal, always-dd/mm/yyyy, fully-typable
// text field on top of it, two-way synced.
const IS_COARSE=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
function dmyDigitsToISO(digits){
  if(digits.length!==8)return null;
  const dd=+digits.slice(0,2),mm=+digits.slice(2,4),yyyy=+digits.slice(4,8);
  if(mm<1||mm>12||dd<1||dd>31||yyyy<1000||yyyy>9999)return null;
  const pad=x=>String(x).padStart(2,'0');
  const iso=`${yyyy}-${pad(mm)}-${pad(dd)}`;
  const chk=new Date(iso+'T00:00:00');
  if(isNaN(chk)||chk.getFullYear()!==yyyy||chk.getMonth()+1!==mm||chk.getDate()!==dd)return null; // rejects e.g. 31/02
  return iso;
}
function enhanceDates(root){
  if(!root||!root.querySelectorAll)return;
  root.querySelectorAll('input[type=date]:not([data-dx])').forEach(inp=>{
    inp.dataset.dx='1';
    inp.addEventListener('click',()=>{try{inp.showPicker&&inp.showPicker()}catch(e){}});
    if(IS_COARSE)return; // phones/tablets already show correct locale format + a native wheel picker
    const wrap=document.createElement('span');wrap.className='dwrap2';
    inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
    inp.classList.add('dnative');inp.tabIndex=-1;
    const txt=document.createElement('input');
    txt.type='text';txt.className=Array.from(inp.classList).filter(c=>c!=='dnative').join(' ');
    txt.placeholder='dd/mm/yyyy';txt.maxLength=10;txt.autocomplete='off';
    txt.setAttribute('inputmode','numeric');
    wrap.appendChild(txt);
    // Native → text: whenever the real (ISO) value changes — from the calendar popup, or from
    // qd()/qdToday() quick-date buttons — reflect it as dd/mm/yyyy in the visible text field.
    const syncFromNative=()=>{
      txt.classList.remove('dbad');
      if(inp.value){const[y,m,d]=inp.value.split('-');txt.value=`${d}/${m}/${y}`}
      else txt.value='';
    };
    inp._dov=syncFromNative; // keeps existing refreshDateOverlays() callers (qd/qdToday/set/open) working unchanged
    inp.addEventListener('change',syncFromNative);
    inp.addEventListener('input',syncFromNative);
    syncFromNative();
    // Text → native: live-mask digits into dd/mm/yyyy as the person types; once a complete valid
    // date is typed, push it into the native input (and fire change so onchange="" handlers still run).
    txt.addEventListener('input',()=>{
      const digits=txt.value.replace(/\D/g,'').slice(0,8);
      txt.value=digits.length<=2?digits:digits.length<=4?digits.slice(0,2)+'/'+digits.slice(2):digits.slice(0,2)+'/'+digits.slice(2,4)+'/'+digits.slice(4);
      txt.classList.remove('dbad');
      if(digits.length===8){
        const iso=dmyDigitsToISO(digits);
        if(iso){
          inp.value=iso;
          inp.dispatchEvent(new Event('input',{bubbles:true}));
          inp.dispatchEvent(new Event('change',{bubbles:true}));
        }else txt.classList.add('dbad'); // valid-looking but impossible date (e.g. 31/02/2026)
      }
    });
    // Typing/clicking the visible field also pops the native calendar, so both entry paths work together.
    const pop=()=>{try{inp.showPicker&&inp.showPicker()}catch(e){}};
    txt.addEventListener('focus',pop);
    txt.addEventListener('click',pop);
  });
}
function refreshDateOverlays(){document.querySelectorAll('input[data-dx]').forEach(i=>{if(i._dov)i._dov()})}

/* ═══════════════ REMINDERS (📝) ═══════════════ */
let _remCaseId=null,remShowDone=false;
function openRem(id){_remCaseId=id;renderRemSheet();open('ov-rem');}
function renderRemSheet(){
  const c=load().find(x=>x.id===_remCaseId);if(!c)return;
  document.getElementById('rem-title').textContent='📝 '+(c.nm||'Reminders');
  const items=(c.rem||[]).filter(r=>!r.done);
  document.getElementById('rem-list').innerHTML=items.length
    ?items.map(r=>`<div class="rem-item"><button class="rem-tick" onclick="tickRem('${c.id}','${r.id}')"></button><div class="rem-txt">${esc(r.txt)}</div></div>`).join('')
    :`<div style="text-align:center;color:var(--t3);font-size:13px;padding:10px 0">No reminders yet — add one above</div>`;
}
async function addRem(){
  const inp=document.getElementById('rem-input');
  const txt=inp.value.trim();if(!txt)return;
  const c=load().find(x=>x.id===_remCaseId);if(!c)return;
  const rem=[...(c.rem||[]),{id:uid_(),txt,done:false,created:new Date().toISOString()}];
  inp.value='';inp.focus();
  await window._saveToCloud({...c,rem,upd:new Date().toISOString()});
  renderRemSheet();
}
async function tickRem(cid,rid){
  const c=load().find(x=>x.id===cid);if(!c)return;
  const rem=(c.rem||[]).map(r=>r.id===rid?{...r,done:!r.done,doneAt:new Date().toISOString()}:r);
  await window._saveToCloud({...c,rem,upd:new Date().toISOString()});
  if(_remCaseId===cid&&document.getElementById('ov-rem').classList.contains('on'))renderRemSheet();
}
function remGroupHTML(g,done){
  return`<div class="card" style="cursor:default${done?';opacity:.72':''}">
    <div class="cn" style="margin-bottom:6px">${esc(g.c.nm)} ${g.c.hn?`<span class="bh bhn">HN ${esc(g.c.hn)}</span>`:''} ${g.c.wd?`<span class="bh bwd">${esc(g.c.wd)}</span>`:''}</div>
    ${g.c.dx?`<div class="cdx" style="margin-bottom:6px">${esc(g.c.dx)}</div>`:''}
    ${g.items.map(r=>`<div class="rem-item"><button class="rem-tick${done?' done':''}" onclick="tickRem('${g.c.id}','${r.id}')">${done?'✓':''}</button><div class="rem-txt${done?' done':''}">${esc(r.txt)}</div></div>`).join('')}
  </div>`;
}
function rRem(){
  const act=load().filter(c=>!c.dc);
  const activeGroups=act.map(c=>({c,items:(c.rem||[]).filter(r=>!r.done)})).filter(g=>g.items.length);
  const doneGroups=act.map(c=>({c,items:(c.rem||[]).filter(r=>r.done)})).filter(g=>g.items.length);
  const doneCount=doneGroups.reduce((n,g)=>n+g.items.length,0);
  let h=`<div style="text-align:center;padding:0 0 8px;display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap">
    <button onclick="remShowDone=!remShowDone;rRem()" style="background:none;border:none;color:var(--a);font-size:13px;font-weight:600;cursor:pointer;padding:4px 14px">Review ${remShowDone?'▲':'▼'}${doneCount?` (${doneCount})`:''}</button>
    ${remShowDone&&doneCount?`<button onclick="confirmClearRemHistory()" style="background:none;border:none;color:var(--t3);font-size:12px;cursor:pointer;padding:4px 10px">🗑 Clear History</button>`:''}
  </div>`;
  if(remShowDone){
    h+=doneCount
      ?`<div class="sh">✔ Completed (${doneCount}) — tap ✓ to restore</div><div class="cards" style="margin-bottom:10px">${doneGroups.map(g=>remGroupHTML(g,true)).join('')}</div>`
      :`<div style="text-align:center;font-size:12px;color:var(--t3);padding:2px 0 12px">No completed reminders</div>`;
  }
  if(!activeGroups.length){
    h+=`<div class="empty"><div class="ei">📝</div><div class="et">No reminders</div><div class="es">Tap 📝 on any case card to add one</div></div>`;
  }else{
    h+=`<div class="sh">📝 Active</div><div class="cards">${activeGroups.map(g=>remGroupHTML(g,false)).join('')}</div>`;
  }
  set('v-rem',h);
}
function confirmClearRemHistory(){
  showConf('🗑','Clear reminder history?','Completed reminders will be permanently deleted from all patients (including discharged ones) to free up storage. This cannot be undone.','Clear History',clearRemHistory);
}
async function clearRemHistory(){
  const withDone=load().filter(c=>(c.rem||[]).some(r=>r.done));
  for(const c of withDone){
    const rem=(c.rem||[]).filter(r=>!r.done);
    await window._saveToCloud({...c,rem,upd:new Date().toISOString()});
  }
  toast('🗑 Reminder history cleared');
  remShowDone=false;
  rRem();
}

/* ═══════════════ PICTURES (📷 — local device only, IndexedDB) ═══════════════ */
let _picDB=null,_picIds=new Set(),_picCaseId=null;
function _picOpen(){return new Promise((res,rej)=>{
  const r=indexedDB.open('rehab_pics',1);
  r.onupgradeneeded=()=>{r.result.createObjectStore('pics')};
  r.onsuccess=()=>res(r.result);
  r.onerror=()=>rej(r.error);
})}
async function picInit(){
  try{
    _picDB=await _picOpen();
    const rq=_picDB.transaction('pics').objectStore('pics').getAllKeys();
    rq.onsuccess=()=>{_picIds=new Set(rq.result||[]);window.render&&window.render()};
  }catch(e){console.warn('Picture storage unavailable',e)}
}
function picGet(id){return new Promise(res=>{
  if(!_picDB)return res(null);
  const rq=_picDB.transaction('pics').objectStore('pics').get(id);
  rq.onsuccess=()=>res(rq.result||null);rq.onerror=()=>res(null);
})}
function picPut(id,data){return new Promise(res=>{
  if(!_picDB)return res(false);
  const rq=_picDB.transaction('pics','readwrite').objectStore('pics').put(data,id);
  rq.onsuccess=()=>{_picIds.add(id);res(true)};rq.onerror=()=>res(false);
})}
function picDel(id){return new Promise(res=>{
  _picIds.delete(id);
  if(!_picDB)return res(false);
  const rq=_picDB.transaction('pics','readwrite').objectStore('pics').delete(id);
  rq.onsuccess=()=>res(true);rq.onerror=()=>res(false);
})}
function picClearAll(){
  _picIds=new Set();
  if(_picDB){try{_picDB.transaction('pics','readwrite').objectStore('pics').clear()}catch(e){}}
}
function compressImage(file){return new Promise((res,rej)=>{
  const img=new Image();
  img.onload=()=>{
    const max=1600;let w=img.naturalWidth,h=img.naturalHeight;
    const sc=Math.min(1,max/Math.max(w,h));w=Math.round(w*sc)||1;h=Math.round(h*sc)||1;
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    cv.getContext('2d').drawImage(img,0,0,w,h);
    URL.revokeObjectURL(img.src);
    res(cv.toDataURL('image/jpeg',.85));
  };
  img.onerror=rej;
  img.src=URL.createObjectURL(file);
})}
async function picClick(id){
  _picCaseId=id;
  if(!_picDB){toast('⚠ Picture storage not available in this browser');return}
  if(_picIds.has(id)){
    const data=await picGet(id);
    if(data){
      document.getElementById('pic-img').src=data;
      const c=load().find(x=>x.id===id);
      document.getElementById('pic-title').textContent='🖼 '+((c&&c.nm)||'Picture');
      open('ov-pic');return;
    }
    _picIds.delete(id);
  }
  const f=document.getElementById('pic-file');f.value='';f.click();
}
function picReplace(){const f=document.getElementById('pic-file');f.value='';f.click()}
function picDelete(){
  showConf('🗑','Remove picture?','The picture will be deleted from this device.','Remove',
    async()=>{await picDel(_picCaseId);cls('ov-pic');toast('🗑 Picture removed');window.render&&window.render()});
}
document.getElementById('pic-file').addEventListener('change',async e=>{
  const file=e.target.files&&e.target.files[0];
  if(!file||!_picCaseId)return;
  try{
    const data=await compressImage(file);
    const ok=await picPut(_picCaseId,data);
    if(!ok){toast('⚠ Could not save picture');return}
    if(document.getElementById('ov-pic').classList.contains('on'))document.getElementById('pic-img').src=data;
    toast('🖼 Picture saved on this device');
    window.render&&window.render();
  }catch(err){toast('⚠ Could not read image');console.error(err)}
});

/* ═══════════════ VISUALIZE (🏥 buildings) ═══════════════ */
const VZ_FH=15; // px per floor
const VZ_SEG_FLOORS=[15,27]; // ภูมิสิริ floor range that is divided into wings A/B/C
// Parses a ward string into {b:'p'|'s'|'o', f:floorNumber, seg:wingLabel|null}.
// Delimiter-agnostic — handles "18c/17-1", "26B 9-1", "21B-4", "สก18ลุม/301", "สก4/405-1", etc.
function wardLoc(wd){
  if(!wd)return{b:'o'};
  const raw=String(wd).trim();
  let m=raw.match(/^สก\.?\s*(\d{1,2})\s*([A-Za-zก-๙]*)/);
  if(m){
    const f=parseInt(m[1],10);
    const seg=(m[2]||'').trim();
    return(f>=1&&f<=20)?{b:'s',f,seg:seg||null}:{b:'o'};
  }
  m=raw.match(/^(\d{1,2})\s*([A-Za-zก-๙]*)/);
  if(m){
    const f=parseInt(m[1],10);
    let seg=(m[2]||'').trim();
    const lm=seg.match(/[A-Za-z]/); // normalize A1/B2/etc → first letter only
    seg=lm?lm[0].toUpperCase():null;
    if(f>=1&&f<=28){
      const useSeg=(f>=VZ_SEG_FLOORS[0]&&f<=VZ_SEG_FLOORS[1])?seg:null;
      return{b:'p',f,seg:useSeg};
    }
  }
  return{b:'o'};
}
function vzGroup(cases,building){
  const g={};
  cases.forEach(c=>{
    const l=wardLoc(c.wd);
    if(l.b!==building)return;
    g[l.f]=g[l.f]||{};
    const key=l.seg||'_';
    (g[l.f][key]=g[l.f][key]||[]).push(c);
  });
  return g;
}
function vzFloorTotal(segs){return segs?Object.values(segs).reduce((n,a)=>n+a.length,0):0}
function vzSimpleFloorHTML(b,f,segs){
  const n=vzFloorTotal(segs);
  return`<div class="vz-fl${n?' has':''}" id="vzf-${b}-${f}" style="height:${VZ_FH}px"${n?` onclick="vzTap('${b}',${f})"`:''}><span class="vz-fn">${f}</span>${n?`<span class="vz-ct">${n}</span>`:''}</div>`;
}
function vzSegFloorHTML(b,f,segs,labels){
  const n=vzFloorTotal(segs);
  const cells=labels.map(lab=>{
    const arr=(segs&&segs[lab.key])||[];const c=arr.length;
    return`<div class="vz-seg${c?' has':''}"${c?` onclick="vzTap('${b}',${f},'${lab.key}')"`:''} title="${esc(lab.title)}"><span class="vz-segl">${esc(lab.short)}</span>${c?`<span class="vz-segn">${c}</span>`:''}</div>`;
  }).join('');
  return`<div class="vz-fl${n?' has':''}" id="vzf-${b}-${f}" style="height:${VZ_FH}px"><span class="vz-fn">${f}</span><div class="vz-segwrap">${cells}</div></div>`;
}
// Mon–Sat of "this coming work week": if today is Sat or Sun, shows next week's Mon–Sat instead of the current one.
function vzWeekDays(){
  const t=new Date(),dow=t.getDay(); // 0=Sun..6=Sat
  const monday=new Date(t);
  if(dow===0)monday.setDate(t.getDate()+1);       // Sunday -> next day is Monday
  else if(dow===6)monday.setDate(t.getDate()+2);  // Saturday -> Monday after next
  else monday.setDate(t.getDate()-(dow-1));       // Mon..Fri -> Monday of this week
  const days=[];
  for(let i=0;i<6;i++){const d=new Date(monday);d.setDate(monday.getDate()+i);days.push(localDateStr(d))}
  return days;
}
function vzSetDayFilter(v){vzDayFilter=v;rViz()}
function vzDayBar(){
  const days=vzWeekDays();
  const wk=['Mon','Tue','Wed','Thu','Fri','Sat'];
  const btn=(val,label,active)=>`<button class="chip${active?' on':''}" onclick="vzSetDayFilter(${val===null?'null':`'${val}'`})">${label}</button>`;
  return`<div class="fw">
    ${btn(null,'Overall',vzDayFilter===null)}
    ${btn('today','Today',vzDayFilter==='today')}
    ${days.map((d,i)=>btn(d,`${wk[i]} ${new Date(d+'T00:00:00').getDate()}`,vzDayFilter===d)).join('')}
  </div>`;
}
function vzFilteredCases(){
  const all=load().filter(c=>!c.dc);
  if(vzDayFilter===null)return all;
  const target=vzDayFilter==='today'?today():vzDayFilter;
  return all.filter(c=>c.fu===target);
}
function rViz(){
  const act=vzFilteredCases();
  const p=vzGroup(act,'p'),sk=vzGroup(act,'s');
  const oth=act.filter(c=>wardLoc(c.wd).b==='o');
  const pN=Object.values(p).reduce((n,segs)=>n+vzFloorTotal(segs),0);
  const sN=Object.values(sk).reduce((n,segs)=>n+vzFloorTotal(segs),0);

  const pFloors=(()=>{let r='';
    for(let f=28;f>=1;f--){
      if(f>=VZ_SEG_FLOORS[0]&&f<=VZ_SEG_FLOORS[1]){
        const labels=['A','B','C'].map(s=>({key:s,short:s,title:'Wing '+s}));
        r+=vzSegFloorHTML('p',f,p[f],labels);
      }else r+=vzSimpleFloorHTML('p',f,p[f]);
    }
    return r;
  })();

  const sFloors=(()=>{let r='';
    for(let f=20;f>=1;f--){
      const segs=sk[f];
      const namedKeys=segs?Object.keys(segs).filter(k=>k!=='_'):[];
      if(namedKeys.length){
        const labels=namedKeys.map(k=>({key:k,short:k.length>2?k.slice(0,2):k,title:k}));
        if(segs['_'])labels.push({key:'_',short:'?',title:'Unspecified wing'});
        r+=vzSegFloorHTML('s',f,segs,labels);
      }else r+=vzSimpleFloorHTML('s',f,segs);
    }
    return r;
  })();

  const h=`
  ${vzDayBar()}
  <div class="sbar">
   <div class="sc"><div class="sn" style="color:var(--a)">${pN}</div><div class="sl">ภูมิสิริ</div></div>
   <div class="sc"><div class="sn" style="color:var(--g)">${sN}</div><div class="sl">สก.</div></div>
   <div class="sc"><div class="sn" style="color:var(--am)">${oth.length}</div><div class="sl">Others</div></div>
  </div>
  <div class="vz-wrap" id="vz-wrap" style="position:relative">
    <svg id="vz-bridge-svg" style="position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none"></svg>
    <div class="vz-b" style="width:36%"><div class="vz-name">ภูมิสิริ</div><div class="vz-body">${pFloors}</div></div>
    <div class="vz-gap" style="width:9%"></div>
    <div class="vz-b" style="width:30%"><div class="vz-name">สก.</div><div class="vz-body">${sFloors}</div></div>
    <div style="width:5%"></div>
    <div class="vz-b" style="width:20%"><div class="vz-name">Others</div><div class="vz-body vz-oth" style="height:${5*VZ_FH}px"${oth.length?` onclick="vzTap('o',0)"`:''}>${oth.length?`<div class="vz-oct">${oth.length}</div>`:`<div style="font-size:9px;color:var(--t3)">–</div>`}</div></div>
  </div>`;
  set('v-viz',h);
  requestAnimationFrame(vzDrawBridge);
}

// Draws an accurate line connecting ภูมิสิริ floor 8 to สก floor 7 by measuring
// the real rendered positions of those two floor rows (not a guessed skew).
function vzDrawBridge(){
  const wrap=document.getElementById('vz-wrap'),svg=document.getElementById('vz-bridge-svg');
  const pFloor=document.getElementById('vzf-p-8'),sFloor=document.getElementById('vzf-s-7');
  if(!wrap||!svg||!pFloor||!sFloor)return;
  const wr=wrap.getBoundingClientRect(),pr=pFloor.getBoundingClientRect(),sr=sFloor.getBoundingClientRect();
  const x1=pr.right-wr.left,y1=pr.top+pr.height/2-wr.top;
  const x2=sr.left-wr.left,y2=sr.top+sr.height/2-wr.top;
  const mx=(x1+x2)/2,my=(y1+y2)/2;
  svg.innerHTML=`
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--bo2)" stroke-width="4" stroke-linecap="round"/>
    <rect x="${mx-11}" y="${my-7}" width="22" height="14" rx="3" fill="var(--s2)" stroke="var(--bo2)" stroke-width="1"/>
    <text x="${mx}" y="${my+3}" font-size="7" font-weight="700" text-anchor="middle" fill="var(--t2)">8↔7</text>`;
}
let _vzResizePending=false;
window.addEventListener('resize',()=>{
  if(_vzResizePending||!document.getElementById('vz-wrap'))return;
  _vzResizePending=true;
  requestAnimationFrame(()=>{vzDrawBridge();_vzResizePending=false});
},{passive:true});
function vzTap(b,f,seg){
  const act=vzFilteredCases();
  const list=act.filter(c=>{
    const l=wardLoc(c.wd);
    if(l.b!==b)return false;
    if(b==='o')return true;
    if(l.f!==f)return false;
    if(seg===undefined)return true;
    return(l.seg||'_')===seg;
  });
  if(!list.length)return;
  const wingTxt=seg&&seg!=='_'?` wing ${seg}`:'';
  const lbl=b==='p'?`ภูมิสิริ ชั้น ${f}${wingTxt}`:b==='s'?`สก. ชั้น ${f}${wingTxt}`:'Others';
  const names=list.map(c=>`${c.nm}${c.wd?' ('+c.wd+')':''}`);
  toast(`${lbl}: ${names.slice(0,3).join(' · ')}${names.length>3?' +'+(names.length-3):''}`);
}

/* ═══════════════ IMPORT (📥 from Google Sheet / Excel / CSV) ═══════════════ */
let impRows=[],impHasHeader=true,impMap=[],impDefaultType='',impSkipDup=true,impStep=1,impWorkbook=null,impSheetNames=[],impPending=[];

const FIELD_OPTS=[['','— Skip —'],['nm','Patient Name'],['hn','HN'],['wd','Ward'],['dx','Diagnosis'],['ty','Category'],['fu','Follow-up Date'],['firstVisit','First Visit (optional)'],['status','Status (IPD→Active, OPD→Discharged+✅, End→Discharged, other→skip)'],['st','VIP (yes/no)'],['nt','Notes']];
const GUESS_KEYS=[['nm',['name','ชื่อ','patient','คนไข้','pt ']],['hn',['hn']],['wd',['ward','ตึก','ห้อง','room','bed','หอ']],['dx',['dx','diag','โรค','วินิจฉัย']],['ty',['type','category','ประเภท']],['fu',['fu','follow','นัด','appointment']],['firstVisit',['first visit','date added','วันที่มา','admit','วันแรก']],['status',['status','สถานะ']],['st',['vip']],['nt',['note','remark','หมายเหตุ']]];
function guessField(header){
  const h=(header||'').toString().toLowerCase();
  for(const[f,keys]of GUESS_KEYS)if(keys.some(k=>h.includes(k)))return f;
  return'';
}
// Full clinical terms that should resolve to an abbreviated category code
const TYPE_ALIASES={'PO':['prosthesis','orthosis','prostheticorthotic'],'ICU':['intensivecareunit','criticalcare'],'PT':['physicaltherapy']};
function matchType(v){
  if(!v)return null;
  const norm=x=>String(x).trim().toLowerCase().replace(/[^a-z0-9ก-๙]/g,'');
  const s=norm(v);if(!s)return null;
  let hit=TYPES.find(t=>norm(t)===s); // exact match, punctuation/whitespace-insensitive ("P.O." === "PO", "Postop" === "Post op")
  if(hit)return hit;
  // alias check — full clinical terms for short abbreviation codes ("Prosthesis" -> "PO"). Length guard avoids short false-positive substrings.
  hit=TYPES.find(t=>(TYPE_ALIASES[t]||[]).some(a=>{const an=norm(a);return an.length>=6&&s.includes(an)}));
  if(hit)return hit;
  // fuzzy fallback only for longer category names AND longer input — avoids short codes/garbage ("PO", "P", "O") false-matching substrings
  // (this is why "PO" never gets confused with "Post op" — PO is only ever matched exactly or via its own alias list)
  hit=TYPES.find(t=>{const tn=norm(t);return tn.length>=4&&s.length>=4&&(s.includes(tn)||tn.includes(s))});
  return hit||null;
}
function isTruthy(v){return/^(y|yes|true|1|vip|✓|✔|x|จริง|ใช่)$/i.test(String(v||'').trim())}
// Status column interpretation, when mapped: IPD -> active inpatient case.
// End -> discharged, no further OPD follow-up. OPD -> discharged AND flagged with an ongoing OPD follow-up (✅ marked, shows in the OPD tab).
// Anything else (blank, unrecognized) -> row is skipped, not imported.
function isDischargedStatus(v){
  return/^(end|dc|discharge|discharged|closed|complete|completed|จำหน่าย|เสร็จ|จบ)/i.test(String(v||'').trim());
}
function isActiveStatus(v){
  return/^(ipd|active|admit|admitted|inpatient)/i.test(String(v||'').trim());
}
function isOpdStatus(v){
  return/^(opd|outpatient|out\s*patient|ผู้ป่วยนอก)/i.test(String(v||'').trim());
}
function impIso(y,m,d){if(!y||m<1||m>12||d<1||d>31)return'';const pad=x=>String(x).padStart(2,'0');return`${y}-${pad(m)}-${pad(d)}`}
function parseDateFlexible(v){
  if(v==null||v==='')return'';
  if(v instanceof Date&&!isNaN(v)||Object.prototype.toString.call(v)==='[object Date]'&&!isNaN(v))return localDateStr(v);
  const s=String(v).trim();let m;
  if(m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)){let y=+m[1],mo=+m[2],d=+m[3];if(y>2400)y-=543;return impIso(y,mo,d)}
  if(m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)){let d=+m[1],mo=+m[2],y=+m[3];if(y<100)y+=2000;if(y>2400)y-=543;return impIso(y,mo,d)}
  return'';
}
function parseCSV(text){
  const rows=[];let row=[],cur='',inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(inQ){
      if(c==='"'&&n==='"'){cur+='"';i++}
      else if(c==='"')inQ=false;
      else cur+=c;
    }else{
      if(c==='"')inQ=true;
      else if(c===','){row.push(cur);cur=''}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&n==='\n')i++;row.push(cur);cur='';if(row.some(x=>x.trim()!==''))rows.push(row);row=[]}
      else cur+=c;
    }
  }
  if(cur!==''||row.length){row.push(cur);if(row.some(x=>x.trim()!==''))rows.push(row)}
  return rows;
}
function parsePaste(text){
  const lines=text.split(/\r\n|\n|\r/).filter(l=>l.trim()!=='');
  const rows=lines.map(l=>l.split('\t'));
  if(rows.some(r=>r.length>1))return rows;
  return parseCSV(text); // fallback: pasted text looks comma-separated (CSV), not tab-separated
}
function loadXLSXLib(){
  if(window.XLSX)return Promise.resolve();
  return new Promise((res,rej)=>{
    const el=document.createElement('script');
    el.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    el.onload=()=>res();el.onerror=()=>rej(new Error('Failed to load Excel parser'));
    document.head.appendChild(el);
  });
}

function openImport(){
  impRows=[];impHasHeader=true;impMap=[];impDefaultType='';impSkipDup=true;impStep=1;impWorkbook=null;impSheetNames=[];impPending=[];
  renderImportStep();open('ov-import');
}
function renderImportStep(){
  if(impStep===1)renderImportSource();
  else if(impStep===2)renderImportMap();
  else renderImportPreview();
}

function renderImportSource(){
  set('imp-body',`
   <div style="font-size:12px;color:var(--t3);margin-bottom:10px">Paste rows copied from Google Sheets or Excel, or upload a file. Cell formatting (dropdowns, colors) doesn't matter — only the text is imported.</div>
   <textarea class="fta" id="imp-paste" placeholder="Paste here (Ctrl+V / Cmd+V)... select your rows in the sheet first, including the header row if you have one" style="min-height:130px;font-family:ui-monospace,monospace;font-size:12px"></textarea>
   <div style="display:flex;align-items:center;gap:8px;margin:12px 0;color:var(--t3);font-size:12px"><div style="flex:1;height:1px;background:var(--bo)"></div>or<div style="flex:1;height:1px;background:var(--bo)"></div></div>
   <button class="expbtn" style="width:100%;justify-content:center;box-sizing:border-box;margin-bottom:6px" onclick="document.getElementById('imp-file').click()">📁 Upload CSV / Excel file</button>
   <input type="file" id="imp-file" accept=".csv,.xlsx,.xls" style="display:none" onchange="handleImportFile(event)">
   <div id="imp-file-name" style="font-size:11px;color:var(--t3);text-align:center;min-height:16px"></div>
   <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);margin:12px 0"><input type="checkbox" id="imp-header-chk" class="set-chk" checked> First row is column headers</label>
   <button class="sbmt" onclick="importGoToMap()">Next: Map Columns →</button>
  `);
}
async function handleImportFile(e){
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const nameEl=document.getElementById('imp-file-name');
  nameEl.textContent='Reading '+f.name+'...';
  const ext=f.name.split('.').pop().toLowerCase();
  try{
    if(ext==='csv'){
      impRows=parseCSV(await f.text());
      nameEl.textContent=`✅ Loaded ${f.name} (${impRows.length} rows)`;
    }else{
      await loadXLSXLib();
      const buf=await f.arrayBuffer();
      const wb=XLSX.read(buf,{type:'array',cellDates:true});
      impWorkbook=wb;
      if(wb.SheetNames.length>1){impSheetNames=wb.SheetNames;renderImportSheetPicker(f.name);return}
      impRows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''});
      nameEl.textContent=`✅ Loaded ${f.name} (${impRows.length} rows)`;
    }
    const pa=document.getElementById('imp-paste');if(pa)pa.value='';
  }catch(err){nameEl.textContent='⚠ Could not read file';console.error(err)}
}
function renderImportSheetPicker(fname){
  const nameEl=document.getElementById('imp-file-name');
  nameEl.innerHTML=`Loaded ${esc(fname)} — sheet: <select onchange="pickImportSheet(this.value)" style="font-size:11px">${impSheetNames.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>`;
  pickImportSheet(impSheetNames[0]);
}
function pickImportSheet(name){
  impRows=XLSX.utils.sheet_to_json(impWorkbook.Sheets[name],{header:1,raw:true,defval:''});
  const pa=document.getElementById('imp-paste');if(pa)pa.value='';
}
function importGoToMap(){
  impHasHeader=document.getElementById('imp-header-chk').checked;
  if(!impRows.length){
    const txt=document.getElementById('imp-paste').value;
    if(!txt.trim())return toast('⚠ Paste some rows or upload a file');
    impRows=parsePaste(txt);
  }
  if(!impRows.length)return toast('⚠ No rows detected');
  impMap=[];impStep=2;renderImportStep();
}
function renderImportMap(){
  const headerRow=impHasHeader?impRows[0]:null;
  const dataStart=impHasHeader?1:0;
  const sample=impRows[dataStart]||[];
  const colCount=Math.max(0,...impRows.map(r=>r.length));
  if(!impMap.length)impMap=Array.from({length:colCount},(_,i)=>guessField(headerRow?headerRow[i]:''));
  let h=`<div style="font-size:12px;color:var(--t3);margin-bottom:10px">${impRows.length-dataStart} data row(s) detected. Match each column to a field:</div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">`;
  for(let i=0;i<colCount;i++){
    const label=headerRow?(headerRow[i]||'Column '+(i+1)):'Column '+(i+1);
    const ex=sample[i]!==undefined&&sample[i]!==''?String(sample[i]).slice(0,26):'–';
    h+=`<div style="background:var(--s2);border-radius:10px;padding:9px 11px">
      <div style="font-size:12px;font-weight:600;margin-bottom:2px">${esc(String(label))}</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:6px">e.g. "${esc(ex)}"</div>
      <select class="fsl" style="padding:7px 9px;font-size:13px" onchange="impMap[${i}]=this.value">
        ${FIELD_OPTS.map(([v,l])=>`<option value="${v}" ${impMap[i]===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>`;
  }
  h+=`</div>
  <div class="fg"><label class="fl">Default category (for rows with no / unmatched category)</label>
   <select class="fsl" id="imp-def-type">${TYPES.map(t=>`<option ${(impDefaultType||TYPES[0])===t?'selected':''}>${t}</option>`).join('')}</select>
  </div>
  <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--t2);margin:12px 0"><input type="checkbox" id="imp-skipdup-chk" class="set-chk" ${impSkipDup?'checked':''}> Skip rows that match an existing case (by name)</label>
  <div style="display:flex;gap:8px">
   <button class="ab agr" style="flex:1" onclick="impStep=1;renderImportStep()">← Back</button>
   <button class="sbmt" style="flex:2;margin-top:0" onclick="importGoToPreview()">Preview →</button>
  </div>`;
  set('imp-body',h);
}
function importGoToPreview(){
  impDefaultType=document.getElementById('imp-def-type').value;
  impSkipDup=document.getElementById('imp-skipdup-chk').checked;
  if(impMap.indexOf('nm')===-1)return toast('⚠ Map at least the Patient Name column');
  impStep=3;renderImportStep();
}
function buildImportCases(){
  const dataStart=impHasHeader?1:0;
  const existingNames=new Set(load().map(c=>(c.nm||'').trim().toLowerCase()).filter(Boolean));
  const idx=f=>impMap.indexOf(f);
  const nameIdx=idx('nm'),hnIdx=idx('hn'),wdIdx=idx('wd'),dxIdx=idx('dx'),tyIdx=idx('ty'),fuIdx=idx('fu'),fvIdx=idx('firstVisit'),stIdx=idx('st'),ntIdx=idx('nt'),statusIdx=idx('status');
  const out=[];let skippedNoName=0,skippedDup=0,skippedStatus=0;
  for(let r=dataStart;r<impRows.length;r++){
    const row=impRows[r];if(!row||!row.some(x=>String(x||'').trim()!==''))continue;
    const nm=nameIdx>=0?String(row[nameIdx]||'').trim():'';
    if(!nm){skippedNoName++;continue}
    if(impSkipDup&&existingNames.has(nm.toLowerCase())){skippedDup++;continue}
    let dcFlag=false,opdFlag=false;
    if(statusIdx>=0){
      const rawStatus=row[statusIdx];
      const discharged=isDischargedStatus(rawStatus),active=isActiveStatus(rawStatus),opdStat=isOpdStatus(rawStatus);
      if(!discharged&&!active&&!opdStat){skippedStatus++;continue} // blank / unrecognized — not imported
      dcFlag=discharged||opdStat; // both End and OPD mean the patient is discharged
      opdFlag=opdStat; // OPD additionally marks the ✅ ongoing-follow-up flag
    }
    const ty=(tyIdx>=0?matchType(row[tyIdx]):null)||impDefaultType||TYPES[0];
    const fu=fuIdx>=0?parseDateFlexible(row[fuIdx]):'';
    const fv=fvIdx>=0?(parseDateFlexible(row[fvIdx])||fu||today()):(fu||today());
    out.push({
      id:uid_(),nm,
      hn:hnIdx>=0?String(row[hnIdx]||'').trim():'',
      wd:wdIdx>=0?String(row[wdIdx]||'').trim():'',
      dx:dxIdx>=0?String(row[dxIdx]||'').trim():'',
      ty,fu,nt:ntIdx>=0?String(row[ntIdx]||'').trim():'',
      firstVisit:fv,st:stIdx>=0?isTruthy(row[stIdx]):false,
      dc:dcFlag,dcDate:dcFlag?(fu||today()):null,opd:opdFlag,
      created:new Date().toISOString(),upd:new Date().toISOString()
    });
  }
  return{out,skippedNoName,skippedDup,skippedStatus};
}
function renderImportPreview(){
  const{out,skippedNoName,skippedDup,skippedStatus}=buildImportCases();
  impPending=out;
  const dcCount=out.filter(c=>c.dc).length,opdCount=out.filter(c=>c.opd).length;
  let h=`<div style="font-size:13px;margin-bottom:8px">Ready to import <b>${out.length}</b> case(s)${dcCount?` — <span style="color:var(--t3)">${dcCount} discharged${opdCount?` (${opdCount} with ✅ OPD follow-up)`:''}</span>`:''}.</div>`;
  if(skippedNoName)h+=`<div style="font-size:12px;color:var(--t3);margin-bottom:3px">⚠ ${skippedNoName} row(s) skipped — no name</div>`;
  if(skippedDup)h+=`<div style="font-size:12px;color:var(--t3);margin-bottom:3px">⚠ ${skippedDup} row(s) skipped — name already exists</div>`;
  if(skippedStatus)h+=`<div style="font-size:12px;color:var(--t3);margin-bottom:8px">⚠ ${skippedStatus} row(s) skipped — status wasn't IPD, OPD, or End</div>`;
  if(out.length){
    h+=`<div style="overflow-x:auto;margin-bottom:12px"><table class="stbl" style="min-width:520px"><thead><tr><th>Name</th><th>HN</th><th>Ward</th><th>Category</th><th>F/U</th><th>Status</th></tr></thead><tbody>`;
    out.slice(0,8).forEach(c=>{h+=`<tr><td>${esc(c.nm)}</td><td>${esc(c.hn)}</td><td>${esc(c.wd)}</td><td>${esc(c.ty)}</td><td>${c.fu?fd(c.fu):'–'}</td><td>${c.opd?'🏠 DC · ✅ OPD':c.dc?'🏠 DC':'Active'}</td></tr>`});
    h+=`</tbody></table></div>`;
    if(out.length>8)h+=`<div style="font-size:11px;color:var(--t3);margin-bottom:10px">…and ${out.length-8} more</div>`;
  }
  h+=`<div style="display:flex;gap:8px">
    <button class="ab agr" style="flex:1" onclick="impStep=2;renderImportStep()">← Back</button>
    <button class="sbmt" style="flex:2;margin-top:0" ${out.length?'':'disabled'} onclick="runImport()">✅ Import ${out.length} Case(s)</button>
  </div>`;
  set('imp-body',h);
}
async function runImport(){
  if(!impPending||!impPending.length)return;
  const btn=document.querySelector('#imp-body .sbmt');if(btn){btn.disabled=true;btn.textContent='Importing...'}
  for(const c of impPending)await window._saveToCloud(c);
  cls('ov-import');
  toast(`✅ Imported ${impPending.length} case(s)`);
  go('done');
}

/* ═══════════════ PULL TO REFRESH ═══════════════ */
(function initPullToRefresh(){
  let startY=0,pulling=false,armed=false;
  const content=document.getElementById('content');
  const ind=document.getElementById('pull-refresh');
  if(!content||!ind)return;
  content.addEventListener('touchstart',e=>{
    if(window.scrollY<=0&&!document.querySelector('.ov-wrap.on')){startY=e.touches[0].clientY;pulling=true;armed=false}
  },{passive:true});
  content.addEventListener('touchmove',e=>{
    if(!pulling)return;
    const dy=e.touches[0].clientY-startY;
    armed=dy>70;
    ind.classList.toggle('on',dy>35);
    ind.textContent=armed?'↻ Release to refresh':'↓ Pull to refresh';
  },{passive:true});
  content.addEventListener('touchend',()=>{
    if(!pulling)return;
    const run=armed;pulling=false;armed=false;ind.classList.remove('on');
    if(run)refreshFromCloud();
  },{passive:true});
})();

/* ═══════════════ INIT new features ═══════════════ */
enhanceDates(document);
applyTabPrefs();
picInit();

/* ── Battery optimizations ── */

// 1. Pause video + flush queue when backgrounded, re-fetch on foreground
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    clearTimeout(_syncTimer);
    document.querySelectorAll('video.granny').forEach(v=>{try{v.pause()}catch(e){}});
  } else {
    document.querySelectorAll('video.granny').forEach(v=>{try{v.play()}catch(e){}});
    if(_uid&&navigator.onLine)refreshFromCloud({toast:false});
  }
});

// 2. Pause video when it scrolls off screen, resume when visible.
// (No longer uses a whole-document MutationObserver — that fired on every single DOM mutation
// across the whole app, which is expensive given how often views get rebuilt via innerHTML.
// The header video is static and observed once here; the empty-state video in Today is observed
// right where it's created, in rToday().)
const _iObs=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.target.tagName==='VIDEO'){
      if(e.isIntersecting){try{e.target.play()}catch(x){}}
      else{try{e.target.pause()}catch(x){}}
    }
  });
},{threshold:0.1});
window._iObs=_iObs;
document.querySelectorAll('video.granny').forEach(v=>_iObs.observe(v));

// 3. Throttle render to one per animation frame — prevents redundant repaints
const _rawRender=window.render;
let _rPending=false;
window.render=()=>{
  if(_rPending)return;
  _rPending=true;
  requestAnimationFrame(()=>{_rawRender&&_rawRender();_rPending=false});
};
