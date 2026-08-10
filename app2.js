/* ===== DETAIL ===== */
function openDet(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  document.getElementById('det-name').textContent=c.nm||'–';
  const fus=c.dc?`<span style="color:var(--t3)">DC ${fd(c.dcDate)}</span>`:c.fu?fd(c.fu):'–';
  document.getElementById('det-body').innerHTML=`
  <div class="dsec"><div class="dgrid">
    <div><div class="dl">HN</div><div class="dv">${c.hn||'–'}</div></div>
    <div><div class="dl">Ward</div><div class="dv">${c.wd||'–'}</div></div>
    <div><div class="dl">Category</div><div class="dv"><span class="bh btp ${TC[c.ty]||''}">${c.ty||'–'}</span></div></div>
    <div><div class="dl">Follow-up</div><div class="dv">${fus}</div></div>
    <div><div class="dl">First Visit 📊</div><div class="dv">${fd(c.firstVisit||c.created?.split('T')[0])}</div></div>
  </div></div>
  ${c.dx?`<div class="dsec"><div class="dl">Diagnosis</div><div class="dv" style="margin-top:3px">${c.dx}</div></div>`:''}
  ${c.nt?`<div class="dsec"><div class="dl">Notes</div><div class="dnotes">${c.nt}</div></div>`:''}
  <div class="dsec" style="border:none"><div class="dl">Added</div><div class="dv" style="font-size:12px;color:var(--t3)">${c.created?new Date(c.created).toLocaleString('th-TH'):'–'}</div></div>
  <div class="dacts">
    <button class="ab ap" onclick="cls('ov-det');setTimeout(()=>openFU('${c.id}'),180)">📅 Set Follow-up Date</button>
    <button class="ab aw" onclick="openEdit('${c.id}')">✏️ Edit Case</button>
    <button class="ab agr" onclick="starFromDet('${c.id}')">${c.st?'☆ Remove VIP':'⭐ Mark as VIP'}</button>
    ${c.dc?`<button class="ab ag" onclick="undc('${c.id}');cls('ov-det')">↩ Reactivate</button>`:`<button class="ab" style="background:rgba(255,107,107,.15);color:var(--r)" onclick="dc('${c.id}');cls('ov-det')">🏠 Discharge</button>`}
    <button class="ab ard" onclick="del('${c.id}')">🗑 Delete Case</button>
  </div>`;
  open('ov-det');
}

let _formVip=false,_formOpd=false;

function toggleFormVip(){
  _formVip=!_formVip;
  const btn=document.getElementById('f-vip-btn');
  if(_formVip){btn.style.background='rgba(245,166,35,.15)';btn.style.borderColor='var(--am)';btn.style.color='var(--am)';btn.innerHTML='<span>★</span><span>VIP</span>'}
  else{btn.style.background='var(--s2)';btn.style.borderColor='var(--bo)';btn.style.color='var(--t2)';btn.innerHTML='<span>☆</span><span>VIP</span>'}
}

function toggleFormOpd(){
  _formOpd=!_formOpd;
  const btn=document.getElementById('f-opd-btn');
  if(_formOpd){btn.style.background='rgba(62,207,142,.15)';btn.style.borderColor='var(--g)';btn.style.color='var(--g)';btn.innerHTML='<span>✅</span><span>OPD set</span>'}
  else{btn.style.background='var(--s2)';btn.style.borderColor='var(--bo)';btn.style.color='var(--t2)';btn.innerHTML='<span style="filter:grayscale(1) opacity(.4)">✅</span><span>OPD set</span>'}
}

