/* Manufactures realistic Florida East dispatch days for Route4Me.

   Subdivisions, coordinates and street names all come out of the live library
   in index.html, so this stays correct as the library does. Streets seen in
   real Sage exports are listed in EXPORT_STREETS and preferred, because those
   give several streets per subdivision; everything else falls back to the one
   street in the library's own address field. Nothing is invented except house
   numbers, job numbers and dates, and the RNG is seeded so a re-run reproduces
   the same days.

   Run: node samples/make-sample-days.mjs <outdir>                           */

import fs from 'node:fs';
import path from 'node:path';

// ---- deterministic RNG ----
let _s=20260921;
const rnd=()=>{ _s=(_s*1103515245+12345)&0x7fffffff; return _s/0x7fffffff; };
const pick=a=>a[Math.floor(rnd()*a.length)];
const int=(lo,hi)=>lo+Math.floor(rnd()*(hi-lo+1));

// ---- the six East Florida crews, exactly as their depot rows carry them ----
const CREWS=[
  {code:'F19', name:'Hunter Cope',     lat:30.277278, lng:-81.73279},
  {code:'F34', name:'Steven Brooks',   lat:28.514039, lng:-81.480958},
  {code:'F51', name:'Ayinde Blackman', lat:28.158096, lng:-81.497195},
  {code:'F65', name:'Eric Brand',      lat:28.476193, lng:-81.269467},
  {code:'F75', name:'Paul Mabb',       lat:28.753204, lng:-81.28209},
  {code:'F76', name:'Johnathan Ortiz', lat:28.521713, lng:-81.289175},
];
const mi=(a,b,c,d)=>{const R=3958.8,p=Math.PI/180,q=(c-a)*p,r=(d-b)*p,
  x=Math.sin(q/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(r/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));};

// ---- read the library out of the app ----
const here=path.dirname(new URL(import.meta.url).pathname);
const html=fs.readFileSync(path.join(here,'..','index.html'),'utf8');
const SEED=JSON.parse(html.match(/const SUBS_SEED = (\[.*?\]);/s)[1]);

/* Library rows left over from the narrow-export era: a truncated name sitting
   beside the full one, on the same coordinates. Skipped so a day cannot carry
   both halves of the same place. */
const STALE=new Set(['Hidden Ridge at Estate','Meadow Pointe at Esta','The Villas at Camden',
  'Congdon Townhomes (Grove','Founders Corner (Waterlin']);
// Sage writes this one with the bracket the library dropped
const AS_SAGE={'Plat of Subdivision SurveyEsplanade at St. Marys':
  'Plat of Subdivision Survey(Esplanade at St. Marys)'};

/* Streets pulled from real Sage exports and real Route4Me uploads. Several per
   subdivision, with the house-number range each one actually shows.
   style: 'lot' -> "Lot 42 <street>", 'LOT' -> "LOT 42 <street>".            */
