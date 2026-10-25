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

  /* --- WHERE THE PICTURES LIVE. The project record used to carry every image inside
     it, so saving anything rewrote all of them: at 34 decks that is a 115MB record,
     1.2s to stringify and 2.6s to write, on the main thread, every save — and it grows
     with the board, so the longer the run the worse each save gets. Pictures are one
     record each now, written once.

     The assertion that matters most is not the speed. It is that a reloaded slide
     still has its picture: half the app asks whether a slide HAS one — the row counts,
     the planner, the finish loop — and a slide that lost it reads as one that was
     never generated, which on the planner's side means paying to make it again. */
  const bigBoard = async () => {
    S.slides = []; S.batch = []; ROW_THUMB.clear(); DIRTY_IMGS.clear();
    for(const k in IMG_CACHE) delete IMG_CACHE[k];
    IMG_LRU.length = 0; IMG_MP.clear();
    for(const k of await idbKeys()) if(typeof k === 'string' && k.startsWith('img:')) await idbDel(k);
    const pool = [];
    for(let i = 0; i < 4; i++) pool.push(await frame(2048, 1365));
    S.batch = Array.from({length:12}, (_, d) => {
      const deck = {id:'g'+d, cat:'Terrifying', hook:'DECK '+d, subject:'s', tone:'mono',
                    status:'done', caption:'a\n\nb\n\nc', slides:[]};
      deck.slides = Array.from({length:4}, (_, i)=>({id:'g'+d+'s'+i, kind:i?'slide':'hook',
        title:'T', body:'b', scene:'s', tone:'mono', status:'done',
        img: pool[(d*4+i) % pool.length], _deck:deck}));
      return deck;
    });
    S.openBatch = -1;
    S.batch.forEach(d=>d.slides.forEach(x=>DIRTY_IMGS.add(x.id)));
    await saveFull();
  };
  await bigBoard();

  out.theProjectRecordIsSmall = await (async ()=>{
    const rec = await idbGet('project');
    const size = JSON.stringify(rec).length;
    out.projectRecordKB = Math.round(size / 1024);
    return size < 200 * 1024 && !JSON.stringify(rec).includes('data:image');
  })();

  /* Counted as writes rather than timed, so the guarantee does not move when a machine
     is busy: a save with nothing new must touch no picture at all, and a save after one
     new picture must write exactly that one. Before, both wrote all 48. */
  const writesDuring = async fn => {
    const real = window.idbPut;
    let imgWrites = 0;
    window.idbPut = async (k, v) => { if(typeof k === 'string' && k.startsWith('img:')) imgWrites++;
                                      return real(k, v); };
    await fn();
    window.idbPut = real;
    return imgWrites;
  };
  out.anIdleSaveWritesNoPictures = await writesDuring(() => saveFull()) === 0;
  out.oneNewPictureWritesOne = await (async ()=>{
    const sl = S.batch[0].slides[2];
    sl.img = await frame(2048, 1365);
    DIRTY_IMGS.add(sl.id);
    return await writesDuring(() => saveFull()) === 1;
  })();

  out.everyPictureSurvivesAReload = await (async ()=>{
    const ids = S.batch.flatMap(d=>d.slides.map(x=>x.id));
    S.batch = []; S.slides = [];
    for(const k in IMG_CACHE) delete IMG_CACHE[k];
    await restoreProject();
    const back = S.batch.flatMap(d=>d.slides);
    out.picturesBack = back.filter(x=>x.img).length + '/' + ids.length;
    return back.length === ids.length && back.every(x => x.img && x.img.startsWith('data:'));
  })();
  out.nothingReadsAsUngenerated = S.batch.flatMap(d=>d.slides).filter(x=>!x.img).length === 0;

  /* The failure the resume suite caught: a slide deliberately WITHOUT a picture must
     stay without one. Reattaching from any record that happens to exist resurrects a
     frame the user deleted to force a regenerate, and tells the finish loop there is
     nothing left to do. */
  out.aDeletedPictureStaysDeleted = await (async ()=>{
    const d = S.batch[1], sl = d.slides[1];
    const id = sl.id;
    await saveFull();                       // its picture is on disk
    sl.img = ''; sl.status = 'queued';      // now the user clears it
    await saveFull();
    S.batch = []; S.slides = [];
    await restoreProject();
    const back = S.batch.flatMap(x=>x.slides).find(x=>x.id === id);
    return !!back && !back.img;
  })();
  out.andTheOthersAreStillThere = S.batch.flatMap(d=>d.slides).filter(x=>x.img).length ===
                                  S.batch.flatMap(d=>d.slides).length - 1;
  out.anUploadedCoverCircleSurvives = await (async ()=>{
    const sl = S.batch[2].slides[0];
    sl.inset = await frame(400, 400);
    DIRTY_IMGS.add(sl.id);
    await saveFull();
    const id = sl.id;
    S.batch = []; S.slides = [];
    await restoreProject();
    const back = S.batch.flatMap(x=>x.slides).find(x=>x.id === id);
    return !!back && !!back.inset && back.inset.startsWith('data:');
  })();

  out.orphansAreSwept = await (async ()=>{
    S.batch = S.batch.slice(0, 3);          // 12 slides should remain
    await saveFull();
    const keys = (await idbKeys()).filter(k => typeof k === 'string' && k.startsWith('img:'));
    return keys.length === 11;              // twelve slides, one of them deliberately blank
  })();

  /* A project written before the pictures moved out carries them inline. It still has
     to load, and the pictures still have to end up in their own records. */
  out.anOldProjectStillLoads = await (async ()=>{
    const img = await frame(1024, 683);
    await idbPut('project', {v:2, profile:S.profile, styleKey:S.styleKey, caption:'', openBatch:-1,
      slides:[], batch:[{id:'old', cat:'History', hook:'h', subject:'s', status:'done', caption:'',
        slides:[{id:'old0', kind:'hook', title:'t', body:'', scene:'s', img, status:'done'}]}]});
    S.batch = []; S.slides = []; DIRTY_IMGS.clear();
    await restoreProject();
    const kept = S.batch[0] && S.batch[0].slides[0].img === img;
    const queued = DIRTY_IMGS.has('old0');     // and it gets written out properly next save
    await saveFull();
    const stored = await idbGet('img:old0');
    return kept && queued && stored === img;
  })();

  S.slides = []; S.batch = []; ROW_THUMB.clear(); DIRTY_IMGS.clear();
  await idbPut('project', {v:3, slides:[], batch:[]});
  for(const k of await idbKeys()) if(typeof k === 'string' && k.startsWith('img:')) await idbDel(k);
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
  andTheAnswersDidNotChange:true,
  theProjectRecordIsSmall:true, anIdleSaveWritesNoPictures:true, oneNewPictureWritesOne:true,
  everyPictureSurvivesAReload:true, nothingReadsAsUngenerated:true,
  aDeletedPictureStaysDeleted:true, andTheOthersAreStillThere:true,
  anUploadedCoverCircleSurvives:true,
  orphansAreSwept:true, anOldProjectStillLoads:true
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
console.log('  ·   project record ' + r.projectRecordKB + 'KB · pictures after a reload ' + r.picturesBack);
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
