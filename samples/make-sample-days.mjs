/* Manufactures realistic Florida East dispatch days for Route4Me.
   Every street name below is taken from a real Sage export, and every
   coordinate is the real subdivision centroid out of the FL library, so
   the addresses geocode and the drive times Route4Me computes are genuine.
   Only the house numbers, job numbers and dates are invented.

   Run: node samples/make-sample-days.mjs <outdir>                         */

// ---- deterministic RNG, so a re-run produces the same days ----
let _s=20260921;
const rnd=()=>{ _s=(_s*1103515245+12345)&0x7fffffff; return _s/0x7fffffff; };
const pick=a=>a[Math.floor(rnd()*a.length)];
const int=(lo,hi)=>lo+Math.floor(rnd()*(hi-lo+1));

// ---- the six East Florida crews, from the live library ----
const CREWS=[
  {code:'F19', name:'Hunter Cope',     lat:30.2773, lng:-81.7328},
  {code:'F34', name:'Steven Brooks',   lat:28.5140, lng:-81.4810},
  {code:'F51', name:'Ayinde Blackman', lat:28.1581, lng:-81.4972},
  {code:'F65', name:'Eric Brand',      lat:28.4762, lng:-81.2695},
  {code:'F75', name:'Paul Mabb',       lat:28.7532, lng:-81.2821},
  {code:'F76', name:'Johnathan Ortiz', lat:28.5217, lng:-81.2892},
];

/* Subdivisions: real centroid, real map code, and street names lifted from
   actual exports. `zone` groups them for building each day's shape.
   base/step give the house-number range seen on that street.             */
const S=(name,lat,lng,map,div,zone,sections,streets)=>({name,lat,lng,map,div,zone,sections,streets});
const SUBS=[
  // ---- Orlando core ----
  S('Poitras N-4 West',28.3565,-81.2624,'ORL3','08','core',['PH1'],
    [['Sinatra Lane',9100,4],['Luminary Boulevard',0,1,'lot']]),
  S('Laureate Park',28.3509,-81.2562,'ORL3','08','core',['PH1','PH2'],
    [['Gobat Alley',10040,3],['Pearson Avenue',10460,4],['MacBride Drive',0,1,'lot']]),
  S('Waters at Center Lake Ranch',28.2800,-81.2345,'ORL3','08','core',['PH1B'],
    [['Ladyfish Trail',815,4],['Buterfish Place',5088,4],['Lost Key Place',5041,4]]),
  S('Esplanade at Center Lake Ranch',28.2808,-81.2227,'ORL3','08','core',['PH1','PH2'],
    [['Spring Moss Court',5401,4],['Tassleflower Trail',1063,4]]),
  S('Edgewater Cross Prairie',28.2182,-81.3356,'ORL3','08','core',['PH1','PH2'],
    [['Elliotts Astor Boulevard',4425,2],['Seagrape Avenue',0,1,'LOT'],
     ['Natalia Drive',5104,4],['Bentgrass Bend',4370,4],['Clay Whaley Road',0,1,'LOT']]),
  S('EA McKinnon Groves',28.5090,-81.6629,'ORL4','08','core',['PH1'],
    [['Bourbon Rose Circle',11302,4],['Sedona Street',17730,8],['Carding Mill Lane',11220,6]]),
  S('Parkview at Hamlin',28.4762,-81.6180,'ORL4','08','core',[''],
    [['Groveside Road',15141,6],['Brightside',5519,4]]),

  // ---- north: Sanford / Mount Dora / Leesburg ----
  S('Lochside',28.8242,-81.6370,'ORL1','08','north',[''],
    [['Sea Loch Loop',32405,8],['Lochside Lane',19290,8]]),
  S('Leala Reserve',28.7669,-81.7556,'ORL1','08','north',['PH2B'],
    [['Radhika Point',3300,2],['Priya Drive',2628,4]]),
  S('Cresswind at Lake Harris',28.7900,-81.7747,'ORL1','08','north',['PH1'],
    [['Bellagio Loop',1610,4]]),
  S('Meadow Pointe at Estates at Cherry Lake',28.6053,-81.8028,'ORL1','08','north',[''],
    [['Tundra Loop',770,8]]),

  // ---- southwest: Poinciana / Haines City / Lakeland / Lake Alfred ----
  S('Westview',28.1570,-81.5075,'ORL6','08','metrosw',['PBN4','PBN2A2B','PB5PH1','PB2BPH2','PBN2B'],
    [['Sapote Court',5510,5],['Dennery Bay Road',5585,6],['Ochos Rios Place',4483,4],
     ['Coral Harbour Road',4614,6],['Loggia Lane',4973,6],['Guava Court',5508,6],
     ['Pimenta Court',5518,6],['Ficus Aurea Street',5692,4],['Ackee Road',4567,4],
     ['Segrape Lane',5617,4]]),
  S('Crosswinds East',28.1225,-81.5849,'ORL6','08','polk',['PH2C'],
    [['Riverbend Boulevard',4325,12]]),
  S('Liberty Trace',28.1069,-81.5969,'ORL6','08','polk',[''],
    [['Liberty Bend',412,6],['Hugo Drive',299,4]]),
  S('Woodland Ranch Estates',28.0128,-81.5821,'ORL6','08','polk',['PH1'],
    [['Nola Lane',327,4]]),
  S('Crystal Lake Preserve',28.0269,-81.6359,'ORL6','08','polk',['20'],
    [['Manchester Path',590,6],['Harvard Court',451,4]]),
  S('Gum Lake Preserve',28.1237,-81.7304,'ORL6','08','polk',['PH1','PH2'],
    [['Amanatsu Avenue',3636,4]]),

  // ---- far northeast coast: New Smyrna / Ormond ----
  S('Palms (Venetian Bay)',29.0264,-81.0231,'ORL2','08','coast',['PH6'],
    [['Tiger Palm Way',3186,4],['Venetian Palms Boulevard',116,4]]),
  S('Waterstone Subdivision',29.3005,-81.1125,'ORL2','08','coast',[''],
    [['Ridge Tree Lane',1462,4]]),

  // ---- far north: Nassau County / St Marys, 150 miles out ----
  S('Plat of Subdivision Survey(Esplanade at St. Marys',30.7794,-81.6162,'JAX1','15','farnorth',[''],
    [['Hillcrest Drive',96,8],['Grandview Drive',311,8],['Sugar Creek Cove',97,8],['Richland Way',120,8]]),
  S('The Villas at Camden Woods',30.7855,-81.6252,'GASE','15','farnorth',['PH2','PH2B'],
    [['Collin Nicholas Drive',0,1,'Lot']]),
  S('Northshore',30.8084,-81.7820,'GASE','15','farnorth',[''],
    [['Shoreline Drive',377,8]]),
  S('Laurel Preserve',30.8016,-81.6082,'','12','farnorth',['PH1SA'],
    [['Spyglass',206,8]]),
];
const BY=Object.fromEntries(SUBS.map(s=>[s.name,s]));

