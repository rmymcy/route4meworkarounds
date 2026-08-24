# Route4Me Workaround — Map & Pin System (extract)

Reference markup of the two Leaflet systems in `index.html`, in the same style as the
Dispatch v2.15 extracts this tool was reworked from.

1. **The big subs map** — the 📍 Map view on the Subdivisions tab: every sub with
   coordinates as a pin, plus the per-row 📍 button that jumps to one sub.
2. **The mini map in the sub-resolution popup** — the KMZ/Zones review card with the
   horizontal layout (info left, 280px map right), lazy-initialized as cards scroll
   into view, with the stacking-context fix that keeps Leaflet from bleeding over the
   modal chrome.

Everything below is verbatim from the live file (v35).

---

## Part 1 — The subs map and the pins

### How it works, end to end

- The Subdivisions tab has **two swappable panes**: the list (`#subsListWrap`) and the
  map (`#subsMapWrap`, 540px tall, hidden by default). The 📍 Map button toggles which
  one is visible — they never show at the same time.
- The Leaflet map is built **once** and reused. `subsMapInstance` is module-level;
  the first `renderSubsMap()` creates the map, the tile layer, one `layerGroup` for the
  pins, and a small info control (top-right). Every later call just clears the layer
  group and repopulates it — no teardown, no flicker.
- Pins are **canvas circle markers** (`preferCanvas:true` on the map), which is what
  lets the company page draw 8,000+ subs without dying. Each pin gets a hover tooltip
  (name) and a click popup (name, nickname, address, 6-decimal coords).
- The map draws **exactly what the list shows**: both read the same
  `subsFilterList()` result, so typing in the filter box narrows the pins too. When the
  filter string changes, the map re-fits its bounds to the new pin set; when nothing
  changed it keeps your pan/zoom.
- Subs **without coordinates never get a pin** — the info control counts them
  (`N without coordinates` in amber) so they're visible without being fake-placed.
  No geocoding, ever: a pin only exists if the library has real coords.
- **Per-sub focus**: each list row with coords gets a 📍 icon button. Clicking it sets
  `pendingSubFocus`, force-opens the map pane, and the next render drops a **teardrop
  marker** on that sub at zoom 15 (on top of its blue circle). The teardrop
  self-removes once you zoom back out to ≤13 — it's a "you are here" flag, not a
  permanent layer.
- `renderSubs()` ends with `renderSubsMap(false)` so any edit made while the map is
  open (rename, coord change, delete) is reflected immediately; the `false` means
  "don't re-fit, keep my view".
- Offline guard: Leaflet + OSM tiles are the tool's only online dependency. If `L`
  never loaded, the Map button and 📍 buttons toast
  *"Map needs internet (Leaflet + OpenStreetMap tiles)"* instead of erroring.

### 1. The two panes (HTML)

```html
<button class="small" id="subsMapBtn">&#128205; Map</button>
...
<div id="subsListWrap">
  <div class="subs-grid-head"><div></div><div>Name</div><div>Nickname</div><div>Address</div><div>Lat / Long</div><div>Aliases</div><div style="text-align:right">Actions</div></div>
  <div id="subsList" style="max-height:56vh;overflow-y:auto"></div>
</div>
<div id="subsMapWrap" class="hide"></div>
```

```css
#subsMapWrap{height:540px;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#eaeaed}
```

### 2. State + toggle

```js
/* ==== SUBS MAP (Leaflet — all subs + per-sub focus) ==== */
let subsMapInstance=null, subsMapLayer=null, subsMapInfoEl=null, _subsMapLastFilter=null, pendingSubFocus=null, _focusPin=null;
function mapAvailable(){ return typeof L!=='undefined'; }
function toggleSubsMap(force){
  const mapWrap=document.getElementById('subsMapWrap'), listWrap=document.getElementById('subsListWrap'), btn=document.getElementById('subsMapBtn');
  const show = force!==undefined ? force : mapWrap.classList.contains('hide');
  if(show && !mapAvailable()){ showToast('Map needs internet (Leaflet + OpenStreetMap tiles) — reconnect and reload'); return; }
  mapWrap.classList.toggle('hide',!show);
  listWrap.classList.toggle('hide',show);
  btn.classList.toggle('primary',show);
  if(show) renderSubsMap(true);
}
```

