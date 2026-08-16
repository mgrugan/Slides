/* Memory: a decoded 1080x1350 frame is 5.8MB of bitmap held outside the JS heap, so
   running out of it kills the tab with no error to catch. Ten decks of six used to
   decode all sixty on load (334MB) and paint every card at full resolution (35MB of
   canvas). These tests pin the fixes, and — more importantly — pin that nothing was
   lost in exchange: the library still returns real images, an evicted slide still
   comes back, and an export of a deck that was never on screen still contains photos. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--enable-precise-memory-info']});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

const r = await p.evaluate(async ()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  // a realistic generated frame, and a visibly different second one
  const frame = (hue) => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,600,1350);
    g.addColorStop(0, 'hsl('+hue+',45%,55%)'); g.addColorStop(1, 'hsl('+hue+',30%,14%)');
    x.fillStyle = g; x.fillRect(0,0,1080,1350);
    for(let i=0;i<3000;i++){ x.fillStyle='rgba(200,120,90,0.3)'; x.fillRect(Math.random()*1080, Math.random()*1350, 9, 9); }
    return c.toDataURL('image/jpeg',0.92);
  };
  const data = frame(30);

  const DECKS = 10, PER = 6;
  S.batch = Array.from({length:DECKS},(_,d)=>{
    const deck = {id:'d'+d, hook:'Deck '+d, subject:'Subject '+d, tone:'mono', n:PER, slides:[], caption:'c', status:'done'};
    deck.slides = Array.from({length:PER},(_,i)=>({id:'s'+d+'_'+i, kind:i?'slide':'hook', title:'T'+i, body:'b',
      scene:'sc', tone:'mono', img:data, status:'done', _deck:deck}));
    return deck;
  });
  S.slides = S.batch[0].slides;
  S.batch.forEach(d=>d.slides.slice(0,1).forEach(s=>{ if(s.img) cacheImage(s); }));   // as restoreProject does
  await new Promise(r=>setTimeout(r, 2000));
  buildGrid(); renderBatch();
  await new Promise(r=>setTimeout(r, 1500));

  const cvs = [...document.querySelectorAll('canvas')];
  const decoded = Object.values(IMG_CACHE).filter(i=>i.naturalWidth);

  // an untouched deck's body slides must not be resident
  const cold = S.batch[7].slides[3];
  const coldResident = !!IMG_CACHE[cold.id];

  // ...but exporting it must still produce a photograph, not the placeholder
  await cacheImage(cold);
  const ec = document.createElement('canvas');
  renderSlide(cold, ec, S.profile);
  const px = ec.getContext('2d').getImageData(40, 40, 1, 1).data;
  const exportHasPhoto = ec.width === 1080 && Math.abs(px[0]-px[2]) > 12;   // placeholder is flat blue-grey

  // the LRU must hold the line under pressure, and never evict the open deck
  for(const d of S.batch) for(const s of d.slides) await cacheImage(s);
  const openDeckKept = S.slides.every(s=>!!IMG_CACHE[s.id]);
  const cappedTo = Object.keys(IMG_CACHE).length;

  // an evicted slide re-decodes when something asks to draw it
  const victim = S.batch[3].slides[2];
  delete IMG_CACHE[victim.id];
  const before = !!IMG_CACHE[victim.id];
  renderSlide(victim, document.createElement('canvas'), S.profile, 0.1);
  await new Promise(r=>setTimeout(r, 700));
  const recovered = !before && !!IMG_CACHE[victim.id];

  return {
    canvasMB: +(cvs.reduce((a,c)=>a + c.width*c.height, 0)*4/1048576).toFixed(1),
    biggestCard: Math.max(...cvs.map(c=>c.width)),
    decodedOnLoad: decoded.length,
    coldResident, exportHasPhoto, openDeckKept, cappedTo, recovered,
    dataUrlMB: +(S.batch.flatMap(d=>d.slides).reduce((a,s)=>a+(s.img||'').length*2,0)/1048576).toFixed(1)
  };
});

// the library must give back exactly what it stored, with nothing full-size in memory
const lib = await p.evaluate(async ()=>{
  const c = document.createElement('canvas'); c.width = 800; c.height = 1000;
  const x = c.getContext('2d'); x.fillStyle = '#a8432c'; x.fillRect(0,0,800,1000);
  const data = c.toDataURL('image/jpeg', 0.9);
  await libClear();
  await keepInLibrary({id:'z', kind:'slide', title:'T', scene:'a red wall', tone:'mono'}, data);
  await new Promise(r=>setTimeout(r, 900));

  const item = LIB[0];
  const back = await libData(item.id);
  // a metadata-only save must not wipe the stored image
  item.used = 5; await libSave(item);
  const afterSave = await libData(item.id);

  const slide = {id:'target', kind:'slide', title:'T', scene:'x', status:''};
  S.slides = [slide]; buildGrid();
  await useFromLibrary(slide, LIB[0]);
  await new Promise(r=>setTimeout(r, 700));

  return {
    mirrorHasNoData: LIB.every(x=>!x.data),
    hasThumb: !!item.thumb,
    thumbSmaller: (item.thumb||'').length < data.length / 4,
    roundTrip: back === data,
    survivedMetadataSave: afterSave === data,
    bytesKept: item.bytes === data.length,
    statsShown: /background/.test($('libStats').textContent),
    usedSetsSlide: slide.img === data && slide.status === 'done'
  };
});

const fail = [];
if(r.canvasMB > 8) fail.push('card canvases still oversized: '+r.canvasMB+'MB');
if(r.biggestCard > 900) fail.push('a screen canvas is '+r.biggestCard+'px wide');
if(r.decodedOnLoad > 20) fail.push('too many frames decoded on load: '+r.decodedOnLoad);
if(r.coldResident) fail.push('an unopened deck decoded its body slides');
if(!r.exportHasPhoto) fail.push('export of a cold deck lost its photograph');
if(!r.openDeckKept) fail.push('the open deck was evicted');
if(r.cappedTo > 32) fail.push('cache is not capped: '+r.cappedTo+' resident');
if(!r.recovered) fail.push('an evicted slide did not re-decode on draw');
for(const [k,v] of Object.entries(lib)) if(!v) fail.push('library: '+k);

console.log(JSON.stringify({r, lib, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  bounded memory, nothing lost');
await b.close();
process.exit(fail.length ? 1 : 0);
