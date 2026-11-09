/* ===== PARISH YETU · core data layer ===== */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n||0).toLocaleString('en-KE');
const ksh=n=>'KSh '+fmt(Math.round(n||0));
const uid=p=>(p||'x')+Math.random().toString(36).slice(2,8);
const todayD=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const iso=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const dOff=n=>{const d=todayD();d.setDate(d.getDate()+n);return iso(d)};
const TODAY=()=>iso(todayD());
const fdate=s=>{if(!s)return '—';const d=new Date(s+(s.length<=10?'T00:00:00':''));return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})};
const ftime=t=>{if(!t)return '';const[h,m]=t.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+' '+(h<12?'AM':'PM')};
const ago=s=>{const n=Math.round((todayD()-new Date(s+'T00:00:00'))/864e5);return n<=0?'Today':n===1?'Yesterday':n<30?n+' days ago':n<365?Math.round(n/30)+' mo ago':Math.round(n/365)+' yr ago'};
const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const sum=(a,f)=>a.reduce((s,x)=>s+(+(f?f(x):x)||0),0);
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const ICONS={
 dash:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
 people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.6"/><path d="M17 14.5c2.6.1 4.2 1.7 4.6 4.5"/>',
 liturgy:'<path d="M8 3h8l-1 7a3 3 0 0 1-6 0z"/><path d="M12 13v5M8 21h8"/>',
 pastoral:'<path d="M12 21s-7-4.4-9-9.3C1.8 8 4 5 7 5c2 0 3.7 1 5 3 1.3-2 3-3 5-3 3 0 5.200 3 4 6.700-2 4.900-9 9.300-9 9.300z"/>',
 comm:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
 steward:'<path d="M12 3v18M17 7.500c0-1.900-2.200-3-5-3s-5 1.100-5 3 2 2.700 5 3.500 5 1.600 5 3.500-2.200 3-5 3-5-1.100-5-3"/>',
 msg:'<path d="M4 5h16v11H9l-5 4z"/>',
 admin:'<path d="M4 20V8l8-5 8 5v12M9 20v-6h6v6"/>',
 report:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
 sys:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900l2.100 2.100M17 17l2.100 2.100M4.900 19.100L7 17M17 7l2.100-2.100"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 bell:'<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 chev:'<path d="m9 6 6 6-6 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 down:'<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>',
 x:'<path d="M6 6l12 12M18 6 6 18"/>',
 lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
 cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 check:'<path d="m5 12 5 5 9-10"/>',
 play:'<path d="M7 4v16l13-8z"/>',
 pause:'<path d="M7 4h4v16H7zM13 4h4v16h-4z"/>',
 doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',
 folder:'<path d="M3 6h6l2 2h10v11H3z"/>',
 send:'<path d="m3 11 18-8-8 18-2-8z"/>',
 pin:'<path d="M12 21s-6-5.500-6-11a6 6 0 0 1 12 0c0 5.500-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
 shield:'<path d="M12 3 4 6v6c0 5 3.500 8 8 9 4.500-1 8-4 8-9V6z"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
 more:'<circle cx="5" cy="12" r="1.500"/><circle cx="12" cy="12" r="1.500"/><circle cx="19" cy="12" r="1.500"/>',
 out:'<path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9"/>',
 up:'<path d="M12 20V9m-5 5 5-5 5 5M5 4h14"/>',
 globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.800 2.700 2.800 15.300 0 18M12 3c-2.800 2.700-2.800 15.300 0 18"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
 share:'<circle cx="18" cy="5" r="2.500"/><circle cx="6" cy="12" r="2.500"/><circle cx="18" cy="19" r="2.500"/><path d="m8.200 10.800 7.600-4.400M8.200 13.200l7.600 4.400"/>',
 ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'
};
const ic=(n,c)=>`<svg class="i ${c||''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n]||''}</svg>`;
const CROSS=(s,c)=>`<svg width="${s||24}" height="${s||24}" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 2h4v7h7v4h-7v9h-4v-9H3V9h7z" fill="${c||'#6E1725'}"/></svg>`;

/* ---------- roles & permissions ---------- */
const ALLMODS=['dash','portal','diocese','parishioners','families','sacraments','masses','pastoral','scc','ministries','events','sermons','catechesis','finance','accounting','assets','projects','documents','comms','reports','governance','settings'];
const FLAGS=['pii','giving','private','write'];
const ROLES0=[
 /* The platform owner manages churches on the platform (applications, suspension, dioceses), not a
    church's internal records, so the only module it has is the platform console. */
 {key:'super',label:'Super Admin',scope:'Platform',landing:'/super-admin',desc:'Platform owner: approves, suspends and supports the parishes on PARISH YETU.',perms:['platform']},
 {key:'diocese',label:'Diocesan Administrator',scope:'Diocese',landing:'/diocese',desc:'Consolidated view of deaneries, parishes, reports and submissions.',perms:['diocese','reports','governance','settings','giving']},
 {key:'deanery',label:'Deanery Administrator',scope:'Deanery',landing:'/diocese',desc:'Oversees parishes within the deanery and reviews submissions.',perms:['diocese','reports','governance']},
 {key:'priest',label:'Parish Priest',scope:'Parish',landing:'/dashboard',desc:'Pastoral leader with full parish visibility including confidential care.',perms:['dash','parishioners','families','sacraments','masses','pastoral','scc','ministries','events','sermons','catechesis','finance','assets','projects','documents','comms','reports','governance','pii','giving','private','write']},
 {key:'admin',label:'Parish Administrator',scope:'Parish',landing:'/dashboard',desc:'Runs parish operations, records and day-to-day administration.',perms:['dash','parishioners','families','sacraments','masses','scc','ministries','events','sermons','catechesis','assets','projects','documents','comms','reports','governance','settings','pii','write']},
 {key:'secretary',label:'Parish Secretary',scope:'Parish',landing:'/dashboard',desc:'Registrations, certificates, Mass intentions, documents and communication.',perms:['dash','parishioners','families','sacraments','masses','scc','ministries','events','sermons','catechesis','documents','comms','reports','pii','write']},
 {key:'finance',label:'Finance Officer',scope:'Parish',landing:'/dashboard',desc:'Collections, expenses, budgets, accounting, projects and assets.',perms:['dash','finance','accounting','assets','projects','documents','reports','giving','write']},
 {key:'scc',label:'SCC Leader',scope:'SCC',landing:'/dashboard',desc:'Leads a Small Christian Community: members, meetings and attendance.',perms:['dash','scc','families','parishioners','events','comms','write']},
 {key:'parishioner',label:'Parishioner',scope:'Personal',landing:'/dashboard',desc:'Simplified portal for family, giving, Mass schedule and requests.',perms:['portal']}
];

/* ===== PARISH YETU · Firebase data layer ===== */
const FB=window.FB||{ok:false};
const ACCESS={"families":{"r":["priest","admin","secretary","scc"],"w":["priest","admin","secretary","scc"],"limit":1500},"parishioners":{"r":["priest","admin","secretary","scc"],"w":["priest","admin","secretary","scc"],"limit":2000},"sccs":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary","scc"],"limit":200},"sccReports":{"r":["priest","admin","secretary","scc"],"w":["priest","admin","secretary","scc"],"limit":500},"ministries":{"r":["priest","admin","secretary"],"w":["priest","admin","secretary"],"limit":200},"volunteers":{"r":["priest","admin","secretary"],"w":["priest","admin","secretary"],"limit":500},"sacraments":{"r":["priest","admin","secretary"],"w":["priest","admin","secretary"],"limit":2000},"masses":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary"],"limit":800},"intentions":{"r":["priest","admin","secretary"],"w":["priest","admin","secretary"],"limit":800},"sermons":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary"],"limit":300},"liturgical":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary"],"limit":400},"pastoralCases":{"r":["priest"],"w":["priest"],"limit":500},"visits":{"r":["priest"],"w":["priest"],"limit":500},"events":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary","finance","scc"],"limit":300},"registrations":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary","finance","scc"],"limit":1500},"catechesis":{"r":["priest","admin","secretary"],"w":["priest","admin","secretary"],"limit":1000},"transactions":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary","finance","scc"],"limit":1500},"funds":{"r":["priest","finance"],"w":["priest","finance"],"limit":100},"budgets":{"r":["priest","finance"],"w":["priest","finance"],"limit":200},"expenses":{"r":["priest","admin","finance"],"w":["priest","admin","finance"],"limit":1000},"banks":{"r":["priest","finance"],"w":["priest","finance"],"limit":100},"reconciliation":{"r":["priest","finance"],"w":["priest","finance"],"limit":500},"accounts":{"r":["finance"],"w":["finance"],"limit":300},"journals":{"r":["finance"],"w":["finance"],"limit":500},"payables":{"r":["finance"],"w":["finance"],"limit":300},"receivables":{"r":["finance"],"w":["finance"],"limit":300},"giving":{"r":["priest","finance"],"w":["priest","finance"],"limit":1500},"assets":{"r":["priest","admin","finance"],"w":["priest","admin","finance"],"limit":500},"projects":{"r":["priest","admin","finance"],"w":["priest","admin","finance"],"limit":200},"documents":{"r":["priest","admin","secretary","finance"],"w":["priest","admin","secretary","finance"],"limit":500},"messages":{"r":["priest","admin","secretary","scc"],"w":["priest","admin","secretary","scc"],"limit":500},"segments":{"r":["priest","admin","secretary","scc"],"w":["priest","admin","secretary","scc"],"limit":100},"councils":{"r":["priest","admin"],"w":["priest","admin"],"limit":100},"meetings":{"r":["priest","admin"],"w":["priest","admin"],"limit":300},"decisions":{"r":["priest","admin"],"w":["priest","admin"],"limit":300},"actions":{"r":["priest","admin"],"w":["priest","admin"],"limit":300},"approvals":{"r":["priest","admin","finance"],"w":["priest","admin","finance"],"limit":300},"staff":{"r":["priest","admin"],"w":["priest","admin"],"limit":200},"reports":{"r":["priest","admin","secretary","finance"],"w":["priest","admin","secretary","finance"],"limit":300},"submissions":{"r":["priest","admin","secretary","finance"],"w":["priest","admin","secretary","finance"],"limit":500},"requests":{"r":["priest","admin","secretary"],"w":["priest","admin","secretary"],"limit":500},"notifications":{"r":["priest","admin","secretary","finance","scc"],"w":["priest","admin","secretary","finance","scc"],"limit":100},"auditLogs":{"r":["admin"],"w":["priest","admin","secretary","finance","scc"],"limit":300}};
const STAFF_ROLES=['priest','admin','secretary','finance','scc'];
const DIOCESE_ROLES=['diocese','deanery'];
const DIOCESE_READ=['reports','councils','meetings','decisions','actions','approvals','staff'];
const SETTINGS0={theme:'Ivory',density:'Comfortable',notifyEmail:true,notifySms:true,sessionMinutes:30,currency:'KSh',language:'English'};
const PRIVATE_REQUEST_TYPES=['Prayer request','Prayer intention','Pastoral assistance','Home visit'];
const PARISH_REPORT_STATES=['Draft','Ready for Submission','Submitted'];
const DIOCESE_REPORT_STATES=['Under Review','Returned','Approved','Locked'];
const PROFILE_KEYS=['name','patron','priest','phone','email','address','outstations','short','town','county','founded','motto'];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ts=()=>firebase.firestore.FieldValue.serverTimestamp();
const FDEL=()=>firebase.firestore.FieldValue.delete();
const jclone=o=>JSON.parse(JSON.stringify(o));
const cleanDoc=o=>{const c=jclone(o);Object.keys(c).forEach(k=>{if(k[0]==='_'&&k!=='_c')delete c[k]});delete c.createdAt;delete c.updatedAt;return c};
const roleDef=k=>ROLES0.find(r=>r.key===k);

/* ---------- context ---------- */
const Ctx={parishId:null,parishes:[],profile:null};

/* ---------- boot sequence ---------- */
const Boot={error:null,notice:null,
 /* Pages may set window.PARISHOS_LOGIN (e.g. the platform console uses /super-admin/login). */
 loginPath(){return window.PARISHOS_LOGIN||'/login'},
 guard(fn){return this.ready.then(()=>{if(this.error){this.showError(this.error);return}if(!Auth.user()){location.replace(this.loginPath());return}fn()})},
 showError(e){
  const msg=Boot.explain(e);
  document.body.innerHTML=`<div style="min-height:100vh;display:grid;place-items:center;background:#F7F3E8;font-family:Quicksand,system-ui,sans-serif;padding:24px"><div style="max-width:520px;background:#fff;border:1px solid #E8E5DD;border-radius:12px;padding:28px;box-shadow:0 4px 14px rgba(17,19,21,.06)"><h2 style="color:#6E1725;margin-bottom:8px">${esc(msg.title)}</h2><p style="color:#5d6065;line-height:1.6">${esc(msg.body)}</p><div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap"><button id="bt-retry" class="btn p">Try again</button><button id="bt-out" class="btn">Sign out</button></div></div></div>`;
  document.getElementById('bt-retry').onclick=()=>location.reload();
  document.getElementById('bt-out').onclick=()=>Auth.logout().then(()=>location.href=Boot.loginPath());
  console.error('PARISH YETU could not start:',e);
 },
 explain(e){
  const c=(e&&e.code)||'';
  if(c==='parishos/config')return{title:'Firebase is not configured yet',body:'Add your Firebase web configuration to js/firebase-config.js, then reload. See README.md, step 5.'};
  if(c==='permission-denied'||c==='parishos/denied')return{title:'Access denied',body:'The database refused this request. Your membership may be suspended, your parish may be suspended on PARISH YETU, or your account has no permission for this church. Contact your parish office.'};
  if(c==='unavailable'||c==='parishos/offline')return{title:'Cannot reach the database',body:'Check your internet connection and try again. No records are shown until the database responds.'};
  if(c==='parishos/no-church')return{title:'No church assigned',body:'Your account is not linked to a church. Contact the platform administrator.'};
  return{title:'Something went wrong',body:'The application could not load its data ('+((e&&e.message)||c||'unknown error')+'). No records are shown until this is resolved.'};
 }
};

