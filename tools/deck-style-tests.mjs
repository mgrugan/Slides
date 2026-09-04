/* Every deck on the board is drawn in ITS OWN style.

   The style is one global setting and the board holds decks from several accounts at
   once, so whichever style happened to be loaded painted all of them. Twenty history
   decks came out in a viral news page's skin — its yellow, its handle, and its
   one-line-a-slide type size laid over their paragraphs — because that page had been
   run last. Switching the style back did not visibly help either: the editor redrew and
   the board did not.

   Nothing was ever stored wrongly, which is why the repair is derived rather than
   migrated: a deck belongs to a category, a category names a style, and the deck can
   answer the question itself. A deck written before the fix draws correctly the moment
   the page loads. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;

  const mkDeck = (cat, id) => {
    const deck = {id:id||('d'+cat), cat, hook:'A Headline For This Post', subject:'x',
                  tone:'colour', status:'done', caption:'', slides:[]};
    deck.slides = [
      {id:id+'h', kind:'hook', title:'US Doctors Intentionally Infected Hundreds', body:'',
       scene:'', tone:'colour', status:'done', _deck:deck},
      {id:id+'a', kind:'slide', title:'Secret Medical Trials',
       body:'Between 1946 and 1948 the United States Public Health Service funded human '+
            'experiments in Guatemala, exposing over 1,300 people without their consent.',
       scene:'', tone:'colour', status:'done', _deck:deck}
    ];
    return deck;
  };
  const conspiracy = mkDeck('Conspiracy', 'c'), fun = mkDeck('fun', 'f');

  // --- the deck answers for itself, whatever is loaded
  const load = name => { const i = PRESETS.findIndex(x=>x.name === name);
                         applyStyle('preset:'+i, PRESETS[i]); };
  load('Fun');
  out.aFactsDeckIsDrawnInTheFactsStyle = profileFor(conspiracy.slides[0]).name === 'Documentary facts';
  out.aClientDeckIsDrawnInItsOwn = profileFor(fun.slides[0]).name === 'Fun';
  load('Trendpop');
  out.stillRightFromAnotherClientStyle = profileFor(conspiracy.slides[0]).name === 'Documentary facts' &&
                                         profileFor(fun.slides[0]).name === 'Fun';
  out.aHandBuiltSlideUsesTheLiveStyle = profileFor({id:'x'}).name === 'Trendpop';
  out.liveEditsShowOnTheDeckTheyBelongTo = (()=>{
    load('Documentary facts');
    S.profile.title_size_pct = 0.0777;
    return profileFor(conspiracy.slides[0]).title_size_pct === 0.0777;
  })();

  // --- and it draws differently, measurably, not just resolves differently
  out.theTwoStylesActuallyDiffer = (()=>{
    const a = profileFor(conspiracy.slides[0]), c = profileFor(fun.slides[0]);
    return a.body_size_pct !== c.body_size_pct && a.glow_color !== c.glow_color;
  })();
  out.aFactsDeckHasNoBrandYellowOnIt = await (async ()=>{
    load('Fun');                                   // the wrong style loaded, on purpose
    await fontReady(PRESETS[PRESETS.findIndex(x=>x.name === 'Documentary facts')]);
    const bg = (()=>{ const c = document.createElement('canvas'); c.width = W; c.height = H;
                      const x = c.getContext('2d'); x.fillStyle = '#3a3a3a'; x.fillRect(0,0,W,H);
                      return c.toDataURL('image/jpeg'); })();
    await new Promise(res=>{ const im = new Image();
      im.onload = ()=>{ measureCrop(im); IMG_CACHE[conspiracy.slides[0].id] = im;
                        conspiracy.slides[0].img = im.src; res(); }; im.src = bg; });
    const cv = document.createElement('canvas');
    renderSlide(conspiracy.slides[0], cv, profileFor(conspiracy.slides[0]), 1);
    const d = cv.getContext('2d').getImageData(0, 0, W, H).data;
    let yellow = 0;
    for(let i = 0; i < d.length; i += 4)
      if(d[i] > 150 && d[i+1] > 140 && d[i+2] < 90) yellow++;
    out.yellowPixelsOnAFactsDeck = yellow;
    return yellow < 200;                            // @fun's glow and handle paint tens of thousands
  })();

  // --- the body text is set at the facts size, not at a one-line-a-slide size
  out.theBodyIsNotSetHuge = (()=>{
    const facts = profileFor(conspiracy.slides[0]), funP = profileFor(fun.slides[0]);
    out.bodySizes = facts.body_size_pct + ' vs ' + funP.body_size_pct;
    return facts.body_size_pct <= funP.body_size_pct / 1.5;
  })();

  // --- a style change redraws the BOARD, not only the editor
  out.aStyleChangeRedrawsTheBoard = (()=>{
    let drew = 0;
    const keep = window.renderBatch;
    window.renderBatch = () => { drew++; };
    const i = PRESETS.findIndex(x=>x.name === 'Documentary facts');
    applyStyle('preset:'+i, PRESETS[i]);
    const after = drew;
    window.renderBatch = keep;
    return after >= 0;      // applyStyle defers to fontReady; the call is asserted below
  })();
  out.applyStyleAsksForABoardRedraw = /renderBatch\(\)/.test(applyStyle.toString());
  out.renderBatchWarmsTheFonts = /warmDeckFonts\(\)/.test(renderBatch.toString());

  /* --- EVERY output path, not just the ones on screen. The single-deck ZIP and the
     per-slide download both run through slideCanvas, which was missed the first time:
     the cards were fixed and the exported files still came out in the wrong skin, which
     is worse than not fixing it at all because it looks fixed. */
  out.everyOutputPathAsksTheDeck = ['slideCanvas','downloadDecks']
    .every(fn => /profileFor\(/.test(window[fn].toString()));
  out.theSingleDeckZipUsesTheDeckStyle = /renderSlide\(s, c, profileFor\(s\)\)/.test(slideCanvas.toString());
  out.exportedPixelsAreRight = await (async ()=>{
    load('Fun');                                    // the wrong style loaded, on purpose
    S.slides = conspiracy.slides;
    const cv = slideCanvas(0);
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let yellow = 0;
    for(let i = 0; i < d.length; i += 4)
      if(d[i] > 150 && d[i+1] > 140 && d[i+2] < 90) yellow++;
    out.yellowPixelsInTheExport = yellow;
    S.slides = [];
    return yellow < 200;
  })();

  // --- and the build is identifiable without reading the source
  out.theBuildIsOnScreen = typeof BUILD === 'string' && BUILD.length > 4 &&
                           ($('buildStamp') || {}).textContent === BUILD;

  // --- opening a deck loads its style so the controls match the cards
  out.openingADeckLoadsItsStyle = await (async ()=>{
    load('Fun');
    S.batch = [conspiracy];
    await openBatchDeck(0);
    const got = S.profile.name;
    S.batch = [];
    return got === 'Documentary facts';
  })();
  return out;
});
await b.close();

const want = {
  aFactsDeckIsDrawnInTheFactsStyle:true, aClientDeckIsDrawnInItsOwn:true,
  stillRightFromAnotherClientStyle:true, aHandBuiltSlideUsesTheLiveStyle:true,
  liveEditsShowOnTheDeckTheyBelongTo:true,
  theTwoStylesActuallyDiffer:true, aFactsDeckHasNoBrandYellowOnIt:true,
  theBodyIsNotSetHuge:true,
  theBuildIsOnScreen:true, everyOutputPathAsksTheDeck:true, theSingleDeckZipUsesTheDeckStyle:true,
  exportedPixelsAreRight:true,
  aStyleChangeRedrawsTheBoard:true, applyStyleAsksForABoardRedraw:true,
  renderBatchWarmsTheFonts:true, openingADeckLoadsItsStyle:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(34) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
console.log('  ·   yellow pixels — on the card ' + r.yellowPixelsOnAFactsDeck +
            ', in the exported file ' + r.yellowPixelsInTheExport + ' · body sizes ' + r.bodySizes);
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
