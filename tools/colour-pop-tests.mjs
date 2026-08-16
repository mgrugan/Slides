/* Colour pop: black and white except one element that keeps its colour. Two things
   make it different from the other tones — it is a property of the whole carousel
   rather than a slide, and it cannot be recognised by average saturation, because a
   mostly-grey frame with one red coat in it averages out as monochrome. */
import { chromium } from 'playwright-core';

const stub = () => {
  // grey field, then a coloured patch covering `frac` of it
  window.__paint = (frac, hue) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 500;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,0,500); g.addColorStop(0,'#d2d2d2'); g.addColorStop(1,'#2e2e2e');
    x.fillStyle = g; x.fillRect(0,0,400,500);
    if(frac > 0){
      const area = 400*500*frac, w = Math.sqrt(area*0.8), h = area/w;
      x.fillStyle = 'hsl('+(hue||8)+',85%,48%)';
      x.fillRect(40, 60, w, h);
    }
    return c.toDataURL('image/jpeg', 0.92);
  };
  window.__full = (muted) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 500;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,300,500);
    if(muted){ g.addColorStop(0,'#9c8a63'); g.addColorStop(1,'#4a5a6b'); }
    else { g.addColorStop(0,'#e0a23c'); g.addColorStop(1,'#1c4f8a'); }
    x.fillStyle = g; x.fillRect(0,0,400,500);
    x.fillStyle = muted ? '#7d5a44' : '#2f7d3a';        // a second hue, as any real scene has
    x.fillRect(0,340,400,160);
    return c.toDataURL('image/jpeg', 0.92);
  };
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

// 1 — the measurement can tell the three apart
const measure = await p.evaluate(async ()=>{
  const check = async (data, want) => {
    const st = await statsOfDataURL(data);
    return {mean:+st.mean.toFixed(3), hot:+st.hot.toFixed(3), ok: toneOK(want, st), as: classifyTone(want, st)};
  };
  return {
    monoAsMono:   await check(window.__paint(0), 'mono'),
    popAsPop:     await check(window.__paint(0.08), 'pop'),
    bigPopAsPop:  await check(window.__paint(0.3), 'pop'),
    fullAsColour: await check(window.__full(), 'colour'),
    // a plain grey frame must NOT pass as a pop — that is the failure that would let
    // an ignored instruction through unnoticed
    monoFailsPop:   !(await check(window.__paint(0), 'pop')).ok,
    // nor should a fully coloured frame count as a pop — vivid or muted. The muted one
    // is the trap: its average saturation is lower than a large pop's.
    fullFailsPop:   !(await check(window.__full(), 'pop')).ok,
    mutedFailsPop:  !(await check(window.__full(true), 'pop')).ok,
    mutedIsColour:  (await check(window.__full(true), 'colour')).ok,
    // and a pop frame must not be filed as plain colour
    popNotColour:   (await check(window.__paint(0.08), 'pop')).as === 'pop'
  };
});

// 2 — prompt wording, and the deck-wide rule
const deck = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  const d = {id:'d1', subject:'Test', tone:'pop', pop:'a red coat', slides:[]};
  d.slides = Array.from({length:5},(_,i)=>({id:'s'+i, kind:i?'slide':'hook', title:'T'+i, body:'b',
    scene:'a street', tone: i === 2 ? 'mono' : 'pop', _deck:d}));      // writer got one wrong
  applySlideTones(d);

  const prompt = imagePrompt(d.slides[1]);
  const insisted = imagePrompt(d.slides[1], true);
  const monoDeck = {id:'d2', tone:'mono', slides:[]};
  monoDeck.slides = [{id:'m0', kind:'hook', scene:'x', tone:'mono', _deck:monoDeck}];

  return {
    everySlidePops: d.slides.every(s=>s.tone === 'pop'),
    popCarried: d.slides.every(s=>s.pop === 'a red coat'),
    namesTheThing: prompt.includes('a red coat'),
    saysMonochrome: /BLACK AND WHITE PHOTOGRAPH WITH A SINGLE COLOUR POP/.test(prompt),
    noPlaceholderLeft: !/\{pop\}/.test(prompt),
    insistNegates: /NOT a colour photograph/.test(insisted),
    keepsArchivalLook: /archival/.test(prompt),          // a pop frame is still a b&w photograph
    monoUnaffected: !/COLOUR POP/.test(imagePrompt(monoDeck.slides[0]))
  };
});

