/* The model does not always honour "in colour" — it hears "archival photograph" and
   returns black and white. These tests cover the three defences:
     1. the returned picture is measured, and a monochrome "colour" slide is asked again, harder
     2. what gets stored in the library is the measured tone, not the requested one
     3. the library picker treats tone as a hard filter, so a colour slide is never
        handed a grey frame — it falls through to the API instead                       */
import { chromium } from 'playwright-core';

const stub = () => {
  const paint = (colour) => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 250;
    const x = c.getContext('2d'); const g = x.createLinearGradient(0,0,0,250);
    if(colour){ g.addColorStop(0,'#e8a33a'); g.addColorStop(1,'#17457d'); }
    else { g.addColorStop(0,'#cfcfcf'); g.addColorStop(1,'#343434'); }
    x.fillStyle = g; x.fillRect(0,0,200,250);
    x.fillStyle = colour ? '#b8372a' : '#8b8b8b';
    for(let i=0;i<60;i++) x.fillRect(Math.random()*200, Math.random()*250, 6, 3);
    return c.toDataURL('image/jpeg',0.85).split(',')[1];
  };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__paint = paint;
  window.__prompts = [];
  window.__stubborn = true;          // ignores the first, polite colour request

  window.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){
      window.__prompts.push(txt);
      const wantsColour = /FULL COLOUR PHOTOGRAPH/.test(txt);
      const insisted = /NOT black and white/.test(txt);
      const give = wantsColour && (!window.__stubborn || insisted);
      return J({output:[{content:[{type:'text', text: paint(give)}]}]});
    }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:'{}'}]}]});
  };
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);

// switch to the toned style and hand-build one colour slide and one mono slide
await p.evaluate(()=>{
  S.profile = JSON.parse(JSON.stringify(PRESETS.find(x=>x.name === 'Documentary facts')));
  S.styleKey = 'Documentary facts';
  S.slides = [
    {id: uid(), kind:'slide', title:'Colour one', body:'b', scene:'a harbour at noon', tone:'colour', status:''},
    {id: uid(), kind:'slide', title:'Mono one',  body:'b', scene:'a harbour at noon', tone:'mono',   status:''}
  ];
  buildGrid();
});

// 1 — the stubborn model: the colour slide should be asked twice and end up in colour
await p.evaluate(()=>genImage(S.slides[0]));
await p.waitForTimeout(1500);
await p.evaluate(()=>genImage(S.slides[1]));
await p.waitForTimeout(1500);

const retry = await p.evaluate(async ()=>{
  const tone = async d => await toneOfDataURL(d);
  return {
    imageCalls: window.__prompts.length,
    insisted: window.__prompts.filter(t=>/NOT black and white/.test(t)).length,
    monoNeverInsisted: window.__prompts.filter(t=>/BLACK AND WHITE PHOTOGRAPH\./.test(t) && /NOT black and white/.test(t)).length,
    colourSlideTone: await tone(S.slides[0].img),
    monoSlideTone:   await tone(S.slides[1].img),
    logSaysRetry: [...document.querySelectorAll('#log div')].filter(d=>/came back black and white/.test(d.textContent)).length
  };
});

// 2 — the library stores the measured tone. Force a mono answer for a colour request.
const stored = await p.evaluate(async ()=>{
  window.__stubborn = 'always';                      // never yields, even when insisted
  window.fetch = (u,o) => {
    const txt = (JSON.parse(o.body).input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__prompts.push(txt);
      return new Response(JSON.stringify({output:[{content:[{type:'text', text: window.__paint(false)}]}]}),
        {status:200, headers:{'content-type':'application/json'}}); }
    return new Response('{}', {status:200, headers:{'content-type':'application/json'}});
  };
  const s = {id: uid(), kind:'slide', title:'Stubborn', body:'b', scene:'a quiet street', tone:'colour', status:''};
  S.slides.push(s); buildGrid();
  await genImage(s);
  await new Promise(r=>setTimeout(r, 900));
  const item = LIB.find(x=>x.scene === 'a quiet street');
  return {asked:'colour', storedTone: item && item.tone, checked: !!(item && item.toneChecked),
          warned: [...document.querySelectorAll('#log div')].filter(d=>/still black and white after a retry/.test(d.textContent)).length};
});

// 3 — the picker refuses to substitute. Library holds mono frames only.
const picks = await p.evaluate(()=>{
  LIB.forEach(x=>{ x.collection = 'Facts'; x.tone = 'mono'; x.toneChecked = true; x.tags = ['harbour','noon']; });
  const colourSlide = {kind:'slide', tone:'colour', scene:'a harbour at noon'};
  const monoSlide   = {kind:'slide', tone:'mono',   scene:'a harbour at noon'};
  const a = libPick(new Set(), S.profile, colourSlide);
  const c = libPick(new Set(), S.profile, monoSlide);
  const cTone = c && c.tone;                          // read now — LIB is mutated below
  // an unverified item is not trusted for a toned style either
  LIB.forEach(x=>{ x.tone = 'colour'; x.toneChecked = false; });
  const d = libPick(new Set(), S.profile, colourSlide);
  // an untoned style still picks freely
  const before = S.profile; S.profile = PRESETS[0];
  LIB.forEach(x=>{ x.collection = 'General'; x.aspect = PRESETS[0].aspect_ratio; });
  const e = libPick(new Set(), S.profile, {kind:'slide', scene:'a harbour at noon'});
  S.profile = before;
  return {colourGetsNothing: a === null, monoGetsFrame: cTone === 'mono',
          uncheckedRefused: d === null, untonedStyleUnaffected: !!e};
});

