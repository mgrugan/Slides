/* The thrifting template, rebuilt to the account's own posts: a photograph, a heavy
   gradient off the bottom, one short line of white caps over it. The cover is the only
   frame that differs — red flag, handle in the corner, and a gradient that fades to
   dark red instead of black.

   The first build of this was a white-box dashboard with price rows and a green total,
   taken from a different set of the client's posts. It rendered correctly and was the
   wrong design, which is the failure mode a test cannot catch — so what is checked here
   is the things that can silently drift: which furniture appears on which slide, and
   whether the gradient is actually doing its job over a bright photograph. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const ti = PRESETS.findIndex(x=>x.name === 'Thrifting');
  out.presetExists = ti >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[ti])); S.styleKey = 'preset:'+ti;
  await fontReady(S.profile);

  // a bright photograph: white caps over it are only legible because of the gradient
  const bright = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#d8d2c4'; x.fillRect(0,0,W,H);
    return c.toDataURL('image/jpeg');
  };
  const deck = {id:'t', cat:'Thrifting', angle:'thriftfind', kind:'story', tone:'colour', slides:[]};
  deck.slides = [
    {id:'c', kind:'hook', title:'Someone Sold A Vintage Tee Then Saw The Name', body:'',
     badge:'GRAILS', scene:'', tone:'colour', _deck:deck},
    {id:'s', kind:'slide', title:'A 1996 Andy Warhol Cat Tee', body:'', scene:'', tone:'colour', _deck:deck}
  ];
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); }; im.src = bright();
  })));
  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const cover = draw(deck.slides[0]), item = draw(deck.slides[1]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step) if(test(px(c, x, y))) return true;
    return false;
  };
  const red   = q => q[0] > 140 && q[1] < 90 && q[2] < 90;
  const white = q => q[0] > 235 && q[1] > 235 && q[2] > 235;

  out.usesDocumentary = S.profile.caption_treatment === 'documentary';

  // --- the cover's furniture
  // the flag floats just above the headline, so where it lands depends on how many
  // lines that headline took — scan the whole band it can occupy
  out.badgeIsRed = scan(cover, W*0.30, W*0.70, H*0.60, H*0.92, red);
  out.handleTopRight = scan(cover, W*0.60, W*0.98, H*0.015, H*0.075, white);
  out.coverCaptionIsWhite = scan(cover, W*0.06, W*0.94, H*0.80, H*0.99, white);
  /* The badge is fixed text. A slide asking for a different word must not get one —
     the client wants the same flag on every cover. */
  out.badgeIgnoresSlide = S.profile.badge_fixed === true && S.profile.badge_text === 'TRENDING';

  // --- and the body slide has none of it
  out.itemHasNoBadge = !scan(item, 0, W, H*0.55, H*0.95, red);
  out.itemHasNoHandle = !scan(item, W*0.60, W*0.98, H*0.015, H*0.075, white);
  out.itemCaptionIsWhite = scan(item, W*0.06, W*0.94, H*0.85, H*0.99, white);

  // --- the gradients, which are most of the look
  out.gradientCarriesTheCaption = (()=>{      // the foot must be dark despite a bright photo
    const foot = px(item, W*0.5, H - 6);
    return foot[0] < 60 && foot[1] < 60 && foot[2] < 60;
  })();
  out.coverFootIsRed = (()=>{                 // the cover's fades to red, the body's to black
    const c = px(cover, W*0.03, H - 6), i = px(item, W*0.03, H - 6);
    return c[0] > i[0] + 12 && c[0] > c[2] + 8;
  })();
  out.gradientTopIsClear = (()=>{             // and it has not swallowed the whole picture
    const top = px(item, W*0.5, H*0.10);
    return top[0] > 150;
  })();

  /* The face. Archivo Black was too wide — the same headline came out two lines rather
     than four and stopped reading as this account. Anton is the narrow one, and it is
     carried in the page rather than fetched, so a slow or blocked Google Fonts cannot
     silently swap a wide grotesque back in. */
  out.setInAnton = S.profile.font_family === 'Anton' && S.profile.body_font_family === 'Anton';
  out.antonIsCarried = BUILTIN_FONTS.has('Anton') && fontAvailable('Anton');
  out.antonIsNarrow = (()=>{
    const g = document.createElement('canvas').getContext('2d');
    g.font = '400 100px Anton';       const a = g.measureText('SOMEONE SOLD A VINTAGE').width;
    g.font = '900 100px Archivo';     const c = g.measureText('SOMEONE SOLD A VINTAGE').width;
    return a < c * 0.85;
  })();
  /* Line spacing. The account stacks these almost touching; 1.02 put a band of air
     between every line. It cannot go arbitrarily tight either — Anton's caps are tall
     against its em, and below about 0.94 they collide. */
  out.linesStackClose = S.profile.title_line_em <= 0.98 && S.profile.title_line_em >= 0.94;
  out.headlineLinesDoNotTouch = (()=>{
    const g = document.createElement('canvas').getContext('2d');
    const size = S.profile.title_size_pct * H;
    g.font = fontStr(S.profile, size);
    const m = g.measureText('SOMEONE');
    const cap = (m.actualBoundingBoxAscent || size*0.72) + (m.actualBoundingBoxDescent || 0);
    return size * S.profile.title_line_em > cap + 4;      // a real gap, not an overlap
  })();
  /* The cover's red is a glow added over a near-black gradient, not a maroon tint mixed
     into it: bright at the bottom edge and gone by halfway up the caption. */
  out.glowIsBrightestAtTheFoot = (()=>{
    /* Measured as what the glow ADDS, not as absolute brightness: the gradient is dark
       at the foot and thin higher up, so comparing raw pixels compares the scrim. */
    const off = JSON.parse(JSON.stringify(S.profile)); off.glow_pct = 0;
    const c2 = document.createElement('canvas'); renderSlide(deck.slides[0], c2, off, 1);
    const add = y => px(cover, W*0.5, y)[0] - px(c2, W*0.5, y)[0];
    const foot = add(H - 4), mid = add(H - Math.round(H*0.30));
    return foot > 30 && foot > mid + 15;
  })();
  out.glowSpansTheWidth = (()=>{               // a wash across the foot, not a smudge in the middle
    const edge = px(cover, W*0.10, H - 8), mid = px(cover, W*0.5, H - 8);
    return edge[0] > 55 && edge[0] < mid[0];
  })();
  out.glowStaysOffTheSlides = S.profile.glow_on_all === false;
  /* The caption sits up off the foot, not against it — which is also what leaves room
     for the glow to read from under the words rather than behind them. */
  out.captionSitsOffTheFoot = (()=>{
    const d = cover.getContext('2d').getImageData(0, 0, W, H).data;
    for(let y = H - 1; y > H*0.6; y--)
      for(let x = 0; x < W; x++){
        const i = (y*W + x)*4;
        if(d[i] > 240 && d[i+1] > 240 && d[i+2] > 240) return (H - y) > H*0.055;
      }
    return false;
  })();
  /* And the gradient was raised with it: lifting the type moved its top line into a
     lighter part of the ramp, so the foot under the caption has to stay dark. */
  out.footStaysDarkUnderTheLift = (()=>{
    const top = px(item, W*0.5, H - Math.round(H*0.16));      // just above the caption
    return top[0] < 110 && top[1] < 110 && top[2] < 110;
  })();
  /* The slides keep their picture: the gradient there only has to hold one line at the
     foot, and a scrim over half the frame was throwing the photograph away. */
  out.slideKeepsItsPicture = S.profile.scrim_pct <= 0.34 && S.profile.hook_scrim_pct > S.profile.scrim_pct;
  out.pictureShowsAtMidHeight = px(item, W*0.5, H*0.55)[0] > 120;
  /* Big and centred even when a line comes up short — the fit-to-column step-down that
     the dating style uses is exactly wrong here. */
  out.doesNotShrinkToFill = S.profile.fit_column === false && S.profile.balance_wrap === true;

  // --- no leftovers from the dashboard build
  out.noWhiteBoxes = !scan(item, W*0.04, W*0.96, H*0.02, H*0.70, white);
  out.statsOff = S.profile.stat_boxes === false;
  out.noGreenFigure = !scan(item, 0, W, H*0.70, H, q => q[1] > 140 && q[1] > q[0] + 40 && q[1] > q[2] + 40);

  // --- the rotation and the brief
  const conf = catCfg('Thrifting');
  const set = angleSet(conf.angles);
  out.angleCount = set.length;
  out.angleKinds = [...new Set(set.map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = set.every(a => a.brief.length > 150 && a.cover && a.close && a.swipe);
  out.pillarsCovered = ['sneaker','card','toy','Y2K'].every(w =>
    (catPrompt('Thrifting') + set.map(a=>a.brief).join(' ')).toLowerCase().includes(w.toLowerCase()));

  const tp = thriftDeckPrompt('Thrifting', {subject:'A tee', hook:'Someone sold a vintage tee',
                                            angle:'thriftfind', kind:'story', n:6, cat:'Thrifting'});
  out.promptOneLinePerSlide = tp.includes('Every slide is ONE LINE') && tp.includes('leave "body" empty');
  out.promptCapsLineLength = /4 to 10 words/.test(tp);
  out.promptDemandsRealFigures = tp.includes('No invented figures');
  out.promptWantsCredit = tp.includes('Credit the original finder');
  out.promptKeepsFootClear = tp.includes('keep the lower third simple and dark');
  out.promptNoTextInImages = tp.includes('never asks for words');
  return out;
});
await b.close();

