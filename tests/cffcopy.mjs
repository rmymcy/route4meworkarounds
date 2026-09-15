/* The Copy CFF button puts the calc requests on the clipboard without opening
   the modal, and appears only when there are requests to copy.
   Run: node tests/cffcopy.mjs                                               */
import pw from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pw;
const URL='file:///home/user/route4meworkarounds/index.html';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
const ctx=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
await ctx.route('**/*.tile.openstreetmap.org/**',r=>r.abort());
const page=await ctx.newPage(); page.on('pageerror',e=>console.log('PAGEERROR:',e.message));
const fails=[]; const check=(n,ok,x='')=>{console.log((ok?'PASS':'FAIL')+' '+n+(x?` (${x})`:''));if(!ok)fails.push(n);};

await page.goto(URL); await page.waitForSelector('#regionBar .region.active');
await page.evaluate(async()=>{localStorage.clear();localStorage.setItem('r4m_region_v1','FL');
  try{const db=await idbOpen();await new Promise(r=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').clear();t.oncomplete=r;t.onerror=r;});}catch(e){}});
await page.reload(); await page.waitForSelector('#regionBar .region.active'); await page.waitForTimeout(700);

const HDR='"Received Date","Servicer Id","Status Code","Builder Name","Master Job","Svc Job Num","Address 1","Map Code","Subdiv Name","Section","Description Of Problem","Priority","Division","Title","Schedule_Date","BuildType"';
/* `status` per row: CFF rows become calc requests, everything else stays in the
   Sage import. Runs the whole trip and returns what the result row shows. */
const run=statuses=>page.evaluate(([h,sts])=>{
  const sub=SUBS.find(s=>geoOk(s.lat,s.lng)).name;
  window.__csv=[h,...sts.map((st,i)=>
    `"09/07/26","00","${st}","B","${900000+i}","${880000+i}","${100+i} Oak St","M","${sub}","","GRADE STAKING","","D","T","09/20/26",""`)].join('\n')+'\n';
  loadFile01ForReview(window.__csv,'file01.csv',false);
  const b=document.getElementById('umSkip'); if(b) b.click();
  const res=buildFile02(parseCSV(window.__csv).filter(r=>r.some(c=>String(c).trim()!=='')));
  const hh=res.rows[0].map(x=>String(x).trim());
  const iA=hh.indexOf('Alias'), iS=hh.indexOf('Svc Job Num'), iD=hh.indexOf('Depot');
  const c=CREWS[0]; if(!c.code) c.code='F65';        // the seed ships without Servicer Ids
  file03Text=['"Svc Job Num","User_First_Name","User_Last_Name","Alias"',
    ...res.rows.slice(1).filter(r=>String(r[iD])!=='1')
      .map(r=>`"${r[iS]}","${c.name}","${c.last||''}","${r[iA]}"`)].join('\n');
  setFile01(window.__csv,'file01.csv',true); runReverse();
  return {reqs:lastFile04.cffReq.length, text:lastFile04.cffText};
},[HDR,statuses]);

// ---- with CFF rows in the file ----
let st=await run(['OUT','CFF','OUT','CFF','CFF']);
check('the file produced calc requests',st.reqs===3,`${st.reqs}`);
check('the copy button shows alongside CFF',await page.isVisible('#cffCopyBtn'));
check('the CFF button still opens the modal',await page.isVisible('#cffBtn'));

await page.click('#cffCopyBtn'); await page.waitForTimeout(400);
let clip=await page.evaluate(()=>navigator.clipboard.readText());
check('the clipboard holds the calc requests',clip===st.text,`${clip.length} chars`);
check('it is the same text the modal shows',
  await page.evaluate(t=>t===lastFile04.cffText,clip));
check('the toast says what was copied',/CFF copied/.test(await page.textContent('#toast')),
  await page.textContent('#toast'));
check('the toast counts the lines',
  new RegExp(`${clip.split('\n').filter(Boolean).length} lines`).test(await page.textContent('#toast')),
  await page.textContent('#toast'));
check('copying opened no modal',await page.evaluate(()=>!document.querySelector('.backdrop')));

// the modal's own Copy still works, and agrees
await page.click('#cffBtn'); await page.waitForTimeout(250);
await page.evaluate(()=>navigator.clipboard.writeText('scrubbed'));
await page.click('#cffCopy'); await page.waitForTimeout(400);
check('the modal copy button still works',
  await page.evaluate(()=>navigator.clipboard.readText().then(t=>t===lastFile04.cffText)));
await page.click('#cffClose');

// ---- with no CFF rows ----
st=await run(['OUT','OUT','OUT']);
check('no calc requests, no buttons',st.reqs===0&&
  !(await page.isVisible('#cffCopyBtn'))&&!(await page.isVisible('#cffBtn')),`${st.reqs} reqs`);

await browser.close();
console.log(fails.length?`\n${fails.length} FAILED: `+fails.join(', '):'\nALL PASS');
process.exit(fails.length?1:0);