function setFormFlags(vip,opd){
  _formVip=false;_formOpd=false;
  // Reset both first then apply
  const vb=document.getElementById('f-vip-btn');
  const ob=document.getElementById('f-opd-btn');
  if(vb){vb.style.background='var(--s2)';vb.style.borderColor='var(--bo)';vb.style.color='var(--t2)';vb.innerHTML='<span>☆</span><span>VIP</span>'}
  if(ob){ob.style.background='var(--s2)';ob.style.borderColor='var(--bo)';ob.style.color='var(--t2)';ob.innerHTML='<span style="filter:grayscale(1) opacity(.4)">✅</span><span>OPD set</span>'}
  if(vip)toggleFormVip();
  if(opd)toggleFormOpd();
}
function openAdd(){
  document.getElementById('eid').value='';
  document.getElementById('ft-title').textContent='New Consult';
  ['fn','fhn','fwd','fdx','fnt'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('fty').value='';document.getElementById('ffu').value='';
  document.getElementById('fvisit').value=today();
  document.getElementById('fvisit-wrap').style.display='';
  setFormFlags(false,false);
  open('ov-add');
}
function openEdit(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  document.getElementById('eid').value=id;
  document.getElementById('ft-title').textContent='Edit Consult';
  document.getElementById('fn').value=c.nm||'';document.getElementById('fhn').value=c.hn||'';
  document.getElementById('fwd').value=c.wd||'';document.getElementById('fdx').value=c.dx||'';
  document.getElementById('fty').value=c.ty||'';document.getElementById('ffu').value=c.fu||'';
  document.getElementById('fnt').value=c.nt||'';
  document.getElementById('fvisit').value=c.firstVisit||c.created?.split('T')[0]||today();
  document.getElementById('fvisit-wrap').style.display='';
  setFormFlags(c.st||false,c.opd||false);
  cls('ov-det');setTimeout(()=>open('ov-add'),180);
}
async function saveCase(){
  const nm=document.getElementById('fn').value.trim(),ty=document.getElementById('fty').value;
  if(!nm)return toast('⚠ Enter patient name');
  if(!ty)return toast('⚠ Select a category');
  const id=document.getElementById('eid').value||uid_();
  const existing=load().find(x=>x.id===id)||{};
  const data={
    id,nm,ty,
    hn:document.getElementById('fhn').value.trim(),
    wd:document.getElementById('fwd').value.trim(),
    dx:document.getElementById('fdx').value.trim(),
    fu:document.getElementById('ffu').value,
    nt:document.getElementById('fnt').value.trim(),
    // Preserve firstVisit — only set on new case, editable but not overwritten by follow-up
    firstVisit:document.getElementById('fvisit').value||existing.firstVisit||today(),
    st:_formVip,
    dc:existing.dc||false,
    dcDate:existing.dcDate||null,
    opd:_formOpd,
    created:existing.created||new Date().toISOString(),
    upd:new Date().toISOString()
  };
  cls('ov-add');
  await window._saveToCloud(data);
  toast(existing.created?'✅ Updated':'✅ Case added');
}

/* ===== FU ===== */
function openFU(id,optional){
  fuId=id;const c=load().find(x=>x.id===id);
  document.getElementById('fuinp').value=c?.fu||'';
  document.getElementById('fu-title').textContent=optional?'Set OPD Follow-up Date':'Set Follow-up Date';
  document.getElementById('fu-sub').textContent=optional?'Optional — you can skip this and set it later.':'';
  document.getElementById('fu-skip-btn').style.display=optional?'':'none';
  open('ov-fu');
}
async function saveFU(){
  if(!fuId)return;
  const c=load().find(x=>x.id===fuId);if(!c)return;
  const updated={...c,fu:document.getElementById('fuinp').value,upd:new Date().toISOString()};
  cls('ov-fu');
  await window._saveToCloud(updated);
  toast('📅 Follow-up updated');
}
function qd(n,id){const el=document.getElementById(id);const base=el.value?new Date(el.value+'T00:00:00'):new Date();base.setDate(base.getDate()+n);el.value=localDateStr(base);refreshDateOverlays()}
function qdToday(id){document.getElementById(id).value=localDateStr(new Date());refreshDateOverlays()}

/* ===== ACTIONS ===== */
async function starFromDet(id){
  await star(id);
  // Update just the star button text in open detail without full re-render
  const c=load().find(x=>x.id===id);
  const btn=document.querySelector('#det-body .ab.agr');
  if(btn&&c)btn.textContent=c.st?'☆ Remove VIP':'⭐ Mark as VIP';
}
async function star(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  await window._saveToCloud({...c,st:!c.st,upd:new Date().toISOString()});
  toast(c.st?'☆ Removed from VIP':'⭐ Marked VIP');
}
function keepPicsOnDischarge(){return localStorage.getItem('rehab_keep_pics_on_dc')==='true'}
function setKeepPicsOnDischarge(v){localStorage.setItem('rehab_keep_pics_on_dc',v?'true':'false')}
function picWarnShown(){return localStorage.getItem('rehab_pic_warn_shown')==='1'}
async function dc(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  if(_picIds.has(id)&&!keepPicsOnDischarge()&&!picWarnShown()){
    localStorage.setItem('rehab_pic_warn_shown','1'); // shown once ever per account, regardless of outcome
    showConf('📷','Photo will be deleted','This patient has a photo attached. To save device storage, photos are automatically deleted when a patient is discharged. You can turn this off anytime in ⚙️ Settings → "Do not delete photos when discharge".',
      'Discharge & Delete Photo',()=>_doDischarge(id));
    return;
  }
  await _doDischarge(id);
}
async function _doDischarge(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  await window._saveToCloud({...c,dc:true,dcDate:today(),upd:new Date().toISOString()});
  if(_picIds.has(id)){
    if(keepPicsOnDischarge())toast('🏠 Discharged — photo kept');
    else{await picDel(id);toast('🏠 Discharged — picture removed')}
  }else toast('🏠 Discharged');
}
async function undc(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  await window._saveToCloud({...c,dc:false,dcDate:null,upd:new Date().toISOString()});
  toast('↩ Reactivated');
}
function del(id){
  showConf('🗑','Delete case?','This case will be permanently deleted.',
    'Delete',async()=>{cls('ov-det');if(_picIds.has(id))await picDel(id);await window._deleteFromCloud(id);toast('🗑 Deleted')});
}
async function toggleOpd(id){
  const c=load().find(x=>x.id===id);if(!c)return;
  const turningOn=!c.opd;
  await window._saveToCloud({...c,opd:turningOn,upd:new Date().toISOString()});
  toast(turningOn?'✅ OPD appt set':'OPD appt cleared');
  if(turningOn)setTimeout(()=>openFU(id,true),250); // optional — set/confirm the OPD follow-up date
}
let _grannyTimer=null;
function grannyTurbo(){
  document.querySelectorAll('.granny').forEach(g=>{
    if(g.tagName==='VIDEO'){g.playbackRate=3}
    else g.classList.add('turbo');
  });
  clearTimeout(_grannyTimer);
  _grannyTimer=setTimeout(()=>document.querySelectorAll('.granny').forEach(g=>{
    if(g.tagName==='VIDEO'){g.playbackRate=1}
    else g.classList.remove('turbo');
  }),3000);
}
function confirmClearAll(){
  showConf('⚠️','Delete ALL data?','Every patient record will be permanently erased from your account. This cannot be undone.',
    'Delete All',async()=>{picClearAll();await window._clearAllFromCloud();toast('🗑 All data cleared')});
}

/* ===== CONFIRM ===== */
let confCb=null;
function showConf(icon,title,msg,okLabel,cb){
  confCb=cb;
  document.getElementById('conf-icon').textContent=icon;
  document.getElementById('conf-title').textContent=title;
  document.getElementById('conf-msg').textContent=msg;
  document.getElementById('conf-ok-btn').textContent=okLabel;
  document.getElementById('conf-wrap').classList.add('on');
}
function confOk(){document.getElementById('conf-wrap').classList.remove('on');if(confCb)confCb();confCb=null}
function confCancel(){document.getElementById('conf-wrap').classList.remove('on');confCb=null}
window.showConf=showConf;

/* ===== EXPORT ===== */
function expCSV(){
  const hdr=['Name','HN','Ward','Dx','Type','FU Date','DC Date','Notes','Created'];
  const rows=load().map(c=>[c.nm,c.hn,c.wd,c.dx,c.ty,c.fu,c.dcDate,c.nt,(c.created||'').split('T')[0]].map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(','));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['\uFEFF'+[hdr.join(','),...rows].join('\n')],{type:'text/csv;charset=utf-8'}));
  a.download=`rehab_${today()}.csv`;a.click();toast('⬇ CSV exported');
}