`toggleSubsMap()` with no argument flips; `toggleSubsMap(true)` is used by the focus
path to guarantee the map pane is open before dropping the pin.

### 3. The renderer — create once, repopulate forever

```js
function renderSubsMap(fit){
  const wrap=document.getElementById('subsMapWrap');
  if(!wrap||wrap.classList.contains('hide')||!mapAvailable()) return;
  if(!subsMapInstance){
    subsMapInstance=L.map('subsMapWrap',{zoomControl:true,zoomDelta:0.5,zoomSnap:0.5,preferCanvas:true}).setView([28.5,-81.4],8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(subsMapInstance);
    subsMapLayer=L.layerGroup().addTo(subsMapInstance);
    const info=L.control({position:'topright'});
    info.onAdd=()=>{ subsMapInfoEl=L.DomUtil.create('div');
      subsMapInfoEl.style.cssText='background:rgba(255,255,255,.93);border:1px solid #d1d1d6;border-radius:6px;padding:5px 9px;font-size:11px;color:#3f3f46;box-shadow:0 1px 4px rgba(0,0,0,.15);line-height:1.5';
      return subsMapInfoEl; };
    info.addTo(subsMapInstance);
  }
  setTimeout(()=>subsMapInstance.invalidateSize(),50);
  subsMapLayer.clearLayers();
  const {list,filtered}=subsFilterList();
  const curFilter=norm(document.getElementById('subSearch').value);
  if(_subsMapLastFilter!==null && curFilter!==_subsMapLastFilter) fit=true;
  _subsMapLastFilter=curFilter;
  const located=list.filter(({s})=>subHasGeo(s));
  const missing=list.length-located.length;
  const pts=[];
  for(const {s,i} of located){
    const m=L.circleMarker([+s.lat,+s.lng],{radius:7,color:'#fff',weight:1.5,fillColor:'#2563eb',fillOpacity:.92});
    m.bindTooltip(esc(s.name),{direction:'top',offset:[0,-6]});
    m.bindPopup(`<div style="min-width:180px">
      <div style="font-weight:700;font-size:12.5px">${esc(s.name)}</div>
      ${s.nickname?`<div style="font-size:11px;color:#6b6b73">&ldquo;${esc(s.nickname)}&rdquo;</div>`:''}
      ${s.address?`<div style="font-size:11px;color:#6b6b73;margin-top:2px">${esc(s.address)}</div>`:''}
      <div style="font-size:11px;color:#6b6b73;margin-top:3px;font-variant-numeric:tabular-nums">${(+s.lat).toFixed(6)}, ${(+s.lng).toFixed(6)}</div>
    </div>`);
    subsMapLayer.addLayer(m);
    pts.push([+s.lat,+s.lng]);
  }
  if(subsMapInfoEl) subsMapInfoEl.innerHTML=`<b>${located.length}</b> sub${located.length===1?'':'s'} shown${filtered?' (filtered)':''}${missing?` · <span style="color:#d97706">${missing} without coordinates</span>`:''}`;
  if(pendingSubFocus){
    const p=pendingSubFocus; pendingSubFocus=null;
    setTimeout(()=>{
      subsMapInstance.setView([p.lat,p.lng],15);
      if(_focusPin){ _focusPin.remove(); _focusPin=null; }
      _focusPin=L.marker([p.lat,p.lng]).addTo(subsMapInstance).bindTooltip(esc(p.name),{permanent:false});
      const check=()=>{ if(_focusPin && subsMapInstance.getZoom()<=13){ _focusPin.remove(); _focusPin=null; subsMapInstance.off('zoomend',check); } };
      subsMapInstance.on('zoomend',check);
    },80);
  } else if(fit&&pts.length) subsMapInstance.fitBounds(pts,{padding:[40,40]});
}
```

