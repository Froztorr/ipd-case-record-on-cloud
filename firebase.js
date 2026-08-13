// Theme Toggler
const savedTheme = localStorage.getItem('rehab_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

window.toggleTheme = function() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('rehab_theme', newTheme);
  updateThemeBtns(newTheme);
};

function updateThemeBtns(theme) {
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}
document.addEventListener('DOMContentLoaded', () => updateThemeBtns(savedTheme));

firebase.initializeApp({
  apiKey:"AIzaSyCfFKjk49sIs9ybiCkJzqC2j0YAOf7i5YI",
  authDomain:"rehab-consult.firebaseapp.com",
  projectId:"rehab-consult",
  storageBucket:"rehab-consult.firebasestorage.app",
  messagingSenderId:"419932775509",
  appId:"1:419932775509:web:35594c443aee67da5f20dc"
});
const db=firebase.firestore();
window.db=db;
let _uid=null,_unsub=null,_fpUser=null,_fpData=null;
window._cases=[];
window._incomingWatchRequests=[];
// Expose for visibility handler
Object.defineProperty(window,'_uid',{get:()=>_uid,set:v=>_uid=v});
Object.defineProperty(window,'_unsub',{get:()=>_unsub,set:v=>_unsub=v});

async function sha(s){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('rehab2024_'+s));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function uidFrom(user,pass){return(await sha(user+'::'+pass)).slice(0,28)}

/* ── UI helpers ── */
function showApp(){
  document.getElementById('app').style.display='';
  document.getElementById('loading').classList.add('h');
  document.getElementById('login-screen').classList.add('h');
}
function showLogin(mode){
  document.getElementById('login-screen').classList.remove('h');
  document.getElementById('loading').classList.add('h');
  document.getElementById('app').style.display='none';
  authMode(mode||'signin');
}
function showLoading(t){
  document.getElementById('load-txt').textContent=t||'Loading...';
  document.getElementById('loading').classList.remove('h');
}
function setErr(id,msg){const e=document.getElementById(id);if(e)e.textContent=msg}

window.authMode=function(m){
  ['signin','signup','forgot'].forEach(x=>{
    document.getElementById('panel-'+x).style.display=x===m?'flex':'none';
  });
  const ts=document.getElementById('tab-signin'),tu=document.getElementById('tab-signup');
  if(ts&&tu){
    ts.style.background=m==='signin'?'var(--a)':'none';
    ts.style.color=m==='signin'?'#fff':'var(--t2)';
    tu.style.background=m==='signup'?'var(--a)':'none';
    tu.style.color=m==='signup'?'#fff':'var(--t2)';
  }
  // Hide auth-tabs for forgot mode
  const at=document.getElementById('auth-tabs');
  if(at)at.style.display=m==='forgot'?'none':'flex';
  setErr('si-err','');setErr('su-err','');setErr('fp-err','');
  // Reset forgot sub-panels
  if(m==='forgot'){
    document.getElementById('fp-qs').style.display='none';
    document.getElementById('fp-newpass').style.display='none';
    document.getElementById('fp-user').value='';
    _fpUser=null;_fpData=null;
  }
};

/* ── Subscribe data ── */
const CACHE_KEY=uid=>`rehab_cache_${uid}`;
const QUEUE_KEY=uid=>`rehab_queue_${uid}`;
// Watched (shared-in) cases — cases owned by someone else who granted this account access
const WCACHE_KEY=uid=>`rehab_wcache_${uid}`;
const WQUEUE_KEY=uid=>`rehab_wqueue_${uid}`;

function loadLocalCache(uid){
  try{const d=localStorage.getItem(CACHE_KEY(uid));return d?JSON.parse(d):null}catch{return null}
}
function saveLocalCache(uid,cases){
  try{localStorage.setItem(CACHE_KEY(uid),JSON.stringify(cases))}catch(e){console.warn('Cache write failed',e)}
}
function loadQueue(uid){
  try{const d=localStorage.getItem(QUEUE_KEY(uid));return d?JSON.parse(d):{saves:{},deletes:[]}}catch{return{saves:{},deletes:[]}}
}
function saveQueue(uid,q){
  try{localStorage.setItem(QUEUE_KEY(uid),JSON.stringify(q))}catch(e){console.warn('Queue write failed',e)}
}
function clearQueue(uid){localStorage.removeItem(QUEUE_KEY(uid))}