/* ---------- church directory (public) ---------- */
const Dir={_c:null,
 async load(){if(this._c)return this._c;const s=await FB.db.collection('churchDirectory').where('status','==','active').limit(1000).get();this._c=s.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));return this._c},
 search(list,q){const t=String(q||'').toLowerCase().split(/\s+/).filter(Boolean);if(!t.length)return list;return list.filter(c=>{const h=[c.name,c.town,c.county,c.dioceseName,c.deanery,c.address].join(' ').toLowerCase();return t.every(x=>h.includes(x))})}
};

/* ---------- empty cache skeleton ---------- */
function EMPTY(){const d={parish:{name:'No church selected',short:'—',deanery:'',diocese:'',archdiocese:'',priest:'',phone:'',email:'',address:'',outstations:[],patron:'',stats:{}},settings:{...SETTINGS0},roles:jclone(ROLES0),users:[],parishes:[]};Object.keys(ACCESS).forEach(k=>d[k]=[]);['notifications','auditLogs','requests','submissions'].forEach(k=>d[k]=d[k]||[]);return d}

/* ---------- DB ---------- */
const DB={_d:null,_snap:{},_snapObj:{},_dirty:new Set(),_chain:Promise.resolve(),_failed:false,
 load(){return this._d||(this._d=EMPTY())},
 save(coll){this._dirty.add(coll||'*');if(!this._timer)this._timer=setTimeout(()=>{this._timer=null;this.flush()},0)},
 c(n){const d=this.load();return d[n]||(d[n]=[])},
 add(n,o,mod,act,why){o.id=o.id||uid(n[0]);if(n==='notifications'&&!o.audience)o.audience='all';this.c(n).unshift(o);this.save(n);if(mod)this.log(mod,act||'Created record',null,o.name||o.title||o.id,why);return o},
 upd(n,id,patch,mod,act){const a=this.c(n),i=a.findIndex(x=>x.id===id);if(i<0)return;const before=JSON.stringify(a[i]).slice(0,60);Object.assign(a[i],patch);this.save(n);if(mod)this.log(mod,act||'Updated record',before,JSON.stringify(patch).slice(0,70));return a[i]},
 del(n,id,mod,act){const a=this.c(n),i=a.findIndex(x=>x.id===id);if(i<0)return;const o=a.splice(i,1)[0];this.save(n);if(mod)this.log(mod,act||'Deleted record',o.name||o.title||id,'—');return o},
 get(n,id){return this.c(n).find(x=>x.id===id)},
 log(module,action,before,after,reason){const u=Auth.user();this.c('auditLogs').unshift({id:uid('au'),user:u?u.name:'System',action,module,date:TODAY()+' '+new Date().toTimeString().slice(0,8),device:navigator.userAgent.includes('Mobile')?'Mobile browser':'Desktop browser',ip:'—',before:before||'—',after:after||'—',reason:reason||'—'});this.save('auditLogs')},

 async init(u){
  const db=FB.db,d=this._d=EMPTY();d.roles=jclone(ROLES0);
  const staffLike=STAFF_ROLES.includes(u.role);
  const isDioc=DIOCESE_ROLES.includes(u.role);
  const isSuper=u.role==='super';
  let pid=null;

  /* ---------- SUPER ADMIN: load list of every church, optionally enter one ---------- */
  if(isSuper){
   const s=await db.collection('parishes').limit(500).get();
   Ctx.parishes=s.docs.map(x=>({...x.data(),id:x.id}))
     .filter(p=>p.status==='active')
     .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
   d.parishes=Ctx.parishes.map(p=>{const st=p.stats||{};return{id:p.id,name:p.name,deanery:p.deanery||'—',priest:p.priest||'—',parishioners:st.parishioners||0,sccs:st.sccs||0,baptisms:st.baptisms||0,giving:st.giving||0,health:st.health||0,reportStatus:p.reportStatus||'Draft',reportComment:p.reportComment||''}});
   const want=sessionStorage.getItem('parishos.parish');
   pid=Ctx.parishes.find(p=>p.id===want)?.id||null;
   Ctx.parishId=pid;
   if(!pid){this._index();return}
  }

  /* ---------- DIOCESE / DEANERY: load list of parishes in scope, optionally enter one ---------- */
  else if(isDioc){
   let q=db.collection('parishes');
   if(u.role==='diocese')q=q.where('dioceseId','==',u.dioceseId);
   if(u.role==='deanery')q=q.where('dioceseId','==',u.dioceseId).where('deanery','==',u.organization);
   const s=await q.limit(300).get();
   Ctx.parishes=s.docs.map(x=>({...x.data(),id:x.id}))
     .filter(p=>p.status==='active')
     .sort((a,b)=>String(a.name).localeCompare(String(b.name)));
   d.parishes=Ctx.parishes.map(p=>{const st=p.stats||{};return{id:p.id,name:p.name,deanery:p.deanery||'—',priest:p.priest||'—',parishioners:st.parishioners||0,sccs:st.sccs||0,baptisms:st.baptisms||0,giving:st.giving||0,health:st.health||0,reportStatus:p.reportStatus||'Draft',reportComment:p.reportComment||''}});
   const want=sessionStorage.getItem('parishos.parish');
   pid=Ctx.parishes.find(p=>p.id===want)?.id||null;
   Ctx.parishId=pid;
   if(!pid){this._index();return}
  }

  /* ---------- PARISHIONER: their own parish only ---------- */
  else if(u.role==='parishioner'){
   pid=u.parishId;
   Ctx.parishId=pid;
   if(!pid){this._index();return}
  }

  /* ---------- PARISH STAFF: their assigned parish, no fallback ---------- */
  else if(staffLike){
   pid=u.parishId;
   if(!pid){
    const e=new Error('No church is assigned to your account.');
    e.code='parishos/no-church';
    throw e;
   }
   Ctx.parishId=pid;
  }

  /* ---------- Load the chosen parish's data ---------- */
  const pref=db.collection('parishes').doc(pid);
  const ps=await pref.get();
  if(!ps.exists){const e=new Error('Church record not found');e.code='parishos/no-church';throw e}
  d.parish={outstations:[],stats:{},...ps.data(),id:ps.id};
  const ss=await pref.collection('config').doc('settings').get();
  d.settings={...SETTINGS0,...(ss.exists?ss.data():{})};
  if(staffLike||isSuper)u.organization=d.parish.name;

  const jobs=[],put=(name,snap)=>{d[name]=snap.docs.map(x=>{const o={...x.data(),id:x.id};delete o.createdAt;delete o.updatedAt;return o}).sort((a,b)=>(b._c||0)-(a._c||0))};
  const col=n=>pref.collection(n);
  const lim=n=>(ACCESS[n]&&ACCESS[n].limit)||500;
  const run=(name,q)=>jobs.push(q.get().then(s=>put(name,s)));

  if(u.role==='parishioner'){
   const t=TODAY(),me=u.personId;
   jobs.push(col('parishioners').doc(me).get().then(async s=>{d.parishioners=s.exists?[{...s.data(),id:s.id}]:[];const fid=s.exists&&s.data().familyId;if(fid){const k=await col('parishioners').where('familyId','==',fid).limit(40).get();k.docs.forEach(x=>{if(!d.parishioners.some(y=>y.id===x.id))d.parishioners.push({...x.data(),id:x.id})});const f=await col('families').doc(fid).get();d.families=f.exists?[{...f.data(),id:f.id}]:[]}}));
   run('sccs',col('sccs').limit(200));
   run('masses',col('masses').where('date','>=',t).limit(100));
   run('events',col('events').where('date','>=',t).limit(100));
   run('sermons',col('sermons').orderBy('_c','desc').limit(30));
   run('liturgical',col('liturgical').where('date','>=',t).limit(60));
   run('messages',col('messages').where('channel','==','Announcement').limit(50));
   ['registrations','intentions','requests','sacraments','giving'].forEach(n=>run(n,col(n).where('personId','==',me).limit(200)));
  }else{
   const readable=n=>{const a=ACCESS[n];if(!a)return false;if(u.role==='super')return true;if(DIOCESE_ROLES.includes(u.role))return DIOCESE_READ.includes(n);return a.r.includes(u.role)};
   Object.keys(ACCESS).forEach(n=>{
    if(n==='notifications'||n==='auditLogs'||!readable(n))return;
    let q=col(n);
    if(u.role==='scc'&&(n==='parishioners'||n==='families'||n==='sccReports'))q=q.where('sccId','==',u.sccId||'none').limit(lim(n));
    else if(n==='requests'&&['admin','secretary'].includes(u.role))q=q.where('private','==',false).limit(lim(n));
    else q=q.orderBy('_c','desc').limit(lim(n));
    run(n,q);
   });
   if(u.role!=='super'&&!DIOCESE_ROLES.includes(u.role)){
    let q=col('notifications');
    if(u.role==='priest')q=q.orderBy('_c','desc').limit(100);
    else if(u.role==='admin'){run('notifications',col('notifications').where('audience','==','admins').limit(100));q=q.where('audience','==','all').limit(100)}
    else q=q.where('audience','==','all').limit(100);
    run('notifications',q);
    if(u.role==='admin')run('auditLogs',col('auditLogs').orderBy('date','desc').limit(300));
   }else if(u.role==='super'){run('notifications',col('notifications').orderBy('_c','desc').limit(100));run('auditLogs',col('auditLogs').orderBy('date','desc').limit(300))}
   if(['priest','admin','super'].includes(u.role))jobs.push(db.collection('users').where('parishId','==',pid).limit(500).get().then(s=>{d.users=s.docs.map(x=>{const o={...x.data(),id:x.id};delete o.createdAt;delete o.updatedAt;return o})}));
  }
  await Promise.all(jobs);
  this._index();
  if(['priest','admin','super'].includes(u.role))StatsSync.run(u).catch(e=>console.warn('Statistics refresh skipped:',e.message));
 },
 _index(){const d=this._d;this._snap={};this._snapObj={parish:JSON.stringify(this._pick(d.parish)),settings:JSON.stringify(d.settings)};
  Object.keys(d).forEach(k=>{if(Array.isArray(d[k])&&k!=='roles'){const m=new Map();d[k].forEach(o=>{if(o&&o.id)m.set(o.id,JSON.stringify(cleanDoc(o)))});this._snap[k]=m}});
 },
 _pick(p){const o={};PROFILE_KEYS.forEach(k=>{if(p&&p[k]!==undefined)o[k]=p[k]});return o},
 _path(coll,id){if(coll==='users')return 'users/'+id;if(coll==='parishes')return 'parishes/'+id;return 'parishes/'+Ctx.parishId+'/'+coll+'/'+id},

 flush(){this._chain=this._chain.then(()=>this._flush()).catch(e=>this._fail(e));return this._chain},
 async _flush(){
  if(!Ctx.parishId&&!this._dirty.has('users')&&!this._dirty.has('parishes')){this._dirty.clear();return}
  const d=this._d,all=this._dirty.has('*'),names=all?Object.keys(this._snap):[...this._dirty];this._dirty.clear();
  const ops=new Map();
  const WL={users:['role','status','title','sccId'],parishes:['reportStatus','reportComment']};
  for(const name of names){
   if(name==='parish'||name==='settings')continue;
   const arr=d[name];if(!Array.isArray(arr)||name==='roles')continue;
   const snap=this._snap[name]||(this._snap[name]=new Map());const seen=new Set();
   for(const o of arr){
    if(!o||!o.id)continue;seen.add(o.id);
    const body=cleanDoc(o),js=JSON.stringify(body),prev=snap.get(o.id),path=this._path(name,o.id);
    if(prev===js)continue;
    if(prev===undefined){
     if(WL[name])continue;
     if(!o._c)o._c=Date.now();body._c=o._c;
     ops.set(path,{t:'set',data:{...body,createdAt:ts()},name,id:o.id,js:JSON.stringify(body)});
    }else{
     const pb=JSON.parse(prev),patch={};
     Object.keys(body).forEach(k=>{if(JSON.stringify(body[k])!==JSON.stringify(pb[k]))patch[k]=body[k]});
     Object.keys(pb).forEach(k=>{if(!(k in body))patch[k]=FDEL()});
     const keys=WL[name]?Object.keys(patch).filter(k=>WL[name].includes(k)):Object.keys(patch);
     if(!keys.length)continue;
     const data={};keys.forEach(k=>data[k]=patch[k]);data.updatedAt=ts();
     ops.set(path,{t:'update',data,name,id:o.id,js});
     if(name==='parishioners'&&o.accountUid&&pb.status!==body.status&&(pb.status==='Suspended'||body.status==='Suspended')){
      const up='users/'+o.accountUid,ex=ops.get(up);
      ops.set(up,{t:'update',data:{...(ex?ex.data:{}),status:body.status==='Suspended'?'suspended':'active',updatedAt:ts()},name:'users',id:o.accountUid,js:null});
     }
    }
   }
   if(!WL[name])for(const id of [...snap.keys()])if(!seen.has(id))ops.set(this._path(name,id),{t:'delete',name,id});
  }
  if(Ctx.parishId&&(all||names.includes('parish')||this._dirty.has('parish'))){
   const js=JSON.stringify(this._pick(d.parish));
   if(js!==this._snapObj.parish){const nw=this._pick(d.parish),old=JSON.parse(this._snapObj.parish),data={};Object.keys(nw).forEach(k=>{if(JSON.stringify(nw[k])!==JSON.stringify(old[k]))data[k]=nw[k]});if(Object.keys(data).length){data.updatedAt=ts();ops.set('parishes/'+Ctx.parishId,{t:'update',data,name:'parish',js})}}
  }
  if(Ctx.parishId&&(all||names.includes('settings'))){const js=JSON.stringify(d.settings);if(js!==this._snapObj.settings)ops.set('parishes/'+Ctx.parishId+'/config/settings',{t:'set',merge:true,data:{...d.settings,updatedAt:ts()},name:'settings',js})}
  if(Ctx.parishId&&['priest','admin','secretary','finance'].includes(Auth.user().role)&&(all||names.includes('reports'))){
   const lr=latestReport(d),pa=d.parish;
   if(lr&&PARISH_REPORT_STATES.includes(lr.status)&&(pa.reportStatus!==lr.status||pa.reportRef!==lr.id)){
    const pp='parishes/'+Ctx.parishId,ex=ops.get(pp);
    ops.set(pp,{...(ex||{t:'update',name:'parish-report',js:null}),t:'update',data:{...(ex?ex.data:{}),reportStatus:lr.status,reportRef:lr.id,updatedAt:ts()}});
    pa.reportStatus=lr.status;pa.reportRef=lr.id;
   }
  }
  if(!ops.size)return;
  const list=[...ops.entries()];
  for(let i=0;i<list.length;i+=400){
   const b=FB.db.batch();
   list.slice(i,i+400).forEach(([p,o])=>{const r=FB.db.doc(p);if(o.t==='set')o.merge?b.set(r,o.data,{merge:true}):b.set(r,o.data);else if(o.t==='update')b.update(r,o.data);else b.delete(r)});
   await b.commit();
  }
  list.forEach(([p,o])=>{
   if(o.name==='parish')this._snapObj.parish=o.js;else if(o.name==='settings')this._snapObj.settings=o.js;
   else{const m=this._snap[o.name]||(this._snap[o.name]=new Map());if(o.t==='delete')m.delete(o.id);else if(o.js)m.set(o.id,o.js)}
  });
 },
 _fail(e){
  console.error('Save failed:',e);this._failed=true;
  const denied=e&&e.code==='permission-denied';
  try{UI.toast(denied?'You do not have permission to make that change. The page will reload.':'Could not save to the database ('+((e&&e.message)||'unknown error')+'). The page will reload.','err')}catch(x){}
  setTimeout(()=>location.reload(),2600);
 }
};