async function exportCasesExcel(){
  const cases=load();
  if(!cases.length){toast('⚠ No cases to export');return}
  try{
    await loadXLSXLib();
    const headers=['Patient Name','HN','Ward','Diagnosis','Category','Follow-up Date','First Visit','Status','VIP','Notes','Created','Updated'];
    const rows=cases.map(c=>[
      c.nm||'',c.hn||'',c.wd||'',c.dx||'',c.ty||'',c.fu||'',c.firstVisit||(c.created||'').split('T')[0]||'',
      c.opd?'OPD':(c.dc?'End':'IPD'),c.st?'Yes':'No',c.nt||'',(c.created||'').split('T')[0]||'',(c.upd||'').split('T')[0]||''
    ]);
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet([headers,...rows]);
    ws['!cols']=[{wch:24},{wch:12},{wch:14},{wch:28},{wch:14},{wch:14},{wch:14},{wch:10},{wch:8},{wch:36},{wch:12},{wch:12}];
    XLSX.utils.book_append_sheet(wb,ws,'Cases');
    XLSX.writeFile(wb,`rehab_cases_export_${today()}.xlsx`);
    toast('📤 Excel exported — import it in the new account');
  }catch(e){
    console.error(e);
    toast('⚠ Excel export failed');
  }
}