function loadWatchedCache(uid){
  try{const d=localStorage.getItem(WCACHE_KEY(uid));return d?JSON.parse(d):null}catch{return null}
}
function saveWatchedCache(uid,cases){
  try{localStorage.setItem(WCACHE_KEY(uid),JSON.stringify(cases))}catch(e){console.warn('Watched cache write failed',e)}
}
function loadWQueue(uid){
  try{const d=localStorage.getItem(WQUEUE_KEY(uid));return d?JSON.parse(d):{saves:{},deletes:[]}}catch{return{saves:{},deletes:[]}}
}
function saveWQueue(uid,q){
  try{localStorage.setItem(WQUEUE_KEY(uid),JSON.stringify(q))}catch(e){console.warn('Watched queue write failed',e)}
}
function clearWQueue(uid){localStorage.removeItem(WQUEUE_KEY(uid))}

// Rebuild window._cases straight from the on-disk caches, with no queue merge.
// Use this right after writing to a cache (applyToCache etc.) — at that instant
// the cache already reflects the edit, and merging the queue on top would
// re-apply whatever OLDER entry is still queued for that same id (the queue for
// *this* edit hasn't been written yet — that happens right after, back in
// _saveToCloud/_saveSharedCase), clobbering the edit that was just made.
function rebuildCasesViewFromCacheOnly(uid){
  window._cases=[...(loadLocalCache(uid)||[]),...(loadWatchedCache(uid)||[])];
}
function applyToCache(uid,c){
  // Replace single case in cache — no pile-up
  const cases=loadLocalCache(uid)||[];
  const idx=cases.findIndex(x=>x.id===c.id);
  if(idx>=0)cases[idx]=c;else cases.unshift(c);
  saveLocalCache(uid,cases);
  rebuildCasesViewFromCacheOnly(uid);
}
function removeFromCache(uid,id){
  const cases=(loadLocalCache(uid)||[]).filter(x=>x.id!==id);
  saveLocalCache(uid,cases);
  rebuildCasesViewFromCacheOnly(uid);
}
function applyToWatchedCache(uid,c){
  const cases=loadWatchedCache(uid)||[];
  const idx=cases.findIndex(x=>x.id===c.id);
  if(idx>=0)cases[idx]=c;else cases.unshift(c);
  saveWatchedCache(uid,cases);
  rebuildCasesViewFromCacheOnly(uid);
}
function removeFromWatchedCache(uid,id){
  const cases=(loadWatchedCache(uid)||[]).filter(x=>x.id!==id);
  saveWatchedCache(uid,cases);
  rebuildCasesViewFromCacheOnly(uid);
}

// Combined view used when (re)loading from the server or from disk at startup —
// merges any still-queued (not yet flushed) offline edits on top, in case a
// prior flush didn't fully complete. My own cases + cases someone else has
// handed off to me to watch. This is the array the rest of the app renders
// from (window._cases) — see rToday/rDone/etc in app1.js.
function rebuildCasesView(uid){
  const own=mergeCacheWithQueue(uid,loadLocalCache(uid)||[]);
  const watched=mergeWatchedCacheWithQueue(uid,loadWatchedCache(uid)||[]);
  window._cases=[...own,...watched];
}

let _syncTimer=null,_wSyncTimer=null;
async function flushQueue(uid){
  if(!navigator.onLine)return;
  const q=loadQueue(uid);
  const saves=Object.values(q.saves);
  const deletes=q.deletes;
  if(!saves.length&&!deletes.length)return;
  setSyncBusy(true);
  try{
    // Batch all pending saves and deletes
    await Promise.all([
      ...saves.map(c=>db.collection('users').doc(uid).collection('cases').doc(c.id).set(c)),
      ...deletes.map(id=>db.collection('users').doc(uid).collection('cases').doc(id).delete())
    ]);
    clearQueue(uid);
    setSyncBusy(false);
  }catch(e){setSyncBusy(false);console.warn('Flush failed',e)}
}

// Same as flushQueue but for edits made to cases someone else owns (I'm just the
// watcher) — each queued entry carries its own ownerUid so it writes back to the
// owner's users/{ownerUid}/cases/{id} doc, not mine.
async function flushWQueue(uid){
  if(!navigator.onLine)return;
  const q=loadWQueue(uid);
  const saves=Object.values(q.saves);
  const deletes=q.deletes;
  if(!saves.length&&!deletes.length)return;
  try{
    await Promise.all([
      ...saves.map(e=>db.collection('users').doc(e.ownerUid).collection('cases').doc(e.c.id).set(e.c)),
      ...deletes.map(e=>db.collection('users').doc(e.ownerUid).collection('cases').doc(e.id).delete())
    ]);
    clearWQueue(uid);
  }catch(e){console.warn('Shared-case flush failed',e)}
}

