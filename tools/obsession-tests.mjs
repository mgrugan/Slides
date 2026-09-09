/* @obsession, rebuilt.

   It used to be a viral human-interest page with a wordmark across the cover, a second
   colour inside the paragraphs and left/right alternation. All of that is gone: the
   account went back to the plain facts layout, and the one thing it kept is the reason
   it was built — the picture runs across the swipe instead of cutting.

   So what is checked here is mostly ABSENCE, which is the hard kind to keep true: a
   preset that merely stops setting a field inherits nothing, but a preset that still
   carries the field with a stale value draws it. Each dropped feature is asserted off
   at the style AND absent from the drawn frame, because those are different failures.

   The content is a single subject — getting paid for GTA footage — which puts the
   weight on two things a topic page gets wrong: the rotation, without which every post
   is the same post, and the line between practical advice and an income promise. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const oi = PRESETS.findIndex(x=>x.name === 'Obsession');
  const fi = PRESETS.findIndex(x=>x.name === 'Documentary facts');
  out.presetExists = oi >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[oi])); S.styleKey = 'preset:'+oi;
  await fontReady(S.profile);
  const O = PRESETS[oi], F = PRESETS[fi];

  // --- it is the plain facts layout again, field for field where it matters
  const shared = ['caption_treatment','font_family','body_font_family','uppercase','text_align',
                  'title_size_pct','body_size_pct','title_gap_em','title_line_em',
                  'max_width_pct','body_width_pct','scrim_pct','scrim_alpha','bottom_pad_pct',
                  'text_block_top_pct','hook_top_pct','portrait_inset','auto_inset'];
  const drift = shared.filter(k => O[k] !== F[k]);
  out.matchesTheFactsLayout = drift.length === 0;
  out.whatDrifted = drift.join(',');

  // --- and the old account's furniture is off, at the style and on the frame
  out.noWordmark   = !O.wordmark && !O.wordmark_behind;
  out.noAccent     = !O.accent_color;
  out.noAltAlign   = !O.alt_align;
  out.noGlow       = !O.glow_pct;
  out.noBadge      = !O.badge_fixed && !O.badge_from_angle;
  out.noHandle     = !O.handle_text;
  out.noKeptBreaks = !O.keep_breaks;
  /* The one field this page deliberately does NOT take from the base layout. On a deck
     whose whole point is that the picture is continuous, a hard horizontal rule across
     the cover is the single element that reads as a seam. */
  out.noRuleOnTheCover = O.divider === false && F.divider === true;

  const mk = n => {
    const deck = {id:'d', cat:'Obsession', angle:'pipeline', kind:'story', tone:'colour', slides:[]};
    deck.slides = Array.from({length:n}, (_,i)=>({id:'s'+i, kind:i?'slide':'hook',
      title: i ? 'MARK THE MOMENT' : 'One GTA Session Is A Week Of Posts',
      body: i ? 'Press the clip button the second it happens. Trawling four hours afterwards is why most people stop.' : '',
      scene:'', tone:'colour', _deck:deck}));
    markSeams(deck, S.profile);
    return deck;
  };
  const deck = mk(6);
  const shot = () => {
    /* A PAIR is generated at 3:2, not at the 21:9 a three-panel run uses — and the shape
       matters to the seam rather than only to the picture. A source wider than the strip
       of slides it fills gets cover-fitted by cropping the left and right of every panel,
       which is exactly where the joins are; 3:2 across two 4:5 slides is narrower than
       the strip, so the crop lands on the top and bottom and the joins stay exact. A
       stand-in of the wrong shape here would fail this test for a reason the app does
       not have. */
    const c = document.createElement('canvas'); c.width = 1728; c.height = 1152;   // 3:2
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,1728,0);
    /* Deliberately nothing near #F4511E in it: the old accent is looked for on the
       finished frame, and a stand-in with orange in it would find its own background. */
    g.addColorStop(0,'#1f5f7a'); g.addColorStop(0.5,'#2f6f9e'); g.addColorStop(1,'#4a3f86');
    x.fillStyle = g; x.fillRect(0,0,2688,1152);
    return c.toDataURL('image/png');
  };
  const src = shot();
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im._seam = s.seam;
    im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); }; im.src = src;
  })));
  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const cover = draw(deck.slides[0]), item = draw(deck.slides[1]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data;
                          return [d[0],d[1],d[2]]; };
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step) if(test(px(c, x, y))) return true;
    return false;
  };
  const white  = q => q[0] > 235 && q[1] > 235 && q[2] > 235;
  const orange = q => q[0] > 170 && q[1] > 50 && q[1] < 130 && q[2] < 70;   // the old accent, #F4511E

  out.theCoverHasNoWordmarkBand = (()=>{
    /* The wordmark filled 88% of the measure across the top of every cover. Measured
       against the SAME frame with it switched back on, rather than against a frame with
       the ink turned off — this layout draws its own rule and inset up there, and those
       are text-coloured too, so turning the ink off would have measured the furniture
       the account is supposed to have. */
    const on = JSON.parse(JSON.stringify(S.profile));
    on.wordmark = 'OBSESSION'; on.wordmark_size_pct = 0.10; on.wordmark_width_pct = 0.88;
    on.wordmark_top_pct = 0.025;
    const c2 = document.createElement('canvas'); renderSlide(deck.slides[0], c2, on, 1);
    let diff = 0;
    const a = cover.getContext('2d').getImageData(0, 0, W, Math.round(H*0.16)).data;
    const d2 = c2.getContext('2d').getImageData(0, 0, W, Math.round(H*0.16)).data;
    for(let i = 0; i < a.length; i += 4) if(Math.abs(a[i] - d2[i]) > 24) diff++;
    out.wordmarkPixelsItWouldHaveDrawn = diff;
    return diff > 8000;                     // the word is genuinely absent, not merely unset
  })();
  out.noAccentInkAnywhere = !scan(cover, 0, W, H*0.55, H, orange) && !scan(item, 0, W, H*0.55, H, orange);
  out.captionIsWhite = scan(item, W*0.10, W*0.90, H*0.66, H*0.96, white);
  out.captionIsCentred = (()=>{
    // alternating alignment would put slide 2 hard against one edge
    const rowHas = x => { for(let y = Math.round(H*0.66); y < H*0.96; y += 2) if(white(px(item, x, y))) return true;
                          return false; };
    let lo = W, hi = 0;
    for(let x = 4; x < W - 4; x += 3){ if(rowHas(x)){ lo = Math.min(lo, x); hi = Math.max(hi, x); } }
    const mid = (lo + hi) / 2;
    return Math.abs(mid - W/2) < W*0.06;
  })();

  // --- the one thing it kept
  out.stillSeamless = O.seamless === true && O.seam_span === 2;
  /* Slides one and two are one frame, three and four the next, and so on. Six slides is
     three pictures rather than one picture and a join. */
  out.theSlidesAreStampedInPairs = mk(6).slides.map(s=>s.seam.run + ':' + s.seam.i + '/' + s.seam.n).join(' ') ===
    '0:0/2 0:1/2 1:0/2 1:1/2 2:0/2 2:1/2';
  out.anOddLastSlideGetsItsOwnPicture = (()=>{
    const d = mk(5);
    return d.slides.map(s=>s.seam.n).join(',') === '2,2,2,2,1' &&
           d.slides[4].seam.run === 2;
  })();
  out.theJoinsAreInvisible = (()=>{
    /* Only the joins INSIDE a pair: 1-2, 3-4, 5-6. The gap between one pair and the
       next is a deliberate cut to a new picture and matching there would mean the
       feature was doing nothing. */
    const cv = deck.slides.map(draw);
    const col = (c, x) => px(c, x, Math.round(H*0.30));
    let worst = 0;
    for(let i = 0; i < cv.length - 1; i++){
      if(deck.slides[i].seam.run !== deck.slides[i+1].seam.run) continue;
      const a = col(cv[i], W-1), b2 = col(cv[i+1], 0);
      worst = Math.max(worst, Math.abs(a[0]-b2[0]), Math.abs(a[1]-b2[1]), Math.abs(a[2]-b2[2]));
    }
    out.worstJoin = worst;
    return worst <= 4;
  })();
  out.onePicturePerPair = (()=>{
    // six slides, three pictures — and half the image bill of a deck drawn frame by frame
    const {fresh} = planImages(mk(6).slides.slice(), 'all');
    return fresh.length === 3 && fresh.map(s=>s.id).join(',') === 's0,s2,s4';
  })();
  out.aPairIsGeneratedAtThreeByTwo = seamAspect(2, S.profile) === '3:2';

  // --- the pictures are the game, not a photograph of one
  out.imageryIsARender = O.imagery === 'video-game-render' &&
                         /rendered in a modern game engine/.test(O.image_prompt_suffix);
  out.namesTheGameAndDescribesIt = /Grand Theft Auto V/.test(O.image_prompt_suffix) &&
                                   /palm-lined boulevards/.test(O.image_prompt_suffix) &&
                                   /third-person camera/.test(O.image_prompt_suffix);
  out.bansTheInterface = /no interface, no minimap, no health bar/.test(O.image_prompt_suffix);
  out.theCoverIsDirected = /THIS IS THE COVER FRAME/.test(O.hook_image_suffix) &&
                           /mid-drift/.test(O.hook_image_suffix) &&
                           /Not a parked car/.test(O.hook_image_suffix);
  out.theCoverBriefReachesTheCover = /THIS IS THE COVER FRAME/.test(
    imagePrompt(Object.assign({}, deck.slides[0], {scene:'a car on a boulevard'}), false));

  // --- one subject, six ways of saying it
  const set = angleSet('obsession');
  out.angleCount = set.length;
  out.anglesDocumented = set.every(a => a.brief.length > 150 && a.cover && a.close && a.swipe && a.badge);
  out.anglesAreDistinct = new Set(set.map(a=>a.label)).size === set.length;
  out.theRotationCoversTheLoop = ['pipeline','themoment','themoney','thesetup','themistake','theday']
    .every(k => set.some(a => a.key === k));

  const conf = catCfg('Obsession');
  out.categoryWired = conf.mode === 'angles' && conf.angles === 'obsession' &&
                      conf.style === 'Obsession' && conf.tone === 'colour';
  out.notANewsPageAnyMore = conf.news === false && !conf.scan;
  out.lengthIsExact = conf.fixed_len === true;
  out.promptIsAboutTheLoop = /YouTube Shorts, TikTok and Reels/.test(conf.prompt) &&
                             /GTA specifically/.test(conf.prompt);

  // --- advice, not a pitch. This is the part that would get the account reported.
  const dp = obsessionDeckPrompt('Obsession', {subject:'x', hook:'y', n:6, angle:'themoney'});
  out.neverPromisesAnIncome = /Never promise an income/.test(dp) && /no "guaranteed"/.test(dp) &&
                              /no implied timeline/.test(dp);
  out.ratesAreQualified = /say it varies and say what it depends on/.test(dp);
  out.neverInventsAFigure = /Never invent a statistic, a payout or a creator's earnings/.test(dp);
  out.noGetRichFraming = /No get-rich framing/.test(dp) && /never suggest buying anything to start/.test(dp);
  out.staysInsideThePlatformRules = /no view botting/.test(dp) &&
                                    /no re-uploading other people's footage/.test(dp) &&
                                    /the reader's OWN gameplay/.test(dp);
  out.categoryCarriesTheSameLimits = /Never promise an income/.test(conf.prompt) &&
                                     /never suggest buying anything to start/.test(conf.prompt);

  // --- and it writes the plain shape: a short title over a short paragraph
  out.slidesAreTitlePlusBody = /SHORT TITLE of 2 to 5 words in caps/.test(dp) &&
                               /2 to 3 short declarative sentences/.test(dp);
  out.coverIsHeadlineOnly = /headline of 6 to 12 words and nothing else/.test(dp);
  out.noAccentMarkersInTheBrief = !/asterisks/.test(dp);
  out.noCastBlockInTheBrief = !/"cast"/.test(dp);
  out.briefBansTheHypeRegister = /no "you won't believe"/.test(dp) && /never "grind" or "hustle"/.test(dp);

  // --- the seamless rider tells the writer what a good set of scenes now is
  out.briefExplainsThePairing = /THE FRAMES COME IN PAIRS/.test(dp) &&
    /ONE horizontal frame cut down the middle: the first slide is its left half and the second is its right half/.test(dp);
  out.briefWantsOnePictureNotTwo = /write those scenes as ONE picture, not as two/.test(dp) &&
                                   /a bike leaving a ramp on the left and landing on the right/.test(dp);
  out.briefKeepsTheCentreClear = /Nothing important sits dead centre, because that is where the cut falls/.test(dp);
  out.briefPlacesThePlayerAtOneEnd = /put them in the LEFT half/.test(dp);
  out.briefSaysWhereTheLocationMayChange = /A new pair is a new picture, so that is where the location may change/.test(dp);
  out.briefWantsMotionInEveryFrame = /Something is HAPPENING in every frame/.test(dp) &&
                                     /never a parked car/i.test(dp);

  // --- nothing here leaked onto the pages that share the layout
  out.factsPagesUnchanged = F.seamless !== true && !F.hook_image_suffix.includes('mid-drift') &&
                            /authentic archival documentary photograph/.test(F.image_prompt_suffix);
  out.factsPagesStillRefuseTheFace =
    /do NOT describe the face of the specific real named individual/
      .test(factDeckPrompt('History', {subject:'x', claim:'y'}, 6, 'mono'));
  out.siblingAccountsAreNotSeamless = ['Fun','Trendpop','Thrifting','iDisney']
    .every(n => !PRESETS[PRESETS.findIndex(x=>x.name === n)].seamless);
  return out;
});
await b.close();