const EXPORT_STREETS={
  'Poitras N-4 West':[['Sinatra Lane',9100,4],['Luminary Boulevard',0,1,'lot']],
  'Laureate Park':[['Gobat Alley',10040,3],['Pearson Avenue',10460,4],
    ['MacBride Drive',0,1,'lot'],['Sinatra Lane',9700,4]],
  'Waters at Center Lake Ranch':[['Ladyfish Trail',815,4],['Buterfish Place',5088,4],
    ['Lost Key Place',5041,4],['Goldfinch Drive',5200,6]],
  'Esplanade at Center Lake Ranch':[['Spring Moss Court',5401,4],['Tassleflower Trail',1063,4],
    ['Arbor Green Drive',1041,4]],
  'Edgewater Cross Prairie':[['Elliotts Astor Boulevard',4425,2],['Seagrape Avenue',0,1,'LOT'],
    ['Natalia Drive',5104,4],['Bentgrass Bend',4370,4],['Clay Whaley Road',0,1,'LOT'],
    ['Flaxleaf Street',5123,4]],
  'EA McKinnon Groves':[['Bourbon Rose Circle',11302,4],['Sedona Street',17730,8],
    ['Carding Mill Lane',11220,6]],
  'Parkview at Hamlin':[['Groveside Road',15141,6],['Brightside',5519,4]],
  'Westview':[['Sapote Court',5510,5],['Dennery Bay Road',5585,6],['Ochos Rios Place',4483,4],
    ['Coral Harbour Road',4614,6],['Loggia Lane',4973,6],['Guava Court',5508,6],
    ['Pimenta Court',5518,6],['Ficus Aurea Street',5692,4],['Ackee Road',4567,4],
    ['Segrape Lane',5617,4],['Morant Bay Path',5636,6]],
  'Crosswinds East':[['Riverbend Boulevard',4325,12]],
  'Liberty Trace':[['Liberty Bend',412,6],['Hugo Drive',299,4]],
  'Woodland Ranch Estates':[['Nola Lane',327,4],['Stetson Avenue',1219,6],
    ['Spindlewood Boulevard',200,6]],
  'Crystal Lake Preserve':[['Manchester Path',590,6],['Harvard Court',451,4],
    ['Camelot Way',503,4],['Biltmore Boulevard',303,6]],
  'Gum Lake Preserve':[['Amanatsu Avenue',3636,4],['Chinotto Drive',3306,4]],
  'Lochside':[['Sea Loch Loop',32405,8],['Lochside Lane',19290,8]],
  'Leala Reserve':[['Radhika Point',3300,2],['Priya Drive',2600,4]],
  'Cresswind at Lake Harris':[['Bellagio Loop',1610,4]],
  'Meadow Pointe at Estates at Cherry Lake':[['Tundra Loop',770,8]],
  'Hidden Ridge at Estates at Cherry Lake':[['Tundra Loop',920,6]],
  'Palms (Venetian Bay)':[['Tiger Palm Way',3060,6],['Venetian Palms Boulevard',110,6]],
  'Waterstone Subdivision':[['Ridge Tree Lane',1420,6],['Fermoy Drive',2685,6],
    ['Portadown Street',2714,6]],
  'Plat of Subdivision SurveyEsplanade at St. Marys':[['Hillcrest Drive',96,8],
    ['Grandview Drive',311,8],['Sugar Creek Cove',97,8],['Richland Way',120,8]],
  'The Villas at Camden Woods':[['Collin Nicholas Drive',0,1,'Lot'],['Collin Nicholas Drive',232,6]],
  'Northshore':[['Shoreline Drive',377,8],['Longshore Drive',96,8]],
  'Laurel Preserve':[['Spyglass',206,8]],
  'Villas at Bishop Oaks':[['Waterfield Road',10604,2]],
  'Hills of Montverde':[['Celadon Avenue',16389,4],['Serenity Way',1620,6]],
  'Kentucky Square':[['Triple Crown Lane',3640,6]],
  'Weslyn Park':[['Labrynth Court',6653,4],['Sailhouse Drive',3158,6]],
  'Windward Preserve':[['Binnacle Lane',5812,4],['Bulkhead Way',2726,4],['Windward Drive',3854,6]],
  'Sandhill Preserve':[['Dease Road',5593,6]],
};

// ---- turn a library address into one usable street ----
const SUFFIX={rd:'Road',ln:'Lane',dr:'Drive',lp:'Loop',st:'Street',blvd:'Boulevard',wy:'Way',
  ct:'Court',cv:'Cove',trl:'Trail',pth:'Path',ave:'Avenue',av:'Avenue',cir:'Circle',
  pl:'Place',trce:'Trace',pk:'Park',ter:'Terrace',way:'Way',run:'Run'};
const title=w=>w.replace(/\b[a-z]/g,c=>c.toUpperCase());
function streetFromAddress(addr){
  if(!addr||/pin drop/i.test(addr)) return null;
  let a=addr.split(',')[0].trim();                       // drop city/state/zip
  const m=a.match(/^(\d+)\s+(.*)$/);                      // leading house number
  const base=m?+m[1]:1200;
  let street=(m?m[2]:a).trim();
  if(/^(fl|ga)\b/i.test(street)) return null;            // the address was only a zip
  street=street.split(/\s+/).map((w,i,arr)=>{
    const k=w.toLowerCase().replace(/\.$/,'');
    return (i===arr.length-1 && SUFFIX[k]) ? SUFFIX[k] : title(k);
  }).join(' ');
  return [street, Math.max(2,base-8), 4];
}

