/* The fact cover carries a circle containing one of the deck's own frames — a full
   circle, filled, with a complete ring — and the cover is always in colour. Facts
   only: the other styles must not grow a circle. */
import { chromium } from 'playwright-core';
import fs from 'fs';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

const r = await p.evaluate(async ()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  // deck background is dark grey; the donor frame is vivid magenta, so anything
  // magenta in the output can only have come through the circle
  const flat = (css) => {
    const c = document.createElement('canvas'); c.width = 800; c.height = 1000;
    const x = c.getContext('2d'); x.fillStyle = css; x.fillRect(0,0,800,1000);
    return c.toDataURL('image/jpeg', 0.95);
  };
  const deck = {id:'d1', subject:'The Great Emu War', hook:'Australia lost a war to birds',
                tone:'mono', n:5, slides:[], caption:'c', status:'done'};
  const tones = ['mono','mono','mono','mono','mono'];
  deck.slides = tones.map((t,i)=>({id:'s'+i, kind:i?'slide':'hook', title:'T'+i, body:'b',
    scene:'sc'+i, tone:t, img:'', status:'done', _deck:deck}));
  S.batch = [deck]; S.slides = deck.slides;

  deck.slides[0].img = flat('#2b2b2b');            // cover
  deck.slides[1].img = flat('#303030');
  deck.slides[2].img = flat('#333333');
  deck.slides[3].img = flat('#ff00cc');            // second-to-last body slide — the donor
  deck.slides[4].img = flat('#353535');
  for(const s of deck.slides) await cacheImage(s);

  const donor = insetDonor(deck.slides[0]);

  // tone rule: a mono deck must still get a colour cover. Hold the colour-slides
  // slider at zero first, so this measures the cover rule and nothing else.
  $('rColourSlides').value = 0; $('rColourSlides').dispatchEvent(new Event('input'));
  applySlideTones(deck);
  const coverTone = deck.slides[0].tone;
  const bodyTones = deck.slides.slice(1).map(s=>s.tone);

  // and with the slider up, body slides still get their share without touching the cover
  deck.slides.forEach((s,i)=>{ s.tone = 'mono'; });
  $('rColourSlides').value = 40; $('rColourSlides').dispatchEvent(new Event('input'));
  applySlideTones(deck);
  const withSlider = {cover: deck.slides[0].tone,
                      colourBodies: deck.slides.slice(1).filter(s=>s.tone === 'colour').length};
  const popDeck = {id:'d2', tone:'pop', pop:'a red coat', slides:[]};
  popDeck.slides = [0,1,2].map(i=>({id:'p'+i, kind:i?'slide':'hook', tone:'mono', _deck:popDeck}));
  applySlideTones(popDeck);
  const popCover = popDeck.slides[0].tone;

  // render the cover full size and look for the circle
  const c = document.createElement('canvas');
  renderSlide(deck.slides[0], c, S.profile, 1);
  const W = c.width, H = c.height;
  const g = c.getContext('2d');
  const at = (x,y) => { const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const magenta = px => px[0] > 150 && px[2] > 100 && px[1] < 90;

  const d = W*0.40, rad = d/2, cx = W - rad - W*0.06, cy = rad + H*0.045;
  const centre = at(cx, cy);
  const inLeft = at(cx - rad*0.7, cy), inRight = at(cx + rad*0.7, cy);
  const inTop = at(cx, cy - rad*0.7), inBottom = at(cx, cy + rad*0.7);
  const outside = at(cx - rad*1.5, cy);
  const belowCircle = at(cx, cy + rad*1.4);

  // the ring: sample just on the circle edge at four angles, all must be light
  const ringAt = a => at(cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
  const ring = [0, Math.PI/2, Math.PI, 3*Math.PI/2].map(a=>ringAt(a));
  const light = px => px[0] > 170 && px[1] > 170 && px[2] > 170;

  // the whole circle must be inside the frame
  const insideFrame = (cx - rad) > 0 && (cx + rad) < W && (cy - rad) > 0 && (cy + rad) < H;

  // a style without the flag must not draw one
  const golf = (()=>{ const before = S.profile;
    S.profile = JSON.parse(JSON.stringify(PRESETS[0]));
    const gc = document.createElement('canvas');
    const s0 = {id:'g0', kind:'hook', title:'T', scene:'x', img: deck.slides[3].img, _deck:null};
    S.slides = [s0]; IMG_CACHE[s0.id] = IMG_CACHE[deck.slides[3].id];
    renderSlide(s0, gc, S.profile, 1);
    const gg = gc.getContext('2d');
    const gw = gc.width, gh = gc.height;
    const gd = gw*0.40, gr = gd/2;
    const px = gg.getImageData(Math.round(gw - gr - gw*0.06), Math.round(gr + gh*0.045), 1, 1).data;
    S.profile = before; S.slides = deck.slides;
    return {drewNothingSpecial: !(px[0] > 170 && px[1] > 170 && px[2] > 170)};
  })();

  return {
    donorIsSecondToLast: donor && donor.id === 's3',
    coverTone, bodyTones, popCover, withSlider,
    filled: [centre, inLeft, inRight, inTop, inBottom].every(magenta),
    notLeaking: !magenta(outside) && !magenta(belowCircle),
    ringComplete: ring.every(light),
    insideFrame,
    golf,
    shot: c.toDataURL('image/jpeg', 0.9)
  };
});

fs.writeFileSync('cover-inset.jpg', Buffer.from(r.shot.split(',')[1], 'base64'));
delete r.shot;

const fail = [];
if(!r.donorIsSecondToLast) fail.push('the circle did not take the second-to-last image');
if(r.coverTone !== 'colour') fail.push('the cover of a mono deck is '+r.coverTone);
if(r.bodyTones.some(t=>t !== 'mono')) fail.push('body slides were changed too: '+r.bodyTones.join());
if(r.withSlider.cover !== 'colour') fail.push('the cover lost its colour when the slider moved');
if(!r.withSlider.colourBodies) fail.push('the colour-slides slider stopped promoting body slides');
if(r.popCover !== 'pop') fail.push('a pop deck lost its popped cover: '+r.popCover);
if(!r.filled) fail.push('the circle is not filled with the image');
if(!r.notLeaking) fail.push('the image leaked outside the circle');
if(!r.ringComplete) fail.push('the ring is not complete at all four sides');
if(!r.insideFrame) fail.push('the circle is clipped by the frame edge');
if(!r.golf.drewNothingSpecial) fail.push('a non-fact style grew a circle');

console.log(JSON.stringify({...r, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  full circle, filled, complete ring, colour cover');
await b.close();
process.exit(fail.length ? 1 : 0);