function subscribeData(uid){
  window.subscribeData=subscribeData;
  if(_unsub)_unsub();

  // Always load cache first — works offline and online
  rebuildCasesView(uid);
  // Render immediately from cache — never wait for network
  if(window.render)window.render();
  if(window.badges)window.badges();

  // Flush queues if online
  flushQueue(uid);
  flushWQueue(uid);

  // Background cloud fetch if online — updates cache silently
  refreshFromCloud({toast:false});
}

// Merge any queued (offline) saves into cached list for accurate offline display
function mergeCacheWithQueue(uid,cached){
  const q=loadQueue(uid);
  let merged=[...cached];
  // Apply pending saves
  Object.values(q.saves).forEach(c=>{
    const idx=merged.findIndex(x=>x.id===c.id);
    if(idx>=0)merged[idx]=c;else merged.unshift(c);
  });
  // Apply pending deletes
  q.deletes.forEach(id=>{merged=merged.filter(x=>x.id!==id)});
  return merged;
}

// Same idea for the watched-case cache — queued entries store {c, ownerUid, ownerUsername}
function mergeWatchedCacheWithQueue(uid,cachedWatched){
  const q=loadWQueue(uid);
  let merged=[...cachedWatched];
  Object.values(q.saves).forEach(e=>{
    const idx=merged.findIndex(x=>x.id===e.c.id);
    const decorated={...e.c,_ownerUid:e.ownerUid,_ownerUsername:e.ownerUsername||(idx>=0?merged[idx]._ownerUsername:''),_shared:true};
    if(idx>=0)merged[idx]=decorated;else merged.unshift(decorated);
  });
  q.deletes.forEach(e=>{merged=merged.filter(x=>x.id!==e.id)});
  return merged;
}

// Re-fetch when coming back online
window.addEventListener('online',()=>{ if(_uid)refreshFromCloud({toast:false}).then(ok=>{if(ok)window.toast&&window.toast('☁️ Back online — synced')}); });

function setSyncBusy(b){document.querySelectorAll('.sync-dot').forEach(d=>d.classList.toggle('busy',b))}

// Pulls in any cases someone else has handed off to me (accepted shares), and any
// pending incoming requests I still need to accept/decline. Best-effort — wrapped
// so a failure here never breaks the normal case refresh.
async function refreshWatchData(uid){
  try{
    const[pendingSnap,activeSnap]=await Promise.all([
      db.collection('caseShares').where('toUid','==',uid).where('status','==','pending').get(),
      db.collection('caseShares').where('toUid','==',uid).where('status','==','active').get()
    ]);
    window._incomingWatchRequests=pendingSnap.docs.map(d=>({id:d.id,...d.data()}));
    const activeGrants=activeSnap.docs.map(d=>({id:d.id,...d.data()}));
    const caseDocs=await Promise.all(activeGrants.map(async g=>{
      try{
        const snap=await db.collection('users').doc(g.ownerUid).collection('cases').doc(g.caseId).get();
        if(!snap.exists)return null;
        return{...snap.data(),id:snap.id,_ownerUid:g.ownerUid,_ownerUsername:g.ownerUsername,_shared:true};
      }catch(e){return null}
    }));
    saveWatchedCache(uid,caseDocs.filter(Boolean));
  }catch(e){console.warn('Watch data refresh failed',e)}
}
window.refreshWatchData=refreshWatchData;

async function refreshFromCloud(opts={}){
  if(!_uid)return false;
  if(!navigator.onLine){setSyncBusy(false);window.toast&&window.toast('Offline — showing saved data');return false}
  setSyncBusy(true);
  try{
    await flushQueue(_uid);
    await flushWQueue(_uid);
    const snap=await db.collection('users').doc(_uid).collection('cases').orderBy('created','desc').get({source:'server'});
    const fresh=snap.docs.map(d=>({id:d.id,...d.data()}));
    saveLocalCache(_uid,fresh);
    await refreshWatchData(_uid);
    rebuildCasesView(_uid);
    setSyncBusy(false);
    if(window.render)window.render();
    if(window.badges)window.badges();
    if(window.renderWatchInbox)window.renderWatchInbox();
    if(opts.toast!==false)window.toast&&window.toast('↻ Refreshed');
    return true;
  }catch(e){
    setSyncBusy(false);console.warn('Refresh failed',e);
    window.toast&&window.toast('⚠ Refresh failed — check connection');
    return false;
  }
}
window.refreshFromCloud=refreshFromCloud;