// ---- which part of the region a subdivision sits in ----
function zoneOf(s){
  const L=s.lat, G=s.lng;
  if(L>29.6) return 'farnorth';                       // Nassau, St Marys, Jacksonville
  if(G>-81.1) return 'coast';                         // Cocoa, Titusville: east of everything
  if(L>29.2) return 'coast';                          // Palm Coast, Ormond
  if(L>28.9) return 'coast';                          // DeLand, New Smyrna
  if(L>28.6) return 'north';                          // Sanford, Mt Dora, Leesburg
  if(L<28.25 && G<-81.55) return 'polk';              // Haines City, Auburndale, Lake Alfred
  if(s.name==='Westview') return 'metrosw';           // Poinciana: big enough to stand alone
  if(L<28.25) return 'core';
  return 'core';
}

/* How often each subdivision turns up, counted across 148 real rows. Anything
   the real files did not happen to include gets a small default so it appears
   now and then without crowding out the places that carry the work. */
const WEIGHT={
  'Westview':26, 'Edgewater Cross Prairie':15, 'Poitras N-4 West':12,
  'Plat of Subdivision SurveyEsplanade at St. Marys':11, 'EA McKinnon Groves':10,
  'Lochside':9, 'The Villas at Camden Woods':9, 'Woodland Ranch Estates':5,
  'Crosswinds East':5, 'Liberty Trace':5, 'Crystal Lake Preserve':5,
  'Waters at Center Lake Ranch':5, 'Laureate Park':4, 'Gum Lake Preserve':4,
  'Leala Reserve':4, 'Esplanade at Center Lake Ranch':2,
  'Meadow Pointe at Estates at Cherry Lake':2, 'Laurel Preserve':2,
  'Palms (Venetian Bay)':2, 'Waterstone Subdivision':2, 'Cresswind at Lake Harris':1,
  'Northshore':1, 'Villas at Bishop Oaks':4, 'Hills of Montverde':3,
  'Weslyn Park':3, 'Windward Preserve':3, 'Kentucky Square':2, 'Sandhill Preserve':3,
  // Parkview earns its rows from the townhome building added on top: in the real
  // files six of its seven rows were a single BLDG
  'Parkview at Hamlin':0,
};
const DEFAULT_WEIGHT=2;

// ---- build the working subdivision list ----
const SUBS=SEED
  .filter(s=>!STALE.has(s.name))
  .filter(s=>s.lng>-81.95 && Math.min(...CREWS.map(c=>mi(c.lat,c.lng,s.lat,s.lng)))<55)
  .map(s=>{
    const streets=EXPORT_STREETS[s.name] || (x=>x?[x]:null)(streetFromAddress(s.address));
    if(!streets) return null;                     // no street anywhere: leave it out
    return {name:s.name, sage:AS_SAGE[s.name]||s.name, lat:s.lat, lng:s.lng,
      zone:zoneOf(s), streets, weight:WEIGHT[s.name]!==undefined?WEIGHT[s.name]:DEFAULT_WEIGHT};
  }).filter(Boolean);
// Kept out of the samples at the dispatcher's request
const OMIT=new Set(['Poitras N-4 West']);
for(const s of SUBS) if(OMIT.has(s.name)) s.weight=0;
const BY=Object.fromEntries(SUBS.map(s=>[s.name,s]));

// map codes and divisions as the real exports show them
const MAP={'ORL1':['Lochside','Leala Reserve','Cresswind at Lake Harris',
  'Meadow Pointe at Estates at Cherry Lake','Hidden Ridge at Estates at Cherry Lake',
  'Kentucky Square','Riverbank Place','Rivington','Trailside','Bronsons Ridge','Oak Hammock Reserve'],
  'ORL2':['Palms (Venetian Bay)','Waterstone Subdivision','Seminole Palms','Seminole Palms Townhomes',
    'Cresswind Jax','Windward Preserve'],
  'ORL3':['Poitras N-4 West','Laureate Park','Waters at Center Lake Ranch',
    'Esplanade at Center Lake Ranch','Edgewater Cross Prairie','Sandhill Preserve','Weslyn Park'],
  'ORL4':['EA McKinnon Groves','Parkview at Hamlin','Hills of Montverde'],
  'ORL6':['Westview','Crystal Lake Preserve','Liberty Trace','Crosswinds East',
    'Woodland Ranch Estates','Gum Lake Preserve','Wynnstone','Garden Hill at Providence',
    'Hamilton Bluff','Villamar'],
  'GASE':['The Villas at Camden Woods','Northshore'],
  'JAX1':['Plat of Subdivision SurveyEsplanade at St. Marys','Villas at Bishop Oaks',
    'Landings at Pecan Park','Shearwater']};
