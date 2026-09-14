/* Priority is deliberately sparse: only a letter Sage puts in its Priority
   column earns one. Route4Me reads priority as a sequencing instruction, so a
   priority on every stop makes it order the day by priority instead of by drive
   time — which defeats the routing. Run: node tests/priority.mjs            */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const URL = 'file:///home/user/route4meworkarounds/index.html';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext();
await ctx.route('**/*.tile.openstreetmap.org/**', r => r.abort());
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const fails = [];
const check = (n, ok, x='') => { console.log((ok?'PASS':'FAIL')+' '+n+(x?` (${x})`:'')); if(!ok) fails.push(n); };

await page.goto(URL); await page.waitForSelector('#regionBar .region.active');
await page.evaluate(async () => { localStorage.clear(); localStorage.setItem('r4m_region_v1','FL');
  try{ const db=await idbOpen(); await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=r;t.onerror=r;}); }catch(e){} });
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(600);

// ---- the model carries service time only ----
let st = await page.evaluate(() => {
  const m = loadTaskMx();
  return { keys: Object.keys(m.tasks[0]).sort().join(','), codes: m.codes,
    n: m.tasks.length, active: prioMxActive(m) };
});
check('a task row is just a name and on-site minutes', st.keys==='name,svc', st.keys);
check('R defaults to 5, not 1', st.codes.R==='5', JSON.stringify(st.codes));
check('priority is on whenever a code exists', st.active===true);

// ---- an old family matrix migrates without dragging the clocks along ----
st = await page.evaluate(async () => {
  localStorage.setItem('r4m_priomatrix_v2', JSON.stringify({
    fam:{ form:{label:'Forms',tasks:['FORM SURVEY','PIER SURVEY'],due:['9','9','14','39'],recv:['','','','']} },
    codes:{R:'1',X:'7'} }));
  localStorage.removeItem('r4m_taskmatrix_v1');
  try{ const db=await idbOpen(); await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=r;t.onerror=r;}); }catch(e){}
  const m = loadTaskMx();
  return { names: m.tasks.map(t=>t.name).join(','), codes: m.codes,
    hasClocks: m.tasks.some(t=>'due' in t || 'recv' in t) };
});
check('old family task names survive the upgrade', st.names==='FORM SURVEY,PIER SURVEY', st.names);
check('their clock values do not', st.hasClocks===false);
check('letter codes already set are kept as they were', st.codes.R==='1' && st.codes.X==='7', JSON.stringify(st.codes));

// ---- the export ----
const HDR='"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date"';
const build = async rows => page.evaluate(([h,rs]) => {
  const csv=[h, ...rs].join('\n')+'\n';
  const res=buildFile02(parseCSV(csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const hh=res.rows[0].map(x=>String(x).trim());
  const iA=hh.indexOf('Alias'), iP=hh.indexOf('Priority'), iC=hh.indexOf('Color'), iD=hh.indexOf('Depot');
  // crews always ship as depot rows now — they are not jobs, so leave them out
  const jobs=res.rows.slice(1).filter(r=>iD<0||String(r[iD])!=='1');
  return { header:hh.join('|'), prioOn:res.prioOn, applied:res.prioApplied, rushN:res.rushN,
    skipped:[...(res.prioSkipped||new Map())].map(([c,n])=>`${c}×${n}`),
    rows:jobs.map(r=>({alias:String(r[iA]), prio:iP>=0?String(r[iP]):null, color:iC>=0?String(r[iC]):null})) };
}, [HDR, rows]);

// the migration case above deliberately kept R at 1 — reset to defaults here
await page.evaluate(async () => {
  localStorage.removeItem('r4m_priomatrix_v2'); localStorage.removeItem('r4m_taskmatrix_v1');
  try{ const db=await idbOpen(); await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=r;t.onerror=r;}); }catch(e){}
  TASKMX=null; saveTaskMx(loadTaskMx());
});

const job=(n,prio,sched)=>`"09/07/26","F1","OUT","B","1","${700000+n}","${100+n} Oak St","M","SUBNAME","","FORM SURVEY","${prio}","D","T","${sched}"`;
st = await page.evaluate(()=>{ const s=SUBS.find(x=>geoOk(x.lat,x.lng)); return s.name; });
const SUB = st;
const mk = rows => rows.map(r=>r.replace('SUBNAME', SUB));

// a normal day: nothing flagged
let r = await build(mk([job(1,'',  '09/15/26'), job(2,'1','09/15/26'), job(3,'99','09/10/26')]));
check('a day with no letters gets no Priority column at all', !/Priority/.test(r.header), r.header);
check('Sage numeric priorities are never passed through', r.rows.every(x=>x.prio===null), JSON.stringify(r.rows.map(x=>x.prio)));