/* ---------- parish statistics ---------- */
const latestReport=d=>d.reports.filter(r=>r.level==='Parish'&&r.type==='Parish').sort((a,b)=>String(b.due).localeCompare(String(a.due)))[0];
const StatsSync={
 async run(u){
  const d=DB.load(),pa=d.parish,st=pa.stats||{},act=d.parishioners.filter(p=>p.status==='Active');
  const next={parishioners:act.length,families:d.families.length,sccs:d.sccs.length};
  if(ACCESS.sacraments.r.includes(u.role)||u.role==='super')next.baptisms=d.sacraments.filter(s=>s.type==='Baptism'&&String(s.date).startsWith(String(new Date().getFullYear()))).length;
  if(can('giving'))next.giving=Stats.income(0);
  const parts=[];
  if(d.sccs.length){const recent=d.sccs.filter(s=>s.lastMeeting&&(todayD()-new Date(s.lastMeeting+'T00:00:00'))/864e5<=45).length;parts.push(recent/d.sccs.length*100)}
  const past=d.masses.filter(m=>m.date<=TODAY());if(past.length)parts.push(past.filter(m=>m.attendance>0).length/past.length*100);
  if(parts.length)next.health=Math.round(parts.reduce((a,b)=>a+b,0)/parts.length);
  const patch={};Object.keys(next).forEach(k=>{if(st[k]!==next[k])patch['stats.'+k]=next[k]});
  const latest=latestReport(d);
  if(latest&&DIOCESE_REPORT_STATES.includes(pa.reportStatus)&&pa.reportRef===latest.id&&latest.status!==pa.reportStatus){DB.upd('reports',latest.id,{status:pa.reportStatus,comment:pa.reportComment||latest.comment||''})}
  else if(latest&&PARISH_REPORT_STATES.includes(latest.status)&&(pa.reportStatus!==latest.status||pa.reportRef!==latest.id)){patch.reportStatus=latest.status;patch.reportRef=latest.id;pa.reportStatus=latest.status;pa.reportRef=latest.id}
  if(Object.keys(patch).length){patch.updatedAt=ts();await FB.db.doc('parishes/'+Ctx.parishId).update(patch);pa.stats={...st,...next}}
 }
};

/* ---------- members ---------- */
const Members={
 memberNo(parish,uid){return (parish.short||'MBR').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4)+'-'+uid.slice(0,6).toUpperCase()},
 pending(uid){try{const p=JSON.parse(localStorage.getItem('parishos.pendingReg'));return p&&p.uid===uid?p:null}catch(e){return null}},
 async completeProfile(fu,info){
  const db=FB.db,uref=db.doc('users/'+fu.uid);
  if((await uref.get()).exists)return false;
  const ds=await db.doc('churchDirectory/'+info.parishId).get();
  if(!ds.exists||ds.data().status!=='active'){const e=new Error('That church is not available for registration.');e.code='parishos/no-church';throw e}
  const c=ds.data(),t=TODAY(),name=String(info.name).trim().slice(0,120),email=String(fu.email||'').toLowerCase();
  const b=db.batch();
  b.set(uref,{name,email,phone:info.phone||'',role:'parishioner',status:'active',parishId:info.parishId,dioceseId:c.dioceseId||'',deanery:c.deanery||'',organization:c.name,title:'Parishioner',personId:fu.uid,createdAt:ts()});
  b.set(db.doc('parishes/'+info.parishId+'/parishioners/'+fu.uid),{id:fu.uid,accountUid:fu.uid,memberNo:Members.memberNo({short:c.short||c.name.split(/\s+/).map(w=>w[0]).join('')},fu.uid),status:'Active',name,email,phone:info.phone||'',gender:'',dob:'',familyId:'',sccId:'',outstation:'',role:'Member',ministries:[],occupation:'',lastActivity:t,registeredOn:t,source:'self-registration',history:[{date:t,action:'Registered',by:'self'}],_c:Date.now(),createdAt:ts()});
  b.set(db.doc('parishes/'+info.parishId+'/notifications/newmember_'+fu.uid),{id:'newmember_'+fu.uid,text:'New member registered: '+name,link:'/parishioners#open='+fu.uid,date:t,read:false,audience:'admins',type:'new-member',memberUid:fu.uid,_c:Date.now(),createdAt:ts()});
  await b.commit();
  localStorage.removeItem('parishos.pendingReg');
  return true;
 },
 setSuspended(p,flag,reason){
  const by=Auth.user().name;
  return DB.upd('parishioners',p.id,{status:flag?'Suspended':'Active',history:[...(p.history||[]),{date:TODAY(),action:flag?'Suspended':'Restored',by,reason:reason||''}]},'Parishioners',flag?'Suspended member':'Restored member');
 },
 canManage(){const u=Auth.user();return !!u&&['priest','admin','super'].includes(u.role)}
};

/* ---------- Auth ---------- */
const AUTH_MSG={
 'auth/invalid-email':'That email address is not valid.','auth/user-disabled':'This account has been disabled.',
 'auth/user-not-found':'Email or password is incorrect.','auth/wrong-password':'Email or password is incorrect.','auth/invalid-credential':'Email or password is incorrect.','auth/invalid-login-credentials':'Email or password is incorrect.',
 'auth/email-already-in-use':'An account with this email already exists. Sign in instead, or reset your password.',
 'auth/weak-password':'Choose a stronger password (at least 8 characters).','auth/too-many-requests':'Too many attempts. Wait a few minutes and try again.',
 'auth/network-request-failed':'Cannot reach the server. Check your connection and try again.','permission-denied':'The database refused the request. Please try again or contact your parish office.',
 'auth/popup-blocked':'Your browser blocked the Google sign-in window. Allow pop-ups for this site, or use email and password instead.',
 'auth/popup-closed-by-user':'The Google sign-in window was closed before it finished. Please try again.',
 'auth/cancelled-popup-request':'Another sign-in attempt is still open. Please finish or close it and try again.',
 'auth/operation-not-allowed':'Google sign-in is not enabled on the platform yet. Please use email and password.',
 'auth/unauthorized-domain':'This domain is not authorised for Google sign-in yet. Please use email and password.',
 'auth/account-exists-with-different-credential':'An account with that email already exists using a different sign-in method. Please sign in with email and password instead.',
 'parishos/suspended':'Your membership is suspended. Please contact your parish office.','parishos/no-profile':'Your account is not linked to a church yet.','parishos/no-church':'No church is assigned to your account.'
};
const authMsg=e=>AUTH_MSG[e&&e.code]||((e&&e.message)||'Something went wrong. Please try again.');

/* Google sign-in helper — popup first, falls back to redirect if the popup is blocked. */
async function googleSignIn(){
 if(!FB.google)throw Object.assign(new Error('Google sign-in is not available on this site.'),{code:'auth/operation-not-allowed'});
 try{
  const cred=await FB.auth.signInWithPopup(FB.google);
  return cred.user;
 }catch(e){
  const c=(e&&e.code)||'';
  if(c==='auth/popup-blocked'||c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request'||c==='auth/operation-not-supported-in-this-environment'){
   await FB.auth.signInWithRedirect(FB.google);
   return new Promise(()=>{});
  }
  throw e;
 }
}