Details worth keeping if you ever port this again:

- `invalidateSize()` in a 50ms `setTimeout` — the pane was `display:none` a moment
  ago, so Leaflet measured it at 0×0; the deferred call fixes the tile grid after
  the browser lays it out.
- The `_subsMapLastFilter` compare is what makes filter-typing auto-refit while
  plain re-renders (edits) leave your viewport alone.
- Blue dots are `circleMarker`s in the layer group; the focus teardrop is a real
  `L.marker` added **directly to the map**, so `clearLayers()` on a re-render never
  eats it — only the `zoomend` watcher (≤13) removes it.
- `pendingSubFocus` is consumed-then-cleared before the `setTimeout`, so a render
  that happens for any other reason can't re-trigger an old focus.

### 4. The per-row 📍 pin button

Only rendered when the sub actually has coords, inside each `sub-card2` row:

```js
<div class="sub-actions2">
  ${geo?`<button class="icon-btn" data-map="${i}" title="show on map">&#128205;</button>`:''}
  <button class="icon-btn danger" data-del="${i}" title="delete sub">&#128465;</button>
</div>
```

One delegated click listener on the list container routes it (rows re-render
constantly, so per-button handlers would go stale):

```js
subsListEl.addEventListener('click',e=>{
  const t=e.target.closest('[data-geo],[data-adel],[data-aadd],[data-map],[data-del]');
  if(!t) return;
  if(t.dataset.geo!=null) return openGeoEditor(+t.dataset.geo);
  if(t.dataset.map!=null) return focusSubOnMap(+t.dataset.map);
  ...
});
```

And the focus function itself — set intent, force the map open, let the renderer
do the rest:

```js
function focusSubOnMap(i){
  const s=SUBS[i]; if(!s||!subHasGeo(s)) return;
  if(!mapAvailable()){ showToast('Map needs internet (Leaflet + OpenStreetMap tiles)'); return; }
  pendingSubFocus={lat:+s.lat,lng:+s.lng,name:s.name};
  toggleSubsMap(true);
}
```

### 5. List and map stay in sync

Last line of `renderSubs()`:

```js
renderSubsMap(false); // keep map in step when it's open
```

---

## Part 2 — The sub-resolution popup's horizontal mini map

### How it works, end to end

- Every KMZ-scan / Zones-import suggestion renders as a `review-card` whose body is a
  **two-column grid**: flexible info column left, fixed **280px** map column right,
  `align-items:stretch` so the map tile fills the card's height. Below 640px wide it
  collapses to one column (map under the info).
- The left column holds everything actionable: the badge (`new sub` / `fill blank` /
  `noise?`), the **editable name input** (rename before creating), the create/fill
  checkbox, the one-click **"Same sub — save alias"** banner when the fuzzy match is
  ≥0.70 *and* the pin is ≤1 mile from a library sub, the folder / filename / raw map
  name provenance, and the coordinates.
- The right column is just `<div id="kzmap_N" class="kz-mini">` — an empty 150px-tall
  placeholder. **No Leaflet map exists yet when the modal opens.**
- Maps are **lazy**: an `IntersectionObserver` rooted on the modal's scroll container
  (with a 250px look-ahead margin) initializes each mini map only when its card scrolls
  near view, then unobserves it. A 2,800-card zones review opens instantly instead of
  building 2,800 maps up front. `data-inited` guards double-init; browsers without
  IntersectionObserver just build them all.
- Each mini map is a full interactive Leaflet instance — drag, scroll-wheel zoom, and
  zoom buttons (the zoom control you asked for) — centered at zoom 14 with a single
  marker on the KMZ/zone centroid. Attribution is off to save the 150px.
- **The "really wonky" fix**: Leaflet's internal panes use z-indexes in the hundreds,
  which used to float over the modal's borders and sticky footer. Two CSS moves ended
  it: the mini-map div is its own **stacking context** (`position:relative; z-index:0;
  isolation:isolate; overflow:hidden`) so nothing inside can escape its box, and the
  modal footer sits at `z-index:20` above whatever the body scrolls under it.
- Offline: if Leaflet didn't load, the placeholder text says
  *"map needs internet — coordinates are still used"* — resolution still works, you
  just don't get the visual.

### 1. The horizontal layout (CSS)

```css
/* KMZ review card: info left, mini map right; isolate the map so Leaflet's
   internal z-indexes can't escape over the modal chrome */