const mapOf=n=>{for(const [k,v] of Object.entries(MAP)) if(v.includes(n)) return k; return '';};
const divOf=s=>s.name==='Laurel Preserve'?'12':(s.lat>29.6?'15':'08');

// who Sage has on each subdivision, from the real exports; nearest home otherwise
const OWNER={'Laurel Preserve':'F19','The Villas at Camden Woods':'F19',
  'Plat of Subdivision SurveyEsplanade at St. Marys':'F19','Northshore':'F19',
  'Villas at Bishop Oaks':'F19','Palms (Venetian Bay)':'F19','Waterstone Subdivision':'F19',
  'Westview':'F51','Crystal Lake Preserve':'F34','Liberty Trace':'F34','Crosswinds East':'F34',
  'Woodland Ranch Estates':'F34','Parkview at Hamlin':'F76','EA McKinnon Groves':'F34',
  'Lochside':'F75','Cresswind at Lake Harris':'F75','Poitras N-4 West':'F75',
  'Leala Reserve':'F75','Meadow Pointe at Estates at Cherry Lake':'F75','Kentucky Square':'F75',
  'Edgewater Cross Prairie':'F65','Waters at Center Lake Ranch':'F65',
  'Esplanade at Center Lake Ranch':'F65','Laureate Park':'F76','Sandhill Preserve':'F76',
  'Weslyn Park':'F76','Windward Preserve':'F65','Gum Lake Preserve':'F51',
  'Hills of Montverde':'F34'};
const ownerOf=s=>OWNER[s.name] ||
  CREWS.slice().sort((a,b)=>mi(a.lat,a.lng,s.lat,s.lng)-mi(b.lat,b.lng,s.lat,s.lng))[0].code;

// Sage truncates Builder Name at 12 characters
const BUILDERS=['Toll Brother','Lennar Homes','Taylor Morri','NVR South (M','Century Comm',
                'DRB Homes (M','Casa Fresca','ICI Homes (M','Kolter Homes','NVR (SAV)'];
/* Task, the Priority value Sage ships with it, and how long it takes on site --
   both read off a real Route4Me upload the tool produced. */
const TASKS=[['FORM SURVEY','3',25],['GRADE STAKING','2',20],['FINAL SVY SWALE','4',45],
  ['ENV W\\ELEV STK','2',40],['SIGNED SLAB SVY','3',20],['RE-GRADE STAKE','2',20],
  ['RE-FORM SURVEY','3',20],['RE-ENV STAKE','2',30],['FIELD VERIFICAT','2',20],
  ['LOCATE RODS','3',15],['FINAL SVY DRAIN','2',60],['MUNICIPAL CERT.','3',25],
  ['REVIEW-FINAL','1',20],['UPDATE SURVEY','2',20]];

// ---- dates, weekdays only ----
const p2=n=>String(n).padStart(2,'0');
const mdy=d=>`${p2(d.getMonth()+1)}/${p2(d.getDate())}/${String(d.getFullYear()).slice(2)}`;
const shift=(d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};
const weekday=d=>{const x=new Date(d);
  while(x.getDay()===0||x.getDay()===6) x.setDate(x.getDate()+1); return x;};

let JOB=2544000, MASTER=440000;
function makeRow(sub, dispatch, opts={}){
  const [street,base,step,style]=pick(sub.streets);
  const n=base+step*int(0,24);
  const addr = style ? `${style==='LOT'?'LOT':'Lot'} ${int(11,148)} ${street}` : `${n} ${street}`;
  const t=opts.task ? TASKS.find(x=>x[0]===opts.task) : pick(TASKS);
  const [task,prio]=t;
  return {
    recv:mdy(opts.recv||weekday(shift(dispatch,-int(3,13)))),
    sched:mdy(opts.sched||weekday(shift(dispatch,int(0,4)))),
    sid:ownerOf(sub), status:pick(['IF','IF','IF','IF','FV','FE','CFF','OUT']),
    builder:opts.builder||pick(BUILDERS),
    master:String(MASTER+=int(11,260)).padStart(15,'0'), job:String(JOB+=int(1,9)),
    addr, map:mapOf(sub.name), sub:sub.sage, section:'',
    task, prio:rnd()<0.04?'R':prio, div:divOf(sub),
    title:task==='FINAL SVY SWALE'?'N':'',
    build:opts.build!==undefined?opts.build:(rnd()<0.05?'M':rnd()<0.04?'D':''),
    lat:sub.lat, lng:sub.lng };
}

