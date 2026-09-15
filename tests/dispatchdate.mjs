/* The dispatch date stamps every job as "Scheduled For", leaves depot rows
   blank, drops the column when cleared, and survives a refresh.
   Run: node tests/dispatchdate.mjs                                          */
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
  const sub=SUBS.find(s=>geoOk(s.lat,s.lng)).name;
  window.__csv=[h,...[0,1,2].map(i=>
    `"09/07/26","F1","OUT","B","1","${770000+i}","${100+i} Oak St","M","${sub}","","FORM SURVEY","","D","T","09/20/26",""`)].join('\n')+'\n';
  loadFile01ForReview(window.__csv,'file01.csv',false);
  const b=document.getElementById('umSkip'); if(b) b.click();
},HDR);
await page.waitForTimeout(400);

const out=()=>page.evaluate(()=>{
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim());
  const iS=h.indexOf('Scheduled For'), iD=h.indexOf('Depot');
  const body=res.rows.slice(1);
  return { header:h.join('|'), has:iS>=0, schedFor:res.schedFor,
    jobs:iS<0?[]:body.filter(r=>String(r[iD])!=='1').map(r=>String(r[iS])),
    depots:iS<0?[]:body.filter(r=>String(r[iD])==='1').map(r=>String(r[iS])) };
});

// 1. a fresh import defaults to tomorrow
const val=await page.inputValue('#schedFor');
const want=new Date(Date.now()+86400000).toISOString().slice(0,10);
check('a fresh import defaults to tomorrow',val===want,`${val} vs ${want}`);

// 2. the date reaches every job, in the M/D/YYYY shape Route4Me reads
await page.fill('#schedFor','2026-09-21'); await page.waitForTimeout(150);
let st=await out();
check('the column appears when a date is set',st.has,st.header);
check('it sits right after Svc Job Num',/Svc Job Num\|Scheduled For/.test(st.header),st.header);
check('every job carries the date',st.jobs.length===3&&st.jobs.every(v=>v==='9/21/2026'),st.jobs.join(','));
check('the date is not zero-padded',st.schedFor==='9/21/2026',String(st.schedFor));
check('depot rows are left blank',st.depots.length>0&&st.depots.every(v=>v===''),`${st.depots.length} depots`);

// a two-digit month and day keep their own shape
await page.fill('#schedFor','2026-12-25'); await page.waitForTimeout(150);
st=await out();
check('a December date reads back whole',st.jobs.every(v=>v==='12/25/2026'),st.jobs[0]);

// 3. clearing it drops the column entirely
await page.fill('#schedFor',''); await page.waitForTimeout(150);
st=await out();
check('clearing the date removes the column',!st.has,st.header);
check('and nothing else shifts',st.header==='Alias|Latitude|Longitude|Svc Job Num|Depot',st.header);

// 4. the chosen date survives a refresh, rather than resetting to tomorrow
await page.fill('#schedFor','2026-10-05'); await page.waitForTimeout(250);
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(900);
check('a refresh keeps the date that was chosen',await page.inputValue('#schedFor')==='2026-10-05',
  await page.inputValue('#schedFor'));

// 5. it is per region, like everything else
await page.evaluate(()=>localStorage.setItem('r4m_region_v1','HOU'));
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(700);
check('another region does not inherit it',await page.inputValue('#schedFor')!=='2026-10-05',
  await page.inputValue('#schedFor'));

await browser.close();
console.log(fails.length?`\n${fails.length} FAILED: `+fails.join(', '):'\nALL PASS');
process.exit(fails.length?1:0);
