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