// sections, where the real exports show them
const SECTIONS={'Westview':['PBN4','PBN2A2B','PB5PH1','PB2BPH2','PBN2B'],
  'Edgewater Cross Prairie':['PH1','PH2'],'Poitras N-4 West':['PH1'],'Laureate Park':['PH1','PH2'],
  'Waters at Center Lake Ranch':['PH1B'],'Esplanade at Center Lake Ranch':['PH1','PH2'],
  'EA McKinnon Groves':['PH1'],'Crosswinds East':['PH2C'],'Crystal Lake Preserve':['20'],
  'Woodland Ranch Estates':['PH1'],'The Villas at Camden Woods':['PH2','PH2B'],
  'Laurel Preserve':['PH1SA'],'Palms (Venetian Bay)':['PH6'],'Leala Reserve':['PH2B'],
  'Gum Lake Preserve':['PH1','PH2'],'Cresswind at Lake Harris':['PH1'],
  'Wynnstone':['PH1','PH2'],'Garden Hill at Providence':['PH1','PH2'],'Hamilton Bluff':['PH1']};

/* One townhome building: eight units under one roof, one builder, received and
   due together. Real exports write them as "<number> Groveside Road BLDG <n>". */
function townhomeBuilding(sub, dispatch, bldg){
  const base=15141+6*int(0,10);
  const shared={task:'FINAL SVY SWALE', build:'T', builder:pick(BUILDERS),
    recv:weekday(shift(dispatch,-int(4,10))), sched:weekday(shift(dispatch,int(1,3)))};
  return Array.from({length:8},(_,i)=>{
    const r=makeRow(sub,dispatch,shared);
    r.addr=`${base+i*6} Groveside Road BLDG ${bldg}`;
    return r;
  });
}

/* Largest-remainder allocation inside one zone, so the rounding lands on the
   subdivisions with the biggest fractional claim rather than always the same few. */
function share(subs, total, skip=new Set()){
  const w=subs.filter(s=>s.weight>0 && !skip.has(s.name));
  const sum=w.reduce((a,b)=>a+b.weight,0);
  const out=w.map(s=>{const v=total*s.weight/sum; return {s, n:Math.floor(v), r:v-Math.floor(v)};});
  let left=total-out.reduce((a,b)=>a+b.n,0);
  out.sort((a,b)=>b.r-a.r);
  for(let i=0;left>0;i++,left--) out[i%out.length].n++;
  return out.filter(x=>x.n>0).map(x=>[x.s.name,x.n]);
}
// A day is written as how many jobs fall in each part of the region.
/* `pin` forces a subdivision to an exact count; the rest of its zone shares out
   what is left, so pinning never changes the day's total. */
const allocZones=(z,exclude=[],pin={})=>{
  const skip=new Set([...exclude,...Object.keys(pin)]);
  const left={...z};
  for(const [name,count] of Object.entries(pin)){
    const zone=BY[name].zone;
    left[zone]=(left[zone]||0)-count;
    if(left[zone]<0) throw new Error(`pinned ${name} exceeds the ${zone} total`);
  }
  return [...Object.entries(pin),
    ...Object.entries(left).flatMap(([zone,total])=>
      total>0 ? share(SUBS.filter(s=>s.zone===zone), total, skip) : [])];
};
/* Subdivisions that sit on their own: a job in one is a leg of its own however
   the day is routed. Day 2 leaves them out, which is what makes it the tight
   comparison -- with them in, every day looks spread. */
const STANDALONE=['Shearwater','Landings at Pecan Park','Villas at Bishop Oaks',
  'Oak Hammock Reserve','Hills of Montverde','Villamar','Bronsons Ridge'];

function buildDay(dispatch, plan, tName){
  const rows=[];
  for(const [name,count] of plan){
    const sub=BY[name];
    for(let i=0;i<count;i++){
      const r=makeRow(sub,dispatch);
      const sec=SECTIONS[name]; if(sec) r.section=pick(sec);
      rows.push(r);
    }
  }
  if(tName) rows.push(...townhomeBuilding(BY[tName],dispatch,int(21,34)));
  const key=r=>{const[m,d,y]=r.recv.split('/');return +('20'+y+m+d);};
  return rows.sort((a,b)=>key(a)-key(b));      // Sage exports oldest received first
}