// Sage truncates Builder Name at 12 characters.
const BUILDERS=['Toll Brother','Lennar Homes','Taylor Morri','NVR South (M','Century Comm',
                'DRB Homes (M','Casa Fresca','ICI Homes (M','Kolter Homes','NVR (SAV)'];
// task -> the Priority value Sage ships with it, as seen in real exports
const TASKS=[['FORM SURVEY','3'],['GRADE STAKING','2'],['FINAL SVY SWALE','4'],
  ['ENV W\\ELEV STK','2'],['SIGNED SLAB SVY','3'],['RE-GRADE STAKE','2'],
  ['RE-FORM SURVEY','3'],['MUNICIPAL CERT.','3'],['REVIEW-FINAL','1'],['UPDATE SURVEY','2']];

// who Sage has on each subdivision today, from the real exports
const OWNER={'Laurel Preserve':'F19','The Villas at Camden Woods':'F19',
  'Plat of Subdivision Survey(Esplanade at St. Marys':'F19','Northshore':'F19',
  'Westview':'F51','Crystal Lake Preserve':'F34','Liberty Trace':'F34','Crosswinds East':'F34',
  'Woodland Ranch Estates':'F34','Parkview at Hamlin':'F76','EA McKinnon Groves':'F34',
  'Lochside':'F75','Cresswind at Lake Harris':'F75','Poitras N-4 West':'F75',
  'Leala Reserve':'F75','Meadow Pointe at Estates at Cherry Lake':'F75',
  'Edgewater Cross Prairie':'F65','Waters at Center Lake Ranch':'F65',
  'Esplanade at Center Lake Ranch':'F65','Laureate Park':'F76','Sandhill Preserve':'F76',
  'Palms (Venetian Bay)':'F19','Waterstone Subdivision':'F19','Gum Lake Preserve':'F51'};
const mi=(a,b,c,d)=>{const R=3958.8,p=Math.PI/180,q=(c-a)*p,r=(d-b)*p,
  x=Math.sin(q/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(r/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));};
const ownerOf=s=>OWNER[s.name] ||
  CREWS.slice().sort((a,b)=>mi(a.lat,a.lng,s.lat,s.lng)-mi(b.lat,b.lng,s.lat,s.lng))[0].code;

