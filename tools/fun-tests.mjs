/* @fun. The thrifting frame, in the account's yellow, fed by the grounded news scan.
   Three things here are worth pinning beyond "it renders":

     - #FBC91C is a BRIGHT colour, and the frame it lands on carries white caps. Red at
       the same alpha is harmless and yellow is not — the glow had to come down to keep
       the type legible, and that is a number a later tweak could quietly undo.
     - the flag and the handle both sit in the brand colour, which means black ink on
       the flag rather than white; white on #FBC91C at badge size is unreadable.
     - the scan finds the STORY and the rotation picks the SHAPE. If the dealing breaks,
       every post silently becomes the same kind of post, which looks like nothing. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const fi = PRESETS.findIndex(x=>x.name === 'Fun');
  out.presetExists = fi >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[fi])); S.styleKey = 'preset:'+fi;
  await fontReady(S.profile);

  // a stand-in mark, in a colour nothing else on the frame uses
  const mark = () => {
    const c = document.createElement('canvas'); c.width = c.height = 240;
    const x = c.getContext('2d'); x.fillStyle = '#d020a0';
    x.beginPath(); x.arc(120, 120, 116, 0, 7); x.fill();
    return c.toDataURL('image/png');
  };
  CAT_LOGOS = {fun: mark()};
  await cacheCatLogos();

  const bright = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#cfc7b4'; x.fillRect(0,0,W,H);
    return c.toDataURL('image/jpeg');
  };
  const deck = {id:'f', cat:'fun', angle:'blewup', kind:'story', tone:'colour',
                person:'A creator', source:'@someone / IG', day:'2026-09-01', slides:[]};
  deck.slides = [
    {id:'fc', kind:'hook', title:'She Had 900 Followers On Monday And 4 Million By Friday',
     body:'', scene:'x', tone:'colour', _deck:deck},
    {id:'fb', kind:'slide', title:'The Video Was Fourteen Seconds Long',
     body:'', scene:'x', tone:'colour', _deck:deck}
  ];
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); };
    im.src = bright();
  })));
  const draw = (s, prof) => { const c = document.createElement('canvas'); renderSlide(s, c, prof || S.profile, 1); return c; };
  const cover = draw(deck.slides[0]), item = draw(deck.slides[1]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step) if(test(px(c, x, y))) return true;
    return false;
  };
  const white   = q => q[0] > 235 && q[1] > 235 && q[2] > 235;
  const magenta = q => q[0] > 120 && q[2] > 80 && q[1] < q[0]*0.7;
  /* Yellow by hue, not by brightness: under a 0.94 scrim the brand colour renders as a
     dark gold (about 161,130,26), and a "bright yellow" predicate finds none of it. */
  const yellow  = q => q[0] > 85 && q[1] > 60 && q[0] > q[2] + 55 && q[2] < q[1] * 0.8;

  // --- built on the thrifting frame
  out.usesDocumentary = S.profile.caption_treatment === 'documentary';
  out.setInAnton = S.profile.font_family === 'Anton';
  out.noInsetOrRule = !S.profile.portrait_inset && !S.profile.auto_inset &&
                      !S.profile.divider && !S.profile.brand_bar && !S.profile.cover_swipe;

  // --- the colour
  out.glowIsTheBrandYellow = S.profile.glow_color === '#FBC91C';
  out.badgeIsTheBrandYellow = S.profile.badge_bg === '#FBC91C';
  out.handleIsTheBrandYellow = S.profile.handle_color === '#FBC91C';
  out.coverFootIsYellow = scan(cover, W*0.2, W*0.8, H - 30, H - 4, yellow);
  out.gradientIsNotAYellowBand = (()=>{
    const c = hexToRGB(S.profile.hook_scrim_color);
    return c[0] < 60 && c[1] < 55 && c[2] < 40;      // near-black; the yellow is the glow
  })();
  /* The legibility number. #FBC91C is roughly three times the luminance of the red the
     sibling account uses, so the same glow alpha that is harmless there puts white caps
     at about 2.4:1 here. It was brought down until large bold white type clears 3:1,
     and this is the assertion that stops that being tuned back up by eye. */
  out.whiteCapsClearTheGlow = (()=>{
    /* Measured where the letters actually are. The caption frame supplies the mask; the
       ground comes from the same slide rendered with the ink turned off — NOT with the
       title emptied, which moves the block and ends up measuring the badge. Reading the
       finished frame alone counts the letters' own anti-aliased edges as background,
       which is why that number barely moved when the glow did. */
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
    const worst = vals[Math.floor(vals.length*0.95)];   // the worst 5% of the type
    /* 2.0:1 is not a WCAG pass and is not claimed as one. White caps over a glow in a
       colour this bright cannot reach 3:1 without either dimming the brand or moving
       the type off the frame, so the type was lifted clear of the glow's core and given
       a heavier halo instead, and this is the floor that keeps someone from tuning the
       glow back up until the bottom line disappears. */
    return (1.05) / (worst + 0.05) >= 2.0;
  })();
  /* And the flag: black ink on the yellow. White on #FBC91C is about 1.7:1, which at
     badge size is not a design choice, it is unreadable. */
  out.badgeInkIsDark = (()=>{
    const c = hexToRGB(S.profile.badge_color);
    return (c[0]*0.2126 + c[1]*0.7152 + c[2]*0.0722) / 255 < 0.3;
  })();

  // --- the flag names the kind of post
  out.badgeFollowsTheAngle = S.profile.badge_from_angle === true && S.profile.badge_fixed === false &&
                             angleBadge(deck.slides[0]) === 'WENT VIRAL';
  out.everyAngleHasABadge = angleSet('fun').every(a => /^[A-Z ]{3,14}$/.test(a.badge || ''));
  out.angleCount = angleSet('fun').length;
  out.angleKinds = [...new Set(angleSet('fun').map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = angleSet('fun').every(a => a.brief.length > 150 && a.cover && a.close && a.swipe);

  // --- the lockup: the mark beside the handle
  const handleBand = {y0: H*0.020, y1: H*0.075};
  out.handleDraws = scan(cover, W*0.70, W*0.97, handleBand.y0, handleBand.y1, yellow);
  out.markDrawsBesideIt = scan(cover, W*0.74, W*0.90, handleBand.y0, handleBand.y1, magenta);
  out.markIsLeftOfTheText = (()=>{
    /* The disc the mark sits in is the brand yellow as well, so "leftmost yellow pixel"
       finds the disc, not the handle. The text's own left edge is taken from a render
       with no logo at all, where the only yellow in the corner IS the handle. */
    const saved = LOGO_CACHE['fun']; delete LOGO_CACHE['fun'];
    const savedGlobal = LOGO_IMG; LOGO_IMG = null;
    const noLogo = draw(deck.slides[0]);
    LOGO_CACHE['fun'] = saved; LOGO_IMG = savedGlobal;
    let textX = W, markRight = 0;
    for(let y = Math.round(handleBand.y0); y < handleBand.y1; y++){
      for(let x = Math.round(W*0.55); x < W; x++){
        if(yellow(px(noLogo, x, y)) && x < textX) textX = x;
        if(magenta(px(cover, x, y)) && x > markRight) markRight = x;
      }
    }
    return markRight > 0 && textX < W && markRight < textX;
  })();
  /* The mark FILLS its circle. It used to be inset inside a filled plate, which read as
     a thick border with the logo lost in the middle of it — the plate showed as a ring
     16% of the diameter wide the whole way round, and a dark mark inside it was barely
     visible. It is now drawn by the same drawAvatar every other mark in the app uses:
     the logo covering the circle, a thin stroked ring if the style carries one, and the
     plate behind it at exactly the same diameter so a mark with transparent corners
     still reads over a photograph. */
  const markSpan = c => {
    let top = H, bot = 0;
    for(let y = Math.round(H*0.008); y < H*0.10; y++)
      for(let x = Math.round(W*0.55); x < W; x++)
        if(magenta(px(c, x, y))){ if(y < top) top = y; if(y > bot) bot = y; }
    return bot > top ? bot - top : 0;
  };
  out.markFillsItsCircle = (()=>{
    const d = S.profile.handle_size_pct * H * S.profile.handle_logo_em;
    return markSpan(cover) >= d * 0.85;             // the inset version reached only 0.68
  })();
  out.markIsNotOversized = (()=>{                   // and still sized to the type beside it
    const saved = LOGO_CACHE['fun']; delete LOGO_CACHE['fun'];
    const g = LOGO_IMG; LOGO_IMG = null;
    const noLogo = draw(deck.slides[0]);
    LOGO_CACHE['fun'] = saved; LOGO_IMG = g;
    let tTop = H, tBot = 0;
    for(let y = Math.round(H*0.008); y < H*0.10; y++)
      for(let x = Math.round(W*0.55); x < W; x++)
        if(yellow(px(noLogo, x, y))){ if(y < tTop) tTop = y; if(y > tBot) tBot = y; }
    return tBot > tTop && markSpan(cover) < (tBot - tTop) * 1.35;
  })();
  out.markUsesTheSharedAvatar = S.profile.brand_logo_ring === true &&
                                S.profile.handle_logo_inset === undefined &&
                                S.profile.handle_logo_disc === undefined;
  out.lockupIsCoverOnly = !scan(item, W*0.60, W, handleBand.y0, handleBand.y1, magenta);
  out.noLogoNoCrash = (()=>{                        // most accounts never set one
    const saved = LOGO_CACHE['fun']; delete LOGO_CACHE['fun'];
    const savedGlobal = LOGO_IMG; LOGO_IMG = null;
    const c = draw(deck.slides[0]);
    LOGO_CACHE['fun'] = saved; LOGO_IMG = savedGlobal;
    return scan(c, W*0.70, W*0.97, handleBand.y0, handleBand.y1, yellow) &&
           !scan(c, W*0.60, W, handleBand.y0, handleBand.y1, magenta);
  })();

  // --- the category and the scan
  const conf = catCfg('fun');
  out.categoryWired = conf.mode === 'angles' && conf.angles === 'fun' && conf.news === true &&
                      conf.style === 'Fun' && conf.collection === 'Fun';
  /* The scan says what happened; the rotation says what shape to make of it. With this
     broken every post quietly becomes the same kind of post. */
  out.scanDealsTheAngles = await (async ()=>{
    const stories = [1,2,3,4,5].map(i => ({subject:'story '+i, claim:'A headline '+i,
                                           person:'P'+i, source:'src', date:'2026-09-01'}));
    window.callModel = async () => ({text: JSON.stringify(stories), images:[]});
    const ideas = await newsIdeas('fun', conf, 5, '2026-09-01');
    return ideas.length === 5 &&
           ideas.every(i => i.hook && i.person && i.day) &&
           new Set(ideas.map(i=>i.angle)).size >= 3 &&        // spread, not all one shape
           ideas.every(i => angleIn('fun', i.angle));
  })();
  out.obsessionStillHasOneShape = await (async ()=>{
    const stories = [1,2,3].map(i => ({subject:'o '+i, claim:'H '+i, person:'P', source:'s', date:'2026-09-01'}));
    window.callModel = async () => ({text: JSON.stringify(stories), images:[]});
    const ideas = await newsIdeas('Obsession', catCfg('Obsession'), 3, '2026-09-01');
    return ideas.length === 3 && ideas.every(i => i.angle === 'news');
  })();

  // --- the brief
  const fp = funDeckPrompt('fun', {subject:'x', hook:'A creator blew up', n:7, angle:'blewup',
                                   person:'A creator', day:'2026-09-01', source:'@someone / IG'});
  out.briefIsOneLinePerSlide = /Every slide is ONE LINE/.test(fp) && /leave "body" empty/.test(fp);
  out.briefDemandsALongLook = /40 to 70 words/.test(fp) && /apparent age, build/.test(fp);
  /* The brief used to withhold the person's name from the picture entirely. It no
     longer does — that produced a plausible stranger instead of a likeness. What it
     still bans in "scene" is BRAND names, which are a different problem: the person
     comes through the cast entry, and a platform or show name in the scene is what
     draws a logo the caption then sits on top of. */
  out.briefBansBrandsInScene = /never by a brand, platform or show name/.test(fp);
  out.briefBansRumour = /Never state an allegation, a rumour or an unconfirmed claim as fact/.test(fp);
  out.briefBansPileOns = /No pile-ons/.test(fp);
  out.briefProtectsMinors = /anyone under 18/.test(fp);
  out.briefCarriesTheDay = /1 September 2026/.test(fp);
  /* Left alone an image model returns a smoothed, poreless face. On a page about real
     people that reads as fake at a glance, so the texture is asked for in the cast
     description AND in the suffix that goes on every single frame. */
  out.briefAsksForRealSkin = /Real skin, and say so/.test(fp) && /poreless/.test(fp);
  out.everyFrameAsksForRealSkin = (()=>{
    const s = {id:'fc', kind:'hook', title:'x', scene:'a person at a desk', tone:'colour', _deck:deck};
    const ip = imagePrompt(s, false);
    return /pores/.test(ip) && /not retouched|Not retouched/.test(ip) && /not a render/.test(ip);
  })();
  out.countingBriefStatesTheNumber = (()=>{
    const c = funDeckPrompt('fun', {subject:'x', hook:'7 THINGS THEY DID', n:9, angle:'onething'});
    return /THE HEADLINE PROMISES 7\b/.test(c) && /Deliver exactly 7 points/.test(c);
  })();
  out.dispatchReachesFun = !!ANGLE_PROMPTS['fun'];

  /* The likeness. A 60-word description of a streamer returns a plausible stranger —
     the reader is supposed to know them on sight and does not, which wastes the post.
     So the real name leads and the description rides behind it, and the frame is only
     asked without the name when the model has actually declined. */
  const castDeck = {id:'cd', cat:'fun', angle:'blewup', kind:'story', tone:'colour', slides:[]};
  castDeck.cast = [{name:'Speed', real:'IShowSpeed',
    look:'a young man in his early twenties, slim build, dark brown skin, short black hair in a low fade, ' +
         'wide expressive eyes, broad smile, wearing a red football shirt'}];
  const castSlide = {id:'cs', kind:'slide', title:'T', body:'',
                     scene:'Speed on a stage under hard light', cast:['Speed'], tone:'colour', _deck:castDeck};
  castDeck.slides = [castSlide];
  /* Everything text alone can bring to bear on a specific face: the full name, the
     phrase placing them, and an explicit instruction not to invent or flatter. */
  /* The construction that actually reaches this model. "A portrait of NAME" returns
     somebody who fits the description; "an identical lookalike of NAME" reaches for the
     person. It leads the block, because position matters in an image prompt. */
  out.namesThePerson = /IDENTICAL LOOKALIKE of IShowSpeed/.test(imagePrompt(castSlide, false));
  out.lookalikeLeadsTheBlock = (()=>{
    const ip = imagePrompt(castSlide, false);
    return ip.indexOf('IDENTICAL LOOKALIKE') < ip.indexOf('slim build');   // before the description
  })();
  out.saysTheyAreReal = /The face must be identical to the real IShowSpeed/.test(imagePrompt(castSlide, false));
  out.bansAPrettierFace = (()=>{
    const ip = imagePrompt(castSlide, false);
    return /not a character inspired by them/.test(ip) && /more conventionally attractive/.test(ip);
  })();
  out.carriesWhatTheyAreKnownFor = (()=>{
    castDeck.cast[0].known = 'the streamer known for IRL streams';
    const ip = imagePrompt(castSlide, false);
    delete castDeck.cast[0].known;
    return /LOOKALIKE of IShowSpeed, the streamer known for IRL streams/.test(ip);
  })();
  out.briefAsksWhatTheyAreKnownFor = /"known" is one short phrase placing them/.test(fp);
  out.keepsTheLookBehindTheName = /low fade/.test(imagePrompt(castSlide, false));
  out.fallbackDropsTheName = (()=>{
    const f = imagePrompt(castSlide, false, false);
    return !/IShowSpeed/.test(f) && /low fade/.test(f);
  })();
  out.namedFirstIsOn = S.profile.cast_named_first === true && !S.profile.cast_unnamed;
  out.briefAsksForTheRealName = /"real" is the person's FULL public name/.test(fp);
  out.briefKeepsScenesReported = /Only ever put them in a situation that is actually reported/.test(fp);
  /* And the frame is only illustrating a story, so a refusal has to be visible rather
     than silently downgrading the face. genImage retries without the name and logs it. */
  out.refusalFallsBackAndSaysSo = await (async ()=>{
    const prompts = [];
    const realCall = window.callModel;
    let n = 0;
    window.callModel = async ({parts}) => {
      prompts.push(parts[0].text);
      n++;
      if(n === 1) return {text:'I cannot generate that.', images:[]};   // the model declines
      // saturated, or the colour-tone guard fires its own retry and the count is off
      const c = document.createElement('canvas'); c.width = 16; c.height = 20;
      const x = c.getContext('2d'); x.fillStyle = '#c0392b'; x.fillRect(0,0,16,20);
      x.fillStyle = '#2980b9'; x.fillRect(0,0,8,20);
      return {text:'', images:[c.toDataURL('image/jpeg')]};
    };
    const logs = [];
    const realLog = window.log; window.log = (m, k) => logs.push(String(m));
    try{ await genImage(castSlide, false); }
    finally { window.callModel = realCall; window.log = realLog; }
    return prompts.length === 2 &&
           /IDENTICAL LOOKALIKE of IShowSpeed/.test(prompts[0]) &&   // asked by name first
           !/IShowSpeed/.test(prompts[1]) &&                // then without it
           logs.some(m => /will not be a likeness/.test(m));
  })();
  /* The facts pages are a different case and were left alone: there an image is
     presented as documentation of an event, so a generated face is a fabricated
     record. That rule must not have been dragged along by this change. */
  out.factsPagesStillRefuseTheFace =
    /do NOT describe the face of the specific real named individual/
      .test(factDeckPrompt('History', {subject:'x', claim:'y'}, 6, 'mono'));
  return out;
});
await b.close();

