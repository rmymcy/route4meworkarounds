/* Townhome jobs: marked per job, on-site time divided.  node tests/townhomes.mjs */
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

// 35-minute form surveys, six of them
const HDR='"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date"';
await page.evaluate(h=>{
  const m=loadTaskMx(); m.tasks=[{name:'FORM SURVEY',svc:'35'}]; saveTaskMx(m); TASKMX=null;
  const sub=SUBS.find(s=>geoOk(s.lat,s.lng)).name;
  window.__csv=[h,...[0,1,2,3,4,5].map(i=>
    `"09/07/26","F1","OUT","B","1","${850000+i}","${100+i} Oak St","M","${sub}","","FORM SURVEY","","D","T","09/20/26"`)].join('\n')+'\n';
  loadFile01ForReview(window.__csv,'file01.csv',false);
  const b=document.getElementById('umSkip'); if(b) b.click();
},HDR);
await page.waitForTimeout(300);

const svcOf = () => page.evaluate(()=>{
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim());
  const iS=h.indexOf('Service Time'), iJ=h.indexOf('Svc Job Num'), iD=h.indexOf('Depot');
  const jobs=res.rows.slice(1).filter(r=>iD<0||String(r[iD])!=='1');   // skip the crew depot rows
  return { svc:jobs.map(r=>String(r[iS])), keys:jobs.map(r=>String(r[iJ])),
    thN:res.thN, thDiv:res.thDiv };
});

let st=await svcOf();
check('every job starts at the task time',st.svc.join(',')==='35,35,35,35,35,35',st.svc.join(','));
check('none marked yet',st.thN===0);
st=await page.evaluate(()=>loadTaskMx().builds.find(b=>b.code==='T').pct);
check('townhomes default to 40% of normal time',st==='40',st);

// mark three via the toolbar button
st=await page.evaluate(()=>{
  jobsSel.clear(); jobsRows.slice(0,3).forEach(r=>jobsSel.add(r.id)); renderJobs();
  document.getElementById('thBtn').click();
  return { n:JOB_TH.size, toast:document.getElementById('toast').textContent,
    count:document.getElementById('trimCount').textContent,
    badges:document.querySelectorAll('#jobsBody .badge.sec').length };
});
check('three jobs marked',st.n===3,`${st.n}`);
check('the toast says what happened',/3 job\(s\) marked TH — on-site time cut to 40%/.test(st.toast),st.toast.slice(0,80));
check('the day summary counts them',/3 TH/.test(st.count),st.count);
check('marked rows are badged',st.badges===3,`${st.badges} badges`);

st=await svcOf();
check('35 minutes becomes 14 for townhomes',st.svc.slice(0,3).join(',')==='14,14,14',st.svc.join(','));
check('the others are untouched',st.svc.slice(3).join(',')==='35,35,35',st.svc.join(','));
check('the export counts them',st.thN===3,`${st.thN}`);

// the button toggles back off
st=await page.evaluate(()=>{
  document.getElementById('thBtn').click();
  return { n:JOB_TH.size, toast:document.getElementById('toast').textContent };
});
check('clicking again clears them',st.n===0,`${st.n}`);
check('and says so',/back to full on-site time/.test(st.toast),st.toast.slice(0,70));

// a partial selection turns the whole selection on, rather than toggling half off
st=await page.evaluate(()=>{
  jobsSel.clear(); jobsRows.slice(0,2).forEach(r=>jobsSel.add(r.id)); renderJobs();
  document.getElementById('thBtn').click();                       // 2 on
  jobsSel.clear(); jobsRows.slice(0,4).forEach(r=>jobsSel.add(r.id)); renderJobs();
  document.getElementById('thBtn').click();                       // 2 already on, 2 off -> all on
  return JOB_TH.size;
});
check('a mixed selection turns everything on',st===4,`${st}`);

// (editing the percentages is covered in tests/buildtypes.mjs)

// survives a refresh, and a fresh import clears it
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(800);
st=await page.evaluate(()=>({n:JOB_TH.size,count:document.getElementById('trimCount').textContent}));
check('marks survive a refresh',st.n===4,`${st.n}`);
// the reload wiped the page global the test was holding the csv in — rebuild it
await page.evaluate(h=>{
  const sub=SUBS.find(s=>geoOk(s.lat,s.lng)).name;
  window.__csv=[h,...[0,1,2,3,4,5].map(i=>
    `"09/07/26","F1","OUT","B","1","${850000+i}","${100+i} Oak St","M","${sub}","","FORM SURVEY","","D","T","09/20/26"`)].join('\n')+'\n';
},HDR);
st=await page.evaluate(()=>{ loadFile01ForReview(window.__csv,'file01b.csv',false);
  const b=document.getElementById('umSkip'); if(b) b.click(); return JOB_TH.size; });
check('a fresh import starts clean',st===0,`${st}`);

// no service times at all -> no column, nothing to divide
st=await page.evaluate(()=>{
  const m=loadTaskMx(); m.tasks=[{name:'FORM SURVEY',svc:''}]; saveTaskMx(m); TASKMX=null;
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  return { header:res.rows[0].map(x=>String(x).trim()).join('|'), svcOn:res.svcOn, thN:res.thN };
});
check('no on-site times means no Service Time column',!/Service Time/.test(st.header)&&!st.svcOn,st.header);
check('and nothing counted as divided',st.thN===0);

await page.evaluate(()=>{localStorage.clear();localStorage.setItem('r4m_region_v1','FL');});
await browser.close();
console.log(fails.length?`\n${fails.length} FAILURES: ${fails.join('; ')}`:'\nALL PASS');
process.exit(fails.length?1:0);
