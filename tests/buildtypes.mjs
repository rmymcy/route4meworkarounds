/* BuildType letters scale on-site time; the manual TH and Rush flags override.
   Run: node tests/buildtypes.mjs                                            */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const URL='file:///home/user/route4meworkarounds/index.html';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await browser.newContext(); await ctx.route('**/*.tile.openstreetmap.org/**',r=>r.abort());
const page=await ctx.newPage(); page.on('pageerror',e=>console.log('PAGEERROR:',e.message));
const fails=[]; const check=(n,ok,x='')=>{console.log((ok?'PASS':'FAIL')+' '+n+(x?` (${x})`:''));if(!ok)fails.push(n);};

await page.goto(URL); await page.waitForSelector('#regionBar .region.active');
await page.evaluate(async()=>{localStorage.clear();localStorage.setItem('r4m_region_v1','FL');
  try{const db=await idbOpen();await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=r;t.onerror=r;});}catch(e){}});
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(600);

const HDR='"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date","BuildType"';
await page.evaluate(h=>{
  const m=loadTaskMx(); m.tasks=[{name:'FORM SURVEY',svc:'100'}]; saveTaskMx(m); TASKMX=null;
  const sub=SUBS.find(s=>geoOk(s.lat,s.lng)).name;
  const types=['','A','C','D','M','T'];
  window.__csv=[h,...types.map((bt,i)=>
    `"09/07/26","F1","OUT","B","1","${860000+i}","${100+i} Oak St","M","${sub}","","FORM SURVEY","","D","T","09/20/26","${bt}"`)].join('\n')+'\n';
  loadFile01ForReview(window.__csv,'file01.csv',false);
  const b=document.getElementById('umSkip'); if(b) b.click();
},HDR);
await page.waitForTimeout(300);

const out=()=>page.evaluate(()=>{
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim());
  const iS=h.indexOf('Service Time'), iD=h.indexOf('Depot'), iP=h.indexOf('Priority'), iC=h.indexOf('Color');
  const jobs=res.rows.slice(1).filter(r=>iD<0||String(r[iD])!=='1');
  return { svc:jobs.map(r=>String(r[iS])), prio:iP>=0?jobs.map(r=>String(r[iP])):null,
    color:iC>=0?jobs.map(r=>String(r[iC])):null, thN:res.thN, header:h.join('|') };
});

let st=await out();
check('a 100-minute task scales by build type',st.svc.join(',')==='100,100,100,70,100,40',st.svc.join(','));
check('duplex is 70%, townhome 40%, the rest unchanged',st.svc[3]==='70'&&st.svc[5]==='40',`D=${st.svc[3]} T=${st.svc[5]}`);
check('only the two that change are counted',st.thN===2,`${st.thN}`);

// an unknown letter must not silently shrink anything
st=await page.evaluate(()=>{
  const csv=window.__csv.replace(/,"T"\r?\n?$/,',"Q"\n');
  const res=buildFile02(parseCSV(csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim()); const iS=h.indexOf('Service Time'), iD=h.indexOf('Depot');
  return res.rows.slice(1).filter(r=>String(r[iD])!=='1').map(r=>String(r[iS])).join(',');
});
check('a letter we do not know leaves the time alone',/,100$/.test(st),st);

// the manual TH flag wins over whatever Sage sent
st=await page.evaluate(()=>{
  jobsSel.clear(); jobsSel.add(jobsRows[0].id); jobsSel.add(jobsRows[3].id); renderJobs();  // blank + D
  document.getElementById('thBtn').click();
  return document.getElementById('toast').textContent;
});
check('marking TH says what it does now',/cut to 40%/.test(st),st.slice(0,70));
st=await out();
check('a hand-marked job takes the townhome time whatever Sage said',
  st.svc[0]==='40'&&st.svc[3]==='40',`blank=${st.svc[0]} D=${st.svc[3]}`);
await page.evaluate(()=>{document.getElementById('thBtn').click();});

// the percentages are editable
st=await page.evaluate(async()=>{
  document.querySelector('.tab[data-tab="settings"]').click();
  await new Promise(r=>setTimeout(r,250));
  const rows=[...document.querySelectorAll('#buildBody tr')];
  const dup=[...document.querySelectorAll('[data-bpct]')][3];
  dup.value='50'; dup.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,250));
  return { n:rows.length, stored:loadTaskMx().builds.find(b=>b.code==='D').pct,
    counts:document.querySelectorAll('#buildBody tr td:last-child').length,
    toast:document.getElementById('toast').textContent };
});
check('six build types listed',st.n===6,`${st.n}`);
check('a percentage edits and stores',st.stored==='50',st.stored);
check('and says so',/Duplex jobs now take 50%/.test(st.toast),st.toast.slice(0,60));
st=await out();
check('the new percentage reaches the export',st.svc[3]==='50',st.svc.join(','));

st=await page.evaluate(async()=>{
  const dup=[...document.querySelectorAll('[data-bpct]')][3];
  dup.value='0'; dup.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>setTimeout(r,200));
  return { stored:loadTaskMx().builds.find(b=>b.code==='D').pct, shown:dup.value };
});
check('zero percent is refused',st.stored==='50'&&st.shown==='50',`${st.stored}/${st.shown}`);

// ---- the manual Rush flag ----
await page.evaluate(()=>document.querySelector('.tab[data-tab="dispatch"]').click());
st=await page.evaluate(()=>{
  jobsSel.clear(); jobsSel.add(jobsRows[1].id); renderJobs();
  document.getElementById('rushBtn').click();
  return { n:JOB_RUSH.size, toast:document.getElementById('toast').textContent,
    badges:document.querySelectorAll('#jobsBody .badge.err').length,
    count:document.getElementById('trimCount').textContent };
});
check('a job can be flagged by hand',st.n===1,`${st.n}`);
check('at the same value as the Sage letter',/priority 5 — same as a Sage "R"/.test(st.toast),st.toast.slice(0,80));
check('the row is badged',st.badges===1,`${st.badges}`);
check('the day summary counts it',/1 flagged/.test(st.count),st.count);

st=await out();
check('the flag brings the Priority column back',/Priority/.test(st.header),st.header);
check('only that job scores, and it is red',st.prio.filter(p=>p!=='').length===1&&st.prio[1]==='5'&&st.color[1]==='FF0000',
  JSON.stringify(st.prio));

st=await page.evaluate(()=>{document.getElementById('rushBtn').click(); return {n:JOB_RUSH.size,toast:document.getElementById('toast').textContent};});
check('clicking again unflags',st.n===0&&/no longer flagged/.test(st.toast),st.toast.slice(0,50));

// survives a refresh
await page.evaluate(()=>{jobsSel.clear();jobsSel.add(jobsRows[2].id);renderJobs();document.getElementById('rushBtn').click();});
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(800);
st=await page.evaluate(()=>({rush:JOB_RUSH.size,th:JOB_TH.size}));
check('hand flags survive a refresh',st.rush===1,`${st.rush} rush`);

await page.evaluate(()=>{localStorage.clear();localStorage.setItem('r4m_region_v1','FL');});
await browser.close();
console.log(fails.length?`\n${fails.length} FAILURES: ${fails.join('; ')}`:'\nALL PASS');
process.exit(fails.length?1:0);