/* ===== UTILS ===== */
function set(id,h){const e=document.getElementById(id);if(e){e.innerHTML=h;enhanceDates(e);refreshDateOverlays()}}
function open(id){const e=document.getElementById(id);e.classList.add('on');enhanceDates(e);refreshDateOverlays()}
function cls(id){
  const el=document.getElementById(id);if(!el)return;
  // Blur focused input so keyboard dismisses cleanly
  const focused=el.querySelector('input:focus,textarea:focus,select:focus');
  if(focused)focused.blur();
  el.classList.remove('on');
  // After keyboard closes iOS shifts viewport — reset scroll to fix touch offset
  setTimeout(()=>{window.scrollTo(0,0);document.body.scrollTop=0},350);
}
function bkd(e,id){if(e.target===document.getElementById(id))cls(id)}

// Fix iOS visualViewport shift when keyboard opens/closes
if(window.visualViewport){
  let _lastVH=window.visualViewport.height;
  window.visualViewport.addEventListener('resize',()=>{
    const newVH=window.visualViewport.height;
    // Keyboard just closed (viewport got taller)
    if(newVH>_lastVH&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){
      setTimeout(()=>{window.scrollTo(0,0);document.body.scrollTop=0},100);
    }
    _lastVH=newVH;
  });
}
let toastTimer=null;
function toast(m){const e=document.getElementById('toast');e.textContent=m;e.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('on'),2200)}
window.toast=toast;

window._cases=[];

// ── ADMIN PANEL ──
let _adminTaps=0,_adminTapTimer=null;

function adminTap(){
  _adminTaps++;
  clearTimeout(_adminTapTimer);
  _adminTapTimer=setTimeout(()=>_adminTaps=0,1500);
  if(_adminTaps>=5){
    _adminTaps=0;
    document.getElementById('admin-pw').value='';
    document.getElementById('admin-err').textContent='';
    open('ov-adminlogin');
  }
}

async function adminLogin(){
  const pw=document.getElementById('admin-pw').value;
  if(!pw){document.getElementById('admin-err').textContent='Enter password';return}
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('admin::rehab::'+pw));
  const hash=Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,12);
  const stored=localStorage.getItem('rehab_admin_hash');
  if(!stored){
    localStorage.setItem('rehab_admin_hash',hash);
    cls('ov-adminlogin');openAdmin();return;
  }
  if(hash!==stored){document.getElementById('admin-err').textContent='Incorrect password';return}
  cls('ov-adminlogin');openAdmin();
}