const Auth={_u:null,_fu:null,_registering:false,
 user(){return this._u},
 can(p){const u=this._u;if(!u)return false;const r=roleDef(u.role);return !!r&&r.perms.includes(p)},
 session(p,fu){
  const r=roleDef(p.role);if(!r)throw Object.assign(new Error('Unknown role'),{code:'parishos/denied'});
  return{id:fu.uid,name:p.name,email:p.email,role:p.role,roleLabel:r.label,scope:r.scope,organization:p.organization||'',title:p.title||r.label,avatar:initials(p.name),permissions:r.perms,personId:p.personId||'',sccId:p.sccId||'',landing:r.landing,parishId:p.parishId||'',dioceseId:p.dioceseId||'',deanery:p.deanery||''};
 },
 async resolve(fu){
  this._fu=fu;
  /* The superAdmin custom claim (set only by scripts/admin.js make-super) is the source of truth for
     platform owners. It is read from the signed token, so the browser cannot forge it. */
  let claims={};try{claims=(await fu.getIdTokenResult()).claims||{}}catch(e){console.warn('Could not read token claims',e)}
  const superClaim=claims.superAdmin===true&&!claims.impersonatedBy;
  const uref=FB.db.doc('users/'+fu.uid);let snap=await uref.get();
  if(!snap.exists&&superClaim){ // claim set but no profile document yet: create it (rules allow this for superAdmin)
   try{await uref.set({name:fu.displayName||String(fu.email||'').split('@')[0]||'Platform Administrator',email:String(fu.email||'').toLowerCase(),role:'super',status:'active',title:'Super Admin',organization:'Platform',parishId:'',personId:fu.uid,createdAt:ts()});snap=await uref.get()}catch(e){console.warn('Could not create the platform profile',e)}
  }
  if(!snap.exists&&!this._registering){const pend=Members.pending(fu.uid);if(pend){try{await Members.completeProfile(fu,pend)}catch(e){console.warn('Registration recovery failed',e)}snap=await uref.get()}}
  if(!snap.exists){this._u=null;Boot.notice='no-profile';return}
  let p=snap.data();
  if(p.status!=='active'){this._u=null;Boot.notice='suspended';await FB.auth.signOut();return}
  if(superClaim&&p.role!=='super')p={...p,role:'super'};
  this._u=this.session(p,fu);this._u.superAdmin=superClaim;this._u.impersonatedBy=String(claims.impersonatedBy||'');Ctx.profile=p;
 },
 async login(email,pw,remember){
  await FB.auth.setPersistence(remember?firebase.auth.Auth.Persistence.LOCAL:firebase.auth.Auth.Persistence.SESSION);
  const cred=await FB.auth.signInWithEmailAndPassword(String(email).trim(),pw);
  await this.resolve(cred.user);
  if(Boot.notice==='suspended')throw Object.assign(new Error(AUTH_MSG['parishos/suspended']),{code:'parishos/suspended'});
  if(!this._u)throw Object.assign(new Error(AUTH_MSG['parishos/no-profile']),{code:'parishos/no-profile'});
  return this._u;
 },

 /* ---- Google sign in (members only) ---- */
 async loginWithGoogle(opts){
  opts=opts||{};
  await FB.auth.setPersistence(opts.remember===false?firebase.auth.Auth.Persistence.SESSION:firebase.auth.Auth.Persistence.LOCAL);
  const fu=await googleSignIn();
  await this.resolve(fu);
  if(Boot.notice==='suspended')throw Object.assign(new Error(AUTH_MSG['parishos/suspended']),{code:'parishos/suspended'});
  if(!this._u)throw Object.assign(new Error(AUTH_MSG['parishos/no-profile']),{code:'parishos/no-profile'});
  return this._u;
 },

 async register(o){
  this._registering=true;
  try{
   const ds=await FB.db.doc('churchDirectory/'+o.parishId).get();
   if(!ds.exists||ds.data().status!=='active')throw Object.assign(new Error(AUTH_MSG['parishos/no-church']),{code:'parishos/no-church'});
   await FB.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
   const cred=await FB.auth.createUserWithEmailAndPassword(String(o.email).trim(),o.password);
   const info={uid:cred.user.uid,name:o.name,phone:o.phone,parishId:o.parishId};
   localStorage.setItem('parishos.pendingReg',JSON.stringify(info));
   await Members.completeProfile(cred.user,info);
   await this.resolve(cred.user);
   return this._u;
  }finally{this._registering=false}
 },

 /* ---- Google sign up (members only) ---- */
 async registerWithGoogle(o){
  o=o||{};
  if(!o.parishId)throw Object.assign(new Error('Choose your church first.'),{code:'parishos/no-church'});
  const ds=await FB.db.doc('churchDirectory/'+o.parishId).get();
  if(!ds.exists||ds.data().status!=='active')throw Object.assign(new Error(AUTH_MSG['parishos/no-church']),{code:'parishos/no-church'});
  this._registering=true;
  try{
   await FB.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
   const fu=await googleSignIn();
   const info={
    uid:fu.uid,
    name:(fu.displayName||String(fu.email||'').split('@')[0]||'Member').trim(),
    phone:o.phone||'',
    parishId:o.parishId
   };
   try{
    localStorage.setItem('parishos.pendingReg',JSON.stringify(info));
    await Members.completeProfile(fu,info);
   }catch(e){
    if(!(e&&e.code==='parishos/no-church'))throw e;
   }
   await this.resolve(fu);
   return this._u;
  }finally{this._registering=false}
 },

 async finishRegistration(o){
  const fu=FB.auth.currentUser;if(!fu)throw Object.assign(new Error('Please sign in first.'),{code:'auth/requires-recent-login'});
  this._registering=true;
  try{await Members.completeProfile(fu,{uid:fu.uid,name:o.name,phone:o.phone,parishId:o.parishId});await this.resolve(fu);return this._u}finally{this._registering=false}
 },
 reset(email){return FB.auth.sendPasswordResetEmail(String(email).trim())},
 async requestChurch(o){
  await FB.db.collection('churchRequests').add({name:o.name,town:o.town||'',diocese:o.diocese||'',contactName:o.contactName,contactEmail:o.contactEmail,notes:o.notes||'',status:'open',createdAt:ts()});
 },
 async logout(){this._u=null;try{await FB.auth.signOut()}catch(e){}try{sessionStorage.removeItem('parishos.parish')}catch(e){}}
};
const can=p=>Auth.can(p);

/* ---------- start-up ---------- */
Boot.ready=(async()=>{
 try{
  if(!FB.ok){Boot.error=Object.assign(new Error('Firebase is not configured'),{code:'parishos/config'});return}

  try{
   if(FB.auth&&FB.auth.getRedirectResult){
    const rr=await FB.auth.getRedirectResult();
    if(rr&&rr.user){
     try{await rr.user.getIdToken(true)}catch(e){}
     await Auth.resolve(rr.user);
     if(Auth._u&&!window.PARISHOS_PUBLIC)await DB.init(Auth._u);
     return;
    }
   }
  }catch(e){console.warn('Redirect result could not be resolved:',e)}

  const fu=await new Promise((res,rej)=>{const un=FB.auth.onAuthStateChanged(x=>{un();res(x)},rej)});
  if(!fu)return;
  try{await fu.getIdToken(true)}catch(e){console.warn('Could not refresh token; continuing with cached one',e)}
  await Auth.resolve(fu);
  if(Auth._u&&!window.PARISHOS_PUBLIC)await DB.init(Auth._u);
 }catch(e){Boot.error=e}
})();