function startSession(uid,username){
  _uid=uid;
  localStorage.setItem('rehab_uid',uid);
  localStorage.setItem('rehab_user',username);
  showApp();
  subscribeData(uid);
  setTimeout(showUpdateLogIfNeeded,300);
}

/* ── Restore session — show cache instantly, no loading screen ── */
const savedUID=localStorage.getItem('rehab_uid');
let _preloadSkipped=false;
function showPreload(){
  document.getElementById('login-screen').classList.add('h');
  document.getElementById('loading').classList.add('h');
  document.getElementById('app').style.display='none';
  document.getElementById('preload-screen').classList.add('on');
}
function hidePreload(){document.getElementById('preload-screen').classList.remove('on')}
window.skipPreload=function(){
  if(!savedUID)return;
  _preloadSkipped=true;

  rebuildCasesView(savedUID);
  hidePreload();showApp();
  setTimeout(()=>{window.render&&window.render();window.badges&&window.badges();window.renderWatchInbox&&window.renderWatchInbox();flushQueue(savedUID);flushWQueue(savedUID);showUpdateLogIfNeeded();},0);
};
async function restoreSessionWithPreload(uid){
  _uid=uid;
  showPreload();
  const minDelay=new Promise(r=>setTimeout(r,900));
  const cloudLoad=(async()=>{
    if(!navigator.onLine)throw new Error('offline');
    await flushQueue(uid);
    await flushWQueue(uid);
    const snap=await db.collection('users').doc(uid).collection('cases').orderBy('created','desc').get({source:'server'});
    const fresh=snap.docs.map(d=>({id:d.id,...d.data()}));
    saveLocalCache(uid,fresh);
    await refreshWatchData(uid);
    return fresh;
  })();
  try{
    await Promise.race([cloudLoad,new Promise((_,rej)=>setTimeout(()=>rej(new Error('slow')),9000))]);
    await minDelay;
    if(_preloadSkipped)return;
    rebuildCasesView(uid);
    hidePreload();showApp();
    setTimeout(()=>{window.render&&window.render();window.badges&&window.badges();window.renderWatchInbox&&window.renderWatchInbox();showUpdateLogIfNeeded();},0);
  }catch(e){
    await minDelay;
    if(_preloadSkipped)return;
    rebuildCasesView(uid);
    hidePreload();showApp();
    setTimeout(()=>{window.render&&window.render();window.badges&&window.badges();window.renderWatchInbox&&window.renderWatchInbox();showUpdateLogIfNeeded();toast(navigator.onLine?'⚠ Cloud preload failed — using saved phone data':'Offline — using saved phone data');},0);
  }
}
if(savedUID){
  restoreSessionWithPreload(savedUID);
} else {
  showLogin('signin');
}

/* ── SIGN IN ── */
window.doSignIn=async()=>{
  const user=document.getElementById('si-user').value.trim().toLowerCase();
  const pass=document.getElementById('si-pass').value;
  setErr('si-err','');
  if(!user||!pass){setErr('si-err','Please enter username and password');return}
  showLoading('Signing in...');
  try{
    // Check account exists
    const meta=await db.collection('accounts').doc(user).get();
    if(!meta.exists){showLogin('signin');setErr('si-err','Account not found — please sign up first');return}
    // Verify password hash
    const passHash=await sha(user+'::'+pass);
    if(meta.data().passHash!==passHash){showLogin('signin');setErr('si-err','Incorrect password');return}
    startSession(meta.data().uid,user);
  }catch(e){showLogin('signin');setErr('si-err','Error — check connection');console.error(e)}
};

window.toggleCustomQ=function(prefix,n){
  const sel=document.getElementById(prefix+'-q'+n);
  const inp=document.getElementById(prefix+'-q'+n+'-custom');
  if(!sel||!inp)return;
  inp.style.display=sel.value==='__custom__'?'block':'none';
  if(sel.value==='__custom__')inp.focus();
};

function getQ(prefix,n){
  const sel=document.getElementById(prefix+'-q'+n);
  if(!sel)return'';
  if(sel.value==='__custom__'){
    const c=document.getElementById(prefix+'-q'+n+'-custom');
    return c?c.value.trim():'';
  }
  return sel.value;
}