const want = {
  presetExists:true, usesDocumentary:true,
  badgeIsRed:true, handleTopRight:true, coverCaptionIsWhite:true, badgeIgnoresSlide:true,
  itemHasNoBadge:true, itemHasNoHandle:true, itemCaptionIsWhite:true,
  gradientCarriesTheCaption:true, coverFootIsRed:true, gradientTopIsClear:true,
  noWhiteBoxes:true, statsOff:true, noGreenFigure:true,
  setInAnton:true, antonIsCarried:true, antonIsNarrow:true,
  linesStackClose:true, headlineLinesDoNotTouch:true,
  glowIsBrightestAtTheFoot:true, glowSpansTheWidth:true, glowStaysOffTheSlides:true,
  captionSitsOffTheFoot:true, footStaysDarkUnderTheLift:true,
  slideKeepsItsPicture:true, pictureShowsAtMidHeight:true, doesNotShrinkToFill:true,
  angleCount:8, angleKinds:'list,story', anglesDocumented:true, pillarsCovered:true,
  promptOneLinePerSlide:true, promptCapsLineLength:true, promptDemandsRealFigures:true,
  promptWantsCredit:true, promptKeepsFootClear:true, promptNoTextInImages:true,
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const ok = r[k] === v; if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(26) + JSON.stringify(r[k]) + (ok?'':'  (wanted '+JSON.stringify(v)+')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