/* ===== PARISH YETU · UI toolkit ===== */
const UI={};
UI.toast=(msg,type)=>{let w=$('.toasts');if(!w){w=document.createElement('div');w.className='toasts';w.setAttribute('role','status');document.body.appendChild(w)}const t=document.createElement('div');t.className='toast '+(type||'ok');t.innerHTML=`${ic('check')}<span>${esc(msg)}</span>`;w.appendChild(t);setTimeout(()=>{t.style.transition='opacity .3s,transform .3s';t.style.opacity=0;t.style.transform='translateX(20px)';setTimeout(()=>t.remove(),300)},3200)};
UI._stack=[];
UI.modal=o=>{const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="mbox ${o.size||''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}"><div class="mh"><h3>${esc(o.title)}</h3><button class="iconbtn" data-x aria-label="Close">${ic('x')}</button></div><div class="mb"></div>${o.footer===false?'':'<div class="mf"></div>'}</div>`;document.body.appendChild(m);const b=$('.mb',m);if(typeof o.body==='string')b.innerHTML=o.body;else if(o.body)b.appendChild(o.body);const close=()=>{m.remove();UI._stack=UI._stack.filter(x=>x!==close)};UI._stack.push(close);m.addEventListener('mousedown',e=>{if(e.target===m)close()});$('[data-x]',m).onclick=close;const f=$('.mf',m);(o.buttons||[]).forEach(bt=>{const x=document.createElement('button');x.className='btn '+(bt.cls||'');x.textContent=bt.label;x.onclick=()=>{if(bt.fn&&bt.fn(m,close)===false)return;if(!bt.keep)close()};f.appendChild(x)});const fi=$('input,select,textarea',b);if(fi&&o.focus!==false)setTimeout(()=>fi.focus(),50);m.close=close;return m};
UI.drawer=o=>{const s=document.createElement('div');s.className='dscrim';const d=document.createElement('aside');d.className='drawer';d.setAttribute('role','dialog');d.innerHTML=`<div class="mh"><div><h3>${esc(o.title)}</h3>${o.sub?`<div class="mini">${esc(o.sub)}</div>`:''}</div><button class="iconbtn" aria-label="Close">${ic('x')}</button></div><div class="mb">${o.html||''}</div>${o.footer?`<div class="mf"></div>`:''}`;document.body.append(s,d);const close=()=>{d.remove();s.remove();UI._stack=UI._stack.filter(x=>x!==close)};UI._stack.push(close);s.onclick=close;$('.mh .iconbtn',d).onclick=close;(o.footer||[]).forEach(bt=>{const x=document.createElement('button');x.className='btn '+(bt.cls||'');x.textContent=bt.label;x.onclick=()=>{if(bt.fn)bt.fn(close)};$('.mf',d).appendChild(x)});d.close=close;return d};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&UI._stack.length)UI._stack[UI._stack.length-1]()});
UI.confirm=(o,cb)=>{if(typeof o==='string')o={msg:o};UI.modal({title:o.title||'Please confirm',size:'sm',body:`<p>${esc(o.msg)}</p>`,focus:false,buttons:[{label:'Cancel'},{label:o.ok||'Confirm',cls:o.danger?'d':'p',fn:()=>{cb()}}]})};
UI.menu=(anchor,items)=>{$$('.menu').forEach(m=>m.remove());const m=document.createElement('div');m.className='menu';items.forEach(it=>{if(it==='-'){m.appendChild(document.createElement('hr'));return}const b=document.createElement('button');b.textContent=it.label;if(it.danger)b.className='dng';b.onclick=()=>{m.remove();it.fn()};m.appendChild(b)});document.body.appendChild(m);const r=anchor.getBoundingClientRect();m.style.top=(r.bottom+window.scrollY+4)+'px';m.style.left=Math.max(8,Math.min(r.right+window.scrollX-m.offsetWidth,window.innerWidth-m.offsetWidth-8))+'px';setTimeout(()=>document.addEventListener('click',function h(){m.remove();document.removeEventListener('click',h)},{once:false}),0)};
UI.bd=s=>{const m={Active:'g',Verified:'g',Completed:'g',Approved:'g',Paid:'g',Posted:'g',Sent:'g',Open:'b',Scheduled:'b',Enrolled:'b','In Progress':'y',Pending:'y','In Review':'y','Under Review':'y',Requested:'b',Draft:'',Returned:'r',Overdue:'r',Escalated:'r',High:'r',Medium:'y',Low:'g',Rejected:'r',Inactive:'',Closed:'',Locked:'p',Submitted:'b','Ready for Submission':'p','Mass Assigned':'b','Celebrant Assigned':'b',Confirmed:'g',Good:'g',Fair:'y',Poor:'r',Final:'g','Final Stage':'g',Fundraising:'y',Done:'g','On leave':'y',Transferred:'b'};return `<span class="bd ${m[s]||''}">${esc(s)}</span>`};
UI.av=(n,c)=>`<span class="av sm ${c||''}">${esc(initials(n))}</span>`;
UI.bar=(p,c)=>`<div class="bar ${c||''}"><i style="width:${Math.max(0,Math.min(100,p))}%"></i></div>`;
UI.csv=(name,rows)=>{if(!rows.length)return UI.toast('Nothing to export','err');const k=Object.keys(rows[0]).filter(x=>typeof rows[0][x]!=='object');const l=[k.join(',')].concat(rows.map(r=>k.map(c=>'"'+String(r[c]??'').replace(/"/g,'""')+'"').join(',')));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([l.join('\n')],{type:'text/csv'}));a.download=name+'.csv';document.body.appendChild(a);a.click();a.remove();UI.toast('Exported '+rows.length+' rows to '+name+'.csv')};
UI.dl=(name,text,type)=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain'}));a.download=name;document.body.appendChild(a);a.click();a.remove()};
UI.kpi=o=>`<div class="kpi ${o.cls||''}"><div class="l">${o.icon?ic(o.icon):''}${esc(o.label)}</div><div class="v" ${o.count!=null?`data-count="${o.count}" data-fmt="${o.fmt||''}"`:''}>${o.count!=null?(o.fmt==='ksh'?ksh(o.count):fmt(o.count)):esc(o.value)}</div><div class="s ${o.dn?'dn':''} ${o.mu?'mu':''}">${o.sub||''}</div>${o.spark?`<svg class="spark" viewBox="0 0 90 34" preserveAspectRatio="none"><path d="${UI.sparkPath(o.spark)}"/></svg>`:''}</div>`;
UI.sparkPath=v=>{const mx=Math.max(...v),mn=Math.min(...v),r=mx-mn||1;return v.map((x,i)=>(i?'L':'M')+(i*90/(v.length-1)).toFixed(1)+' '+(30-(x-mn)/r*26).toFixed(1)).join(' ')};
UI.countUp=root=>{$$('[data-count]',root||document).forEach(el=>{const t=+el.dataset.count,f=el.dataset.fmt,d=900,s=performance.now();const draw=v=>el.textContent=f==='ksh'?ksh(v):fmt(v);if(matchMedia('(prefers-reduced-motion:reduce)').matches){draw(t);return}const step=n=>{const p=Math.min(1,(n-s)/d),e=1-Math.pow(1-p,3);draw(t*e);if(p<1)requestAnimationFrame(step);else draw(t)};requestAnimationFrame(step)})};

UI.tabs=(host,tabs,o={})=>{o=Object.assign({hash:true},o);host.innerHTML=`<div class="tabs" role="tablist"></div><div class="tabpane"></div>`;const tb=$('.tabs',host),pane=$('.tabpane',host);tabs.forEach(t=>{const b=document.createElement('button');b.textContent=t.label;b.setAttribute('role','tab');b.dataset.id=t.id||t.label;b.onclick=()=>{if(o.hash)history.replaceState(null,'','#'+encodeURIComponent(t.label));show(t.label)};tb.appendChild(b)});
 const show=l=>{const t=tabs.find(x=>x.label===l)||tabs[0];$$('button',tb).forEach(b=>b.classList.toggle('on',b.textContent===t.label));pane.innerHTML='';pane.style.animation='none';pane.offsetHeight;pane.style.animation='';t.render(pane);UI.countUp(pane);window.dispatchEvent(new Event('tabchange'))};
 const fromHash=()=>decodeURIComponent(location.hash.slice(1)||'').split('&')[0];if(o.hash)window.addEventListener('hashchange',()=>show(fromHash()));show(o.hash?fromHash():(o.start||tabs[0].label));return {show}};
UI.subtabs=(host,items,fn,start)=>{const w=document.createElement('div');w.className='subtabs';items.forEach(i=>{const b=document.createElement('button');b.textContent=i;b.onclick=()=>{$$('button',w).forEach(x=>x.classList.toggle('on',x===b));fn(i)};w.appendChild(b)});host.appendChild(w);const f=$$('button',w)[Math.max(0,items.indexOf(start))];f.classList.add('on');fn(start||items[0]);return w};

UI.table=(host,o)=>{const st={q:'',sort:o.sort||null,dir:o.dir||1,page:1,f:{}};const size=o.pageSize||10;let cur=[];
 host.innerHTML=`<div class="tools">${o.search!==false?`<div class="search">${ic('search')}<input class="inp" type="search" placeholder="${esc(o.placeholder||'Search…')}" aria-label="Search"></div>`:''}<span data-f></span><span class="sp"></span><span data-tools></span></div><div class="tw"></div><div class="pag"></div>`;
 const tools=$('.tools',host),fw=$('[data-f]',host),tw=$('.tw',host),pg=$('.pag',host);
 (o.filters||[]).forEach(f=>{const s=document.createElement('select');s.className='sel';s.setAttribute('aria-label',f.label);const opts=typeof f.options==='function'?f.options():f.options;s.innerHTML=`<option value="">${esc(f.label)}</option>`+opts.map(x=>`<option>${esc(x)}</option>`).join('');s.onchange=()=>{st.f[f.key]=s.value;st.page=1;draw()};fw.appendChild(s);s.style.marginRight='8px'});
 if(o.toolsHtml){const t=$('[data-tools]',host);if(typeof o.toolsHtml==='function')o.toolsHtml(t);else t.innerHTML=o.toolsHtml}
 if(o.export){const b=document.createElement('button');b.className='btn';b.innerHTML=ic('down')+'Export';b.onclick=()=>UI.csv(o.export,all());$('[data-tools]',host).prepend(b);b.style.marginRight='8px'}
 const si=$('input',tools);if(si)si.oninput=()=>{st.q=si.value;st.page=1;draw()};
 function all(){let r=o.rows();if(st.q){const q=st.q.toLowerCase();r=r.filter(x=>(o.search?o.search(x):JSON.stringify(x)).toLowerCase().includes(q))}(o.filters||[]).forEach(f=>{const v=st.f[f.key];if(v)r=r.filter(x=>String(f.get?f.get(x):x[f.key])===v)});if(st.sort){const c=o.cols.find(c=>c.key===st.sort),g=c.val||(x=>x[c.key]);r=[...r].sort((a,b)=>{const A=g(a),B=g(b);return(A>B?1:A<B?-1:0)*st.dir})}return r}
 function draw(){const r=all(),pages=Math.max(1,Math.ceil(r.length/size));if(st.page>pages)st.page=pages;cur=r.slice((st.page-1)*size,st.page*size);
  const hasA=!!o.actions;tw.innerHTML=r.length?`<table class="t"><thead><tr>${o.cols.map(c=>`<th class="${c.sort===false?'':'sort'}" data-k="${c.key}" ${c.sort===false?'':'tabindex="0"'}>${esc(c.label)}${st.sort===c.key?`<span class="ar">${st.dir>0?'▲':'▼'}</span>`:''}</th>`).join('')}${hasA?'<th style="width:60px"></th>':''}</tr></thead><tbody>${cur.map((x,i)=>`<tr class="${o.onRow?'click':''}" data-i="${i}">${o.cols.map(c=>`<td data-label="${esc(c.label)}">${c.render?c.render(x):esc(x[c.key])}</td>`).join('')}${hasA?`<td data-label="Actions"><button class="iconbtn" data-m="${i}" aria-label="Row actions" style="width:32px;height:32px">${ic('more')}</button></td>`:''}</tr>`).join('')}</tbody></table>`:`<div class="empty"><b>${esc(o.emptyTitle||'No records found')}</b>${esc(o.empty||'Try changing your search or filters, or add a new record.')}</div>`;
  pg.style.display=r.length?'':'none';pg.innerHTML=`<span>Showing ${r.length?(st.page-1)*size+1:0}–${Math.min(st.page*size,r.length)} of ${fmt(r.length)}</span><span class="sp"></span>`;const sp=$('.sp',pg);const mk=(l,p,on,dis)=>{const b=document.createElement('button');b.textContent=l;b.disabled=dis;if(on)b.className='on';b.onclick=()=>{st.page=p;draw()};sp.appendChild(b)};mk('‹',st.page-1,0,st.page<=1);const lo=Math.max(1,Math.min(st.page-2,pages-4)),hi=Math.min(pages,lo+4);for(let p=lo;p<=hi;p++)mk(p,p,p===st.page,0);mk('›',st.page+1,0,st.page>=pages);
  $$('th.sort',tw).forEach(th=>{const go=()=>{const k=th.dataset.k;if(st.sort===k)st.dir*=-1;else{st.sort=k;st.dir=1}draw()};th.onclick=go;th.onkeydown=e=>{if(e.key==='Enter')go()}});
  $$('tbody tr',tw).forEach(tr=>{tr.onclick=e=>{if(e.target.closest('[data-m],a,button,input'))return;if(o.onRow)o.onRow(cur[+tr.dataset.i])}});
  $$('[data-m]',tw).forEach(b=>b.onclick=e=>{e.stopPropagation();UI.menu(b,o.actions(cur[+b.dataset.m]))})}
 draw();return {refresh:draw,rows:all}};

UI.form=o=>{const f=document.createElement('form');f.className='fg';f.noValidate=true;const v=o.values||{};f.innerHTML=o.fields.map(x=>{const val=v[x.k]??x.def??'';const id='f_'+x.k;let inp;const opts=(typeof x.options==='function'?x.options():x.options||[]).map(y=>typeof y==='object'?y:{v:y,l:y});
  if(x.type==='select')inp=`<select class="sel" id="${id}" name="${x.k}">${x.blank!==false?'<option value="">Select…</option>':''}${opts.map(y=>`<option value="${esc(y.v)}" ${String(y.v)===String(val)?'selected':''}>${esc(y.l)}</option>`).join('')}</select>`;
  else if(x.type==='textarea')inp=`<textarea class="ta" id="${id}" name="${x.k}" placeholder="${esc(x.placeholder||'')}">${esc(val)}</textarea>`;
  else if(x.type==='checkbox')inp=`<label class="chk"><input type="checkbox" id="${id}" name="${x.k}" ${val?'checked':''}>${esc(x.label)}</label>`;
  else inp=`<input class="inp" id="${id}" name="${x.k}" type="${x.type||'text'}" value="${esc(val)}" placeholder="${esc(x.placeholder||'')}" ${x.type==='number'?'step="any"':''}>`;
  return `<div class="f ${x.w?'w':''}" data-k="${x.k}">${x.type==='checkbox'?'':`<label for="${id}">${esc(x.label)}${x.req?' *':''}</label>`}${inp}${x.hint?`<span class="mini">${esc(x.hint)}</span>`:''}<span class="err">${esc(x.label)} is required</span></div>`}).join('');
 const get=()=>{const out={};let ok=true;o.fields.forEach(x=>{const el=f.elements[x.k];let val=x.type==='checkbox'?el.checked:el.value;if(x.type==='number'&&val!=='')val=+val;out[x.k]=val;const bad=x.req&&(val===''||val==null);$('[data-k="'+x.k+'"]',f).classList.toggle('bad',bad);if(bad)ok=false});return ok?out:null};
 f.addEventListener('submit',e=>e.preventDefault());return {el:f,get}};
UI.formModal=o=>{const fm=UI.form(o);UI.modal({title:o.title,size:o.size,body:fm.el,buttons:[{label:'Cancel'},{label:o.submit||'Save',cls:'p',fn:(m,close)=>{const v=fm.get();if(!v){UI.toast('Please complete the required fields','err');return false}if(o.onSave(v)===false)return false}}]});};

UI.collection=(host,o)=>{const W=can('write')&&o.readonly!==true;const label=r=>o.label?o.label(r):(r.name||r.title||r.id);let T;
 const refresh=()=>T.refresh();
 const edit=r=>UI.formModal({title:(r?'Edit ':(o.addLabel||'Add '+o.noun)+'').replace(/^Add Add/,'Add')+(r?' '+o.noun:''),fields:o.fields,values:r||(o.defaults?o.defaults():{}),size:o.size,submit:r?'Save changes':'Create',onSave:v=>{if(o.validate){const e=o.validate(v,r);if(e){UI.toast(e,'err');return false}}if(r){DB.upd(o.coll,r.id,v,o.module,'Updated '+o.noun.toLowerCase());UI.toast(o.noun+' updated')}else{const n=Object.assign({},o.defaults?o.defaults():{},v);if(o.make)o.make(n);DB.add(o.coll,n,o.module,'Created '+o.noun.toLowerCase());UI.toast(o.noun+' created')}if(o.after)o.after();refresh()}});
 T=UI.table(host,{rows:()=>{const r=DB.c(o.coll);return o.rowFilter?r.filter(o.rowFilter):r},cols:o.cols,search:o.search,filters:o.filters,pageSize:o.pageSize,sort:o.sort,dir:o.dir,onRow:o.onRow,export:o.export,placeholder:o.placeholder,empty:o.empty,
  toolsHtml:t=>{if(W&&o.add!==false){const b=document.createElement('button');b.className='btn p';b.innerHTML=ic('plus')+(o.addLabel||'Add '+o.noun);b.onclick=()=>edit(null);t.appendChild(b)}if(o.tools)o.tools(t,refresh)},
  actions:r=>{const a=[...(o.rowActions?o.rowActions(r,refresh):[])];if(W&&o.edit!==false){if(a.length)a.push('-');a.push({label:'Edit',fn:()=>edit(r)})}if(W&&o.del!==false)a.push({label:'Delete',danger:true,fn:()=>UI.confirm({title:'Delete '+o.noun.toLowerCase(),msg:'Delete “'+label(r)+'”? This cannot be undone.',ok:'Delete',danger:true},()=>{DB.del(o.coll,r.id,o.module,'Deleted '+o.noun.toLowerCase());UI.toast(o.noun+' deleted');if(o.after)o.after();refresh()})});return a.length?a:[{label:'View only',fn:()=>UI.toast('You have read-only access to this record','err')}]}});
 T.add=()=>edit(null);T.edit=edit;return T};

const PAL=['#6E1725','#C9A227','#182A3A','#1E6B4F','#8B8A84','#A5555F'];
const Ch={
 bars(labels,series,o={}){const W=600,H=o.h||220,L=44,B=26,T=10,max=Math.max(1,...series.flatMap(s=>s.data))*1.1,iw=W-L-8,ih=H-B-T,gw=iw/labels.length,bw=Math.min(34,(gw*.7)/series.length);const f=o.fmt||(v=>fmt(v));let g='';for(let i=0;i<=4;i++){const y=T+ih-ih*i/4;g+=`<line class="gl" x1="${L}" x2="${W-8}" y1="${y}" y2="${y}"/><text x="${L-6}" y="${y+4}" text-anchor="end">${f(max*i/4>=1000?Math.round(max*i/4/1000)*1000:max*i/4).toString().replace(/,000$/,'k')}</text>`}
  labels.forEach((l,i)=>{const cx=L+gw*i+gw/2;g+=`<text x="${cx}" y="${H-8}" text-anchor="middle">${esc(l)}</text>`;series.forEach((s,k)=>{const h=s.data[i]/max*ih,x=cx-bw*series.length/2+k*bw;g+=`<rect class="bar-r" style="animation-delay:${i*50}ms" x="${x+1}" y="${T+ih-h}" width="${bw-3}" height="${Math.max(0,h)}" rx="3" fill="${s.color||PAL[k]}"><title>${esc(s.name||'')} ${esc(l)}: ${f(s.data[i])}</title></rect>`})});
  return `<svg class="ch-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Bar chart')}">${g}</svg>${Ch.legend(series)}`},
 line(labels,series,o={}){const W=600,H=o.h||220,L=44,B=26,T=10,all=series.flatMap(s=>s.data),mx=Math.max(...all)*1.08,mn=o.zero===false?Math.min(...all)*.94:0,ih=H-B-T,iw=W-L-12,f=o.fmt||(v=>fmt(v));const X=i=>L+iw*i/(labels.length-1),Y=v=>T+ih-(v-mn)/(mx-mn||1)*ih;let g='';for(let i=0;i<=4;i++){const v=mn+(mx-mn)*i/4,y=Y(v);g+=`<line class="gl" x1="${L}" x2="${W-12}" y1="${y}" y2="${y}"/><text x="${L-6}" y="${y+4}" text-anchor="end">${v>=10000?Math.round(v/1000)+'k':Math.round(v)}</text>`}
  labels.forEach((l,i)=>g+=`<text x="${X(i)}" y="${H-8}" text-anchor="middle">${esc(l)}</text>`);series.forEach((s,k)=>{const c=s.color||PAL[k],d=s.data.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');if(k===0&&o.area!==false)g+=`<path d="${d} L${X(s.data.length-1)} ${T+ih} L${L} ${T+ih}Z" fill="${c}" opacity=".09"/>`;g+=`<path class="ln" pathLength="1" d="${d}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;s.data.forEach((v,i)=>g+=`<circle cx="${X(i)}" cy="${Y(v)}" r="3.6" fill="#fff" stroke="${c}" stroke-width="2"><title>${esc(labels[i])}: ${f(v)}</title></circle>`)});
  return `<svg class="ch-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Line chart')}">${g}</svg>${series.length>1?Ch.legend(series):''}`},
 donut(items,o={}){const R=54,C=2*Math.PI*R,tot=sum(items,x=>x.value)||1;let off=0,g='';items.forEach((x,i)=>{const l=x.value/tot*C;g+=`<circle cx="70" cy="70" r="${R}" fill="none" stroke="${x.color||PAL[i%6]}" stroke-width="20" stroke-dasharray="${l} ${C-l}" stroke-dashoffset="${-off}" transform="rotate(-90 70 70)"><title>${esc(x.label)}: ${fmt(x.value)}</title></circle>`;off+=l});
  return `<div class="flex wrap" style="gap:20px"><svg viewBox="0 0 140 140" style="width:150px;flex:none" role="img" aria-label="${esc(o.label||'Donut chart')}">${g}<text x="70" y="66" text-anchor="middle" style="font:800 20px Quicksand;fill:#111315">${esc(o.center??fmt(tot))}</text><text x="70" y="84" text-anchor="middle" style="font:600 10px Quicksand;fill:#8B8A84">${esc(o.sub||'total')}</text></svg><div class="list" style="flex:1;min-width:140px">${items.map((x,i)=>`<div class="li" style="padding:6px 0"><i style="width:10px;height:10px;border-radius:3px;background:${x.color||PAL[i%6]}"></i><div class="tx"><b style="font-size:13px">${esc(x.label)}</b></div><div class="rt">${fmt(x.value)}</div></div>`).join('')}</div></div>`},
 legend:s=>s.length>1||s[0].name?`<div class="legend">${s.map((x,i)=>`<span><i style="background:${x.color||PAL[i]}"></i>${esc(x.name||'')}</span>`).join('')}</div>`:'',
 hbars(items,o={}){const mx=Math.max(1,...items.map(x=>x.value));return `<div class="list">${items.map(x=>`<div class="li" style="display:block;padding:9px 0"><div class="flex" style="justify-content:space-between;margin-bottom:5px"><b style="font-size:13px">${esc(x.label)}</b><span style="font-weight:800">${o.fmt?o.fmt(x.value):fmt(x.value)}</span></div>${UI.bar(x.value/mx*100,x.cls||'')}</div>`).join('')}</div>`}
};

