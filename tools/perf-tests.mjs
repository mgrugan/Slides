/* The tab was dying and the app was crawling, and both were caused by the same change:
   panoramas are requested at 2K, and two things downstream were sized for 1K.

   THE DECODE CACHE was budgeted in FRAMES. A frame is not a fixed size, and the moment
   it stopped being one the ceiling quadrupled — 28 frames was 156MB of bitmap when it
   was written and 299MB once a 2K image arrived. Decoded bitmaps live outside the JS
   heap, so nothing throws; the tab just dies. It is budgeted in pixels now.

   THE AUTOSAVE serialised every image on the board, and fired once per finished image.
   A run of twenty decks did that work a hundred times, each pass longer than the last.

   Both are measured here rather than asserted, because both were invisible until a
   real board was loaded and neither would show up in a test that used one small image. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1500);

const r = await p.evaluate(async ()=>{
  const out = {};
  const frame = (w,h) => new Promise(res=>{
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#8a5a2b'); g.addColorStop(1,'#1b2a3a');
    x.fillStyle = g; x.fillRect(0,0,w,h);
    res(c.toDataURL('image/jpeg', 0.9));
  });
  const twoK = await frame(2048, 1365);        // what a 2K panorama decodes like

  // --- the budget is in pixels, and it holds whatever size the generator returns
  out.budgetIsInPixels = typeof IMG_BUDGET_MP === 'number' && IMG_BUDGET_MP > 0;
  out.theOldFrameCeilingIsGone = typeof window.IMG_LIMIT === 'undefined';

  const fill = async n => {
    S.slides = []; S.batch = [];
    IMG_LRU.length = 0; IMG_MP.clear();
    for(const k in IMG_CACHE) delete IMG_CACHE[k];
    const deck = {id:'d', cat:'Obsession', slides:[]};
    deck.slides = Array.from({length:n}, (_,i)=>({id:'p'+i, kind:i?'slide':'hook', title:'t',
                                                  body:'b', scene:'s', img:twoK, _deck:deck}));
    S.batch = [deck];
    for(const s of deck.slides) await cacheImage(s);
    return cacheMegapixels();
  };
  const mp = await fill(60);                   // sixty 2K frames asked for at once
  out.heldMegapixels = Math.round(mp);
  out.heldMB = Math.round(mp * 4);
  out.staysUnderBudget = mp <= IMG_BUDGET_MP + 3;      // one frame of slack
  out.wouldHaveBeenMB = Math.round(60 * 2048 * 1365 / 1048576 * 4);
  out.itEvictedRatherThanRefusing = Object.keys(IMG_CACHE).length > 3;
  out.anEvictedFrameIsForgottenToo = IMG_MP.size === Object.keys(IMG_CACHE).length;

  // --- the open deck is never evicted, however big it is
  out.theOpenDeckSurvives = await (async ()=>{
    S.slides = S.batch[0].slides.slice(0, 6);
    for(const s of S.slides) await cacheImage(s);
    trimImageCache();
    return S.slides.every(s => IMG_CACHE[s.id]);
  })();

  // --- a small frame is not evicted for no reason: the budget is pixels, not paranoia
  out.smallFramesStillFit = await (async ()=>{
    S.slides = []; S.batch = [];
    IMG_LRU.length = 0; IMG_MP.clear();
    for(const k in IMG_CACHE) delete IMG_CACHE[k];
    const small = await frame(540, 675);
    const deck = {id:'d2', cat:'History', slides:[]};
    deck.slides = Array.from({length:40}, (_,i)=>({id:'q'+i, kind:'slide', title:'t', body:'b',
                                                   scene:'s', img:small, _deck:deck}));
    S.batch = [deck];
    for(const s of deck.slides) await cacheImage(s);
    return Object.keys(IMG_CACHE).length === 40;       // 40 small frames is only 14MP
  })();

  // --- autosave: the heavy half coalesces instead of running per image
  out.theHeavyHalfIsSeparate = typeof autosaveHeavy === 'function' &&
                               typeof autosaveLight === 'function' &&
                               /autosaveLight\(\); autosaveHeavy\(\)/.test(autosave.toString());
  out.fiftyImagesCauseOneSave = await (async ()=>{
    /* The actual shape of the bug: fifty images landing in a run called autosave fifty
       times and serialised the whole board fifty times. Measured as writes, not as a
       debounce interval, so the number can be retuned without the guarantee moving. */
    const realPut = window.idbPut;
    let writes = 0;
    window.idbPut = async () => { writes++; };
    for(let i = 0; i < 50; i++) autosave();
    await new Promise(r=>setTimeout(r, 300));
    const duringTheRun = writes;
    await new Promise(r=>setTimeout(r, 4200));
    window.idbPut = realPut;
    out.writesDuringTheRun = duringTheRun;
    out.writesAfterItSettled = writes;
    return duringTheRun === 0 && writes === 1;
  })();
  out.theLightHalfCarriesNoImages = (()=>{
    S.batch = [{id:'d3', cat:'History', slides:[{id:'z', kind:'hook', title:'t', img:twoK}]}];
    const light = JSON.stringify(projectJSON(false));
    S.batch = [];
    return light.length < 4000 && !light.includes('data:image');
  })();
  out.twoFullSavesDoNotOverlap = await (async ()=>{
    /* The guard that matters on a long run: a save still running when the next is due
       must not start a second serialise on top of it. */
    let inFlight = 0, maxAtOnce = 0;
    const realPut = window.idbPut;
    window.idbPut = async (k, v) => { inFlight++; maxAtOnce = Math.max(maxAtOnce, inFlight);
                                      await new Promise(r=>setTimeout(r, 60)); inFlight--; };
    saveFull(); saveFull(); saveFull();
    await new Promise(r=>setTimeout(r, 400));
    window.idbPut = realPut;
    return maxAtOnce === 1;
  })();

  S.slides = []; S.batch = [];
  return out;
});
await b.close();

const want = {
  budgetIsInPixels:true, theOldFrameCeilingIsGone:true,
  staysUnderBudget:true, itEvictedRatherThanRefusing:true, anEvictedFrameIsForgottenToo:true,
  theOpenDeckSurvives:true, smallFramesStillFit:true,
  theHeavyHalfIsSeparate:true, fiftyImagesCauseOneSave:true, theLightHalfCarriesNoImages:true,
  twoFullSavesDoNotOverlap:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(32) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
console.log('  ·   sixty 2K frames: held ' + r.heldMB + 'MB, would have held ' + r.wouldHaveBeenMB + 'MB');
console.log('  ·   fifty images landing: ' + r.writesDuringTheRun + ' full saves during the run, ' +
            r.writesAfterItSettled + ' once it settled');
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
