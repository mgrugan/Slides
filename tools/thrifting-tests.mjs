/* The thrifting template. Not a caption on a photograph but a small dashboard, so most
   of what can go wrong is a piece of furniture drawing in the wrong place, in the wrong
   colour, or on the wrong slide — none of which throws. Two of those happened while it
   was being built: the cover drew its headline inside white boxes because drawLines
   recomputed a treatment renderSlide had already overridden, and the boxed captions came
   out empty because the ink colour was shared with the cover's white type. */
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

  const flat = () => {                      // a mid grey field: white boxes and white type both show
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#6b6b6b'; x.fillRect(0,0,W,H);
    return c.toDataURL('image/jpeg');
  };
  const deck = {id:'t', cat:'Thrifting', angle:'cards', kind:'values', tone:'colour', slides:[]};
  deck.slides = [
    {id:'c', kind:'hook', title:'If You Bought Michael Jordan Cards In 2016', badge:'TRENDING',
     scene:'', tone:'colour', _deck:deck},
    {id:'i', kind:'slide', title:'', body:"'97 Topps Chrome Refractor PSA 10",
     bought:'$340', value:'$19,500', gained:'$19,160', scene:'', tone:'colour', _deck:deck},
    {id:'n', kind:'slide', title:'', body:'An item with no figures at all', scene:'', tone:'colour', _deck:deck}
  ];
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); }; im.src = flat();
  })));
  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const cover = draw(deck.slides[0]), item = draw(deck.slides[1]), bare = draw(deck.slides[2]);
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const near = (q, r2, g2, b2, tol) => Math.abs(q[0]-r2)<tol && Math.abs(q[1]-g2)<tol && Math.abs(q[2]-b2)<tol;
  const scan = (c, x0, x1, y0, y1, test, step) => {
    step = step || 2;
    for(let y = Math.round(y0); y < y1; y += step)
      for(let x = Math.round(x0); x < x1; x += step)
        if(test(px(c, x, y))) return true;
    return false;
  };

  // --- the cover: red flag, white type, and NOT in boxes
  out.badgeIsRed = scan(cover, W*0.35, W*0.65, H*0.48, H*0.60, q => q[0] > 150 && q[1] < 90 && q[2] < 90);
  out.coverTypeIsWhite = scan(cover, W*0.08, W*0.92, H*0.60, H*0.98, q => q[0]>235 && q[1]>235 && q[2]>235);
  /* If the cover were boxed, a wide band behind the headline would be solid white. Look
     for a long unbroken run — type alone never gives one. */
  out.coverIsNotBoxed = (()=>{
    const g = cover.getContext('2d');
    for(let y = Math.round(H*0.62); y < H*0.96; y += 2){
      let run = 0;
      for(let x = Math.round(W*0.06); x < W*0.94; x++){
        const d = g.getImageData(x, y, 1, 1).data;
        run = (d[0]>235 && d[1]>235 && d[2]>235) ? run+1 : 0;
        if(run > W*0.5) return false;
      }
    }
    return true;
  })();

  // --- the item slide: boxed caption with DARK ink in it
  out.captionIsBoxed = scan(item, W*0.04, W*0.60, H*0.03, H*0.16, q => q[0]>240 && q[1]>240 && q[2]>240);
  out.captionInkIsDark = scan(item, W*0.04, W*0.60, H*0.03, H*0.16, q => q[0]<70 && q[1]<70 && q[2]<70);
  out.captionSitsLeft = (()=>{                       // boxes hug the left edge, not centred
    const g = item.getContext('2d');
    let firstWhite = W;
    for(let x = 0; x < W; x++){
      const d = g.getImageData(x, Math.round(H*0.06), 1, 1).data;
      if(d[0]>240 && d[1]>240 && d[2]>240){ firstWhite = x; break; }
    }
    return firstWhite < W*0.10;
  })();

  // --- the figures
  out.statBoxesOnRight = scan(item, W*0.66, W*0.98, H*0.36, H*0.66, q => q[0]>240 && q[1]>240 && q[2]>240);
  out.statInkIsDark = scan(item, W*0.66, W*0.98, H*0.36, H*0.66, q => q[0]<70 && q[1]<70 && q[2]<70);
  out.gainIsGreen = scan(item, W*0.20, W*0.80, H*0.82, H*0.95, q => q[1] > 140 && q[1] > q[0] + 40 && q[1] > q[2] + 40);
  out.gainLabelPresent = scan(item, W*0.35, W*0.65, H*0.77, H*0.82, q => q[0]>240 && q[1]>240 && q[2]>240);
  // a slide with no figures gets none of it, rather than empty boxes
  out.noFiguresNoFurniture = !scan(bare, W*0.66, W*0.98, H*0.36, H*0.66, q => q[0]>240 && q[1]>240 && q[2]>240)
                          && !scan(bare, W*0.20, W*0.80, H*0.82, H*0.95, q => q[1] > 140 && q[1] > q[0] + 40 && q[1] > q[2] + 40);
  /* And the cover carries no dashboard — tested by construction rather than by looking
     at a region, because a long headline reaches into wherever the boxes would be and
     the two are indistinguishable by colour. Put figures on a cover: nothing may change. */
  out.coverHasNoStats = (()=>{
    const withFigs = Object.assign({}, deck.slides[0],
      {id:'cf', bought:'$340', value:'$19,500', gained:'$19,160'});
    IMG_CACHE[withFigs.id] = IMG_CACHE[deck.slides[0].id];
    const a = cover.getContext('2d').getImageData(0,0,W,H).data;
    const b2 = draw(withFigs).getContext('2d').getImageData(0,0,W,H).data;
    for(let i = 0; i < a.length; i += 40) if(a[i] !== b2[i]) return false;
    return true;
  })();

  // --- the category and its rotation
  const conf = catCfg('Thrifting');
  out.catStyle = conf.style; out.catMode = conf.mode;
  const set = angleSet(conf.angles);
  out.angleCount = set.length;
  out.angleKinds = [...new Set(set.map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = set.every(a => a.brief.length > 150 && a.cover && a.close && a.swipe);
  out.pillarsCovered = ['sneaker','card','toy','Y2K'].every(w =>
    (catPrompt('Thrifting') + set.map(a=>a.brief).join(' ')).toLowerCase().includes(w.toLowerCase()));
  /* This set has no `story` angle, so an untagged line must land on one it does have —
     the shared fallback used to reach for 'story' and would have produced a deck shape
     no angle in this rotation can write. */
  const hand = parseIdeaLines(conf.angles, '6 sneakers that quietly became grails\nA jacket found for four pounds');
  out.untaggedLandsInSet = hand.every(x => !!angleIn(conf.angles, x.angle));
  out.untaggedCountIsValues = hand[0].kind === 'values';

  // --- the brief the writer is handed
  const d2 = {subject:'MJ cards', hook:'6 Michael Jordan cards bought in 2016', angle:'cards',
              kind:'values', n:7, cat:'Thrifting'};
  const vp = valuesDeckPrompt('Thrifting', d2);
  out.promptDemandsRealPrices = vp.includes('recorded auction result') && vp.includes('invented price');
  out.promptAsksBadge = vp.includes('"badge"');
  out.promptOrdersByGap = vp.includes('largest is last');
  out.promptWantsCredit = vp.includes('credit');
  out.promptNameInBody = vp.includes('Leave "title" empty on item slides');
  out.promptNoTextInImages = vp.includes('never asks for words');
  // a counting headline sets the length: cover plus that many items, no closer
  out.valuesLengthFromHook = (()=>{
    const ids = n => Array.from({length:n}, (_,i)=>({id:'x'+i, kind: i ? 'slide':'hook'}));
    return trimToPromise('6 Michael Jordan cards bought in 2016', ids(9), 0).length === 7;
  })();
  return out;
});
await b.close();

const want = {
  presetExists:true, badgeIsRed:true, coverTypeIsWhite:true, coverIsNotBoxed:true,
  captionIsBoxed:true, captionInkIsDark:true, captionSitsLeft:true,
  statBoxesOnRight:true, statInkIsDark:true, gainIsGreen:true, gainLabelPresent:true,
  noFiguresNoFurniture:true, coverHasNoStats:true,
  catStyle:'Thrifting', catMode:'angles', angleCount:8, angleKinds:'list,values',
  anglesDocumented:true, pillarsCovered:true, untaggedLandsInSet:true, untaggedCountIsValues:true,
  promptDemandsRealPrices:true, promptAsksBadge:true, promptOrdersByGap:true, promptWantsCredit:true,
  promptNameInBody:true, promptNoTextInImages:true, valuesLengthFromHook:true,
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const ok = r[k] === v; if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(26) + JSON.stringify(r[k]) + (ok?'':'  (wanted '+JSON.stringify(v)+')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
