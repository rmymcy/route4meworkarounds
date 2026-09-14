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

// ---- clipWidth: a cut value vs a merely short one ----
// Sage pads every cell in a column to the same width. A value that reaches that
// width was cut; a value that stops short of it is whole.
const cw=await page.evaluate(()=>{
  const pad=(s,w)=>String(s).padEnd(w,' ');
  const col=(title,vals,w)=>({h:[pad(title,w)],rows:vals.map(v=>({cells:[pad(v,w)]}))});
  const cut =col('Subdiv Name',['Poitras N-4 West West','Westview'],21);  // 21 chars fills 21
  const room=col('Description Of Probl',['FINAL SVY SWALE','GRADE STAKING'],20); // 15 of 20
  const ragged={h:['Subdiv Name'],rows:[{cells:['Westview']},{cells:['Poitras N-4 West']}]};
  const empty=col('Subdiv Name',['',''],10);
  return { cut:clipWidth(cut.h,cut.rows,0), room:clipWidth(room.h,room.rows,0),
    ragged:clipWidth(ragged.h,ragged.rows,0), empty:clipWidth(empty.h,empty.rows,0),
    absent:clipWidth(['a'],[{cells:['b']}],-1) };
});
check('a value filling its column is reported as cut',cw.cut===21,`${cw.cut}`);
check('a short value in a wide column is not cut',cw.room===0,`${cw.room}`);
check('an ordinary ragged CSV never trips it',cw.ragged===0,`${cw.ragged}`);
check('an all-blank column is not cut',cw.empty===0,`${cw.empty}`);
check('a missing column is not cut',cw.absent===0,`${cw.absent}`);

// ---- the banner ----
const pad=(s,w)=>String(s).padEnd(w,' ');
const HEADS=['Received Date','Servicer Id','Status Code','Builder Name','Master Job','Svc Job Num',
  'Address 1','Map Code','Subdiv Name','Section','Description Of Problem','Priority','Division','Title','Schedule_Date','BuildType'];
/* Build a fixed-width Sage export. Columns get two characters of slack by
   default, the way a real report is sized, so nothing reads as cut unless
   `widths` deliberately narrows it — which is what a too-narrow report does. */
const sage=(rows,widths={})=>{
  const w=HEADS.map((h,i)=>widths[h] ?? Math.max(h.length,...rows.map(r=>String(r[i]||'').length))+2);
  const line=vals=>vals.map((v,i)=>`"${pad(String(v).slice(0,w[i]),w[i])}"`).join(',');
  return [line(HEADS),...rows.map(line)].join('\n')+'\n';
};
const job=(sub,jobNo,addr='9116 Sinatra La')=>['09/08/26','F65','FE','Toll Brother','0004423',jobNo,
  addr,'ORL3',sub,'PH1','FINAL SVY SWALE','4','08','N','09/14/26','T'];

const banner=async csv=>{
  await page.evaluate(t=>loadFile01ForReview(t,'sage.csv',false),csv);
  await page.waitForTimeout(400);
  return page.evaluate(()=>{const w=document.getElementById('trimWarn');
    return (w&&!w.classList.contains('hide'))?w.innerText.replace(/\s+/g,' ').trim():'';});
};

// 1. subdivisions cut below the alias floor -> hard stop
let t=await banner(sage([job('Poitras N-4 West','2538113'),job('Westview','2538116')],{'Subdiv Name':5}));
check('names cut below the alias floor stop the run',/cutting subdivision names short/i.test(t),t.slice(0,60));
check('the hard stop reports the width',/only 5 characters/.test(t),t.slice(0,120));
check('the hard stop shows what arrived',/Poitr/.test(t),t.slice(0,140));
check('it does not call the file malformed',!/malformed/i.test(t),t.slice(0,60));

// 2. a clipped TITLE whose values still fit is not worth a warning
const FULL=await page.evaluate(()=>SUBS.find(s=>geoOk(s.lat,s.lng)).name);
t=await banner(sage([job(FULL,'2538113'),job(FULL,'2538116')],{'Description Of Problem':20}));
check('a clipped title with room underneath stays quiet',t==='',t.slice(0,120));

// 3. long names cut at a width the prefix aliases still recover -> say nothing
t=await banner(sage([job('Plat of Subdivision Surve','2538113'),job(FULL,'2538116')],{'Subdiv Name':25}));
check('a cut the aliases can recover passes without comment',t==='',t.slice(0,160));

// 4. nothing padded to its edge at all
t=await banner(sage([job(FULL,'2538113'),job(FULL,'2538116')]));
check('a roomy export raises nothing',t==='',t.slice(0,120));

// ---- and a clipped file still converts rather than throwing ----
const conv=await page.evaluate(csv=>{
  try{ const r=buildFile02(parseCSV(csv).filter(x=>x.some(c=>String(c).trim()!==''))); return {ok:true,rows:r.rows.length}; }
  catch(e){ return {ok:false,err:e.message}; }
}, sage([job('Poitras N-4 West','2538113')],{'Subdiv Name':5}));
check('the clipped file opens instead of erroring out',conv.ok===true,conv.err||'');

await browser.close();
console.log(fails.length?`\n${fails.length} FAILED: `+fails.join(', '):'\nALL PASS');
process.exit(fails.length?1:0);