/* ── SIGN UP ── */
window.doSignUp=async()=>{
  const user=document.getElementById('su-user').value.trim().toLowerCase();
  const pass=document.getElementById('su-pass').value;
  const pass2=document.getElementById('su-pass2').value;
  const q1=getQ('su',1);
  const a1=document.getElementById('su-a1').value.trim().toLowerCase();
  const q2=getQ('su',2);
  const a2=document.getElementById('su-a2').value.trim().toLowerCase();
  const q3=getQ('su',3);
  const a3=document.getElementById('su-a3').value.trim().toLowerCase();
  setErr('su-err','');
  if(!user){setErr('su-err','Please enter a username');return}
  if(!/^[a-z0-9_]+$/.test(user)){setErr('su-err','Username: letters, numbers, underscore only');return}
  if(pass.length<4){setErr('su-err','Password must be at least 4 characters');return}
  if(pass!==pass2){setErr('su-err','Passwords do not match');return}
  if(!q1||!a1||!q2||!a2||!q3||!a3){setErr('su-err','Please select and answer all 3 security questions');return}
  if(q1===q2||q1===q3||q2===q3){setErr('su-err','Please choose 3 different questions');return}
  showLoading('Creating account...');
  try{
    const existing=await db.collection('accounts').doc(user).get();
    if(existing.exists){showLogin('signup');setErr('su-err','Username already taken — please choose another');return}
    const uid=await uidFrom(user,pass);
    const passHash=await sha(user+'::'+pass);
    await db.collection('accounts').doc(user).set({
      uid,passHash,
      q1,a1Hash:await sha(user+'::q1::'+a1),
      q2,a2Hash:await sha(user+'::q2::'+a2),
      q3,a3Hash:await sha(user+'::q3::'+a3),
      created:new Date().toISOString()
    });
    startSession(uid,user);
  }catch(e){showLogin('signup');setErr('su-err','Error — check connection');console.error(e)}
};

/* ── FORGOT PASSWORD ── */
window.fpLookup=async()=>{
  const user=document.getElementById('fp-user').value.trim().toLowerCase();
  setErr('fp-err','');
  if(!user){setErr('fp-err','Please enter your username');return}
  showLoading('Looking up account...');
  try{
    const meta=await db.collection('accounts').doc(user).get();
    if(!meta.exists){showLogin('forgot');setErr('fp-err','Account not found');return}
    _fpUser=user;_fpData=meta.data();
    document.getElementById('loading').classList.add('h');
    // Show questions
    document.getElementById('fp-q1-lbl').textContent='Q1: '+_fpData.q1;
    document.getElementById('fp-q2-lbl').textContent='Q2: '+_fpData.q2;
    document.getElementById('fp-q3-lbl').textContent='Q3: '+_fpData.q3;
    document.getElementById('fp-qs').style.display='flex';
    document.getElementById('fp-a1').value='';
    document.getElementById('fp-a2').value='';
    document.getElementById('fp-a3').value='';
  }catch(e){showLogin('forgot');setErr('fp-err','Error — check connection');console.error(e)}
};

window.fpVerify=async()=>{
  if(!_fpUser||!_fpData){setErr('fp-err','Please look up your account first');return}
  const a1=document.getElementById('fp-a1').value.trim().toLowerCase();
  const a2=document.getElementById('fp-a2').value.trim().toLowerCase();
  const a3=document.getElementById('fp-a3').value.trim().toLowerCase();
  setErr('fp-err','');
  if(!a1||!a2||!a3){setErr('fp-err','Please answer all 3 questions');return}
  showLoading('Verifying...');
  const h1=await sha(_fpUser+'::q1::'+a1);
  const h2=await sha(_fpUser+'::q2::'+a2);
  const h3=await sha(_fpUser+'::q3::'+a3);
  document.getElementById('loading').classList.add('h');
  if(h1!==_fpData.a1Hash||h2!==_fpData.a2Hash||h3!==_fpData.a3Hash){
    setErr('fp-err','One or more answers are incorrect');return;
  }
  document.getElementById('fp-qs').style.display='none';
  document.getElementById('fp-newpass').style.display='flex';
  document.getElementById('fp-np1').value='';
  document.getElementById('fp-np2').value='';
};