.kz-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:12px;align-items:stretch}
.kz-mini{height:150px;border:1px solid var(--line);border-radius:8px;background:#eaeaed;display:flex;align-items:center;justify-content:center;
  color:var(--muted);font-size:12px;position:relative;z-index:0;isolation:isolate;overflow:hidden}
@media(max-width:640px){.kz-grid{grid-template-columns:1fr}.kz-mini{height:160px}}
```

`minmax(0,1fr)` on the info column matters: without the `0` floor, a long filename
would push the grid wider than the modal instead of ellipsizing.

The other half of the z-index fix, on the modal footer:

```css
.modal .mf{padding:14px 22px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end;position:sticky;bottom:0;background:var(--panel);z-index:20}
```

### 2. The card template

```js
const cardHtml=r=>{
  const search=norm([r.newName,r.subName,r.name,r.src,r.dir].filter(Boolean).join(' '));
  return `<div class="review-card" data-kz="${r.i}" data-search="${esc(search)}">
  <div class="kz-grid">
    <div style="min-width:0">
      <div class="review-head">
        ${r.status==='new'
          ? `<span class="badge ok">new sub</span>${r.noise?'<span class="badge warn">noise?</span>':''}<input type="text" data-kzname="${r.i}" value="${esc(r.newName)}" style="flex:1;min-width:160px;font-weight:700">`
          : `<span class="badge warn">fill blank</span><span class="raw">${esc(r.subName)}</span>`}
        <label style="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer">
          <input type="checkbox" data-kzapply="${r.i}" ${r.apply?'checked':''}> ${r.status==='new'?'create':'fill'}</label>
      </div>
      ${r.aliasSuggest?`<div style="font-size:11.5px;margin:2px 0 6px;padding:7px 9px;border:1px solid var(--warn);border-radius:8px;background:var(--warn-bg)">
          Matches <b>${esc(r.aliasSuggest.name)}</b> (${r.aliasSuggest.score.toFixed(2)} &middot; ${r.aliasSuggest.dist<0.1?'&lt;0.1':r.aliasSuggest.dist.toFixed(1)} mi away)
          <button class="small primary" data-kzalias="${r.i}" style="margin-left:8px">Same sub &mdash; save alias</button></div>`
        : r.similar?`<div style="font-size:11.5px;margin:2px 0 6px;color:var(--warn)"><b>Similar to existing sub:</b> ${esc(r.similar.name)} (${r.similar.score.toFixed(2)}) &mdash; possible typo/variant; rename to match instead of creating a duplicate</div>`:''}
      <div class="muted" style="font-size:11px">${r.dir?`<b>${esc(r.dir)}</b><br>`:''}${esc(r.src)}<br>map name: ${esc(r.name)}<br><span class="pin">${rnd(r.lat)}, ${rnd(r.lng)}</span></div>
    </div>
    <div id="kzmap_${r.i}" class="kz-mini">${mapAvailable()?'':'map needs internet — coordinates are still used'}</div>
  </div>
</div>`;};
```

The map cell carries the row index in its id (`kzmap_7`), which is how the lazy
initializer finds the matching row's coordinates later.

### 3. The alias-suggest wiring behind that banner

Computed once per suggestion when the review opens — Jaro-Winkler name score plus a
real distance check, so "70% similar name AND pin within a mile" is what earns the
one-click button:

```js
// one-click alias confirm: name >=0.70 similar AND pin within 1 mile of the library sub
for(const c of scoreSubs(newName).filter(x=>x.score>=ALIAS_SCORE).slice(0,5)){
  const s=SUBS.find(x=>x.name===c.name);
  if(s && subHasGeo(s)){
    const d=haversineMi(L.lat,L.lng,+s.lat,+s.lng);
    if(d<=ALIAS_MILES){ aliasSuggest={name:s.name,score:c.score,dist:d}; break; }
  }
}
```

### 4. Lazy mini-map init (IntersectionObserver)

Runs right after the modal HTML is injected, inside `renderKz()`:

```js
// lazy mini maps: initialize only when a card scrolls into view
if(mapAvailable()){
  const makeMap=el=>{
    if(el.dataset.inited) return; el.dataset.inited='1';
    const r=kmzRows.find(x=>('kzmap_'+x.i)===el.id); if(!r) return;
    el.textContent='';
    try{
      const mm=L.map(el,{zoomControl:true,attributionControl:false,dragging:true,scrollWheelZoom:true,zoomDelta:0.5,zoomSnap:0.5}).setView([r.lat,r.lng],14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(mm);
      L.marker([r.lat,r.lng]).addTo(mm);
      setTimeout(()=>mm.invalidateSize(),60);
    }catch(e){ el.textContent='map failed to load — coordinates above are still used'; }
  };
  const targets=[...root.querySelectorAll('[id^=kzmap_]')];
  if(typeof IntersectionObserver==='undefined') targets.forEach(makeMap);
  else{
    const io=new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting){ io.unobserve(en.target); makeMap(en.target); } }),
      {root:root.querySelector('.modal'), rootMargin:'250px'});
    targets.forEach(t=>io.observe(t));
  }
}
```

Notes:

- The observer's `root` is the **modal itself** (that's the scrolling element —
  `.modal{max-height:86vh;overflow:auto}`), not the viewport. Observing against the
  viewport would fire for cards hidden behind the modal's own scroll.
- `rootMargin:'250px'` pre-builds maps one card-height before they appear, so
  scrolling never shows a gray placeholder mid-view.
- Same `invalidateSize()` deferred-measure trick as the big map, for the same reason.
- The whole init is inside `try/catch`; a tile/library failure degrades to a text
  note in the placeholder and the card stays fully usable.

### 5. Why the mini maps don't wreck the modal (recap)

Three ingredients, all needed:

| Ingredient | Where | What it stops |
|---|---|---|
| `isolation:isolate` + `z-index:0` + `position:relative` on `.kz-mini` | CSS | Leaflet panes (z-index 200–700) escaping the card and painting over modal borders/footer |
| `overflow:hidden` on `.kz-mini` | CSS | Tiles drawing outside the rounded 150px box |
| `z-index:20` on the sticky `.mf` footer | CSS | Card content sliding **over** the Cancel / Add-checked bar as the modal scrolls |

---

## Quick index (line numbers in index.html v35)

| Thing | Where |
|---|---|
| `.kz-grid` / `.kz-mini` / media query | ~93–98 |
| `.modal .mf` (sticky footer, z-index 20) | ~92 |
| `#subsMapWrap` (540px pane) | ~139 |
| Subs toolbar + two panes HTML | ~253–285 |
| Per-row 📍 button in `renderSubs()` | ~1013 |
| `renderSubs()` → `renderSubsMap(false)` sync | ~1019 |
| SUBS MAP block (state, toggle, render, focus) | ~1050–1113 |
| `aliasSuggest` scoring (0.70 + 1 mi) | ~1804–1811 |
| `cardHtml` (kz-grid card) | ~1838–1858 |
| Lazy mini-map init (IntersectionObserver) | ~1883–1903 |
| Delegated 📍 click → `focusSubOnMap` | ~2096–2100 |
