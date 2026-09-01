/* The news account. Three things here exist nowhere else in the app and each is the
   kind of thing that fails silently:

     - phrases printed in a second colour inside a sentence, which means the markers
       have to be stripped before wrapping and the flags carried across the line breaks
       the wrap chooses;
     - a grounded model call, because a page about what happened yesterday cannot be
       written from a training cutoff — without the search tool the model answers
       confidently from memory and sources it to nothing;
     - a likeness carried across seven frames by description alone, with the person's
       name deliberately withheld from the image model, because these are real
       recognisable people and a named one gets the frame refused.

   A refused frame, an invented story and a highlight that silently stops highlighting
   all look like nothing at all in the code, so they are pinned here. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const oi = PRESETS.findIndex(x=>x.name === 'Obsession');
  out.presetExists = oi >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[oi])); S.styleKey = 'preset:'+oi;
  await fontReady(S.profile);

  const flat = c => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0,0,W,H); return cv.toDataURL('image/jpeg'); };
  const deck = {id:'o', cat:'Obsession', angle:'news', kind:'story', tone:'colour',
                person:'Tini Younger', source:'@tiniyounger / IG', day:'2026-09-01', slides:[]};
  deck.cast = [{name:'Tini', look:'a woman in her mid twenties, slim, pale skin, oval face, blue eyes, ' +
    'long platinum blonde hair worn up in a loose bun, a small tattoo on the inside of the left forearm, ' +
    'wearing a black t-shirt under a dark green apron'}];
  deck.slides = [
    {id:'oc', kind:'hook', title:'She Was Selling Furniture, *Now Her Recipes Feed 17M People*',
     body:'', scene:'Tini in a kitchen', cast:['Tini'], tone:'colour', _deck:deck},
    {id:'o1', kind:'slide', title:'',
     body:'One night she filmed herself cooking.\n\nAt the time she had *1,800 followers.*\n\nThen she posted it.',
     scene:'Tini at a counter', cast:['Tini'], tone:'colour', _deck:deck},
    {id:'o2', kind:'slide', title:'',
     body:'The next video hit *25 million views.*\n\nThen something clicked.',
     scene:'Tini holding a jar', cast:['Tini'], tone:'colour', _deck:deck}
  ];
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); };
    im.src = flat(s.kind === 'hook' ? '#8a3a12' : '#0a0a0a');
  })));
  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const cover = draw(deck.slides[0]), one = draw(deck.slides[1]), two = draw(deck.slides[2]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step) if(test(px(c, x, y))) return true;
    return false;
  };
  const count = (c, x0, x1, y0, y1, test) => {
    let n = 0;
    for(let y = Math.round(y0); y < y1; y += 2)
      for(let x = Math.round(x0); x < x1; x += 2) if(test(px(c, x, y))) n++;
    return n;
  };
  const white  = q => q[0] > 235 && q[1] > 235 && q[2] > 235;
  const accent = q => q[0] > 170 && q[1] > 45 && q[1] < 135 && q[2] < 80;

  // --- the accent runs
  const pa = parseAccent('One night she made *steak and mac* for him.');
  out.markersStripped = !/\*/.test(pa.text);
  out.flagsMatchTheWords = pa.flags.join(',') === 'false,false,false,false,true,true,true,false,false';
  out.wrapIgnoresMarkers = (()=>{
    const g = document.createElement('canvas').getContext('2d');
    g.font = fontStr(S.profile, 40);
    const plain = 'One night she made steak and mac for him.';
    return wrap(g, plain, 400).join('|') === wrap(g, parseAccent('One night she made *steak and mac* for him.').text, 400).join('|');
  })();
  out.accentIsSetAndNotWhite = /^#/.test(S.profile.accent_color) && S.profile.accent_color !== S.profile.text_color;
  out.coverPrintsAccent = scan(cover, W*0.05, W*0.95, H*0.70, H*0.97, accent);
  out.coverKeepsWhiteToo = scan(cover, W*0.05, W*0.95, H*0.70, H*0.97, white);
  out.bodyPrintsAccent = scan(one, W*0.05, W*0.95, H*0.55, H*0.97, accent);
  out.bodyKeepsWhiteToo = scan(one, W*0.05, W*0.95, H*0.55, H*0.97, white);
  /* An unmarked slide must come out entirely white — if the flag cursor slips, colour
     leaks onto words nobody marked, and that is invisible unless it is counted. */
  out.unmarkedTextStaysWhite = (()=>{
    const s = Object.assign({}, deck.slides[1], {id:'op', body:'One night she filmed herself cooking.\n\nThen she posted it.'});
    IMG_CACHE['op'] = IMG_CACHE['o1'];
    const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1);
    return count(c, 0, W, H*0.5, H, accent) === 0 && scan(c, 0, W, H*0.5, H, white);
  })();

  // --- paragraph breaks survive the wrap
  out.breaksArePreserved = (()=>{
    const g = document.createElement('canvas').getContext('2d');
    g.font = fontStr(S.profile, 40, S.profile.body_weight, S.profile.body_font_family);
    return wrap(g, 'one\n\ntwo', 900, true).filter(l => l === '').length === 1 &&
           wrap(g, 'one\n\ntwo', 900).filter(l => l === '').length === 0;
  })();
  out.styleKeepsBreaks = S.profile.keep_breaks === true;

  // --- the wordmark
  out.wordmarkIsSet = S.profile.wordmark === 'OBSESSION';
  out.wordmarkDrawsOnCover = scan(cover, W*0.06, W*0.94, H*0.03, H*0.11, white);
  out.wordmarkNotOnSlides = !scan(one, W*0.06, W*0.94, H*0.02, H*0.10, white);
  out.wordmarkFitsTheFrame = !scan(cover, 0, W*0.03, H*0.02, H*0.13, white) &&
                             !scan(cover, W*0.97, W, H*0.02, H*0.13, white);
  /* The circle sits below the word rather than in the corner behind it — at the old
     0.045 offset the two overlapped and neither read. */
  out.insetClearsTheWordmark = S.profile.inset_top_pct * H > S.profile.wordmark_size_pct * H;

  /* The word sits behind the subject. There is no cut-out to work from, so the frame's
     own bright pixels are keyed back over the letters — which means this has to be
     checked against a frame shaped like the ones this style asks for: a lit subject
     reaching up into the band, against a surround that falls away. */
  const lit = () => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const g = x.createRadialGradient(W*0.5, H*0.45, 40, W*0.5, H*0.55, W*0.85);
    g.addColorStop(0, '#a8431a'); g.addColorStop(1, '#140603');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = '#e8c9a0'; x.beginPath(); x.ellipse(W*0.5, H*0.30, W*0.17, H*0.16, 0, 0, 7); x.fill();
    x.fillStyle = '#f2ddbe'; x.beginPath(); x.ellipse(W*0.5, H*0.155, W*0.13, H*0.055, 0, 0, 7); x.fill();
    return cv.toDataURL('image/jpeg');
  };
  const litCover = await new Promise(res=>{
    const im = new Image();
    im.onload = ()=>{
      measureCrop(im); IMG_CACHE['lit'] = im;
      const s = Object.assign({}, deck.slides[0], {id:'lit'});
      const on  = document.createElement('canvas'); renderSlide(s, on, S.profile, 1);
      const flatProf = Object.assign(JSON.parse(JSON.stringify(S.profile)), {wordmark_behind:false});
      const off = document.createElement('canvas'); renderSlide(s, off, flatProf, 1);
      res({on, off});
    };
    im.src = lit();
  });
  /* Measured against the word's real geometry rather than guessed fractions of the
     frame: the wordmark is sized to fill the measure, so how tall it ends up depends on
     how long the word is and how wide the face is. */
  const mark = (()=>{
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    return drawWordmark(cv.getContext('2d'), W, H, S.profile);
  })();
  const capTop = mark.baseline - mark.size * 0.72;
  const band = {top: capTop, mid: capTop + (mark.baseline - capTop) * 0.62, bot: mark.baseline};
  const midWhite  = c => count(c, W*0.40, W*0.60, band.mid, band.bot, white);
  const topWhite  = c => count(c, W*0.40, W*0.60, band.top, band.top + mark.size*0.10, white);
  const edgeWhite = c => count(c, W*0.06, W*0.24, band.top, band.bot, white);
  out.subjectCrossesTheWord = midWhite(litCover.on) < midWhite(litCover.off) * 0.7;
  out.wordIsStillThereAtTheEdges = edgeWhite(litCover.on) > edgeWhite(litCover.off) * 0.9;
  /* The tops of the letters are never occluded, so a blown-out frame cannot quietly
     delete the whole word. Note this one is carried mostly by the band's headroom
     rather than by the ramp — it is the invariant, not the mechanism. */
  out.topsOfLettersSurvive = topWhite(litCover.on) >= topWhite(litCover.off) * 0.95;
  /* The ramp that keeps the effect at the foot of the letters is NOT pinned in pixels.
     Every attempt to isolate it measured something else: a subject-shaped frame cannot
     tell the ramp apart from the subject simply being wider lower down, and on a
     uniformly bright frame the occlusion is partial, so it shifts the colour of a
     letter without ever flipping a threshold. What is pinned is the invariant either
     side of it — the word survives (topsOfLettersSurvive) and the subject does cross it
     (subjectCrossesTheWord) — plus the field itself, so it cannot be quietly dropped. */
  out.footRampIsSet = S.profile.wordmark_layer_from > 0.25 && S.profile.wordmark_layer_from < 0.6;
  out.layerIsOnForThisStyle = S.profile.wordmark_behind === true;
  /* And the graceful failure: a frame with nothing bright in the band is left alone,
     rather than the key tearing holes in the word. */
  out.darkFrameIsLeftAlone = (()=>{
    const before = count(cover, W*0.06, W*0.94, band.top, band.bot, white);
    const flatProf = Object.assign(JSON.parse(JSON.stringify(S.profile)), {wordmark_behind:false});
    const c = document.createElement('canvas'); renderSlide(deck.slides[0], c, flatProf, 1);
    return before > 0 &&
           Math.abs(before - count(c, W*0.06, W*0.94, band.top, band.bot, white)) < before * 0.05;
  })();
  // a row thumbnail cannot show it and would pay for the pixel read anyway
  out.thumbnailsSkipTheLayer = (()=>{
    const c = document.createElement('canvas');
    renderSlide(Object.assign({}, deck.slides[0], {id:'lit'}), c, S.profile, 0.25);
    return c.width === Math.round(W*0.25);
  })();

  // --- the column flips down the deck
  out.altAlignOn = S.profile.alt_align === true;
  out.coverIsExempt = altAlign(S.profile, deck.slides[0], true) === null;
  out.firstSlideSetsLeft = altAlign(S.profile, deck.slides[1], false) === 'left';
  out.secondSlideSetsRight = altAlign(S.profile, deck.slides[2], false) === 'right';
  out.andItActuallyDraws = (()=>{                    // ink on the left of one, the right of the other
    const leftOne  = count(one, 0, W*0.35, H*0.5, H, white);
    const rightOne = count(one, W*0.65, W, H*0.5, H, white);
    const leftTwo  = count(two, 0, W*0.35, H*0.5, H, white);
    const rightTwo = count(two, W*0.65, W, H*0.5, H, white);
    return leftOne > rightOne && rightTwo > leftTwo;
  })();

  // --- the likeness, carried without a name
  const cb = castBlock(deck.slides[1]);
  out.castOmitsTheName = !/Tini/.test(cb);
  out.castCarriesTheLook = /platinum blonde/.test(cb);
  out.castForbidsInferringAName = /do not infer or use any name/.test(cb);
  out.castStillInsistsOnSameness = /MUST LOOK IDENTICAL IN EVERY FRAME/.test(cb);
  out.namedModeStillWorks = (()=>{                   // the other accounts are unaffected
    const was = S.profile.cast_unnamed; S.profile.cast_unnamed = false;
    const named = castBlock(deck.slides[1]);
    S.profile.cast_unnamed = was;
    return /Tini — a woman in her mid twenties/.test(named);
  })();

  // --- the brief
  const dp = obsessionDeckPrompt('Obsession', {subject:'x', hook:'y', n:7,
    person:'Tini Younger', day:'2026-09-01', source:'@tiniyounger / IG'});
  out.briefDemandsALongLook = /40 to 70 words/.test(dp) && /apparent age, build/.test(dp);
  out.briefSaysWhyTheNameIsWithheld = /refused/.test(dp) && /blank slide/.test(dp);
  out.briefBansNamesInScene = /NEVER put a real person's name/.test(dp);
  out.briefExplainsTheMarkers = /Wrap the phrase that carries the slide in asterisks/.test(dp);
  out.briefLimitsTheMarking = /One or two marked phrases per slide/.test(dp);
  out.briefWantsParagraphs = /separated by blank lines/.test(dp);
  out.briefBansInvention = /Never invent a number/.test(dp);
  out.briefCarriesTheDay = /1 September 2026/.test(dp);
  out.briefCreditsTheSource = /Credit @tiniyounger/.test(dp);
  out.dispatchReachesObsession = !!ANGLE_PROMPTS['obsession'];

  // --- the scan
  const conf = catCfg('Obsession');
  out.categoryIsNews = conf.news === true && conf.mode === 'angles' &&
                       conf.style === 'Obsession' && conf.collection === 'Obsession';
  out.scanWalksBackByDay = scanDays(3, '2026-09-01').join(' ') === '2026-09-01 2026-08-31 2026-08-30';
  out.scanDefaultsToToday = scanDays(1)[0] === new Date().toISOString().slice(0,10);
  /* Named parts, not an exact string: whether the weekday takes a comma is ICU locale
     data and differs between engines, which is not something this account depends on. */
  out.dayReadsAsAWholeDate = ['Tuesday', '1', 'September', '2026']
    .every(part => prettyDay('2026-09-01').includes(part));
  /* Grounding. Without the tool on the request the model answers a question about
     yesterday from a training cutoff months earlier, which is the one failure that
     looks like success. */
  out.groundingReachesTheRequest = (()=>{
    const on  = bodyGenerateContent('m', [{type:'text', text:'x'}], {search:true});
    const off = bodyGenerateContent('m', [{type:'text', text:'x'}], {});
    return !!(on.tools && on.tools[0] && on.tools[0].google_search) && !off.tools;
  })();
  return out;
});
await b.close();