// ---- CSV: quoted and padded, at the widths the report now uses ----
/* Only what is actually being sent. The rest of the Sage export -- dates,
   Servicer Id, builder, job numbers, BuildType -- is still generated, so
   widening this list again needs nothing but the column name. */
const HEAD=['Address 1','Map Code','Subdiv Name','Section','Description Of Problem','Priority'];
const FIELD=['addr','map','sub','section','task','prio'];
const WIDTH={'Received Date':13,'Servicer Id':11,'Status Code':11,'Builder Name':12,
  'Master Job':15,'Svc Job Num':11,'Address 1':40,'Map Code':10,'Subdiv Name':52,
  'Section':15,'Description Of Problem':22,'Priority':8,'Division':8,'Title':5,
  'Schedule_Date':13,'BuildType':9,'Latitude':12,'Longitude':12};
const pad=(v,w)=>`"${String(v==null?'':v).slice(0,w).padEnd(w,' ')}"`;
function toCSV(rows,{coords}){
  const head=coords?[...HEAD,'Latitude','Longitude']:HEAD;
  const flds=coords?[...FIELD,'lat','lng']:FIELD;
  const line=v=>v.map((x,i)=>pad(x,WIDTH[head[i]])).join(',');
  return [line(head),...rows.map(r=>line(flds.map(f=>
    f==='lat'||f==='lng'?Number(r[f]).toFixed(6):r[f])))].join('\n')+'\n';
}

// ================= the three days =================
const DISPATCH=new Date(2026,8,22);   // Tue 22 Sep 2026

/* Every day carries Hunter's Nassau block: St Marys is 150 miles from Orlando
   but only 35 from his house, so it is his ordinary work -- and without it he
   has no jobs and no reason to be a start. `core` gets eight more for the
   townhome building, and Hills of Montverde is pinned so it shows up properly
   instead of rounding away. */

// Day 1 -- work at the edges: coast pockets too small for anyone's drive, plus
// a Polk tail. Several separate work areas, most of them tiny.
const day1=buildDay(DISPATCH,
  allocZones({core:22, metrosw:12, polk:8, north:6, farnorth:10, coast:4},
    [], {'Hills of Montverde':3}), 'Parkview at Hamlin');

// Day 2 -- same volume, nothing stranded. No coast, a thin Polk tail.
const day2=buildDay(DISPATCH,
  allocZones({core:26, metrosw:14, polk:6, north:8, farnorth:8, coast:0},
    STANDALONE, {'Hills of Montverde':2}), 'Parkview at Hamlin');

// Day 3 -- eighteen jobs down in Polk: more than one crew can finish, less than
// a full day for two, and forty miles from anyone's house.
const day3=buildDay(DISPATCH,
  allocZones({core:20, metrosw:10, polk:18, north:6, farnorth:9, coast:0},
    [], {'Hills of Montverde':4}), 'Parkview at Hamlin');

/* Day 4 -- a thin day. Same shape as the others at 50 jobs instead of 70, to
   see what the optimizer does when six crews have well under a full load. */
const day4=buildDay(DISPATCH,
  allocZones({core:14, metrosw:9, polk:5, north:5, farnorth:7, coast:2},
    [], {'Hills of Montverde':2}), 'Parkview at Hamlin');

const out=process.argv[2]||'.';
fs.mkdirSync(out,{recursive:true});
console.log(`${SUBS.length} subdivisions usable from the library `+
  `(${SUBS.filter(s=>EXPORT_STREETS[s.name]).length} with streets from real exports, `+
  `${SUBS.filter(s=>!EXPORT_STREETS[s.name]).length} from the library address)\n`);
for(const [n,label,rows] of [[1,'spread',day1],[2,'metro only',day2],
                            [3,'southwest cluster',day3],[4,'light day',day4]]){
  fs.writeFileSync(`${out}/SampleAddresses${n}.csv`, toCSV(rows,{coords:false}));
  fs.writeFileSync(`${out}/SampleAddressesWCoords${n}.csv`, toCSV(rows,{coords:true}));
  const byCrew={}; for(const r of rows) byCrew[r.sid]=(byCrew[r.sid]||0)+1;
  console.log(`${n} ${label.padEnd(19)} ${String(rows.length).padStart(3)} jobs · `+
    `${new Set(rows.map(r=>r.sub)).size} subs · `+
    Object.entries(byCrew).sort().map(([k,v])=>`${k}:${v}`).join(' '));
}