// one rush among many
r = await build(mk([job(1,'','09/15/26'), job(2,'R','09/15/26'), job(3,'','09/15/26'), job(4,'','09/15/26')]));
check('one letter brings the Priority and Color columns back', /Priority/.test(r.header) && /Color/.test(r.header), r.header);
check('only the flagged job carries a priority', r.rows.filter(x=>x.prio!=='').length===1, JSON.stringify(r.rows.map(x=>x.prio)));
check('and it is the code value', r.rows.find(x=>x.prio!=='').prio==='5', r.rows.find(x=>x.prio!=='').prio);
check('the flagged job is red', r.rows.find(x=>x.prio!=='').color==='FF0000');
check('everything else has no colour either', r.rows.filter(x=>x.color==='').length===3);
check('the rest stay blank so Route4Me sequences by drive time', r.rows.filter(x=>x.prio==='').length===3);
check('counted once', r.applied===1 && r.rushN===1, `${r.applied}/${r.rushN}`);

// a letter we have no code for
r = await build(mk([job(1,'Z','09/15/26'), job(2,'R','09/15/26')]));
check('an unknown letter is left blank', r.rows.filter(x=>x.prio!=='').length===1, JSON.stringify(r.rows.map(x=>x.prio)));
check('and is reported so it can be added', r.skipped.join(',')==='Z×1', r.skipped.join(','));

// a second code, added the way the settings page adds one
r = await page.evaluate(() => { const m=loadTaskMx(); m.codes.Z='10'; saveTaskMx(m); TASKMX=null; return loadTaskMx().codes; });
check('a second letter code stores', r.Z==='10' && r.R==='5', JSON.stringify(r));
r = await build(mk([job(1,'Z','09/15/26'), job(2,'R','09/15/26'), job(3,'','09/15/26')]));
check('both letters now score, still red, still sparse',
  r.rows.map(x=>x.prio).join(',')==='10,5,' && r.rows.slice(0,2).every(x=>x.color==='FF0000'),
  JSON.stringify(r.rows));

// ---- dates no longer touch priority at all ----
r = await build(mk([job(1,'','01/01/20'), job(2,'','12/31/30')]));
check('a long-overdue job is still blank — dates are out of it', r.rows.every(x=>x.prio===null||x.prio===''),
  JSON.stringify(r.rows.map(x=>x.prio)));

// ---- service time still works, and is what the task rows are for ----
r = await page.evaluate(async ([h,sub]) => {
  const m=loadTaskMx(); m.tasks=[{name:'FORM SURVEY',svc:'35'}]; saveTaskMx(m); TASKMX=null;
  const csv=[h, `"09/07/26","F1","OUT","B","1","700001","1 Oak St","M","${sub}","","FORM SURVEY","","D","T","09/15/26"`].join('\n')+'\n';
  const res=buildFile02(parseCSV(csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const hh=res.rows[0].map(x=>String(x).trim());
  return { header:hh.join('|'), svc:String(res.rows[1][hh.indexOf('Service Time')]) };
}, [HDR, SUB]);
check('on-site minutes still reach Route4Me as service time', /Service Time/.test(r.header) && r.svc==='35', r.svc);

// ---- the settings page matches the model ----
r = await page.evaluate(async () => {
  document.querySelector('.tab[data-tab="settings"]').click();
  await new Promise(x=>setTimeout(x,200));
  return { cols: document.querySelectorAll('#taskTable thead tr').length,
    heads: [...document.querySelectorAll('#taskTable thead th')].map(t=>t.textContent.trim()).join('|'),
    clockCells: document.querySelectorAll('[data-tk]').length,
    svcCells: document.querySelectorAll('[data-tsvc]').length,
    ladder: !!document.getElementById('prioLadder'),
    codeChips: document.querySelectorAll('[data-cdel]').length };
});
check('the task table is name, minutes, count', r.heads==='Task (as Sage spells it)|On site (min)|In this file|', r.heads);
check('no clock cells remain', r.clockCells===0 && r.svcCells>0, `${r.clockCells} clock, ${r.svcCells} svc`);
check('the colour ladder is gone', r.ladder===false);
check('letter codes are editable on the Priority card', r.codeChips>0, `${r.codeChips} chips`);

await page.evaluate(() => { localStorage.clear(); localStorage.setItem('r4m_region_v1','FL'); });
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILURES: ${fails.join('; ')}` : '\nALL PASS');
process.exit(fails.length?1:0);