window.fpReset=async()=>{
  if(!_fpUser||!_fpData){return}
  const np1=document.getElementById('fp-np1').value;
  const np2=document.getElementById('fp-np2').value;
  setErr('fp-err','');
  if(np1.length<4){setErr('fp-err','Password must be at least 4 characters');return}
  if(np1!==np2){setErr('fp-err','Passwords do not match');return}
  showLoading('Updating password...');
  try{
    const oldUID=_fpData.uid;
    const newUID=await uidFrom(_fpUser,np1);
    const newPassHash=await sha(_fpUser+'::'+np1);
    // Migrate all cases to new UID path
    if(oldUID!==newUID){
      const snap=await db.collection('users').doc(oldUID).collection('cases').get();
      const batch=db.batch();
      snap.docs.forEach(d=>{
        batch.set(db.collection('users').doc(newUID).collection('cases').doc(d.id),d.data());
        batch.delete(d.ref);
      });
      await batch.commit();
    }
    // Update account record
    await db.collection('accounts').doc(_fpUser).update({uid:newUID,passHash:newPassHash});
    window.toast&&window.toast('✅ Password updated — please sign in');
    showLogin('signin');
    document.getElementById('si-user').value=_fpUser;
    _fpUser=null;_fpData=null;
  }catch(e){
    document.getElementById('loading').classList.add('h');
    setErr('fp-err','Error — check connection');console.error(e);
  }
};

/* ── SIGN OUT ── */
window.doSignOut=()=>{
  window.showConf('🔒','Sign out?','You will need your username and password to sign back in.',
    'Sign out',()=>{
      if(_unsub){_unsub();_unsub=null}
      // Clean up local cache and queue on sign out
      if(_uid){
        localStorage.removeItem(CACHE_KEY(_uid));localStorage.removeItem(QUEUE_KEY(_uid));
        localStorage.removeItem(WCACHE_KEY(_uid));localStorage.removeItem(WQUEUE_KEY(_uid));
      }
      window._cases=[];window._incomingWatchRequests=[];_uid=null;
      localStorage.removeItem('rehab_uid');
      localStorage.removeItem('rehab_user');
      showLogin('signin');
      window.render&&window.render();
    });
};

/* ── OFFLINE-FIRST OPS ── */
// Save: write to local cache + queue immediately, flush to cloud if online
window._saveToCloud=async(c)=>{
  if(!_uid)return;
  // Case belongs to someone else's account (I'm watching it, not the owner) —
  // route through the shared-case path so it lands back on THEIR doc.
  if(c._ownerUid&&c._ownerUid!==_uid)return window._saveSharedCase(c);
  // 1. Update local cache instantly
  applyToCache(_uid,c);
  window.render&&window.render();
  window.badges&&window.badges();
  // 2. Queue for cloud
  const q=loadQueue(_uid);
  q.saves[c.id]=c; // overwrite same id — no pile-up
  q.deletes=q.deletes.filter(id=>id!==c.id);
  saveQueue(_uid,q);
  // 3. Flush if online — debounced to batch rapid saves
  if(navigator.onLine){
    clearTimeout(_syncTimer);
    _syncTimer=setTimeout(()=>flushQueue(_uid),1500);
  }
};

// Same as _saveToCloud, but for a case owned by another account that has been
// handed off to me to watch — writes back to users/{ownerUid}/cases/{id} instead
// of my own collection, via a separate local cache + queue.
window._saveSharedCase=async(c)=>{
  if(!_uid)return;
  const ownerUid=c._ownerUid,ownerUsername=c._ownerUsername;
  const clean={...c};
  delete clean._ownerUid;delete clean._ownerUsername;delete clean._shared;
  applyToWatchedCache(_uid,{...clean,_ownerUid:ownerUid,_ownerUsername:ownerUsername,_shared:true});
  window.render&&window.render();
  window.badges&&window.badges();
  const q=loadWQueue(_uid);
  q.saves[clean.id]={c:clean,ownerUid,ownerUsername};
  q.deletes=q.deletes.filter(e=>e.id!==clean.id);
  saveWQueue(_uid,q);
  if(navigator.onLine){
    clearTimeout(_wSyncTimer);
    _wSyncTimer=setTimeout(()=>flushWQueue(_uid),1500);
  }
};

