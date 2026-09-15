/* End-to-end smoke test: boot, import, resolve, export, crew map, reverse trip.
   Uses only the FL seed, so it is self-contained.  Run: node tests/smoke.mjs   */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const URL='file:///home/user/route4meworkarounds/index.html';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==','base64');
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await browser.newContext({viewport:{width:1400,height:900}});
await ctx.route('**/*.tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:png}));
const page=await ctx.newPage();
const errs=[]; page.on('pageerror',e=>{errs.push(e.message);console.log('PAGEERROR:',e.message);});
page.on('crash',()=>console.log('!!! CRASHED !!!'));
const fails=[]; const check=(n,ok,x='')=>{console.log((ok?'PASS':'FAIL')+' '+n+(x?` (${x})`:''));if(!ok)fails.push(n);};

await page.goto(URL); await page.waitForSelector('#regionBar .region.active');
await page.evaluate(async()=>{localStorage.clear();localStorage.setItem('r4m_region_v1','FL');
  try{const db=await idbOpen();await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=r;t.onerror=r;});}catch(e){}});
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(700);

let st=await page.evaluate(()=>({ver:document.getElementById('appVer').textContent,subs:SUBS.length,crews:CREWS.length,
  tabs:[...document.querySelectorAll('.tab')].map(t=>t.dataset.tab).join(',')}));
check('boots with the FL library',st.subs>90&&st.crews>0,`${st.subs} subs, ${st.crews} crews`);
check('four tabs',st.tabs==='dispatch,crews,subs,settings',st.tabs);

const HDR='"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date"';
const csv=await page.evaluate(h=>{
  const subs=SUBS.filter(s=>geoOk(s.lat,s.lng)).slice(0,20);
  const tasks=['FORM SURVEY','SIGNED SLAB SVY','FINAL SVY SWALE','GRADE STAKING'];
  return [h,...subs.map((s,i)=>`"09/07/26","F1","OUT","Lennar","${500+i}","${840000+i}","${1200+i} Oak St","M${i}","${s.name}","","${tasks[i%4]}","${i===2?'R':''}","D","T","09/15/26"`)].join('\n')+'\n';
},HDR);

await page.evaluate(t=>{window.__csv=t;loadFile01ForReview(t,'file01.csv',false);},csv);
await page.waitForTimeout(400);
await page.evaluate(()=>{const b=document.getElementById('umSkip');if(b)b.click();});
st=await page.evaluate(()=>({rows:jobsRows.length,trim:!document.getElementById('trimCard').classList.contains('hide')}));
check('file01 loads into the trim table',st.rows===20&&st.trim,`${st.rows} rows`);

st=await page.evaluate(()=>{
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim());
  return {header:h.join('|'),rows:res.rows.length-1,matched:res.matched,depots:res.depots,outName:res.outName,
    flagged:res.rows.slice(1).filter(r=>String(r[h.indexOf('Priority')]||'')!==''&&String(r[h.indexOf('Depot')]||'')!=='1').length};
});
check('export builds every geocoded job plus depots',st.rows===31&&st.matched===20,`${st.rows} rows`);
check('one rush flagged, rest blank',st.flagged===1,`${st.flagged} flagged`);
check('the dispatch date rides along as Scheduled For',
  st.header==='Alias|Latitude|Longitude|Svc Job Num|Scheduled For|Priority|Color|Depot',st.header);
check('crews ship as depots by default',st.depots===11,`${st.depots} depots`);
check('the upload is named plainly',/^Route4Me upload \d{4}-\d{2}-\d{2}\.csv$/.test(st.outName),st.outName);

// subs map, now carrying crew homes too
await page.click('[data-tab="subs"]'); await page.click('#subsMapBtn'); await page.waitForTimeout(1000);
const layers=()=>page.evaluate(()=>{let m=0,c=0;
  if(subsMapLayer)subsMapLayer.eachLayer(()=>m++); if(crewMapLayer)crewMapLayer.eachLayer(()=>c++);
  return {m,c,zoom:subsMapInstance.getZoom(),
    span:+(subsMapInstance.getBounds().getNorth()-subsMapInstance.getBounds().getSouth()).toFixed(1),
    info:subsMapInfoEl.textContent.replace(/\s+/g,' ').trim(),
    togglesShown:!document.querySelector('.mapToggle').classList.contains('hide')};});
st=await layers();
check('subs map opens on Florida',st.m>90&&st.zoom>=6&&st.span<12,`${st.m} pins, zoom ${st.zoom}, ${st.span}° tall`);
check('crew homes are drawn as their own markers',st.c===11,`${st.c} crew markers`);
check('the info box counts both',/subs/.test(st.info)&&/crew home/.test(st.info),st.info);
check('the layer toggles appear with the map',st.togglesShown);

await page.uncheck('#mapShowCrews'); await page.waitForTimeout(300);
st=await layers();
check('crews can be switched off',st.c===0&&st.m>90,`${st.m} subs, ${st.c} crews`);
await page.check('#mapShowCrews'); await page.uncheck('#mapShowSubs'); await page.waitForTimeout(300);
st=await layers();
check('subs can be switched off',st.m===0&&st.c===11,`${st.m} subs, ${st.c} crews`);
check('and the map still fits the crews',st.span<12,`${st.span}° tall`);
await page.check('#mapShowSubs'); await page.waitForTimeout(200);
await page.click('#subsMapBtn'); await page.waitForTimeout(200);
st=await page.evaluate(()=>document.querySelector('.mapToggle').classList.contains('hide'));
check('the toggles hide again with the map',st===true);

// settings
await page.click('[data-tab="settings"]'); await page.waitForTimeout(300);
st=await page.evaluate(()=>({tasks:document.querySelectorAll('#taskBody tr').length,
  codes:document.querySelectorAll('[data-cdel]').length,
  heads:[...document.querySelectorAll('main section:not(.hide) h2')].map(h=>h.textContent.trim()).join('|')}));
check('settings shows Tasks, Priority, Import',st.heads==='Tasks|Priority|Import',st.heads);
check('task rows and codes render',st.tasks>0&&st.codes>0,`${st.tasks} tasks, ${st.codes} codes`);

// reverse trip
st=await page.evaluate(()=>{
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const h=res.rows[0].map(x=>String(x).trim());
  const iA=h.indexOf('Alias'),iS=h.indexOf('Svc Job Num');
  // a real Route4Me export identifies the crew by first/last name, not a route label
  const c=CREWS[0];
  const f03=['"Svc Job Num","User_First_Name","User_Last_Name","Alias"',
    ...res.rows.slice(1).map(r=>`"${r[iS]}","${c.name}","${c.last||''}","${r[iA]}"`)].join('\n');
  file03Text=f03; setFile01(window.__csv,'file01.csv',true); runReverse();
  return {summary:document.getElementById('bringSummary').textContent};
});
check('file03 splices back to a Sage import',/rows/.test(st.summary),st.summary.slice(0,120));
check('the Sage file is named for what it is',/Sage assignment import \d{4}-\d{2}-\d{2}\.csv/.test(st.summary),st.summary.slice(-45));

check('no page errors anywhere in the flow',errs.length===0,errs.join(' | ').slice(0,200));
await page.evaluate(()=>{localStorage.clear();localStorage.setItem('r4m_region_v1','FL');});
await browser.close();
console.log(fails.length?`\n${fails.length} FAILURES: ${fails.join('; ')}`:'\nALL PASS');
process.exit(fails.length?1:0);