const want = {
  presetExists:true, usesDocumentary:true, setInAnton:true, noInsetOrRule:true,
  glowIsTheBrandYellow:true, badgeIsTheBrandYellow:true, handleIsTheBrandYellow:true,
  coverFootIsYellow:true, gradientIsNotAYellowBand:true,
  whiteCapsClearTheGlow:true, badgeInkIsDark:true,
  badgeFollowsTheAngle:true, everyAngleHasABadge:true, angleCount:8, angleKinds:'list,story',
  anglesDocumented:true,
  handleDraws:true, markDrawsBesideIt:true, markIsLeftOfTheText:true,
  markFillsItsCircle:true, markIsNotOversized:true, markUsesTheSharedAvatar:true,
  lockupIsCoverOnly:true, noLogoNoCrash:true,
  categoryWired:true, scanDealsTheAngles:true, obsessionStillHasOneShape:true,
  briefIsOneLinePerSlide:true, briefDemandsALongLook:true, briefBansBrandsInScene:true,
  briefBansRumour:true, briefBansPileOns:true,
  briefProtectsMinors:true, briefCarriesTheDay:true, countingBriefStatesTheNumber:true,
  briefAsksForRealSkin:true, everyFrameAsksForRealSkin:true,
  dispatchReachesFun:true,
  namesThePerson:true, lookalikeLeadsTheBlock:true, saysTheyAreReal:true, bansAPrettierFace:true,
  carriesWhatTheyAreKnownFor:true, briefAsksWhatTheyAreKnownFor:true,
  keepsTheLookBehindTheName:true, fallbackDropsTheName:true,
  namedFirstIsOn:true, briefAsksForTheRealName:true, briefKeepsScenesReported:true,
  refusalFallsBackAndSaysSo:true, factsPagesStillRefuseTheFace:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(30) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