// Delete: remove from cache immediately, queue deletion
// ownerUid: pass this when deleting a shared-in case (someone else's doc) —
// omit (or pass your own uid) for a case you own.
window._deleteFromCloud=async(id,ownerUid)=>{
  if(!_uid)return;
  if(ownerUid&&ownerUid!==_uid){
    removeFromWatchedCache(_uid,id);
    window.render&&window.render();
    window.badges&&window.badges();
    const q=loadWQueue(_uid);
    delete q.saves[id];
    if(!q.deletes.some(e=>e.id===id))q.deletes.push({id,ownerUid});
    saveWQueue(_uid,q);
    if(navigator.onLine){
      clearTimeout(_wSyncTimer);
      _wSyncTimer=setTimeout(()=>flushWQueue(_uid),1500);
    }
    return;
  }
  removeFromCache(_uid,id);
  window.render&&window.render();
  window.badges&&window.badges();
  const q=loadQueue(_uid);
  delete q.saves[id];
  if(!q.deletes.includes(id))q.deletes.push(id);
  saveQueue(_uid,q);
  if(navigator.onLine){
    clearTimeout(_syncTimer);
    _syncTimer=setTimeout(()=>flushQueue(_uid),1500);
  }
};

// Clear all: wipe cache, queue, and cloud
window._clearAllFromCloud=async()=>{
  if(!_uid)return;
  saveLocalCache(_uid,[]);
  clearQueue(_uid);
  rebuildCasesView(_uid);
  window.render&&window.render();
  window.badges&&window.badges();
  if(navigator.onLine){
    setSyncBusy(true);
    try{
      const snap=await db.collection('users').doc(_uid).collection('cases').get();
      await Promise.all(snap.docs.map(d=>d.ref.delete()));
      setSyncBusy(false);
    }catch(e){setSyncBusy(false);console.warn(e)}
  }
};

/* ═══════════ WATCH MY CASE — hand a patient off to a colleague ═══════════
   A share is a doc in the top-level "caseShares" collection:
     {id, caseId, ownerUid, ownerUsername, caseNm, caseHn,
      toUid, toUsername, status:'pending'|'active'|'declined'|'ended', ...}
   The owner's case doc also carries a denormalized `share` field
   ({id,status,toUid,toUsername}) so their own device can render status
   without an extra query. These relationship actions all require being
   online (consistent with the rest of the app's cross-account operations
   like sign-up/sign-in/admin — see doSignUp/adminDeleteOne above); routine
   editing of a shared case's content still works fully offline via
   _saveSharedCase/_deleteFromCloud above. */
function myUsername(){return localStorage.getItem('rehab_user')||''}
// Firestore errors get swallowed into a generic "check connection" message
// elsewhere in this app, but that's actively misleading for a permission-denied
// (a Firestore security-rules problem, not a network problem) — surface the
// real reason so it's diagnosable without opening devtools.
function watchErrMsg(e){
  const code=e&&e.code;
  if(code==='permission-denied')return'⚠ Blocked by Firestore security rules (permission-denied) — see caseShares rule';
  if(code)return'⚠ Error: '+code;
  return'⚠ Error — check connection';
}

window.sendWatchRequest=async function(caseId,toUsernameRaw){
  if(!_uid)return{ok:false,msg:'Not signed in'};
  if(!navigator.onLine)return{ok:false,msg:'⚠ Requires an internet connection'};
  const toUsername=(toUsernameRaw||'').trim().toLowerCase();
  if(!toUsername)return{ok:false,msg:'Enter a username'};
  if(toUsername===myUsername())return{ok:false,msg:"You can't send a request to yourself"};
  const c=(window._cases||[]).find(x=>x.id===caseId&&!x._shared);
  if(!c)return{ok:false,msg:'Case not found'};
  if(c.share&&(c.share.status==='pending'||c.share.status==='active'))return{ok:false,msg:'This case is already shared'};
  try{
    const accSnap=await db.collection('accounts').doc(toUsername).get();
    if(!accSnap.exists)return{ok:false,msg:'No account found with that username'};
    const toUid=accSnap.data().uid;
    if(toUid===_uid)return{ok:false,msg:"You can't send a request to yourself"};
    const id=uid_();
    const grant={id,caseId,ownerUid:_uid,ownerUsername:myUsername(),caseNm:c.nm||'',caseHn:c.hn||'',toUid,toUsername,status:'pending',createdAt:new Date().toISOString()};
    await db.collection('caseShares').doc(id).set(grant);
    await window._saveToCloud({...c,share:{id,status:'pending',toUid,toUsername}});
    return{ok:true,msg:'✅ Request sent to @'+toUsername};
  }catch(e){console.error(e);return{ok:false,msg:watchErrMsg(e)}}
};