const want = {
  presetExists:true,
  markersStripped:true, flagsMatchTheWords:true, wrapIgnoresMarkers:true,
  accentIsSetAndNotWhite:true, coverPrintsAccent:true, coverKeepsWhiteToo:true,
  bodyPrintsAccent:true, bodyKeepsWhiteToo:true, unmarkedTextStaysWhite:true,
  breaksArePreserved:true, styleKeepsBreaks:true,
  wordmarkIsSet:true, wordmarkDrawsOnCover:true, wordmarkNotOnSlides:true,
  wordmarkFitsTheFrame:true, insetClearsTheWordmark:true,
  subjectCrossesTheWord:true, wordIsStillThereAtTheEdges:true, topsOfLettersSurvive:true,
  footRampIsSet:true,
  layerIsOnForThisStyle:true, darkFrameIsLeftAlone:true, thumbnailsSkipTheLayer:true,
  altAlignOn:true, coverIsExempt:true, firstSlideSetsLeft:true, secondSlideSetsRight:true,
  andItActuallyDraws:true,
  castOmitsTheName:true, castCarriesTheLook:true, castForbidsInferringAName:true,
  castStillInsistsOnSameness:true, namedModeStillWorks:true,
  briefDemandsALongLook:true, briefSaysWhyTheNameIsWithheld:true, briefBansNamesInScene:true,
  briefExplainsTheMarkers:true, briefLimitsTheMarking:true, briefWantsParagraphs:true,
  briefBansInvention:true, briefCarriesTheDay:true, briefCreditsTheSource:true,
  dispatchReachesObsession:true,
  categoryIsNews:true, scanWalksBackByDay:true, scanDefaultsToToday:true,
  dayReadsAsAWholeDate:true, groundingReachesTheRequest:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(32) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
