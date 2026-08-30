/* The dating account's template: the account signs every frame — mark, name, tick,
   handle, over its own gradient — the cover swaps that for the swipe promise on a
   rule and keeps the circle, and no caption ever runs into any of it. Then the
   rotation: a run is dealt across the angles rather than repeating one of them. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1600);

const r = await p.evaluate(async ()=>{
  const out = {};
  const mark = () => {                       // a flat magenta disc, as a category logo would be
    const c = document.createElement('canvas'); c.width = c.height = 240;
    const x = c.getContext('2d');
    x.fillStyle = '#d020a0'; x.beginPath(); x.arc(120,120,116,0,7); x.fill();
    return c.toDataURL('image/png');
  };
  const pi = PRESETS.findIndex(x=>x.name === 'Pickuplines');
  out.presetExists = pi >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[pi])); S.styleKey = 'preset:'+pi;
  await fontReady(S.profile);

  CAT_LOGOS = {Pickuplines: mark()};
  await cacheCatLogos();

  const photo = () => {                      // a bright picture, so a footer with no gradient would vanish
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const x = c.getContext('2d'); x.fillStyle = '#f2efe6'; x.fillRect(0,0,1080,1350);
    return c.toDataURL('image/jpeg');
  };
  const deck = {id:'d1', cat:'Pickuplines', subject:'A test post', hook:'H', angle:'saga', kind:'story',
                tone:'colour', swipe:'The last one is why they split.', slides:[]};
  deck.slides = [
    {id:'s1', kind:'hook', title:'THEY MET TWICE, FORTY YEARS APART', scene:'x', tone:'colour',
     swipe:'The last one is why they split.', _deck:deck},
    {id:'s2', kind:'slide', title:'NO ONE KNEW', body:'She kept the letter in a drawer for nine years.',
     scene:'x', tone:'colour', _deck:deck},
    {id:'s3', kind:'slide', title:'THE TURN', body:'He answered it on a Tuesday.', scene:'x', tone:'colour', _deck:deck}
  ];
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); }; im.src = photo();
  })));

  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const magenta = q => q[0] > 120 && q[2] > 80 && q[1] < q[0]*0.7;
  const bluish  = q => q[2] > 120 && q[2] > q[0] + 40 && q[2] > q[1] + 20;
  const W = 1080, H = 1350;

  const cover = draw(deck.slides[0]), body = draw(deck.slides[1]);
  out.size = [cover.width, cover.height];

  // --- the circle, top right, cut from another of the deck's own frames
  const cm = {d: W*0.40};
  out.coverCircleRing = (()=>{                       // the white ring at the circle's left edge
    const cx = W - cm.d/2 - W*0.06, cy = cm.d/2 + H*0.045;
    const q = px(cover, cx - cm.d/2 + 2, cy);
    return q[0] > 200 && q[1] > 200 && q[2] > 200;
  })();

  // --- the cover's footer: the mark on the left, and a rule under it
  const cfm = coverFooterMetrics(W, H, S.profile);
  const ruleY = H - cfm.pad;
  const markCy = ruleY - cfm.rule - cfm.d/2;
  out.coverMark = magenta(px(cover, W*0.055 + cfm.d/2, markCy));
  out.coverRule = (()=>{                             // white line somewhere in the two px around ruleY
    for(const dy of [-1,0,1]){ const q = px(cover, W*0.5, ruleY + dy); if(q[0]>190 && q[1]>190 && q[2]>190) return true; }
    return false;
  })();
  // the swipe line prints to the right of the mark
  out.coverSwipeInk = (()=>{
    const x0 = W*0.055 + cfm.d + cfm.d*0.30;
    for(let x = x0; x < W*0.9; x++){
      const q = px(cover, x, markCy);
      if(q[0] > 190 && q[1] > 190 && q[2] > 190) return true;
    }
    return false;
  })();

  // --- every other frame is signed: mark, name, tick, handle
  const bm = brandBarMetrics(W, H, S.profile);
  const barCy = H - bm.pad - bm.blockH/2;
  out.barMark = (()=>{                               // the mark sits left of centre in the group
    for(let x = W*0.15; x < W*0.5; x++) if(magenta(px(body, x, barCy))) return true;
    return false;
  })();
  out.barTick = (()=>{                               // the verified tick is the only blue on the frame
    const top = Math.round(barCy - bm.blockH/2), bot = Math.round(barCy + bm.blockH/2);
    for(let y = top; y <= bot; y += 2)
      for(let x = Math.round(W*0.3); x < W*0.9; x += 2)
        if(bluish(px(body, x, y))) return true;
    return false;
  })();
  out.barGradient = (()=>{                           // the bottom edge is darker than the frame above it
    const top = px(body, W*0.5, H*0.62), foot = px(body, W*0.5, H - 3);
    return foot[0] < top[0] - 25;
  })();
  // the cover carries the swipe row instead of the account row, and vice versa
  out.coverHasNoBar = !(()=>{ for(let x = W*0.15; x < W*0.5; x++) if(magenta(px(cover, x, barCy))) return true; return false; })();

  // --- the caption stops above whatever footer the frame carries
  out.reserveCover = footerReserve(deck.slides[0], S.profile, W, H);
  out.reserveBody  = footerReserve(deck.slides[1], S.profile, W, H);
  out.reservesFooter = out.reserveCover > cfm.height && out.reserveBody > bm.height;
  out.textClearsFooter = (()=>{                       // no caption ink inside the footer's own band
    const c = draw(deck.slides[1]);
    const g = c.getContext('2d');
    const bandTop = Math.round(H - bm.pad - bm.blockH - H*0.012);
    // the account row itself is centred, so look out at the margins where only caption could be
    for(let y = bandTop; y < bandTop + 8; y++)
      for(let x = 20; x < W*0.12; x++){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[0] > 200 && d[1] > 200 && d[2] > 200) return false;
      }
    return true;
  })();

  // --- a style that never asked for any of this is untouched
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary' && x.name !== 'Pickuplines');
  out.docUnchanged = footerReserve({kind:'hook'}, PRESETS[di], W, H) === 0;

  // --- body case is its own setting now
  out.bodyNotShouted = S.profile.uppercase === true && S.profile.body_uppercase === false;

  // --- the category, and the style it brings with it
  const conf = catCfg('Pickuplines');
  out.catMode = conf.mode; out.catStyle = conf.style; out.catTone = conf.tone;
  out.angleCount = angleSet(conf.angles).length;
  out.angleKinds = [...new Set(angleSet(conf.angles).map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = angleSet(conf.angles).every(a => a.brief.length > 120 && a.cover && a.close);

  // --- the rotation: ten posts are dealt across the angles, and the next run moves on
  localStorage.removeItem('cb.angle.pickuplines');
  const runA = dealAngles('pickuplines', 10).map(a=>a.key);
  const runB = dealAngles('pickuplines', 10).map(a=>a.key);
  out.dealtAll = new Set(runA).size === out.angleCount;         // every angle appears in a run of ten
  out.dealtSpread = Math.max(...Object.values(runA.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{}))) <= 2;
  out.rotationMoves = runA.slice().sort().join() !== runB.slice().sort().join();

  // --- a list carousel keeps its closing slide, a story is left alone
  const ids = n => Array.from({length:n}, (_,i)=>({id:'x'+i, kind: i ? 'slide':'hook'}));
  out.listKeepsCloser = trimToPromise('5 openers that actually work', ids(7), 1).length === 7;
  out.listTrimsExtra  = trimToPromise('5 openers that actually work', ids(9), 1).length === 7;

  // --- the prompt the writer is actually handed
  const listDeck = {subject:'Openers', hook:'5 openers that actually work', angle:'openers', kind:'list', n:7, cat:'Pickuplines'};
  const storyDeck = {subject:'A saga', hook:'They met twice, forty years apart', angle:'saga', kind:'story', n:7, cat:'Pickuplines'};
  const lp = pickupDeckPrompt('Pickuplines', listDeck), sp = pickupDeckPrompt('Pickuplines', storyDeck);
  out.listPromptCounts = /EXACTLY 5|exactly 5/.test(lp) && lp.includes('Slide 7 is one extra CLOSING slide');
  out.promptsAskSwipe = /"swipe"/.test(lp) && /"swipe"/.test(sp);
  out.promptsGuard = ['deceiving', 'demeans a group', 'sexually explicit', 'diagnosing'].every(t=>lp.includes(t) && sp.includes(t));
  out.promptsDiffer = lp !== sp && sp.includes('documented') && lp.includes('double quotation marks');
  out.promptNoText = sp.includes('never asks for words');

  return out;
});
await b.close();

const want = {
  presetExists:true, coverCircleRing:true, coverMark:true, coverRule:true, coverSwipeInk:true,
  barMark:true, barTick:true, barGradient:true, coverHasNoBar:true,
  reservesFooter:true, textClearsFooter:true, docUnchanged:true, bodyNotShouted:true,
  catMode:'angles', catStyle:'Pickuplines', catTone:'colour', angleCount:8, angleKinds:'list,story',
  anglesDocumented:true, dealtAll:true, dealtSpread:true, rotationMoves:true,
  listKeepsCloser:true, listTrimsExtra:true, listPromptCounts:true, promptsAskSwipe:true,
  promptsGuard:true, promptsDiffer:true, promptNoText:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k];
  const ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k + ' = ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