// 3 — the writer is told to pop, and the library keeps pop separate from mono
const rest = await p.evaluate(async ()=>{
  const popPrompt = factDeckPrompt(Object.keys(FACT_CATS)[0], {subject:'X', claim:'Y'}, 5, 'pop');
  const monoPrompt = factDeckPrompt(Object.keys(FACT_CATS)[0], {subject:'X', claim:'Y'}, 5, 'mono');

  LIB.length = 0;
  const mk = (id, tone) => ({id, data:'', thumb:'', scene:'a street', tags:['street'], imagery:'archival-documentary-photograph',
    aspect:'4:5', collection:'Facts', tone, toneChecked:true, bytes:1, stats:{}, created:1, used:0});
  LIB.push(mk('m','mono'), mk('c','colour'), mk('p','pop'));
  const pick = t => { const r = libPick(new Set(), S.profile, {kind:'slide', tone:t, scene:'a street'}); return r ? r.tone : 'none'; };

  return {
    asksForPop: /SINGLE COLOUR POP/.test(popPrompt) && /"pop"/.test(popPrompt),
    everySlidePopInPrompt: /tone" of "pop" — all of them/.test(popPrompt),
    monoPromptUnchanged: !/COLOUR POP/.test(monoPrompt),
    popGetsPop: pick('pop') === 'pop',
    monoGetsMono: pick('mono') === 'mono',
    colourGetsColour: pick('colour') === 'colour'
  };
});

// 4 — the toggle exists, is off by default, and allocates pop decks out of the mono half
const ui = await p.evaluate(()=>{
  const t = $('factPopToggle');
  const alloc = (n, colourPct, popOn) => {
    const nColour = Math.round(n * colourPct/100);
    const nPop = popOn ? Math.max(1, Math.round((n - nColour)/2)) : 0;
    const tones = Array.from({length:n},(_,i)=> i < nColour ? 'colour' : i < nColour+nPop ? 'pop' : 'mono');
    return tones.reduce((a,x)=>(a[x]=(a[x]||0)+1, a), {});
  };
  return {exists: !!t, offByDefault: t.dataset.on === '0', label: t.textContent.trim(),
          offSplit: alloc(10, 50, false), onSplit: alloc(10, 50, true)};
});

const fail = [];
if(!measure.monoAsMono.ok) fail.push('a grey frame no longer reads as mono');
if(!measure.popAsPop.ok) fail.push('an 8% colour patch is not recognised as a pop');
if(!measure.bigPopAsPop.ok) fail.push('a 30% colour patch is not recognised as a pop');
if(!measure.fullAsColour.ok) fail.push('a colour frame no longer reads as colour');
if(!measure.monoFailsPop) fail.push('a plain grey frame passes as a colour pop');
if(!measure.fullFailsPop) fail.push('a fully coloured frame passes as a colour pop');
if(!measure.mutedFailsPop) fail.push('a muted colour frame passes as a colour pop');
if(!measure.mutedIsColour) fail.push('a muted colour frame no longer reads as colour');
if(!measure.popNotColour) fail.push('a pop frame is filed as plain colour');
for(const [k,v] of Object.entries(deck)) if(!v) fail.push('deck: '+k);
for(const [k,v] of Object.entries(rest)) if(!v) fail.push('prompt/library: '+k);
if(!ui.exists) fail.push('no colour pop toggle');
if(!ui.offByDefault) fail.push('colour pop is on by default');
if(ui.offSplit.colour !== ui.onSplit.colour) fail.push('turning pop on changed how many colour decks you get');
if(!ui.onSplit.pop) fail.push('pop decks are never allocated');

console.log(JSON.stringify({measure, deck, rest, ui, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  pop is measured, deck-wide, and its own library tone');
await b.close();
process.exit(fail.length ? 1 : 0);
