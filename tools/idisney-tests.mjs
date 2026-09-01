/* The Disney account. It reuses the thrifting frame — a picture, a gradient off the
   bottom, one line of heavy caps over it — so what is checked here is the things that
   are its own and could silently drift back to the parent: the brand blue arriving as
   a glow rather than a flat band, and the flag on the cover naming the kind of post
   instead of always reading the same word.

   The other half is the brief. This page's images are the part most likely to fail
   quietly: an image model asked for a named trademarked character refuses or degrades,
   and a refused frame is a blank slide. So the brief has to keep names out of the
   "scene" field and put the description in, and that instruction is worth a test
   because it is invisible until a whole batch comes back empty. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const di = PRESETS.findIndex(x=>x.name === 'iDisney');
  out.presetExists = di >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;
  await fontReady(S.profile);

  const bright = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#d8d2c4'; x.fillRect(0,0,W,H);
    return c.toDataURL('image/jpeg');
  };
  // a deck on one angle, and a second on another, because the flag has to follow it
  const mk = angle => {
    const deck = {id:'d'+angle, cat:'iDisney', angle, kind:'list', tone:'colour', slides:[]};
    deck.slides = [
      {id:'h'+angle, kind:'hook', title:'Five Fights The Internet Still Gets Wrong', body:'',
       scene:'', tone:'colour', _deck:deck},
      {id:'s'+angle, kind:'slide', title:'The Archer Beats The Soldier', body:'',
       scene:'', tone:'colour', _deck:deck}
    ];
    return deck;
  };
  const versus = mk('versus'), quotes = mk('quotes');
  await Promise.all([...versus.slides, ...quotes.slides].map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); }; im.src = bright();
  })));
  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const cover = draw(versus.slides[0]), item = draw(versus.slides[1]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step) if(test(px(c, x, y))) return true;
    return false;
  };
  const white = q => q[0] > 235 && q[1] > 235 && q[2] > 235;
  const blue  = q => q[2] > 120 && q[2] > q[0] + 50 && q[2] > q[1] + 40;
  const red   = q => q[0] > 140 && q[1] < 90 && q[2] < 90;

  // --- built on the thrifting frame, not on something else
  out.usesDocumentary = S.profile.caption_treatment === 'documentary';
  out.setInAnton = S.profile.font_family === 'Anton';
  out.noInsetOrRule = !S.profile.portrait_inset && !S.profile.auto_inset &&
                      !S.profile.divider && !S.profile.brand_bar && !S.profile.cover_swipe;

  // --- the brand blue, and it arrives as a glow rather than a flat band
  out.glowIsDisneyBlue = S.profile.glow_color === '#113CCF';
  out.coverFootIsBlue = scan(cover, W*0.2, W*0.8, H - 30, H - 4, blue);
  out.coverFootIsNotRed = !scan(cover, 0, W, H - 60, H - 2, red);
  out.glowIsBrightestAtTheFoot = (()=>{
    /* what the glow ADDS, not absolute brightness: the gradient is dark at the foot
       and thin higher up, so raw pixels would be comparing the scrim */
    const off = JSON.parse(JSON.stringify(S.profile)); off.glow_pct = 0;
    const c2 = document.createElement('canvas'); renderSlide(versus.slides[0], c2, off, 1);
    const add = y => px(cover, W*0.5, y)[2] - px(c2, W*0.5, y)[2];
    return add(H - 4) > 30 && add(H - 4) > add(H - Math.round(H*0.30)) + 15;
  })();
  out.gradientIsNotAFlatBlueBand = (()=>{
    // the scrim under the caption stays near-black navy; tinting it #113CCF instead
    // takes the contrast out from under white type
    const c = hexToRGB(S.profile.hook_scrim_color);
    return c[0] < 40 && c[1] < 40 && c[2] < 70;
  })();

  // --- the flag names the kind of post
  out.badgeIsNotFixed = S.profile.badge_fixed === false && S.profile.badge_from_angle === true;
  out.badgeIsBlue = S.profile.badge_bg === '#113CCF';
  out.badgeDrawsBlue = scan(cover, W*0.25, W*0.75, H*0.60, H*0.90, blue);
  out.badgeFollowsTheAngle = angleBadge(versus.slides[0]) === 'VERSUS' &&
                             angleBadge(quotes.slides[0]) === 'THE LINE';
  out.badgeComesFromTheAngleNotTheWriter = (()=>{
    // a writer returning its own word must not override the rotation's
    const s = Object.assign({}, versus.slides[0]);
    return !S.profile.badge_text && angleBadge(s).length > 0;
  })();
  out.everyAngleHasABadge = angleSet('idisney').every(a => /^[A-Z ]{3,14}$/.test(a.badge || ''));

  // --- and the slides carry none of it
  out.itemHasNoBadge = !scan(item, 0, W, H*0.55, H*0.95, blue);
  out.itemHasNoHandle = !scan(item, W*0.60, W*0.98, H*0.015, H*0.075, white);
  out.itemCaptionIsWhite = scan(item, W*0.06, W*0.94, H*0.80, H*0.97, white);
  out.glowStaysOffTheSlides = S.profile.glow_on_all === false;

  // --- the rotation
  const conf = catCfg('iDisney');
  const set = angleSet(conf.angles);
  out.categoryWired = conf.mode === 'angles' && conf.angles === 'idisney' &&
                      conf.style === 'iDisney' && conf.collection === 'iDisney';
  out.angleCount = set.length;
  out.angleKinds = [...new Set(set.map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = set.every(a => a.brief.length > 150 && a.cover && a.close && a.swipe);
  out.seedAnglesPresent = ['versus','channel','quotes'].every(k => set.some(a=>a.key === k));
  out.threeMoreBeyondTheSeeds = set.filter(a => !['versus','channel','quotes'].includes(a.key)).length >= 3;

  // --- the brief, and the image rule that keeps frames from coming back blank
  const dp = disneyDeckPrompt('iDisney', {subject:'A matchup', hook:'Five fights', n:7, angle:'versus'});
  out.promptOneLinePerSlide = dp.includes('Every slide is ONE LINE') && dp.includes('leave "body" empty');
  out.promptBansNamesInScene = /NEVER name a character, actor, film, studio or franchise inside "scene"/.test(dp);
  out.promptSaysWhyNamesFail = /refused/.test(dp) && /blank/.test(dp);
  out.promptShowsHowToDescribe = /deep green skin/.test(dp) && /costume/.test(dp);
  out.promptKeepsRecognisable = /silhouette/.test(dp);
  out.promptBansInventedQuotes = /Never invent a quote/.test(dp);
  out.promptNoTextInImages = /never asks for words/.test(dp);
  out.promptKeepsFootClear = dp.includes('keep the lower third simple and dark');
  // per-angle riders
  out.quoteAngleWantsExactWords = /the line IS the quote/.test(
    disneyDeckPrompt('iDisney', {subject:'x', hook:'y', n:7, angle:'quotes'}));
  out.versusAngleNamesAWinner = /names both sides and the winner/.test(dp);
  out.otherAnglesSkipTheRiders = !/the line IS the quote/.test(
    disneyDeckPrompt('iDisney', {subject:'x', hook:'y', n:7, angle:'parks'}));
  // and the dispatch actually reaches it rather than falling through to the dating one
  out.dispatchReachesDisney = ANGLE_PROMPTS['idisney'] &&
    ANGLE_PROMPTS['idisney']('iDisney', {subject:'x', hook:'y', n:7, angle:'versus'}).includes('fan account');
  return out;
});
await b.close();

