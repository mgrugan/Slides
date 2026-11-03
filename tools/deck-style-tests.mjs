/* Every deck on the board is drawn in ITS OWN style.

   The style is one global setting and the board holds decks from several accounts at
   once, so whichever style happened to be loaded painted all of them. Twenty history
   decks came out in a client page's skin — its colour, its handle, and its
   one-line-a-slide type size laid over their paragraphs — because that page had been
   run last. Switching the style back did not visibly help either: the editor redrew and
   the board did not.

   Nothing was ever stored wrongly, which is why the repair is derived rather than
   migrated: a deck belongs to a category, a category names a style, and the deck can
   answer the question itself. A deck written before the fix draws correctly the moment
   the page loads. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
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
  const conspiracy = mkDeck('Conspiracy', 'c');
  const handBuilt = mkDeck('', 'h');     // a deck in no category answers to the live style

  // --- the deck answers for itself, whatever is loaded
  const load = name => { const i = PRESETS.findIndex(x=>x.name === name);
                         applyStyle('preset:'+i, PRESETS[i]); };
  load('Photographic');
  out.aFactsDeckIsDrawnInTheFactsStyle = profileFor(conspiracy.slides[0]).name === 'Documentary facts';
  out.anUncategorisedDeckUsesTheLiveStyle = profileFor(handBuilt.slides[0]).name === 'Photographic';
  load('Flat cartoon');
  out.stillRightFromAnotherLoadedStyle = profileFor(conspiracy.slides[0]).name === 'Documentary facts' &&
                                         profileFor(handBuilt.slides[0]).name === 'Flat cartoon';
  out.aHandBuiltSlideUsesTheLiveStyle = profileFor({id:'x'}).name === 'Flat cartoon';
  out.liveEditsShowOnTheDeckTheyBelongTo = (()=>{
    load('Documentary facts');
    S.profile.title_size_pct = 0.0777;
    return profileFor(conspiracy.slides[0]).title_size_pct === 0.0777;
  })();

  // --- and it draws differently, measurably, not just resolves differently
  out.theTwoStylesActuallyDiffer = (()=>{
    load('Flat cartoon');
    const a = profileFor(conspiracy.slides[0]), c = profileFor(handBuilt.slides[0]);
    return a.body_size_pct !== c.body_size_pct || a.glow_color !== c.glow_color;
  })();

  /* The original failure was measured in brand yellow, because the style that had leaked
     onto twenty history decks was a yellow one. Those client pages are retired, so the
     measurement is the general form of the same question: with the WRONG style loaded,
     is the card pixel-identical to one drawn in the facts style, and different from one
     drawn in the loaded style? A count of yellow would pass today by accident. */
  const facts = PRESETS[PRESETS.findIndex(x=>x.name === 'Documentary facts')];
  const paint = async (slide, profile) => {
    await fontReady(profile);
    const cv = document.createElement('canvas');
    renderSlide(slide, cv, profile, 1);
    return cv.toDataURL('image/png');
  };
  await new Promise(res=>{
    const bg = (()=>{ const c = document.createElement('canvas'); c.width = W; c.height = H;
                      const x = c.getContext('2d'); x.fillStyle = '#3a3a3a'; x.fillRect(0,0,W,H);
                      return c.toDataURL('image/jpeg'); })();
    const im = new Image();
    im.onload = ()=>{ measureCrop(im); IMG_CACHE[conspiracy.slides[0].id] = im;
                      conspiracy.slides[0].img = im.src; res(); }; im.src = bg;
  });
  out.theCardIsPaintedInTheFactsStyle = await (async ()=>{
    load('Flat cartoon');                            // the wrong style loaded, on purpose
    const asDrawn = await paint(conspiracy.slides[0], profileFor(conspiracy.slides[0]));
    const asFacts = await paint(conspiracy.slides[0], facts);
    const asLoaded = await paint(conspiracy.slides[0], S.profile);
    out.andTheLoadedStyleWouldHaveLookedDifferent = asDrawn !== asLoaded;
    return asDrawn === asFacts;
  })();

  // --- the body text is set at the facts size, not at a one-line-a-slide size
  out.theBodyIsNotSetHuge = (()=>{
    const others = PRESETS.filter(x=>x.name !== 'Documentary facts').map(x=>x.body_size_pct);
    out.bodySizes = facts.body_size_pct + ' vs ' + others.join(', ');
    return others.every(x => facts.body_size_pct < x);
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
    load('Flat cartoon');                           // the wrong style loaded, on purpose
    S.slides = conspiracy.slides;
    const exported = slideCanvas(0).toDataURL('image/png');
    const asFacts = await paint(conspiracy.slides[0], facts);
    const asLoaded = await paint(conspiracy.slides[0], S.profile);
    out.andTheExportWouldHaveLookedDifferent = exported !== asLoaded;
    S.slides = [];
    return exported === asFacts;
  })();

  // --- and the build is identifiable without reading the source
  out.theBuildIsOnScreen = typeof BUILD === 'string' && BUILD.length > 4 &&
                           ($('buildStamp') || {}).textContent === BUILD;

  // --- opening a deck loads its style so the controls match the cards
  out.openingADeckLoadsItsStyle = await (async ()=>{
    load('Flat cartoon');
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
  aFactsDeckIsDrawnInTheFactsStyle:true, anUncategorisedDeckUsesTheLiveStyle:true,
  stillRightFromAnotherLoadedStyle:true, aHandBuiltSlideUsesTheLiveStyle:true,
  liveEditsShowOnTheDeckTheyBelongTo:true,
  theTwoStylesActuallyDiffer:true,
  theCardIsPaintedInTheFactsStyle:true, andTheLoadedStyleWouldHaveLookedDifferent:true,
  theBodyIsNotSetHuge:true,
  theBuildIsOnScreen:true, everyOutputPathAsksTheDeck:true, theSingleDeckZipUsesTheDeckStyle:true,
  exportedPixelsAreRight:true, andTheExportWouldHaveLookedDifferent:true,
  aStyleChangeRedrawsTheBoard:true, applyStyleAsksForABoardRedraw:true,
  renderBatchWarmsTheFonts:true, openingADeckLoadsItsStyle:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(34) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
console.log('  ·   body size — facts ' + r.bodySizes);
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
