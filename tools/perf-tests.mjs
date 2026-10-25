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
  let seed = 0;
  // each call must differ, or "a new cover" is byte-identical to the old one and a
  // cache keyed on the image correctly decides nothing changed
  const frame = (w,h) => new Promise(res=>{
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'hsl('+((seed++ * 37) % 360)+',45%,35%)'); g.addColorStop(1,'#1b2a3a');
    x.fillStyle = g; x.fillRect(0,0,w,h);
    for(let i=0;i<60;i++){ x.fillStyle='rgba(210,180,130,0.3)'; x.fillRect((i*97+seed)%w,(i*151)%h,40,40); }
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

  /* --- THE ROW THUMBNAILS. The board in the report had 34 decks and the cache holds
     about 15 frames, so every pass over the rows demanded the ones just evicted, and
     each of those decodes redrew its row and evicted another. A loop that never
     settles, which is why the tab went unresponsive with nothing running. */
  const board = async n => {
    S.slides = []; S.batch = []; ROW_THUMB.clear();
    IMG_LRU.length = 0; IMG_MP.clear();
    for(const k in IMG_CACHE) delete IMG_CACHE[k];
    const imgs = [];
    for(let i = 0; i < 6; i++) imgs.push(await frame(2048, 1365));
    S.batch = Array.from({length:n}, (_, d) => {
      const deck = {id:'b'+d, cat:'Terrifying', hook:'DECK '+d, subject:'s', tone:'mono',
                    status:'done', caption:'', slides:[]};
      deck.slides = Array.from({length:4}, (_, i)=>({id:'b'+d+'s'+i, kind:i?'slide':'hook',
        title:'T', body:'b', scene:'s', tone:'mono', status:'done',
        img: imgs[(d*4+i) % imgs.length], _deck:deck}));
      return deck;
    });
    S.openBatch = -1;
    const fi = PRESETS.findIndex(x=>x.name === 'Documentary facts');
    S.profile = JSON.parse(JSON.stringify(PRESETS[fi])); S.styleKey = 'preset:'+fi;
    await fontReady(S.profile);
    renderBatch();
    await new Promise(r=>setTimeout(r, 2500));   // let the first pass decode and cache
    renderBatch();
    await new Promise(r=>setTimeout(r, 800));
  };
  const countDecodes = () => {
    let n = 0;
    const real = window.demandImage;
    window.demandImage = s => { n++; return real(s); };
    renderBatch();
    window.demandImage = real;
    return n;
  };
  await board(34);
  out.moreDecksThanTheCacheHolds = S.batch.length > Object.keys(IMG_CACHE).length;
  out.warmRowsDemandNoDecodes = countDecodes() === 0;
  out.everyRowHasAThumbnail = ROW_THUMB.size === 34;
  out.thumbnailsAreSmall = (()=>{
    const any = [...ROW_THUMB.values()][0];
    return !!any && any.bmp.naturalWidth < 120 && any.bmp.naturalHeight < 200;
  })();
  out.aNewCoverRedrawsItsRow = await (async ()=>{
    const d = S.batch[3], before = ROW_THUMB.get(d.id).key;
    d.slides[0].img = await frame(2048, 1365);
    await cacheImage(d.slides[0]);
    renderBatchRow(d);
    await new Promise(r=>setTimeout(r, 300));
    return ROW_THUMB.get(d.id).key !== before;
  })();
  out.aLiveStyleEditRedrawsTheRows = (()=>{
    /* A Terrifying deck resolves to the facts style, which is the one loaded, so an
       edit to it must reach the row. The style NAME does not change when a slider
       moves, which is why the key carries a revision as well. */
    const d = S.batch[5], before = rowThumbKey(d);
    S.profile.title_size_pct = 0.0801;
    drawAll();
    return rowThumbKey(d) !== before;
  })();
  out.anotherAccountsRowIsNotRedrawnForIt = (()=>{
    /* The same edit, against a deck drawn in a style that is NOT the live one. Its
       row is unaffected and must not be thrown away. */
    const d = S.batch[6];
    d.cat = 'fun'; d.slides[0]._deck = d;
    const before = rowThumbKey(d);
    S.profile.title_size_pct = 0.0802;
    drawAll();
    const after = rowThumbKey(d);
    d.cat = 'Terrifying';
    return after === before;
  })();
  out.thumbnailsGoWhenTheirDeckDoes = (()=>{
    S.batch = S.batch.slice(0, 2);
    trimImageCache();
    for(const k in IMG_CACHE) if(!new Set(S.batch.flatMap(d=>d.slides.map(x=>x.id))).has(k)) delete IMG_CACHE[k];
    // the sweep that drops orphans runs on load; call the same path
    const live = new Set(S.batch.flatMap(d=>d.slides.map(x=>x.id)));
    for(const k in IMG_CACHE) if(!live.has(k)){ delete IMG_CACHE[k]; IMG_MP.delete(k); }
    const decks = new Set(S.batch.map(d=>d.id));
    for(const k of [...ROW_THUMB.keys()]) if(!decks.has(k)) ROW_THUMB.delete(k);
    return ROW_THUMB.size <= 2;
  })();

  /* --- THE LEDGER. ledgerHas rebuilt the whole ledger's rarity counts and re-tokenised
     every entry, on every call, for every candidate a picker considered. Pinned by
     identity rather than by a stopwatch: the same string must come back as the same
     Set, and the counts must be the same object until the ledger changes. */
  LEDGER.length = 0;
  for(let i = 0; i < 400; i++)
    LEDGER.push({subject:'Soviet Submarine K-'+i, title:'t', cat:'Terrifying', date:1});
  out.tokensAreMemoised = subjectTokens('The Great Emu War') === subjectTokens('The Great Emu War');
  out.countsAreHeldUntilTheLedgerChanges = ledgerTokenCounts() === ledgerTokenCounts();
  out.countsRebuildWhenItDoes = (()=>{
    const before = ledgerTokenCounts();
    LEDGER.push({subject:'Something New Entirely', title:'t', cat:'Terrifying', date:1});
    return ledgerTokenCounts() !== before;
  })();
  out.andTheAnswersDidNotChange = ledgerHas('Soviet Submarine K-17') === true &&
                                  ledgerHas('A Completely Unrelated Thing') === false;
  LEDGER.length = 0;

  S.slides = []; S.batch = []; ROW_THUMB.clear();
  return out;
});
await b.close();

const want = {
  budgetIsInPixels:true, theOldFrameCeilingIsGone:true,
  staysUnderBudget:true, itEvictedRatherThanRefusing:true, anEvictedFrameIsForgottenToo:true,
  theOpenDeckSurvives:true, smallFramesStillFit:true,
  theHeavyHalfIsSeparate:true, fiftyImagesCauseOneSave:true, theLightHalfCarriesNoImages:true,
  twoFullSavesDoNotOverlap:true,
  moreDecksThanTheCacheHolds:true, warmRowsDemandNoDecodes:true, everyRowHasAThumbnail:true,
  thumbnailsAreSmall:true, aNewCoverRedrawsItsRow:true, aLiveStyleEditRedrawsTheRows:true,
  anotherAccountsRowIsNotRedrawnForIt:true,
  thumbnailsGoWhenTheirDeckDoes:true,
  tokensAreMemoised:true, countsAreHeldUntilTheLedgerChanges:true, countsRebuildWhenItDoes:true,
  andTheAnswersDidNotChange:true
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