async function openAdmin(){
  open('ov-admin');
  const body=document.getElementById('admin-body');
  body.innerHTML=`<div style="font-size:12px;color:var(--t3);text-align:center">Loading data...</div>`;
  try{
    const accSnap=await db.collection('accounts').get();
    const accounts=accSnap.docs.map(d=>({username:d.id,...d.data()}));
    const now=new Date();
    const sixMonthsAgo=new Date(now);sixMonthsAgo.setMonth(sixMonthsAgo.getMonth()-6);
    let totalCases=0;
    const stats=await Promise.all(accounts.map(async acc=>{
      const cs=await db.collection('users').doc(acc.uid).collection('cases').get();
      totalCases+=cs.size;
      let last=acc.created?new Date(acc.created):new Date(0);
      cs.docs.forEach(c=>{const u=c.data().upd||c.data().created;if(u&&new Date(u)>last)last=new Date(u)});
      return{...acc,caseCount:cs.size,lastActive:last,inactive:last<sixMonthsAgo};
    }));
    stats.sort((a,b)=>a.lastActive-b.lastActive);
    const inactive=stats.filter(a=>a.inactive);
    const active=stats.filter(a=>!a.inactive);
    const usedDocs=totalCases+accounts.length;
    const usedPct=((usedDocs/1000000)*100).toFixed(3);
    const estMB=(usedDocs*0.0005).toFixed(3);

    let h=`<div style="background:var(--s2);border-radius:10px;padding:12px 14px">
      <div style="font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px">☁️ Firestore Usage</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--a)">${accounts.length}</div><div style="font-size:10px;color:var(--t3)">Accounts</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--g)">${totalCases}</div><div style="font-size:10px;color:var(--t3)">Total Cases</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--am)">${usedDocs.toLocaleString()}</div><div style="font-size:10px;color:var(--t3)">Documents</div></div>
        <div style="text-align:center"><div style="font-size:22px;font-weight:700;color:var(--t2)">${estMB} MB</div><div style="font-size:10px;color:var(--t3)">Est. Storage</div></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-bottom:4px"><span>Doc usage</span><span>${usedPct}% of 1M free</span></div>
      <div style="background:var(--bg);border-radius:4px;height:6px;overflow:hidden">
        <div style="background:${parseFloat(usedPct)>80?'var(--r)':parseFloat(usedPct)>50?'var(--am)':'var(--g)'};height:100%;width:${Math.min(parseFloat(usedPct)*100,100)}%;border-radius:4px"></div>
      </div>
      <div style="font-size:10px;color:var(--t3);margin-top:6px">Limits: 1M docs · 1GB storage · 50K reads/day · 20K writes/day</div>
    </div>`;

    if(inactive.length){
      h+=`<div style="background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.2);border-radius:10px;padding:12px 14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:12px;font-weight:700;color:var(--r)">⚠️ Inactive 6+ months (${inactive.length})</div>
          <button onclick="adminDeleteInactive()" style="padding:5px 11px;background:var(--r);border:none;border-radius:7px;color:#fff;font-size:11px;font-weight:700;cursor:pointer;font-family:-apple-system,sans-serif">Delete All</button>
        </div>`;
      inactive.forEach(a=>{
        const mo=Math.floor((now-a.lastActive)/(1000*60*60*24*30));
        h+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bo)">
          <div><div style="font-size:13px;font-weight:600">${a.username}</div><div style="font-size:11px;color:var(--t3)">${a.caseCount} cases · ${mo}mo inactive</div></div>
          <button onclick="adminDeleteOne('${a.username}','${a.uid}')" style="padding:4px 9px;background:rgba(255,107,107,.15);border:none;border-radius:6px;color:var(--r);font-size:11px;font-weight:600;cursor:pointer;font-family:-apple-system,sans-serif">Delete</button>
        </div>`;
      });
      h+=`</div>`;
    } else {
      h+=`<div style="background:rgba(62,207,142,.08);border:1px solid rgba(62,207,142,.2);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--g)">✅ No inactive accounts</div>`;
    }

    h+=`<div style="background:var(--s2);border-radius:10px;padding:12px 14px">
      <div style="font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">👥 Active Accounts (${active.length})</div>`;
    active.forEach(a=>{
      const d=Math.floor((now-a.lastActive)/86400000);
      const ls=d===0?'Today':d===1?'Yesterday':`${d}d ago`;
      h+=`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bo)">
        <div><div style="font-size:13px;font-weight:600">${a.username}</div><div style="font-size:11px;color:var(--t3)">${a.caseCount} cases · ${ls}</div></div>
        <button onclick="adminDeleteOne('${a.username}','${a.uid}')" style="padding:4px 9px;background:var(--s);border:1px solid var(--bo);border-radius:6px;color:var(--t3);font-size:11px;cursor:pointer;font-family:-apple-system,sans-serif">Delete</button>
      </div>`;
    });
    h+=`</div>`;

    h+=`<div style="background:var(--s2);border-radius:10px;padding:12px 14px">
      <div style="font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">🔑 Change Admin Password</div>
      <input class="fi" id="admin-newpw" type="password" placeholder="New admin password" style="margin-bottom:8px">
      <button onclick="adminChangePw()" style="width:100%;padding:10px;background:var(--s);border:1px solid var(--bo2);border-radius:8px;color:var(--t2);font-size:13px;font-weight:600;cursor:pointer;font-family:-apple-system,sans-serif">Update Password</button>
    </div>`;

    body.innerHTML=h;
  }catch(e){body.innerHTML=`<div style="color:var(--r);font-size:13px">Error: ${e.message}</div>`;console.error(e)}
}