const want = {
  presetExists:true, usesDocumentary:true, setInAnton:true, noInsetOrRule:true,
  glowIsDisneyBlue:true, coverFootIsBlue:true, coverFootIsNotRed:true,
  glowIsBrightestAtTheFoot:true, gradientIsNotAFlatBlueBand:true,
  badgeIsNotFixed:true, badgeIsBlue:true, badgeDrawsBlue:true, badgeFollowsTheAngle:true,
  badgeComesFromTheAngleNotTheWriter:true, everyAngleHasABadge:true,
  itemHasNoBadge:true, itemHasNoHandle:true, itemCaptionIsWhite:true, glowStaysOffTheSlides:true,
  categoryWired:true, angleCount:8, angleKinds:'list,story', anglesDocumented:true,
  seedAnglesPresent:true, threeMoreBeyondTheSeeds:true,
  promptOneLinePerSlide:true, promptBansNamesInScene:true, promptSaysWhyNamesFail:true,
  promptShowsHowToDescribe:true, promptKeepsRecognisable:true, promptBansInventedQuotes:true,
  promptNoTextInImages:true, promptKeepsFootClear:true,
  quoteAngleWantsExactWords:true, versusAngleNamesAWinner:true, otherAnglesSkipTheRiders:true,
  dispatchReachesDisney:true
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