const Stats={
 mk:off=>{const d=new Date();d.setMonth(d.getMonth()+off,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')},
 income:off=>sum(DB.c('transactions').filter(t=>t.date.startsWith(Stats.mk(off))),t=>t.amount),
 incomeSeries:()=>[-5,-4,-3,-2,-1,0].map(Stats.income),
 months:()=>[-5,-4,-3,-2,-1,0].map(o=>{const d=new Date();d.setMonth(d.getMonth()+o,1);return MONTHS[d.getMonth()]}),
 expensesTotal:()=>sum(DB.c('expenses').filter(e=>e.status==='Paid'||e.status==='Approved'),e=>e.amount),
 expSeries:()=>[-5,-4,-3,-2,-1,0].map(o=>sum(DB.c('expenses').filter(e=>(e.status==='Paid'||e.status==='Approved')&&e.date.startsWith(Stats.mk(o))),e=>e.amount)),
 parishioners:()=>DB.c('parishioners').filter(p=>p.status==='Active').length,
 suspended:()=>DB.c('parishioners').filter(p=>p.status==='Suspended').length,
 families:()=>DB.c('families').length,
 sccs:()=>DB.c('sccs').length,
 attendance:()=>sum(DB.c('masses').filter(m=>m.attendance>0&&m.date<=TODAY()&&m.date>=dOff(-7)),m=>m.attendance),
 incomeChange(){const a=Stats.income(0),b=Stats.income(-1);if(!b)return a?'This month so far':'No income recorded yet';const p=Math.round((a-b)/b*1000)/10;return (p>=0?'▲ ':'▼ ')+Math.abs(p)+'% on last month'},
 months12:()=>{const o=[];for(let i=11;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i,1);o.push(MONTHS[d.getMonth()])}return o},
 memberGrowth(){const out=[];for(let i=11;i>=0;i--){const e=new Date();e.setMonth(e.getMonth()-i+1,1);e.setHours(0,0,0,0);out.push(DB.c('parishioners').filter(p=>p.status!=='Pending'&&(!p._c||p._c<e.getTime())).length)}return out},
 engagement(){const act=DB.c('parishioners').filter(p=>p.status==='Active'),n=act.length||1,sc=DB.c('sccs'),cat=DB.c('catechesis'),pc=(a,b)=>b?Math.round(a/b*100):0;return [{label:'SCC meeting attendance',value:sc.length?Math.round(sum(sc,s=>s.attendance)/sc.length):0,cls:'n'},{label:'Members in an SCC',value:pc(act.filter(p=>p.sccId).length,n),cls:''},{label:'Ministry involvement',value:pc(act.filter(p=>(p.ministries||[]).length).length,n),cls:'y'},{label:'Catechesis progress',value:cat.length?Math.round(sum(cat,c=>c.progress)/cat.length):0,cls:'g'},{label:'Members with a family record',value:pc(act.filter(p=>p.familyId).length,n),cls:''}]},
 pending(){const b=[['baptism records awaiting verification',DB.c('sacraments').filter(s=>s.type==='Baptism'&&s.status==='Pending').length,'/sacraments#Baptism'],['marriage applications pending',DB.c('sacraments').filter(s=>s.type==='Marriage'&&s.status==='Pending').length,'/sacraments#Marriage'],['expenses awaiting approval',DB.c('expenses').filter(e=>e.status==='Pending').length,'/finance#Expenses'],['diocesan reports awaiting submission',DB.c('reports').filter(r=>r.level==='Parish'&&(r.status==='Draft'||r.status==='Ready for Submission')).length,'/reports#Submissions'],['new parishioners awaiting confirmation',DB.c('parishioners').filter(p=>p.status==='Pending').length,'/parishioners']];return {items:b,total:sum(b,x=>x[1])}},
 fundBalance:f=>f.opening+sum(DB.c('transactions').filter(t=>t.fund===f.name),t=>t.amount)-sum(DB.c('expenses').filter(e=>e.fund===f.name&&(e.status==='Paid'||e.status==='Approved')),e=>e.amount),
 budgetActual:c=>sum(DB.c('expenses').filter(e=>e.category===c&&(e.status==='Paid'||e.status==='Approved')),e=>e.amount),
 personGiving:id=>sum(DB.c('giving').filter(g=>g.personId===id&&String(g.date||'').startsWith(String(new Date().getFullYear()))),g=>g.amount),
 person:id=>DB.get('parishioners',id),
 sccName:id=>(DB.get('sccs',id)||{}).name||'—',
 famName:id=>(DB.get('families',id)||{}).name||'—'
};

const Cert={
 qr(seed){let h=0;for(const c of seed)h=(h*33+c.charCodeAt(0))>>>0;let o='';for(let y=0;y<11;y++)for(let x=0;x<11;x++){const f=(x<3&&y<3)||(x>7&&y<3)||(x<3&&y>7);h=(h*1103515245+12345)>>>0;o+=`<i class="${f||(h>>>16)%2?'':'o'}"></i>`}return `<div class="qr">${o}</div>`},
 html(s){const p=DB.get('parishioners',s.personId);const pa=DB.load().parish;const t=s.type==='Other Records'?(s.subtype||'Sacramental Record'):s.type;return `<div class="cert"><div class="wm">${esc(pa.name)}</div>${CROSS(34,'#6E1725')}<div style="font-weight:700;color:var(--grey);margin-top:6px">${esc(pa.archdiocese)} · ${esc(pa.diocese)}</div><h2>CERTIFICATE OF ${esc(t.toUpperCase())}</h2><div style="font-weight:600">${esc(pa.name)} · ${esc(pa.deanery)}</div><p style="margin-top:18px">This is to certify that</p><div class="nm">${esc(s.name||'—')}</div><p>${s.type==='Marriage'?'were united in Holy Matrimony':s.type==='Funeral'?'was given Christian burial':'received the Sacrament of '+esc(t)}<br>on <b>${fdate(s.date)}</b> at ${esc(s.parish||pa.name)}</p><p>Minister: <b>${esc(s.minister)}</b>${s.godparent&&['Baptism','Confirmation'].includes(s.type)?` · Sponsor: <b>${esc(s.godparent)}</b>`:''}</p><div class="sg"><div style="text-align:left"><div style="border-top:1px solid var(--obs);padding-top:4px;min-width:160px;font-weight:700">${esc(s.minister)}</div><span class="mini">Officiating Minister</span></div><div style="text-align:center">${Cert.qr(s.regNo)}<span class="mini">Scan to verify</span></div><div style="text-align:right"><b>Register No.</b><div style="font-weight:800;font-size:17px">${esc(s.regNo)}</div><span class="mini">Issued ${fdate(TODAY())}</span></div></div></div>`},
 preview(s){UI.modal({title:'Certificate preview · '+s.regNo,size:'lg',body:Cert.html(s),buttons:[{label:'Close'},{label:'Download',fn:()=>{UI.dl(s.regNo.replace(/\//g,'-')+'-certificate.html','<!doctype html><meta charset=utf-8><title>Certificate</title><body style="font-family:sans-serif;padding:30px">'+Cert.html(s)+'<\/body>','text/html');DB.log('Sacraments','Downloaded certificate',null,s.regNo,'Certificate issued');UI.toast('Certificate downloaded')},keep:true},{label:'Issue certificate',cls:'p',fn:()=>{DB.log('Sacraments','Generated '+s.type.toLowerCase()+' certificate',null,s.regNo,'Parishioner request');UI.toast('Certificate issued and logged in audit trail')}}]})}
};

const Profile={open(id){const p=DB.get('parishioners',id);if(!p)return UI.toast('Profile not found','err');const pii=can('pii'),giv=can('giving'),prv=can('private');const fam=DB.get('families',p.familyId),kin=DB.c('parishioners').filter(x=>x.familyId===p.familyId&&x.id!==p.id);const sac=DB.c('sacraments').filter(s=>s.personId===p.id);const cases=DB.c('pastoralCases').filter(c=>c.personId===p.id);const mins=DB.c('ministries').filter(m=>m.memberIds.includes(p.id));const regs=DB.c('registrations').filter(r=>r.personId===p.id);const lock=t=>`<span class="bd p">${ic('lock')}&nbsp;${t||'Restricted for your role'}</span>`;
 const att=Math.abs([...p.id].reduce((h,c)=>h*7+c.charCodeAt(0),3))%38+58;
 const tl=[...sac.map(s=>({d:s.date,t:s.type+' recorded',s:s.regNo})),...regs.map(r=>({d:r.date,t:'Registered for '+((DB.get('events',r.eventId)||{}).title||'event'),s:'Event registration'})),{d:p.lastActivity,t:'Last parish activity',s:'Mass attendance / participation'}].sort((a,b)=>a.d<b.d?1:-1).slice(0,6);
 const html=`<div class="flex" style="gap:16px"><span class="av lg b">${esc(initials(p.name))}</span><div><h3 style="font-size:20px">${esc(p.name)}</h3><div class="mini">${esc(p.memberNo)} · ${esc(p.outstation)}</div><div style="margin-top:6px">${UI.bd(p.status)}</div></div></div>
 <div class="mt"><div class="sec">Personal information</div><dl class="dl"><dt>Gender</dt><dd>${p.gender==='M'?'Male':'Female'}</dd><dt>Date of birth</dt><dd>${pii?fdate(p.dob):lock()}</dd><dt>Phone</dt><dd>${pii?esc(p.phone):lock()}</dd><dt>Email</dt><dd>${pii?esc(p.email):lock()}</dd><dt>Occupation</dt><dd>${esc(p.occupation)}</dd></dl></div>
 <div class="mt"><div class="sec">Family & community</div><dl class="dl"><dt>Family</dt><dd>${fam?`<a href="/families#open=${fam.id}" style="color:var(--bur);font-weight:800">${esc(fam.name)}</a> · ${esc(p.role||'Member')}`:'—'}</dd><dt>Family members</dt><dd>${kin.length?kin.map(k=>`<span class="chip">${esc(k.name)}</span>`).join(''):'—'}</dd><dt>SCC</dt><dd>${esc(Stats.sccName(p.sccId))}</dd><dt>Ministries</dt><dd>${mins.length?mins.map(m=>`<span class="chip p">${esc(m.name)}</span>`).join(''):'None yet'}</dd></dl></div>
 <div class="mt"><div class="sec">Sacraments</div>${sac.length?sac.map(s=>`<div class="li"><div class="tx"><b>${esc(s.type)}</b><small>${fdate(s.date)} · ${esc(s.regNo)}</small></div>${UI.bd(s.status)}<button class="btn sm" data-cert="${s.id}">Certificate</button></div>`).join(''):'<div class="mini">No sacramental records linked to this person yet.</div>'}</div>
 <div class="mt grid g2"><div><div class="sec">Attendance</div><div style="font-size:24px;font-weight:800">${att}%</div>${UI.bar(att,'g')}</div><div><div class="sec">Giving summary (12 mo)</div>${giv?`<div style="font-size:24px;font-weight:800">${ksh(Stats.personGiving(p.id))}</div><span class="mini">Confidential to finance & clergy</span>`:lock('Finance access only')}</div></div>
 <div class="mt"><div class="sec">Pastoral activity</div>${prv?(cases.length?cases.map(c=>`<div class="li"><div class="tx"><b>${esc(c.category)}</b><small>${esc(c.summary)}</small></div>${UI.bd(c.status)}</div>`).join(''):'<div class="mini">No pastoral cases on file.</div>'):`<div class="alert lock">${ic('lock')}<span>Pastoral records are confidential and visible to clergy only.</span></div>`}</div>
 <div class="mt"><div class="sec">Timeline</div><div class="tl">${tl.map(e=>`<div class="e"><b>${esc(e.t)}</b><small>${fdate(e.d)} · ${esc(e.s)}</small></div>`).join('')}</div></div>`;
 const d=UI.drawer({title:'Parishioner profile',sub:p.memberNo,html,footer:can('write')?[{label:'Close',fn:c=>c()},{label:'Add sacrament record',fn:c=>{c();location.href='/sacraments#Baptism&new='+p.id}},{label:'Edit profile',cls:'p',fn:c=>{c();location.href='/parishioners#edit='+p.id}}]:[{label:'Close',fn:c=>c()}]});
 $$('[data-cert]',d).forEach(b=>b.onclick=()=>Cert.preview(DB.get('sacraments',b.dataset.cert)))}};

const NAV=[
 {g:'Platform',i:'shield',items:[['Overview','/super-admin#Overview','platform'],['Applications','/super-admin#Applications','platform'],['Parishes','/super-admin#Parishes','platform'],['Dioceses','/super-admin#Dioceses','platform'],['Diocese Proposals','/super-admin#Diocese Proposals','platform'],['Platform Audit','/super-admin#Platform Audit','platform']]},
 {g:'Overview',i:'dash',items:[['Dashboard','/dashboard','dash'],['Parish Website','/website','dash'],['Diocesan Overview','/diocese','diocese']]},
 {g:'People',i:'people',items:[['Parishioners','/parishioners','parishioners'],['Families','/families','families'],['SCCs','/scc','scc'],['Ministries','/ministries','ministries'],['Volunteers','/ministries#Volunteers','ministries']]},
 {g:'Liturgy',i:'liturgy',items:[['Masses','/masses','masses'],['Mass Intentions','/masses#Intentions','masses'],['Sacraments','/sacraments','sacraments'],['Sermons','/sermons','sermons'],['Liturgical Calendar','/sermons#Liturgical Calendar','sermons']]},
 {g:'Pastoral',i:'pastoral',items:[['Pastoral Care','/pastoral','pastoral'],['Prayer Requests','/pastoral#Prayer Requests','pastoral'],['Catechesis','/catechesis','catechesis'],['Formation','/catechesis#Confirmation','catechesis'],['Visits','/pastoral#Visits','pastoral']]},
 {g:'Community',i:'comm',items:[['Events','/events','events'],['Seminars','/events#Seminars','events'],['Youth','/events#Youth','events'],['Children','/events#Children','events']]},
 {g:'Stewardship',i:'steward',items:[['Giving','/finance#Offerings','finance'],['Collections','/finance#Collections','finance'],['Expenses','/finance#Expenses','finance'],['Accounting','/accounting','accounting'],['Budgets','/finance#Budgets','finance'],['Projects','/projects','projects'],['Assets','/assets','assets']]},
 {g:'Communication',i:'msg',items:[['Announcements','/communications','comms'],['SMS / Email','/communications#SMS / Email','comms'],['Notifications','/communications#Notifications','comms']]},
 {g:'Administration',i:'admin',items:[['Documents','/documents','documents'],['Staff','/governance#Staff','governance'],['Councils','/governance#Councils','governance'],['Approvals','/governance#Approvals','governance']]},
 {g:'Reporting',i:'report',items:[['Reports','/reports','reports'],['Diocesan Submissions','/reports#Submissions','reports'],['Analytics','/reports#Analytics','reports']]},
 {g:'System',i:'sys',items:[['Users','/settings#Users','settings'],['Roles','/settings#Roles','settings'],['Audit Log','/settings#Audit Log','settings'],['Settings','/settings','settings']]}
];
const PORTAL_NAV=[{g:'My Parish',i:'dash',items:[['My Portal','/dashboard','portal'],['My Family','/dashboard#My Family','portal'],['Mass Schedule','/dashboard#Mass Schedule','portal'],['Giving','/dashboard#Giving','portal'],['Events','/dashboard#Events','portal'],['Sermons','/dashboard#Sermons','portal'],['Announcements','/dashboard#Announcements','portal'],['Sacraments','/dashboard#Sacraments','portal'],['Requests','/dashboard#Requests','portal'],['My Parish Website','/website','portal']]}];
const App={
 start(cfg){const u=Auth.user();DB.load();if(!u){location.replace(Boot.loginPath());return}
  const file=cfg.file,hash=()=>decodeURIComponent(location.hash.slice(1));const portal=u.role==='parishioner';const nav=(portal?PORTAL_NAV:NAV).map(g=>({...g,items:g.items.filter(it=>can(it[2]))})).filter(g=>g.items.length);
  const activeFor=()=>{const same=nav.flatMap(g=>g.items).filter(i=>i[1].split('#')[0]===file);const h=hash().split('&')[0];return same.find(i=>i[1].includes('#')&&decodeURIComponent(i[1].split('#')[1])===h)||same.find(i=>!i[1].includes('#'))||same[0]};
  const act=activeFor();
  const grp=nav.find(g=>g.items.includes(act))||{g:cfg.group||''};
  const org=u.scope==='Diocese'||u.scope==='Deanery'?u.organization:DB.load().parish.name;
  const canExit=(Ctx.parishes.length&&Ctx.parishId&&['super','diocese','deanery'].includes(u.role));
  document.body.innerHTML=`<div class="app" id="app"><aside class="side" id="side" aria-label="Main navigation"><div class="brand"><span class="mark">${CROSS(26,'#6E1725')}</span><div><b>PARISH YETU</b><span>${esc(org)}</span></div></div><nav class="nav" id="nav"></nav><div class="sidefoot"><b style="color:#fff">${esc(u.roleLabel)}</b><br>${esc(u.scope)} scope</div></aside><div class="main"><header class="top"><button class="iconbtn" id="burger" aria-label="Toggle navigation">${ic('menu')}</button><div class="crumb">Parish Yetu / ${esc(grp.g)} / <b id="crumbp">${esc(cfg.crumb||cfg.title)}</b></div><div class="gsearch">${ic('search')}<input id="gs" placeholder="Search pages and people…" aria-label="Global search" autocomplete="off"><div class="gres" id="gres"></div></div>${canExit?`<button class="btn" id="exitp" style="margin-right:6px">${ic('out')}Exit church</button>`:''}<span class="pill org sp2"><i></i>${esc(org)}</span>${Site.slug()?`<button class="pill site" id="sitepill" title="${esc(Site.display())}" aria-label="My parish website: ${esc(Site.display())}">${ic('globe')}<span>Parish website</span></button>`:''}<button class="iconbtn" id="bell" aria-label="Notifications">${ic('bell')}<span class="dot" id="bdot"></span></button><button class="user" id="usr" aria-label="Account menu"><span class="av b">${esc(u.avatar)}</span><div><b>${esc(u.name.split(' ').slice(0,2).join(' '))}</b><small>${esc(u.roleLabel)}</small></div></button></header><main class="content" id="content"><div class="phead"><div><h1 id="ptitle"></h1><p id="psub"></p></div><div class="pactions" id="pact"></div></div><div id="view"></div></main><footer class="foot"><span>${CROSS(11,'#C9A227')} Parish Yetu · Catholic parish management</span><span class="sp">Signed in as ${esc(u.roleLabel)} · ${esc(u.name)}</span></footer></div><div class="scrim" id="scrim"></div></div>`;
  const app=$('#app');
  if(u.impersonatedBy){const bn=document.createElement('div');bn.setAttribute('role','alert');bn.style.cssText='background:#B3261E;color:#fff;padding:9px 18px;font-weight:700;display:flex;gap:12px;align-items:center;flex-wrap:wrap';bn.innerHTML=`${ic('shield')}<span>Support session: you are signed in as ${esc(u.name)} (${esc(u.email)}). Everything you do here is done as this person and is attributed to them.</span><button class="btn sm" id="endimp" style="margin-left:auto;color:var(--obs)">End support session</button>`;$('.main').prepend(bn);$('#endimp').onclick=()=>Auth.logout().then(()=>location.href='/super-admin/login')}
  $('#nav').innerHTML=nav.map(g=>`<div class="ng ${g===grp?'open has-active':''}"><button aria-expanded="${g===grp}">${ic(g.i)}<span>${g.g}</span>${ic('chev','chev')}</button><div class="items">${g.items.map(it=>`<a href="${it[1].replace(/ /g,'%20')}" class="${it===act?'active':''}" data-h="${it[1]}">${it[0]}</a>`).join('')}</div></div>`).join('');
  $$('.ng>button').forEach(b=>b.onclick=()=>{if(app.classList.contains('collapsed')&&innerWidth>900){app.classList.remove('collapsed');localStorage.setItem('parishos.collapsed','0')}const g=b.parentElement;g.classList.toggle('open');b.setAttribute('aria-expanded',g.classList.contains('open'))});
  window.addEventListener('hashchange',()=>{const a=activeFor();$$('#nav a').forEach(x=>x.classList.toggle('active',x.dataset.h===(a&&a[1])))});
  if(localStorage.getItem('parishos.collapsed')==='1'&&innerWidth>900)app.classList.add('collapsed');
  $('#burger').onclick=()=>{if(innerWidth<=900)app.classList.toggle('navopen');else{app.classList.toggle('collapsed');localStorage.setItem('parishos.collapsed',app.classList.contains('collapsed')?'1':'0')}};
  $('#scrim').onclick=()=>app.classList.remove('navopen');
  const sp=$('#sitepill');if(sp)sp.onclick=e=>{e.stopPropagation();Site.menu(sp)};
  const exitBtn=$('#exitp');
  if(exitBtn)exitBtn.onclick=()=>Ctx.exitParish();
  const T=typeof cfg.title==='function'?cfg.title(u):cfg.title,S=typeof cfg.subtitle==='function'?cfg.subtitle(u):cfg.subtitle;document.title=T+' · Parish Yetu';$('#ptitle').textContent=T;$('#psub').textContent=S;
  const acts=typeof cfg.actions==='function'?cfg.actions(u):cfg.actions||[];acts.forEach(a=>{const b=document.createElement('button');b.className='btn '+(a.cls||'');b.innerHTML=(a.icon?ic(a.icon):'')+esc(a.label);b.onclick=()=>a.fn(b);$('#pact').appendChild(b)});
  const unread=()=>DB.c('notifications').filter(n=>!n.read).length;const dot=()=>{$('#bdot').style.display=unread()?'':'none'};dot();
  $('#bell').onclick=e=>{e.stopPropagation();const ns=DB.c('notifications').slice(0,7);const m=document.createElement('div');UI.menu($('#bell'),[...ns.map(n=>({label:(n.read?'':'● ')+n.text,fn:()=>{DB.upd('notifications',n.id,{read:true});DB.flush().finally(()=>{location.href=n.link})}})),'-',{label:'Mark all as read',fn:()=>{DB.c('notifications').forEach(n=>n.read=true);DB.save();dot();UI.toast('All notifications marked as read')}}]);const mm=$('.menu');mm.style.width='360px';mm.style.maxWidth='90vw';$$('button',mm).forEach(b=>{b.style.whiteSpace='normal'})};
  $('#usr').onclick=e=>{e.stopPropagation();const menuItems=[{label:u.name+' · '+u.roleLabel,fn:()=>{}},'-'];
   if(['super','diocese','deanery'].includes(u.role)&&Ctx.parishes.length>1)menuItems.push({label:'Switch church',fn:()=>Ctx.switcher()});
   if(Ctx.parishId&&['super','diocese','deanery'].includes(u.role))menuItems.push({label:'Exit church',fn:()=>Ctx.exitParish()});
   menuItems.push({label:'Back to homepage',fn:()=>location.href='/home'});
   menuItems.push({label:'Sign out',danger:true,fn:()=>{Auth.logout().then(()=>{location.href=(u.role==='super'||u.impersonatedBy)?'/super-admin/login':Boot.loginPath()})}});
   UI.menu($('#usr'),menuItems)};
  const gs=$('#gs'),gr=$('#gres');gs.oninput=()=>{const q=gs.value.trim().toLowerCase();if(q.length<2){gr.style.display='none';return}const pg=nav.flatMap(g=>g.items.map(i=>({l:i[0],h:i[1],s:g.g}))).filter(i=>i.l.toLowerCase().includes(q)).slice(0,5);const pp=can('pii')||can('parishioners')?DB.c('parishioners').filter(p=>p.name.toLowerCase().includes(q)).slice(0,5).map(p=>({l:p.name,h:'/parishioners#open='+p.id,s:'Parishioner'})):[];const r=[...pg,...pp];gr.innerHTML=r.length?r.map(i=>`<a href="${i.h}">${esc(i.l)} <span class="mini">· ${esc(i.s)}</span></a>`).join(''):'<a href="#" style="color:var(--grey)">No matches</a>';gr.style.display='block'};document.addEventListener('click',e=>{if(!e.target.closest('.gsearch'))gr.style.display='none'});
  const view=$('#view');
  {
   const mins=+DB.load().settings.sessionMinutes||30;let idle;
   const arm=()=>{clearTimeout(idle);idle=setTimeout(()=>{Auth.logout().then(()=>{sessionStorage.setItem('parishos.notice','You were signed out after a period of inactivity.');location.href=(u.role==='super'||u.impersonatedBy)?'/super-admin/login':Boot.loginPath()})},mins*60000)};
   ['click','keydown','pointerdown'].forEach(ev=>document.addEventListener(ev,arm,{passive:true}));arm();
   if(!Ctx.parishId&&u.role!=='parishioner'&&u.role!=='super'){const ph=$('.phead');if(ph)ph.insertAdjacentHTML('beforebegin',`<div class="alert" style="margin-bottom:16px">${ic('shield')}<span><b>No church is selected.</b> ${u.role==='super'?'Create the first diocese and church under Settings → Churches, or enter a church from the list.':'No churches are linked to your account yet. Contact the platform administrator.'}</span></div>`)}
  }
  if(![].concat(cfg.mod).some(can)){view.innerHTML=`<div class="card"><div class="skel"><div style="max-width:420px">${ic('lock')}<h3 style="margin:10px 0 6px">Access restricted</h3><p style="color:var(--grey)">Your role (${esc(u.roleLabel)}) does not include the ${esc(cfg.title)} module. Open your workspace to continue.</p><a class="btn p mt" href="${u.landing}">Go to my dashboard</a></div></div></div>`;return}
  try{cfg.render(view,u)}catch(err){console.error(err);view.innerHTML=`<div class="alert red">This view could not be displayed: ${esc(err.message)}</div>`}
  UI.countUp(view);
  if(cfg.onHash)cfg.onHash()}
};

const priestNames=()=>{const n=[];const pa=DB.load().parish;if(pa&&pa.priest)n.push(pa.priest);DB.c('staff').forEach(s=>{if(/priest|fr\.|father|curate|vicar|deacon/i.test((s.position||'')+' '+(s.name||''))&&!n.includes(s.name))n.push(s.name)});return n.length?n:['Parish Priest']};

/* ---------- church switching (super / diocese / deanery only) ---------- */
Ctx.enterParish=function(pid){
  if(!pid)return;
  sessionStorage.setItem('parishos.parish',pid);
  location.href='/dashboard';
};
Ctx.exitParish=function(){
  sessionStorage.removeItem('parishos.parish');
  const u=Auth.user();
  if(u&&u.role==='super'){location.href='/super-admin';return}
  if(u&&(u.role==='diocese'||u.role==='deanery')){location.href='/diocese';return}
  location.href='/dashboard';
};
Ctx.switcher=()=>UI.formModal({title:'Switch church',fields:[{k:'p',label:'Church',type:'select',options:()=>Ctx.parishes.map(p=>({v:p.id,l:p.name})),blank:false}],values:{p:Ctx.parishId},submit:'Switch',onSave:v=>Ctx.enterParish(v.p)});
/* ===== PARISH YETU · parish website (public homepage) helpers =====
 * The link always comes from the signed-in user's own parish record (DB.load().parish), which the
 * Security Rules only let them read for their assigned parish. Never from a URL parameter. */
const Site={
 base(){return (FB&&FB.siteBase)||'https://parishyetu.church'},
 parish(){const p=DB.load().parish;return Ctx.parishId&&p&&p.id===Ctx.parishId?p:null},
 slug(p){p=p||Site.parish();return p&&p.slug?String(p.slug):''},
 url(slug){slug=slug||Site.slug();return slug?Site.base()+'/'+slug:''},
 display(slug){return Site.url(slug).replace(/^https?:\/\//,'')},
 /* Opens through the current host so the link also works before the custom domain is connected. */
 openHref(slug,preview){slug=slug||Site.slug();if(!slug)return '';const live=/(^|\.)parishyetu\.church$/.test(location.hostname);return (live?Site.base():location.origin)+'/'+slug+(preview?'?preview=1':'')},
 status(p){p=p||Site.parish();if(!p)return{label:'Not available',cls:''};if(p.status&&p.status!=='active')return{label:'Offline — parish '+p.status,cls:'r'};if(p.verificationStatus==='pending')return{label:'Awaiting verification',cls:'y'};if(!p.websitePublished)return{label:'Being configured',cls:'y'};return{label:'Published',cls:'g'}},
 canManage(){const u=Auth.user();return !!u&&['priest','admin','super'].includes(u.role)},
 async copy(slug){const t=Site.url(slug);try{await navigator.clipboard.writeText(t)}catch(e){const i=document.createElement('textarea');i.value=t;document.body.appendChild(i);i.select();try{document.execCommand('copy')}catch(x){}i.remove()}UI.toast('Website link copied')},
 async share(slug){const p=Site.parish(),t=Site.url(slug);if(navigator.share){try{await navigator.share({title:p?p.name:'Our parish',text:(p?p.name:'Our parish')+' on PARISH YETU',url:t});return}catch(e){if(e&&e.name==='AbortError')return}}Site.copy(slug)},
 menu(anchor){const s=Site.slug();if(!s)return;UI.menu(anchor,[{label:Site.display(),fn:()=>Site.copy()},'-',{label:'Open website',fn:()=>window.open(Site.openHref(),'_blank','noopener')},{label:'Copy link',fn:()=>Site.copy()},{label:'Share link',fn:()=>Site.share()},...(Site.canManage()?['-',{label:'Manage website',fn:()=>location.href='/website'}]:[])])},
 /* Compact identity card used on dashboards. */
 card(o){o=o||{};const p=Site.parish();if(!p)return '';const s=Site.slug(p);
  if(!s)return `<div class="card sitecard"><div class="cb"><div class="sc-row"><span class="sc-ic">${ic('globe')}</span><div class="sc-tx"><small>${esc(o.title||'Parish Website')}</small><span class="mini">A public web address has not been assigned to this parish yet. The platform administrator can assign one.</span></div></div></div></div>`;
  const st=Site.status(p),href=esc(Site.openHref(s));
  return `<div class="card sitecard"><div class="cb"><div class="sc-row"><span class="sc-ic">${ic('globe')}</span><div class="sc-tx"><small>${esc(o.title||'Parish Website')}</small><a class="sc-url" href="${href}" target="_blank" rel="noopener">${esc(Site.display(s))}</a><span class="bd ${st.cls}">${esc(st.label)}</span></div><div class="sc-act"><a class="btn sm p" href="${href}" target="_blank" rel="noopener">${ic('ext')}Open</a><button class="btn sm" data-site-copy>${ic('copy')}Copy</button><button class="btn sm" data-site-share>${ic('share')}Share</button>${o.manage&&Site.canManage()?`<a class="btn sm" href="/website">${ic('edit')}Manage</a>`:''}</div></div></div></div>`},
 bind(root){$$('[data-site-copy]',root||document).forEach(b=>b.onclick=()=>Site.copy());$$('[data-site-share]',root||document).forEach(b=>b.onclick=()=>Site.share())}
};
(function(){if(typeof document==='undefined'||document.getElementById('py-site-css'))return;const st=document.createElement('style');st.id='py-site-css';st.textContent=`
.pill.site{background:#fff;border:1px solid var(--line,#E8E5DD);color:var(--bur,#6E1725);cursor:pointer;margin-left:6px;font-family:inherit}
.pill.site .i{width:14px;height:14px}.pill.site:hover{border-color:var(--bur,#6E1725)}
@media (max-width:900px){.pill.site span{display:none}}
.sitecard .sc-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.sitecard .sc-ic{width:44px;height:44px;border-radius:12px;background:var(--bur,#6E1725);color:#fff;display:grid;place-items:center;flex:none}
.sitecard .sc-ic .i{width:22px;height:22px;stroke:#fff}
.sitecard .sc-tx{flex:1;min-width:200px;display:flex;flex-direction:column;gap:3px}
.sitecard .sc-tx small{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--grey,#8B8A84)}
.sitecard .sc-url{font-weight:800;font-size:16px;color:var(--bur,#6E1725);word-break:break-all}
.sitecard .sc-url:hover{text-decoration:underline}
.sitecard .sc-tx .bd{align-self:flex-start}
.sitecard .sc-act{display:flex;gap:8px;flex-wrap:wrap}`;document.head.appendChild(st)})();

/* ---------- platform (Super Admin) helpers. Super Admin writes are authorised by the Security Rules. ---------- */
const Platform={
 async uniqueSlug(base){
  const S=window.ParishSlug;let s=S.isReserved(base)?'parish-'+base:base;
  for(let i=0;i<8;i++){
   if(S.isValid(s)){const [a,b]=await Promise.all([FB.db.doc('slugs/'+s).get(),FB.db.doc('parishes/'+s).get()]);if(!a.exists&&!b.exists)return s}
   s=S.withSuffix(base);
  }
  throw new Error('Could not find a free web address. Try again.');
 },
 audit(action,data){return FB.db.collection('platformAudit').add({action,...data,by:Auth.user().id,byName:Auth.user().name,at:ts()})},
 /* v: {name, dioceseId, deanery, town, county, country, address, phone, email, priest}; d: the diocese record or null */
 async createParish(v,d){
  const S=window.ParishSlug;if(!S)throw new Error('Slug helper not loaded');
  const name=String(v.name).trim(),town=String(v.town||'').trim();
  const base=S.parishSlug(name,town)||'parish-'+Math.random().toString(36).slice(2,8);
  const slug=await Platform.uniqueSlug(base),id=slug;
  const short=(name.replace(/\b(parish|church|catholic|st\.?|saint|of|the)\b/ig,'').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w=>w[0]).join('')||'PAR').toUpperCase().slice(0,4);
  const dean=(d&&(d.deaneries||[]).find(x=>x.name===v.deanery||x.id===v.deaneryId))||null;
  const pub={name,short,town,county:v.county||'',country:v.country||(d&&d.country)||'',address:v.address||'',phone:v.phone||'',email:v.email||'',dioceseId:d?d.id:'',dioceseName:d?d.name:'',deanery:dean?dean.name:(v.deanery||''),slug,motto:'',websitePublished:false,status:'active'};
  const site={published:false,displayName:name,motto:'',welcome:'Welcome to '+name,about:'',patron:'',accent:'burgundy',logoUrl:'',bannerUrl:'',contact:{phone:pub.phone,email:pub.email,address:pub.address,location:[town,pub.county,pub.country].filter(Boolean).join(', '),officeHours:'',mapUrl:''},social:{website:'',facebook:'',youtube:'',instagram:'',x:'',whatsapp:''},priest:{name:v.priest||'',title:'Parish Priest',show:!!v.priest},massSchedule:[],outstations:[],events:[],announcements:[],ministries:[],sermons:[],updatedAt:ts()};
  const b=FB.db.batch();
  b.set(FB.db.doc('parishes/'+id),{...pub,diocese:d?d.name:'',archdiocese:d?(d.kind==='Archdiocese'?d.name:d.archdiocese||''):'',deaneryId:dean?dean.id:'',priest:v.priest||'',patron:'',outstations:['Main Church'],stats:{},registrationStatus:'active',verificationStatus:'verified',nameKey:S.nameKey(name,town),townKey:S.placeKey(town),registeredVia:'platform-admin',createdAt:ts(),updatedAt:ts()});
  b.set(FB.db.doc('churchDirectory/'+id),{...pub,createdAt:ts()});
  b.set(FB.db.doc('parishes/'+id+'/config/settings'),{...SETTINGS0,createdAt:ts()});
  b.set(FB.db.doc('parishes/'+id+'/public/draft'),site);
  b.set(FB.db.doc('parishes/'+id+'/public/site'),site);
  b.set(FB.db.doc('slugs/'+slug),{parishId:id,status:'active',createdAt:ts()});
  await b.commit();
  await Platform.audit('parish.created',{parishId:id,slug,name}).catch(()=>{});
  return {id,slug};
 }
};

/* Branding images (logo / banner) go to the existing R2 Worker under parishes/{id}/public/.
 * The Worker checks the caller's live profile: only that parish's priest or administrator may upload. */
Site.prepareImage=(file,max)=>new Promise((res,rej)=>{
 if(!/^image\/(png|jpeg|webp)$/.test(file.type))return rej(new Error('Use a PNG, JPEG or WebP image.'));
 if(file.size>15*1024*1024)return rej(new Error('That image is too large (maximum 15 MB before resizing).'));
 const img=new Image(),u=URL.createObjectURL(file);
 img.onload=()=>{URL.revokeObjectURL(u);const k=Math.min(1,max/Math.max(img.width,img.height));
  if(k===1&&file.size<=700*1024)return res(file);
  const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  c.toBlob(b=>{if(!b)return res(file);res(new File([b],'image.webp',{type:b.type||'image/webp'}))},'image/webp',.88)};
 img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('That file could not be read as an image.'))};img.src=u});
Site.uploadImage=async(file,kind,parishId)=>{
 if(!FB.r2Worker)throw new Error('Image storage is not configured yet.');
 const f=await Site.prepareImage(file,kind==='banner'?1920:512);
 if(f.size>5*1024*1024)throw new Error('Images must be smaller than 5 MB.');
 const tok=await FB.auth.currentUser.getIdToken();
 const r=await fetch(FB.r2Worker+'/presign-media',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:JSON.stringify({kind,contentType:f.type,size:f.size,parishId:parishId||Ctx.parishId})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||('Upload was refused ('+r.status+')'));
 const up=await fetch(j.url,{method:'PUT',headers:{'Content-Type':f.type},body:f});
 if(!up.ok)throw new Error('The image could not be uploaded ('+up.status+').');
 return j.publicUrl;
};
