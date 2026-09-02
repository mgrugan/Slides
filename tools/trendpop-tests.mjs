/* @trendpopzz. The @fun frame in the account's lime, fed by a scan that is looking for
   something different from what the other news page looks for, and writing in a
   register the other pages ban outright.

   Four things here are worth pinning, because each of them is a decision that a later
   tweak could quietly undo and none of them is visible in a screenshot:

     - #D5FD43 is the brightest brand colour in the app by a distance. It cannot be used
       the way the red is, and the white caps over its glow are the thing that breaks
       first if somebody turns the glow back up.
     - the cover is meant to be CLEANER than its siblings and the images are meant to
       carry the brand colour as a rim light. That lives entirely in a prompt, so it is
       invisible until a batch comes back looking like every other account.
     - clickbait was asked for and clickbait is not the same as overclaiming. The brief
       has to push hard on specificity and still carry every accuracy rule, and it is
       the accuracy half that a later edit would drop.
     - this page is allowed to put real company logos in frame, which is banned
       everywhere else in the app. That exemption has to be exactly as wide as this page
       and no wider. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const ti = PRESETS.findIndex(x=>x.name === 'Trendpop');
  out.presetExists = ti >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[ti])); S.styleKey = 'preset:'+ti;
  await fontReady(S.profile);

  /* a lit subject on a near-black ground, which is what this page's frames are */
  const shot = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#07090a'; x.fillRect(0,0,W,H);
    const g = x.createRadialGradient(W*0.5,H*0.34,20,W*0.5,H*0.34,W*0.5);
    g.addColorStop(0,'#6b625a'); g.addColorStop(1,'#0a0c0d');
    x.fillStyle = g; x.beginPath(); x.ellipse(W*0.5,H*0.36,W*0.26,H*0.24,0,0,7); x.fill();
    return c.toDataURL('image/jpeg', 0.92);
  };
  const mk = (angle, brands) => {
    const deck = {id:'d'+angle, cat:'trendpopzz', angle, kind:'story', tone:'colour',
                  brands: brands || [], slides:[]};
    deck.slides = [
      {id:'h'+angle, kind:'hook', title:'Meta Just Paid One Point Four Billion', body:'',
       scene:'', tone:'colour', _deck:deck},
      {id:'s'+angle, kind:'slide', title:'That Is Fifty Six Dollars A Head', body:'',
       scene:'', tone:'colour', _deck:deck}
    ];
    return deck;
  };
  const deck = mk('howbig'), other = mk('receipts');
  await Promise.all([...deck.slides, ...other.slides].map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); };
    im.src = shot();
  })));
  const draw = (s, prof) => { const c = document.createElement('canvas');
                              renderSlide(s, c, prof || S.profile, 1); return c; };
  const cover = draw(deck.slides[0]), item = draw(deck.slides[1]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data;
                          return [d[0],d[1],d[2]]; };
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step) if(test(px(c, x, y))) return true;
    return false;
  };
  const white = q => q[0] > 235 && q[1] > 235 && q[2] > 235;
  const lime  = q => q[1] > 90 && q[1] > q[2] + 40 && q[0] > q[2];

  // --- built on the @fun frame rather than on something new
  out.usesDocumentary = S.profile.caption_treatment === 'documentary';
  out.setInAnton = S.profile.font_family === 'Anton';
  out.noInsetOrRule = !S.profile.portrait_inset && !S.profile.auto_inset &&
                      !S.profile.divider && !S.profile.brand_bar && !S.profile.cover_swipe;

  // --- the colour, everywhere it is supposed to be and nowhere else
  out.glowIsTheBrandLime   = S.profile.glow_color === '#D5FD43';
  out.badgeIsTheBrandLime  = S.profile.badge_bg === '#D5FD43';
  out.handleIsTheBrandLime = S.profile.handle_color === '#D5FD43';
  out.coverFootIsLime = scan(cover, W*0.2, W*0.8, H - 30, H - 4, lime);
  out.gradientIsNotALimeBand = (()=>{
    // the scrim under the caption stays near-black; tinting it #D5FD43 puts white
    // type on a bright field, which at this luminance is simply unreadable
    const c = hexToRGB(S.profile.hook_scrim_color);
    return c[0] < 40 && c[1] < 40 && c[2] < 40;
  })();
  out.whiteCapsClearTheGlow = (()=>{
    /* Measured where the letters actually are: the finished frame supplies the mask,
       the ground comes from the same frame drawn with the ink turned off. Reading the
       finished frame alone counts the glyphs' own anti-aliased edges as background. */
    const bareProf = Object.assign(JSON.parse(JSON.stringify(S.profile)),
                                   {text_color:'rgba(0,0,0,0)', text_shadow:0});
    const bare = draw(deck.slides[0], bareProf);
    const dc = cover.getContext('2d').getImageData(0,0,W,H).data;
    const db = bare.getContext('2d').getImageData(0,0,W,H).data;
    const vals = [];
    for(let y = Math.round(H*0.70); y < H*0.96; y++)
      for(let x = Math.round(W*0.10); x < W*0.90; x++){
        const i = (y*W + x)*4;
        if(dc[i] > 245 && dc[i+1] > 245 && dc[i+2] > 245)
          vals.push((db[i]*0.2126 + db[i+1]*0.7152 + db[i+2]*0.0722)/255);
      }
    if(vals.length < 5000) return false;
    vals.sort((a,b)=>a-b);
    const worst = vals[Math.floor(vals.length*0.95)];
    /* Not a WCAG pass and not claimed as one — white caps over a glow this bright
       cannot reach 3:1 without dimming the brand. This is the floor that stops the
       glow being turned back up until the bottom line disappears. */
    return (1.05) / (worst + 0.05) >= 2.0;
  })();
  out.badgeInkIsDark = (()=>{
    const c = hexToRGB(S.profile.badge_color);
    return (c[0]*0.2126 + c[1]*0.7152 + c[2]*0.0722) < 60;
  })();

  // --- the edge glow: on the cover, faint, and not a border
  out.edgeGlowIsCoverOnly = S.profile.edge_glow_on_all === false &&
                            !scan(item, 0, W, 0, H*0.10, lime) &&
                            !scan(item, 0, W*0.03, H*0.2, H*0.6, lime);
  out.edgeGlowLightsTheCover = (()=>{
    // what it ADDS at the top edge, against the same frame with it switched off
    const off = JSON.parse(JSON.stringify(S.profile)); off.edge_glow_pct = 0;
    const c2 = draw(deck.slides[0], off);
    const add = (x,y) => px(cover,x,y)[1] - px(c2,x,y)[1];
    return add(W*0.5, 3) > 6 && add(W*0.03, H*0.3) > 4;
  })();
  out.edgeGlowIsNotABorder = (()=>{
    /* The failure mode is a visible green frame, and it is a matter of degree rather
       than of kind — the first pass at this used 0.085/0.15 and put about 38/255 of
       extra green on the edge, which rendered as a border; 0.09 alpha puts about 23
       there and reads as the frame breathing. 30 is the line between the two renders I
       looked at. It is a judgement, not a standard, and it is written down so the glow
       cannot be turned back up to the version that looked cheap.
       The other half is falloff: the light has to be gone by a tenth of the way in
       rather than sitting there as a band. */
    const off = JSON.parse(JSON.stringify(S.profile)); off.edge_glow_pct = 0;
    const c2 = draw(deck.slides[0], off);
    const add = y => px(cover, W*0.5, y)[1] - px(c2, W*0.5, y)[1];
    return add(2) > 6 && add(2) < 30 && add(2) > add(H*0.045) && add(H*0.10) <= 1;
  })();
  out.edgeGlowSkipsTheFoot = (()=>{
    /* Lighting the foot as well doubles with the caption glow and turns the bottom
       corners to mud — the first pass at this did, and it read as a border. Measured
       at the bottom CENTRE, which only a bottom edge reaches: the side gradients run
       the full height and legitimately reach the bottom corners. */
    const off = JSON.parse(JSON.stringify(S.profile)); off.edge_glow_pct = 0;
    const c2 = draw(deck.slides[0], off);
    return px(cover, W*0.5, H-3)[1] - px(c2, W*0.5, H-3)[1] <= 1;
  })();

  // --- the flag names the kind of post, and the slides carry none of the furniture
  out.badgeFollowsTheAngle = angleBadge(deck.slides[0]) === 'HOW BIG' &&
                             angleBadge(other.slides[0]) === 'THE RECEIPTS';
  out.everyAngleHasABadge = angleSet('trendpop').every(a => /^[A-Z ]{2,14}$/.test(a.badge || ''));
  out.itemHasNoBadge  = !scan(item, 0, W, H*0.55, H*0.95, lime);
  out.itemHasNoHandle = !scan(item, W*0.60, W*0.98, H*0.015, H*0.075, lime);
  out.itemCaptionIsWhite = scan(item, W*0.06, W*0.94, H*0.80, H*0.97, white);
  out.glowStaysOffTheSlides = S.profile.glow_on_all === false;

  // --- the category, and the length control the client asked for
  const conf = catCfg('trendpopzz');
  out.categoryWired = conf.mode === 'angles' && conf.angles === 'trendpop' &&
                      conf.style === 'Trendpop' && conf.collection === 'Trendpop' && conf.news === true;
  out.sweepsTheWeek = conf.news_days === 7;
  out.lengthIsControllable = conf.fixed_len === true;
  out.angleCount = angleSet('trendpop').length;
  out.angleKinds = [...new Set(angleSet('trendpop').map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = angleSet('trendpop').every(a => a.brief.length > 150 && a.cover && a.close && a.swipe);
  out.coversTheThreeWorlds = /\bAI\b/.test(conf.prompt) && /influencer/i.test(conf.prompt) &&
                             /famous people/i.test(conf.prompt);
  out.demandsScale = /scale/i.test(conf.prompt) && /not a post here|does not do mildly/i.test(conf.prompt);

  // --- the scan is looking for something the default scan would throw away
  out.scanHasItsOwnBrief = !!conf.scan && !!conf.scan.what && conf.scan.what !== SCAN_DEFAULT.what;
  out.scanTakesCompanies = /company a reader could name/i.test(conf.scan.what);
  out.scanTakesOutcomesOfRecord = /settlement/i.test(conf.scan.what) && /ruling|filing/i.test(conf.scan.what);
  out.scanStillRefusesAllegations = /never the allegation/i.test(conf.scan.what) &&
                                    /only substance is an accusation/i.test(conf.scan.not);
  out.scanStillProtectsPeople = /under 18/.test(conf.scan.not) && /private individuals/.test(conf.scan.not);
  out.otherNewsPagesKeepTheDefault = !catCfg('fun').scan && !catCfg('obsession').scan;

  // --- the brief: clickbait as craft, not as overclaiming
  const tp = (n, angle, hook) => trendDeckPrompt('trendpopzz',
    {subject:'Meta settlement', hook: hook || 'META JUST PAID $1.4 BILLION', n, angle,
     person:'Mark Zuckerberg', org:'Meta', source:'Reuters', day:'2026-08-30'});
  const brief = tp(6, 'howbig');
  out.briefIsOneLinePerSlide = /Every slide is ONE LINE/.test(brief) && /leave "body" empty/.test(brief);
  out.briefWantsTheSwipe = /MAKE THE NEXT SWIPE INVOLUNTARY/.test(brief);
  out.briefWantsSpecificity = /Specificity is what stops a thumb/.test(brief) &&
                              /\$1\.4 BILLION/.test(brief);
  out.briefBansTheHypeWords = ['you won\'t believe','shocking','insane','this changes everything',
                               'let that sink in','wait for it'].every(w => brief.includes(w)) &&
                              /BANNED/.test(brief);
  out.briefSaysClickbaitIsNotLying = /never means implying something the post does not deliver/i.test(brief);
  out.briefGivesTheCoverItsOwnRules = /THE COVER — slide 1/.test(brief) && /5 to 9 words/.test(brief) &&
                                      /true on its own, read alone/.test(brief);
  out.briefNamesSlideTwoAsTheSecondHook = /second most important line/.test(brief);
  out.briefCarriesThePersonAndTheCompany = /THE PERSON: Mark Zuckerberg/.test(brief) &&
                                           /THE COMPANY: Meta/.test(brief);
  out.briefCarriesTheDay = /reported around/.test(brief);

  // --- accuracy survived the volume
  out.briefDemandsRealFigures = /real, reported and checkable/i.test(brief);
  out.briefHandlesSettlements = /Settling is not an admission/.test(brief) &&
                                /Never state an allegation as a finding/.test(brief);
  out.briefAttributesCompanyNumbers = /company's own figure is reported as the company's own figure/.test(brief);
  out.briefLabelsUnconfirmed = /labelled unconfirmed/.test(brief);
  out.briefProtectsMinors = /under 18/.test(brief);

  // --- the length is the run's, exactly, and no number in the line gets a vote
  out.storyRunsToTheChoice = /^Write a 5-slide carousel/.test(tp(5, 'howbig')) &&
                             /THIS POST IS EXACTLY 5 SLIDES/.test(tp(5, 'howbig'));
  out.listRunsToTheChoice = /THIS POST IS EXACTLY 3 POINTS/.test(tp(5, 'whathappened')) &&
                            /Slide 5 is ONE closing slide/.test(tp(5, 'whathappened'));
  out.aCountInTheLineIsIgnored = (()=>{
    const c = tp(5, 'whathappened', '7 THINGS META JUST ADMITTED');
    return /^Write a 5-slide carousel/.test(c) && /THIS POST IS EXACTLY 3 POINTS/.test(c) && !/7 points/.test(c);
  })();
  out.coverIsToldNotToCount = /Never counts the points out loud/.test(brief);
  out.dispatchReachesTrendpop = !!ANGLE_PROMPTS['trendpop'] &&
    ANGLE_PROMPTS['trendpop']('trendpopzz', {subject:'x', hook:'y', n:6, angle:'howbig'})
      .includes('biggest story of the week');

  // --- the likeness rules came across intact
  out.briefAsksForTheFullName = /FULL public name/.test(brief) && /Mark Zuckerberg/.test(brief);
  out.briefAsksForRealSkin = /Real skin, and say so/.test(brief) && /poreless/.test(brief);
  out.namedFirstIsOn = S.profile.cast_named_first === true && !S.profile.cast_unnamed;
  out.castStillLeadsWithTheLookalike = (()=>{
    const d = mk('howbig');
    d.cast = [{name:'Zuck', real:'Mark Zuckerberg', known:'the chief executive of Meta', look:'a man, 41'}];
    const s = Object.assign({}, d.slides[1], {scene:'Zuck at a desk', _deck:d});
    return /IDENTICAL LOOKALIKE of Mark Zuckerberg/.test(imagePrompt(s, false));
  })();

  // --- the brands: allowed here, exactly as they are, and nowhere else
  out.briefAsksForBrands = /BRANDS — return it as "brands"/.test(brief) &&
                           /A wrong logo is worse than no logo/.test(brief);
  out.styleAllowsMarks = S.profile.allow_brand_marks === true;
  const withMark = mk('howbig', [{name:'Meta', mark:'the blue infinity loop glyph beside the wordmark',
                                  where:'on the wall behind them'}]);
  const inShot  = Object.assign({}, withMark.slides[1], {scene:'a lit lobby with the Meta sign', _deck:withMark});
  const notInShot = Object.assign({}, withMark.slides[1], {scene:'a dark empty desk', _deck:withMark});
  out.markGoesInWhenItIsInShot = /THE BRAND MARKS IN THIS PICTURE MUST BE EXACT/.test(imagePrompt(inShot, false)) &&
                                 /blue infinity loop/.test(imagePrompt(inShot, false));
  out.markLettersAreLetIn = /ONLY lettering anywhere in this image is the brand mark/.test(imagePrompt(inShot, false));
  out.aFrameWithoutTheMarkStaysBanned = imagePrompt(notInShot, false).includes(NO_TEXT_CLAUSE) &&
                                        !/BRAND MARKS IN THIS PICTURE/.test(imagePrompt(notInShot, false));
  out.otherStylesStillBanEveryMark = (()=>{
    // the exemption is this page's, not the app's: same deck, a style that never opted in
    const fi = PRESETS.findIndex(x=>x.name === 'Fun');
    const keep = S.profile;
    S.profile = JSON.parse(JSON.stringify(PRESETS[fi]));
    const got = imagePrompt(inShot, false);
    S.profile = keep;
    return got.includes(NO_TEXT_CLAUSE) && !/BRAND MARKS IN THIS PICTURE/.test(got);
  })();

  // --- the cover frame is art-directed apart from the slides
  out.coverAsksForTheCleanFrame = (()=>{
    const ip = imagePrompt(deck.slides[0], false);
    return /THIS IS THE COVER FRAME/.test(ip) && /ONE subject, alone/.test(ip) &&
           /near-black seamless field/.test(ip);
  })();
  out.coverAsksForTheLimeRim = /acid-lime rim light \(#D5FD43\)/.test(imagePrompt(deck.slides[0], false));
  out.slidesDoNotGetTheCoverTreatment = !/THIS IS THE COVER FRAME/.test(imagePrompt(deck.slides[1], false));
  out.otherStylesHaveNoCoverTreatment = (()=>{
    const fi = PRESETS.findIndex(x=>x.name === 'Fun');
    return !PRESETS[fi].hook_image_suffix;
  })();
  out.briefRepeatsTheCleanCover = /THE COVER FRAME IS DIFFERENT AND CLEANER/.test(brief);

  // --- and the sibling accounts are untouched
  out.funIsUnchanged = catCfg('fun').style === 'Fun' && catCfg('fun').news_days === 3 &&
                       !catCfg('fun').allow_brand_marks;
  out.factsPagesStillRefuseTheFace =
    /do NOT describe the face of the specific real named individual/
      .test(factDeckPrompt('History', {subject:'x', claim:'y'}, 6, 'mono'));
  return out;
});
await b.close();

const want = {
  presetExists:true, usesDocumentary:true, setInAnton:true, noInsetOrRule:true,
  glowIsTheBrandLime:true, badgeIsTheBrandLime:true, handleIsTheBrandLime:true,
  coverFootIsLime:true, gradientIsNotALimeBand:true, whiteCapsClearTheGlow:true, badgeInkIsDark:true,
  edgeGlowIsCoverOnly:true, edgeGlowLightsTheCover:true, edgeGlowIsNotABorder:true,
  edgeGlowSkipsTheFoot:true,
  badgeFollowsTheAngle:true, everyAngleHasABadge:true,
  itemHasNoBadge:true, itemHasNoHandle:true, itemCaptionIsWhite:true, glowStaysOffTheSlides:true,
  categoryWired:true, sweepsTheWeek:true, lengthIsControllable:true,
  angleCount:8, angleKinds:'list,story', anglesDocumented:true,
  coversTheThreeWorlds:true, demandsScale:true,
  scanHasItsOwnBrief:true, scanTakesCompanies:true, scanTakesOutcomesOfRecord:true,
  scanStillRefusesAllegations:true, scanStillProtectsPeople:true, otherNewsPagesKeepTheDefault:true,
  briefIsOneLinePerSlide:true, briefWantsTheSwipe:true, briefWantsSpecificity:true,
  briefBansTheHypeWords:true, briefSaysClickbaitIsNotLying:true,
  briefGivesTheCoverItsOwnRules:true, briefNamesSlideTwoAsTheSecondHook:true,
  briefCarriesThePersonAndTheCompany:true, briefCarriesTheDay:true,
  briefDemandsRealFigures:true, briefHandlesSettlements:true, briefAttributesCompanyNumbers:true,
  briefLabelsUnconfirmed:true, briefProtectsMinors:true,
  storyRunsToTheChoice:true, listRunsToTheChoice:true, aCountInTheLineIsIgnored:true,
  coverIsToldNotToCount:true, dispatchReachesTrendpop:true,
  briefAsksForTheFullName:true, briefAsksForRealSkin:true, namedFirstIsOn:true,
  castStillLeadsWithTheLookalike:true,
  briefAsksForBrands:true, styleAllowsMarks:true, markGoesInWhenItIsInShot:true,
  markLettersAreLetIn:true, aFrameWithoutTheMarkStaysBanned:true, otherStylesStillBanEveryMark:true,
  coverAsksForTheCleanFrame:true, coverAsksForTheLimeRim:true,
  slidesDoNotGetTheCoverTreatment:true, otherStylesHaveNoCoverTreatment:true,
  briefRepeatsTheCleanCover:true,
  funIsUnchanged:true, factsPagesStillRefuseTheFace:true
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
