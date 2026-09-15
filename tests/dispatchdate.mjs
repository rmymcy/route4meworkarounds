/* The dispatch date is the day the crews go out. Schedule_Date is coloured
   against it — red once a job is already due, amber for the day of and the day
   after — and it adds nothing to the Route4Me upload.
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

// Six jobs due across a working week: Mon 21 Sep 2026 through Mon 28 Sep.
const HDR='"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date","BuildType"';
const DUE=['09/21/26','09/22/26','09/23/26','09/24/26','09/25/26','09/28/26'];
await page.evaluate(([h,due])=>{
  const sub=SUBS.find(s=>geoOk(s.lat,s.lng)).name;
  window.__csv=[h,...due.map((d,i)=>
    `"09/07/26","F1","OUT","B","1","${770000+i}","${100+i} Oak St","M","${sub}","","FORM SURVEY","","D","T","${d}",""`)].join('\n')+'\n';
  loadFile01ForReview(window.__csv,'file01.csv',false);
  const b=document.getElementById('umSkip'); if(b) b.click();
},[HDR,DUE]);
await page.waitForTimeout(400);

/* What the Schedule_Date cell of each row looks like: late / soon / plain. */
const shade=async iso=>{
  await page.fill('#schedFor',iso); await page.waitForTimeout(250);
  return page.evaluate(()=>{
    const heads=[...document.querySelectorAll('#jobsTable thead th')].map(t=>t.textContent.trim());
    const col=heads.indexOf('Schedule_Date');
    return [...document.querySelectorAll('#jobsTable tbody tr')].map(tr=>{
      const td=tr.children[col]; if(!td) return '?';
      return td.querySelector('.due-late') ? 'late' : td.querySelector('.due-soon') ? 'soon' : 'plain';
    }).join(' ');
  });
};

// Dispatching Monday: only that day's work is urgent, the rest of the week is not.
let st=await shade('2026-09-21');
check('going out Monday, Monday is due and Tuesday is next',st==='soon soon plain plain plain plain',st);

// Dispatching Wednesday: Monday and Tuesday have gone past.
st=await shade('2026-09-23');
check('going out Wednesday, the start of the week is already late',st==='late late soon soon plain plain',st);

// Dispatching Friday: Monday is the next working day, so it counts as next up
// even though the calendar gap is three days.
st=await shade('2026-09-25');
check('going out Friday, Monday is next up across the weekend',st==='late late late late soon soon',st);

// From Thursday the same Monday is two working days out, so it is not urgent.
st=await shade('2026-09-24');
check('from Thursday that Monday is not urgent yet',st==='late late late soon soon plain',st);

// Dispatching before any of it: nothing is urgent yet.
st=await shade('2026-09-14');
check('a batch going out early flags nothing',st==='plain plain plain plain plain plain',st);

// The colouring follows the picker, not the machine clock.
const today=await page.evaluate(()=>todayStamp());
check('the reference date is the picker, not today',today==='2026-09-15',today);

// ---- and none of it reaches Route4Me ----
await page.fill('#schedFor','2026-09-23'); await page.waitForTimeout(200);
st=await page.evaluate(()=>{
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim());
  return {header:h.join('|'), sched:'schedFor' in res};
});
check('the upload gains no Scheduled For column',!/Scheduled For/.test(st.header),st.header);
check('the columns stay lean',st.header==='Alias|Latitude|Longitude|Svc Job Num|Depot',st.header);

// ---- the picker itself ----
const tomorrow=await page.evaluate(()=>tomorrowStamp());
const backdate=v=>page.evaluate(x=>{
  const k='r4m_trimstate_v1', ts=JSON.parse(localStorage.getItem(k)||'{}');
  ts.sched=x; ts.schedOn='2020-01-01';          // saved on some earlier day
  localStorage.setItem(k,JSON.stringify(ts));
},v);

await page.fill('#schedFor','2026-10-05'); await page.waitForTimeout(250);
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(900);
check('a refresh keeps the date that was chosen',await page.inputValue('#schedFor')==='2026-10-05',
  await page.inputValue('#schedFor'));

await backdate('2026-10-05');
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(900);
check('yesterday’s date does not carry over',await page.inputValue('#schedFor')===tomorrow,
  `${await page.inputValue('#schedFor')} vs ${tomorrow}`);

await backdate('');
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(900);
check('a new day starts at tomorrow even after a clear',await page.inputValue('#schedFor')===tomorrow,
  await page.inputValue('#schedFor'));

await page.evaluate(()=>localStorage.setItem('r4m_region_v1','HOU'));
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(700);
check('another region does not inherit it',await page.inputValue('#schedFor')!=='2026-10-05',
  await page.inputValue('#schedFor'));

// ---- "tomorrow" across the boundaries a naive +24h gets wrong ----
// Instants are pinned in UTC and read in US Eastern, where the tool is used.
const east=await browser.newContext({timezoneId:'America/New_York'});
await east.route('**/*.tile.openstreetmap.org/**',r=>r.abort());
const ep=await east.newPage();
await ep.goto(URL); await ep.waitForSelector('#regionBar .region.active');
for(const [now,want,label] of [
  ['2026-09-15T13:00Z','2026-09-16','an ordinary day'],
  ['2026-10-01T03:30Z','2026-10-01','the last night of a month'],
  ['2026-12-31T23:00Z','2027-01-01','new year’s eve'],
  ['2028-02-28T15:00Z','2028-02-29','the eve of a leap day'],
  ['2026-03-08T04:00Z','2026-03-08','the night the clocks go forward'],
  ['2026-11-01T05:30Z','2026-11-02','the hour that happens twice'],
]){
  await ep.clock.setFixedTime(new Date(now));
  const [t,tm]=await ep.evaluate(()=>[todayStamp(),tomorrowStamp()]);
  check(`tomorrow is right on ${label}`,tm===want,`${t} -> ${tm}, want ${want}`);
}

await browser.close();
console.log(fails.length?`\n${fails.length} FAILED: `+fails.join(', '):'\nALL PASS');
process.exit(fails.length?1:0);
