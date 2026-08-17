/* Two persistent complaints, one cause each.

   1. A run set to 100% colour came out entirely black and white. applySlideTones read
      "if the writer didn't say mono, make it colour" — and a writer told that archival
      moments may be monochrome marks every slide mono. The sliders were suggestions.
   2. Slides labelled pop came out fully black and white, because the prompt led with
      "A BLACK AND WHITE PHOTOGRAPH" and the model stopped reading there. Pop is no
      longer asked of the model at all — it is applied locally. */
import { chromium } from 'playwright-core';
import fs from 'fs';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

// --- 1. the sliders are obeyed exactly, whatever the writer marked ---
const shares = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  const mk = (tone, writerSays) => {
    const d = {id:'d'+Math.round(performance.now()*1000)%1e6, tone, slides:[]};
    d.slides = Array.from({length:5},(_,i)=>({id:'x'+i, kind:i?'slide':'hook',
      title:'T', body:'b', scene:'s', tone: writerSays, _deck:d}));
    return d;
  };
  const count = d => d.slides.filter(s=>s.tone === 'colour').length;
  const setSlider = v => { $('rColourSlides').value = v; $('rColourSlides').dispatchEvent(new Event('input')); };

  // the exact reported case: colour deck, writer marked every slide mono
  const stubborn = mk('colour', 'mono');
  applySlideTones(stubborn);

  // and a colour deck where the writer marked them colour
  const willing = mk('colour', 'colour');
  applySlideTones(willing);

  const out = {};
  for(const pct of [0, 20, 40, 60, 80, 100]){
    setSlider(pct);
    const d = mk('mono', 'mono');
    applySlideTones(d);
    out['at'+pct] = count(d);
  }
  setSlider(60);
  // the writer's own picks decide WHICH, never how many
  const picky = mk('mono', 'mono');
  picky.slides[1].tone = 'colour';
  applySlideTones(picky);

  return {
    colourDeckAllColour: count(stubborn) === 5,
    colourDeckIgnoredWriterMono: stubborn.slides.every(s=>s.tone === 'colour'),
    willingSame: count(willing) === 5,
    perSlide: out,
    writerPickHonoured: picky.slides[1].tone === 'colour',
    writerPickCount: count(picky),
    sliderMax: +$('rColourSlides').max,
    deckSliderMax: +$('rColourDecks').max
  };
});

// --- 2. deck allocation at the extremes, including with pop on ---
const alloc = await p.evaluate(()=>{
  const plan = (n, colourPct, popOn) => {
    const nColour = Math.round(n * colourPct/100);
    const nPop = popOn ? Math.round((n - nColour)/2) : 0;
    const t = Array.from({length:n},(_,i)=> i < nColour ? 'colour' : i < nColour+nPop ? 'pop' : 'mono');
    return t.reduce((a,x)=>(a[x]=(a[x]||0)+1, a), {});
  };
  return {full: plan(10,100,false), fullWithPop: plan(10,100,true),
          none: plan(10,0,false), noneWithPop: plan(10,0,true), half: plan(10,50,true)};
});

// --- 3. the pop is produced locally and is a real pop ---
const pop = await p.evaluate(async ()=>{
  // a full colour photo: blue sky, green ground, one red coat
  const c = document.createElement('canvas'); c.width = 400; c.height = 500;
  const x = c.getContext('2d');
  x.fillStyle = '#2f6fbf'; x.fillRect(0,0,400,250);
  x.fillStyle = '#3f8f4f'; x.fillRect(0,250,400,250);
  x.fillStyle = '#cc2b1d'; x.fillRect(160,300,80,120);
  const src = c.toDataURL('image/jpeg', 0.95);

  const out = await applyPop(src, popHue('a red coat'));
  const before = await statsOfDataURL(src);
  const after = await statsOfDataURL(out);

  const read = async (data, px, py) => {
    const im = new Image(); im.src = data;
    await new Promise(r=>{ im.onload = r; });
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    cv.getContext('2d').drawImage(im,0,0);
    const d = cv.getContext('2d').getImageData(px, py, 1, 1).data;
    return [d[0],d[1],d[2]];
  };
  const coat = await read(out, 200, 360);
  const sky  = await read(out, 60, 60);
  const grass= await read(out, 60, 440);
  const grey = px => Math.max(px[0],px[1],px[2]) - Math.min(px[0],px[1],px[2]) < 26;

  // the whole prompt path: what the model is actually asked for
  const di = PRESETS.findIndex(y=>y.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di]));
  const deck = {id:'dp', subject:'X', tone:'pop', pop:'a red coat', slides:[]};
  deck.slides = [{id:'p0', kind:'slide', title:'t', scene:'a street', tone:'pop', _deck:deck}];
  const prompt = imagePrompt(deck.slides[0]);

  return {
    hues: {red: popHue('a red coat'), amber: popHue('the amber warning light'),
           yellow: popHue('a single yellow flower'), unknown: popHue('something')},
    coatStillRed: !grey(coat) && coat[0] > coat[1] + 40,
    skyDrained: grey(sky), grassDrained: grey(grass),
    readsAsPop: toneOK('pop', after),
    sourceWasColour: before.mean > MONO_THRESHOLD,
    notJustMono: after.hot > 0,
    // the prompt must ask for colour, never lead with black and white
    promptAsksColour: /A FULL COLOUR PHOTOGRAPH/.test(prompt),
    promptNeverLeadsMono: !/^A BLACK AND WHITE/.test(prompt),
    promptNamesPop: prompt.includes('a red coat'),
    shot: out
  };
});

fs.writeFileSync('colour-pop.jpg', Buffer.from(pop.shot.split(',')[1], 'base64'));
delete pop.shot;

const fail = [];
if(!shares.colourDeckAllColour) fail.push('a 100% colour deck is not all colour');
if(!shares.colourDeckIgnoredWriterMono) fail.push('the writer marking every slide mono still wins');
if(!shares.willingSame) fail.push('a cooperative writer gives a different result');
if(shares.sliderMax !== 100) fail.push('colour-slides slider maxes at '+shares.sliderMax);
if(shares.deckSliderMax !== 100) fail.push('colour-decks slider maxes at '+shares.deckSliderMax);
const want = {at0:1, at20:1, at40:2, at60:3, at80:4, at100:5};   // cover always counts as one
for(const k in want) if(shares.perSlide[k] !== want[k])
  fail.push('at '+k.slice(2)+'% expected '+want[k]+' colour slides, got '+shares.perSlide[k]);
if(!shares.writerPickHonoured) fail.push("the writer's own colour pick was dropped");
if(shares.writerPickCount !== 3) fail.push('the writer changed the count: '+shares.writerPickCount);
if(alloc.full.colour !== 10 || alloc.full.mono) fail.push('100% colour is not all colour: '+JSON.stringify(alloc.full));
if(alloc.fullWithPop.colour !== 10) fail.push('turning pop on stole colour decks: '+JSON.stringify(alloc.fullWithPop));
if(alloc.noneWithPop.pop !== 5) fail.push('pop share wrong at 0% colour: '+JSON.stringify(alloc.noneWithPop));
for(const [k,v] of Object.entries(pop)) if(k !== 'hues' && !v) fail.push('pop: '+k);
if(pop.hues.red !== 0 || pop.hues.amber !== 40 || pop.hues.yellow !== 52) fail.push('hue lookup: '+JSON.stringify(pop.hues));

console.log(JSON.stringify({shares, alloc, pop, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  the sliders decide, and the pop is real');
await b.close();
process.exit(fail.length ? 1 : 0);