// ---- dates ----
const p2=n=>String(n).padStart(2,'0');
const mdy=d=>`${p2(d.getMonth()+1)}/${p2(d.getDate())}/${String(d.getFullYear()).slice(2)}`;
const shift=(d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};
const weekday=d=>{const x=new Date(d);
  while(x.getDay()===0||x.getDay()===6) x.setDate(x.getDate()+1);   // Sat/Sun -> Monday
  return x;};

// Master Job and Svc Job Num track the bands the real exports use
let JOB=2544000, MASTER=440000;
function makeRow(sub, dispatch, opts={}){
  const [street,base,step,style]=pick(sub.streets);
  const n=base+step*int(0,24);
  const addr = style==='lot' ? `Lot ${int(11,148)} ${street}`
             : style==='LOT' ? `LOT ${int(11,148)} ${street}`
             : style==='Lot' ? `Lot ${int(11,148)} ${street}`
             : `${n} ${street}`;
  const [task,prio]=opts.task ? [opts.task, (TASKS.find(t=>t[0]===opts.task)||['','3'])[1]] : pick(TASKS);
  const recv=opts.recv||weekday(shift(dispatch,-int(3,13)));
  const sched=opts.sched||weekday(shift(dispatch,int(0,4)));
  return {
    recv:mdy(recv), _recv:recv, _sched:sched, sid:ownerOf(sub), status:pick(['IF','IF','IF','IF','FV','FE','CFF','OUT']),
    builder:opts.builder||pick(BUILDERS), master:String(MASTER+=int(11,260)).padStart(15,'0'),
    job:String(JOB+=int(1,9)), addr, map:sub.map, sub:sub.name,
    section:pick(sub.sections), task, prio:rnd()<0.04?'R':prio, div:sub.div,
    title:task==='FINAL SVY SWALE'?'N':'', sched:mdy(sched),
    build:opts.build!==undefined?opts.build:(rnd()<0.05?'M':rnd()<0.04?'D':''),
    lat:sub.lat, lng:sub.lng };
}

/* One townhome building: eight units, one roof, consecutive addresses.
   Real exports write these as "<number> Groveside Road BLDG <n>".        */
function townhomeBuilding(sub, dispatch, bldg){
  const base=15141+6*int(0,10);
  const shared={task:'FINAL SVY SWALE', build:'T', builder:pick(BUILDERS),
    recv:weekday(shift(dispatch,-int(4,10))), sched:weekday(shift(dispatch,int(1,3)))};
  return Array.from({length:8},(_,i)=>{
    const r=makeRow(sub,dispatch,shared);
    r.addr=`${base+i*6} Groveside Road BLDG ${bldg}`;   // eight units, one roof
    return r;
  });
}

function buildDay(dispatch, plan, tName){
  const rows=[];
  for(const [subName,count] of plan){
    const sub=BY[subName];
    if(!sub) throw new Error('unknown subdivision: '+subName);
    for(let i=0;i<count;i++) rows.push(makeRow(sub,dispatch));
  }
  if(tName) rows.push(...townhomeBuilding(BY[tName],dispatch,int(21,34)));
  // Sage exports oldest received first
  const key=r=>{const[m,d,y]=r.recv.split('/');return +('20'+y+m+d);};
  rows.sort((a,b)=>key(a)-key(b));
  return rows;
}

// ---- CSV, matching the current Sage export: quoted and padded ----
const HEAD=['Received Date','Servicer Id','Status Code','Builder Name','Master Job','Svc Job Num',
  'Address 1','Map Code','Subdiv Name','Section','Description Of Problem','Priority','Division',
  'Title','Schedule_Date','BuildType'];
const FIELD=['recv','sid','status','builder','master','job','addr','map','sub','section','task',
  'prio','div','title','sched','build'];
// widths as the report is now set up, with the fixed ones Sage has always used
const WIDTH={'Received Date':13,'Servicer Id':11,'Status Code':11,'Builder Name':12,
  'Master Job':15,'Svc Job Num':11,'Address 1':40,'Map Code':10,'Subdiv Name':50,
  'Section':15,'Description Of Problem':22,'Priority':8,'Division':8,'Title':5,
  'Schedule_Date':13,'BuildType':9,'Latitude':12,'Longitude':12};
const pad=(v,w)=>`"${String(v==null?'':v).slice(0,w).padEnd(w,' ')}"`;

function toCSV(rows,{coords}){
  const head=coords?[...HEAD,'Latitude','Longitude']:HEAD;
  const flds=coords?[...FIELD,'lat','lng']:FIELD;
  const line=vals=>vals.map((v,i)=>pad(v,WIDTH[head[i]])).join(',');
  return [line(head),...rows.map(r=>line(flds.map(f=>
    f==='lat'||f==='lng'?Number(r[f]).toFixed(6):r[f])))].join('\n')+'\n';
}

