/* A Sage report column too narrow for its title clips the title AND the values.
   The file should still open, and the warning should name the real cause.
   Run: node tests/truncation.mjs                                            */
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

// ---- findCol's prefix fallback ----
const fc=await page.evaluate(()=>({
  exact:      findCol(['Subdiv Name','Section'],'Subdiv Name'),
  clipped:    findCol(['Subdi','Section'],'Subdiv Name'),
  padded:     findCol(['Subdi   ','Section'],'Subdiv Name'),
  tooShort:   findCol(['Sub','Section'],'Subdiv Name'),      // 3 chars is a guess, not a match
  ambiguous:  findCol(['Subdi','Subdiv'],'Subdiv Name'),     // two candidates -> refuse
  notAPrefix: findCol(['Subxx','Section'],'Subdiv Name'),
  full:       findCol(['Subdiv Name Extra'],'Subdiv Name'),  // longer than wanted is not a prefix
  isClipped:  clippedCol(['Subdi','Section'],'Subdiv Name'),
  notClipped: clippedCol(['Subdiv Name','Section'],'Subdiv Name')
}));
check('an exact header still wins',fc.exact===0,`${fc.exact}`);
check('a clipped header resolves by prefix',fc.clipped===0,`${fc.clipped}`);
check('padding does not confuse the prefix match',fc.padded===0,`${fc.padded}`);
check('a 3-character stub is not a match',fc.tooShort===-1,`${fc.tooShort}`);
check('two possible columns match neither',fc.ambiguous===-1,`${fc.ambiguous}`);
check('a same-length near-miss is not a prefix',fc.notAPrefix===-1,`${fc.notAPrefix}`);
check('a longer header is not a prefix',fc.full===-1,`${fc.full}`);
check('clippedCol flags the truncated header',fc.isClipped===true,`${fc.isClipped}`);
check('clippedCol stays quiet on a full header',fc.notClipped===false,`${fc.notClipped}`);

// ---- the banner, on a file shaped like the real narrow export ----
const row=(sub,job)=>`"09/08/26","F65","FE","Toll Brother","0004423","${job}","9116 Sinatra La","ORL3","${sub}","PH1","FINAL SVY SWALE","4","08","N","09/14/26","T"`;
const CLIPPED=['"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdi","Section","Description Of Problem","Priority","Division","Title","Schedule_Date","BuildType"',
  row('Poitr','2538113'),row('Poitr','2538116')].join('\n')+'\n';

const banner=async csv=>{
  await page.evaluate(t=>loadFile01ForReview(t,'sage.csv',false),csv);
  await page.waitForTimeout(400);
  return page.evaluate(()=>{const w=document.getElementById('trimWarn');
    return (w&&!w.classList.contains('hide'))?w.innerText.replace(/\s+/g,' ').trim():'';});
};

let t=await banner(CLIPPED);
check('a clipped export warns',/cut these columns short/i.test(t),t.slice(0,60));
check('the warning names the column',/Subdiv Name/.test(t)&&/Subdi/.test(t),t.slice(0,90));
check('the warning reports the clipped width',/5 characters/.test(t),t.slice(0,140));
check('it does not call the file malformed',!/malformed/i.test(t),t.slice(0,60));

// a full-width file of the same shape must stay quiet
const FULL=await page.evaluate(()=>SUBS.find(s=>geoOk(s.lat,s.lng)).name);
const OK=['"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date","BuildType"',
  row(FULL,'2538113'),row(FULL,'2538116')].join('\n')+'\n';
t=await banner(OK);
check('a full-width export raises nothing',t==='',t.slice(0,80));

// ---- and the clipped file still converts rather than throwing ----
const conv=await page.evaluate(csv=>{
  try{ const r=buildFile02(parseCSV(csv).filter(x=>x.some(c=>String(c).trim()!==''))); return {ok:true,rows:r.rows.length}; }
  catch(e){ return {ok:false,err:e.message}; }
},CLIPPED);
check('the clipped file opens instead of erroring out',conv.ok===true,conv.err||'');

await browser.close();
console.log(fails.length?`\n${fails.length} FAILED: `+fails.join(', '):'\nALL PASS');
process.exit(fails.length?1:0);