// and planImages must send that colour slide to the API rather than to the library
const plan = await p.evaluate(()=>{
  localStorage.setItem('cb.useLib','1');
  LIB.forEach(x=>{ x.collection = 'Facts'; x.tone = 'mono'; x.toneChecked = true; x.aspect = '4:5'; });
  const {fresh, reused} = planImages([
    {id:'a', kind:'slide', tone:'colour', scene:'a harbour at noon'},
    {id:'b', kind:'slide', tone:'mono',   scene:'a harbour at noon'}
  ]);
  localStorage.setItem('cb.useLib','0');
  return {fresh: fresh.map(s=>s.id), reused: reused.map(([s])=>s.id)};
});

/* 4 — the case that actually bit: a project saved before the style gained its tone
   and collection fields. Every tone path used to be gated behind those fields, so
   slides badged "colour" sent prompts that never said colour, and fact backgrounds
   were filed into the general pile. */
const stale = await p.evaluate(async ()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  const old = JSON.parse(JSON.stringify(PRESETS[di]));
  ['mono_suffix','colour_suffix','image_prompt_suffix_colour','library_collection'].forEach(k=>delete old[k]);
  S.profile = old; S.styleKey = 'preset:'+di;
  const col = {kind:'slide', title:'t', scene:'a harbour', tone:'colour'};

  const beforeFix = {saysColour: /FULL COLOUR/.test(imagePrompt(col)), verified: toned(col)};
  const added = refreshBuiltinProfile();
  const after = imagePrompt(col);

  // an archival background saved while the profile was stale
  LIB.length = 0;
  LIB.push({id:'stray', data:'', scene:'a laboratory', tags:['laboratory'], imagery:'archival-documentary-photograph',
            aspect:'4:5', collection:'General', tone:'mono', toneChecked:true, stats:{}, created:1, used:0},
           {id:'cartoon', data:'', scene:'a gym', tags:['gym'], imagery:'flat-vector-cartoon',
            aspect:'4:5', collection:'General', tone:'mono', toneChecked:true, stats:{}, created:1, used:0});
  const strays = LIB.filter(strayCollection).map(x=>x.id);
  LIB.filter(strayCollection).forEach(x=>{ x.collection = COLL_BY_IMAGERY[x.imagery]; });
  return {beforeFix, added,
    saysColour: /FULL COLOUR/.test(after),
    usesColourStyle: /colour film/i.test(after) && !/archival/i.test(after),
    monoKeepsArchival: /archival/i.test(imagePrompt({kind:'slide', scene:'a harbour', tone:'mono'})),
    collectionRestored: S.profile.library_collection === 'Facts',
    strays, homes: LIB.map(x=>x.id+':'+x.collection)};
});

const fail = [];
if(stale.beforeFix.saysColour !== true) fail.push('tone is still gated on the profile, not the slide');
if(!stale.saysColour) fail.push('stale profile: colour never reaches the prompt');
if(!stale.usesColourStyle) fail.push('colour slide still gets the archival black-and-white style sentence');
if(!stale.monoKeepsArchival) fail.push('mono slide lost the archival look');
if(!stale.collectionRestored) fail.push('library_collection was not restored on reload');
if(stale.strays.join() !== 'stray') fail.push('collection migration picked the wrong items: '+stale.strays.join());
if(stale.homes.join() !== 'stray:Facts,cartoon:General') fail.push('backgrounds filed wrongly: '+stale.homes.join());
if(retry.imageCalls < 3) fail.push('colour slide was not asked again (calls '+retry.imageCalls+')');
if(retry.insisted !== 1) fail.push('expected exactly one insisted prompt, got '+retry.insisted);
if(retry.monoNeverInsisted) fail.push('a mono slide was pushed towards colour');
if(retry.colourSlideTone !== 'colour') fail.push('colour slide ended up '+retry.colourSlideTone);
if(retry.monoSlideTone !== 'mono') fail.push('mono slide ended up '+retry.monoSlideTone);
if(!retry.logSaysRetry) fail.push('no log line about the retry');
if(stored.storedTone !== 'mono') fail.push('library stored the requested tone, not the measured one: '+stored.storedTone);
if(!stored.checked) fail.push('library item not marked toneChecked');
if(!stored.warned) fail.push('no warning after a failed colour retry');
for(const [k,v] of Object.entries(picks)) if(!v) fail.push('picker: '+k);
if(plan.fresh.join() !== 'a') fail.push('planImages sent the wrong slides to the API: '+plan.fresh.join());
if(plan.reused.join() !== 'b') fail.push('planImages reused the wrong slides: '+plan.reused.join());

console.log(JSON.stringify({retry, stored, picks, plan, stale, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n') : 'PASS  tone is measured, not assumed');
await b.close();
process.exit(fail.length ? 1 : 0);