// ================= the three days =================
const DISPATCH=new Date(2026,8,22);   // Tue 22 Sep 2026

/* All three days carry Hunter's Nassau County block. St Marys is 150 miles
   from Orlando but only 35 from his house, so it is his ordinary work -- and
   without it he has no jobs, and no reason to be a start. */

/* Day 1 -- work spread to the edges. A tail in Polk County and two coastal
   subdivisions that sit between the two metros and belong to nobody cleanly.
   This is the day that pulls the optimizer apart. */
const day1=buildDay(DISPATCH,[
  ['Edgewater Cross Prairie',5],['Poitras N-4 West',5],['Laureate Park',4],
  ['Waters at Center Lake Ranch',4],['Esplanade at Center Lake Ranch',3],
  ['EA McKinnon Groves',5],['Parkview at Hamlin',1],                    // 27 core
  ['Westview',8],                                                       //  8 Poinciana
  ['Lochside',4],['Leala Reserve',2],['Cresswind at Lake Harris',2],    //  8 north
  ['Crosswinds East',2],['Liberty Trace',2],['Crystal Lake Preserve',2],
  ['Gum Lake Preserve',2],                                              //  8 Polk
  ['Palms (Venetian Bay)',3],['Waterstone Subdivision',2],              //  5 coast
  ['Plat of Subdivision Survey(Esplanade at St. Marys',4],
  ['The Villas at Camden Woods',2],['Northshore',1],['Laurel Preserve',1],
],'Parkview at Hamlin');

/* Day 2 -- the same volume with nothing orphaned. Orlando metro plus Hunter's
   own block; no Polk tail, no coast. The clean comparison. */
const day2=buildDay(DISPATCH,[
  ['Edgewater Cross Prairie',8],['Poitras N-4 West',7],['Laureate Park',6],
  ['Waters at Center Lake Ranch',5],['Esplanade at Center Lake Ranch',4],
  ['EA McKinnon Groves',5],['Parkview at Hamlin',2],                    // 37 core
  ['Westview',7],                                                       //  7 Poinciana
  ['Lochside',4],['Leala Reserve',2],
  ['Meadow Pointe at Estates at Cherry Lake',2],                        //  8 north
  ['Plat of Subdivision Survey(Esplanade at St. Marys',5],
  ['The Villas at Camden Woods',3],['Northshore',1],['Laurel Preserve',1],
],'Parkview at Hamlin');

/* Day 3 -- eighteen jobs down in Polk and Poinciana: more than one crew can
   finish, less than a full day for two. The rest is ordinary work. */
const day3=buildDay(DISPATCH,[
  ['Westview',6],['Gum Lake Preserve',4],['Crystal Lake Preserve',4],
  ['Woodland Ranch Estates',2],['Crosswinds East',2],                   // 18 southwest
  ['Edgewater Cross Prairie',6],['Poitras N-4 West',5],['Laureate Park',5],
  ['Waters at Center Lake Ranch',4],['Esplanade at Center Lake Ranch',3],
  ['EA McKinnon Groves',4],['Parkview at Hamlin',1],                    // 28 core
  ['Lochside',4],['Leala Reserve',2],
  ['Meadow Pointe at Estates at Cherry Lake',3],                        //  9 north
  ['Plat of Subdivision Survey(Esplanade at St. Marys',5],
  ['The Villas at Camden Woods',3],['Northshore',1],['Laurel Preserve',1],
],'Parkview at Hamlin');

import fs from 'node:fs';
const out=process.argv[2]||'.';
fs.mkdirSync(out,{recursive:true});
const days=[['1_spread',day1],['2_metro_only',day2],['3_southwest_cluster',day3]];
for(const [label,rows] of days){
  fs.writeFileSync(`${out}/Sample_day_${label}.csv`, toCSV(rows,{coords:false}));
  fs.writeFileSync(`${out}/Sample_day_${label}_with_coords.csv`, toCSV(rows,{coords:true}));
  const byCrew={}, byZone={};
  for(const r of rows){ byCrew[r.sid]=(byCrew[r.sid]||0)+1; const z=BY[r.sub].zone; byZone[z]=(byZone[z]||0)+1; }
  const far=rows.filter(r=>mi(28.45,-81.35,r.lat,r.lng)>45).length;
  console.log(`${label.padEnd(22)} ${String(rows.length).padStart(3)} jobs · `+
    `${new Set(rows.map(r=>r.sub)).size} subs · ${far} over 45mi out · `+
    Object.entries(byCrew).sort().map(([k,v])=>`${k}:${v}`).join(' '));
  console.log(`${' '.repeat(23)}zones ${Object.entries(byZone).map(([k,v])=>`${k}:${v}`).join(' ')}`);
}