window.cancelWatchRequest=async function(caseId){
  if(!navigator.onLine){window.toast&&window.toast('⚠ Requires an internet connection');return}
  const c=(window._cases||[]).find(x=>x.id===caseId&&!x._shared);
  if(!c||!c.share)return;
  try{
    await db.collection('caseShares').doc(c.share.id).update({status:'ended',endedAt:new Date().toISOString(),endedBy:'owner'});
  }catch(e){console.warn(e)}
  await window._saveToCloud({...c,share:null});
  window.toast&&window.toast('✕ Cancelled');
};

window.revokeWatchAccess=async function(caseId){
  if(!navigator.onLine){window.toast&&window.toast('⚠ Requires an internet connection');return}
  const c=(window._cases||[]).find(x=>x.id===caseId&&!x._shared);
  if(!c||!c.share)return;
  try{
    await db.collection('caseShares').doc(c.share.id).update({status:'ended',endedAt:new Date().toISOString(),endedBy:'owner'});
  }catch(e){console.warn(e)}
  await window._saveToCloud({...c,share:null});
  window.toast&&window.toast('🔒 Access revoked');
};

window.acceptWatchRequest=async function(shareId){
  if(!navigator.onLine){window.toast&&window.toast('⚠ Requires an internet connection');return}
  try{
    const doc=await db.collection('caseShares').doc(shareId).get();
    if(!doc.exists){window.toast&&window.toast('⚠ Request no longer exists');return}
    const g=doc.data();
    if(g.toUid!==_uid)return;
    await db.collection('caseShares').doc(shareId).update({status:'active',respondedAt:new Date().toISOString()});
    const caseRef=db.collection('users').doc(g.ownerUid).collection('cases').doc(g.caseId);
    const caseSnap=await caseRef.get();
    if(caseSnap.exists)await caseRef.update({share:{id:shareId,status:'active',toUid:g.toUid,toUsername:g.toUsername}});
    window.toast&&window.toast('🫱🏻‍🫲🏾 Now watching '+(g.caseNm||'patient'));
    await refreshWatchData(_uid);rebuildCasesView(_uid);
    window.render&&window.render();window.badges&&window.badges();window.renderWatchInbox&&window.renderWatchInbox();
  }catch(e){console.error(e);window.toast&&window.toast(watchErrMsg(e))}
};

window.declineWatchRequest=async function(shareId){
  if(!navigator.onLine){window.toast&&window.toast('⚠ Requires an internet connection');return}
  try{
    const doc=await db.collection('caseShares').doc(shareId).get();
    if(doc.exists){
      const g=doc.data();
      await db.collection('caseShares').doc(shareId).update({status:'declined',respondedAt:new Date().toISOString()});
      const caseRef=db.collection('users').doc(g.ownerUid).collection('cases').doc(g.caseId);
      const caseSnap=await caseRef.get();
      if(caseSnap.exists&&caseSnap.data().share&&caseSnap.data().share.id===shareId)await caseRef.update({share:null});
    }
    await refreshWatchData(_uid);rebuildCasesView(_uid);
    window.render&&window.render();window.badges&&window.badges();window.renderWatchInbox&&window.renderWatchInbox();
    window.toast&&window.toast('Declined');
  }catch(e){console.error(e);window.toast&&window.toast(watchErrMsg(e))}
};

window.giveBackCase=async function(caseId){
  if(!navigator.onLine){window.toast&&window.toast('⚠ Requires an internet connection to give back');return}
  const c=(window._cases||[]).find(x=>x.id===caseId&&x._shared);
  if(!c)return;
  try{
    if(c.share&&c.share.id)await db.collection('caseShares').doc(c.share.id).update({status:'ended',endedAt:new Date().toISOString(),endedBy:'watcher'});
    await db.collection('users').doc(c._ownerUid).collection('cases').doc(c.id).update({share:null});
  }catch(e){console.warn(e);window.toast&&window.toast(watchErrMsg(e));return}
  removeFromWatchedCache(_uid,c.id); // already rebuilds window._cases
  window.render&&window.render();window.badges&&window.badges();
  window.toast&&window.toast('↩ Case given back');
};

function watchEnabled(){return localStorage.getItem('rehab_watch_enabled')==='1'}
window.watchEnabled=watchEnabled;
window.setWatchEnabled=function(v){
  localStorage.setItem('rehab_watch_enabled',v?'1':'0');
  window.render&&window.render();
};