const want = {
  presetExists:true, matchesTheFactsLayout:true, whatDrifted:'',
  noWordmark:true, noAccent:true, noAltAlign:true, noGlow:true, noBadge:true, noHandle:true,
  noKeptBreaks:true, noRuleOnTheCover:true,
  theCoverHasNoWordmarkBand:true, noAccentInkAnywhere:true, captionIsWhite:true, captionIsCentred:true,
  stillSeamless:true, theSlidesAreStampedInPairs:true, anOddLastSlideGetsItsOwnPicture:true,
  theJoinsAreInvisible:true, worstJoin:0,
  onePicturePerPair:true, aPairIsGeneratedAtThreeByTwo:true,
  imageryIsARender:true, namesTheGameAndDescribesIt:true, bansTheInterface:true,
  theCoverIsDirected:true, theCoverBriefReachesTheCover:true,
  angleCount:6, anglesDocumented:true, anglesAreDistinct:true, theRotationCoversTheLoop:true,
  categoryWired:true, notANewsPageAnyMore:true, lengthIsExact:true, promptIsAboutTheLoop:true,
  neverPromisesAnIncome:true, ratesAreQualified:true, neverInventsAFigure:true,
  noGetRichFraming:true, staysInsideThePlatformRules:true, categoryCarriesTheSameLimits:true,
  slidesAreTitlePlusBody:true, coverIsHeadlineOnly:true, noAccentMarkersInTheBrief:true,
  noCastBlockInTheBrief:true, briefBansTheHypeRegister:true,
  briefExplainsThePairing:true, briefWantsOnePictureNotTwo:true, briefKeepsTheCentreClear:true,
  briefPlacesThePlayerAtOneEnd:true, briefSaysWhereTheLocationMayChange:true,
  briefWantsMotionInEveryFrame:true,
  factsPagesUnchanged:true, factsPagesStillRefuseTheFace:true, siblingAccountsAreNotSeamless:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(34) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
