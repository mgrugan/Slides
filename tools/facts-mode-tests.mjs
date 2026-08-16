import { chromium } from 'playwright-core';
import fs from 'fs';
const stub = () => {
  // an obedient model: grey when asked for black and white, saturated when asked for colour
  const mk = (colour) => { const c=document.createElement('canvas'); c.width=200;c.height=250;
    const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,0,250);
    if(colour){ g.addColorStop(0,'#e0a23c'); g.addColorStop(1,'#1c4f8a'); }
    else { g.addColorStop(0,'#c9c9c9'); g.addColorStop(1,'#3a3a3a'); }
    x.fillStyle=g; x.fillRect(0,0,200,250);
    x.fillStyle = colour ? '#c23b22' : '#8a8a8a';
    for(let i=0;i<60;i++) x.fillRect(Math.random()*200, Math.random()*250, 6, 3);
    return c.toDataURL('image/jpeg',0.8).split(',')[1]; };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {subjects:0, decks:0, img:0}; window.__excluded = [];
  window.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++;
      const colour = /FULL COLOUR PHOTOGRAPH/.test(txt);
      (window.__imgTones = window.__imgTones || []).push(colour ? 'colour' : 'mono');
      return J({output:[{content:[{type:'text', text: mk(colour)}]}]}); }
    if(/Pick \d+ subjects/.test(txt)){
      window.__n.subjects++;
      window.__lastSubjectPrompt = txt;
      const m = txt.match(/Pick (\d+) subjects/); const n = +m[1];
      window.__excluded = (txt.match(/ALREADY COVERED[\s\S]*?Return/) || [''])[0].split('·').slice(1).map(s=>s.trim().split('\n')[0]);
      const pool = ['Mad Jack Churchill','Operation Paperclip','The Dyatlov Pass','Tsutomu Yamaguchi','Project MKUltra',
                    'The Radium Girls','Vasili Arkhipov','The Great Emu War','Ignaz Semmelweis','Operation Mincemeat',
                    'The Halifax Explosion','Witold Pilecki'];
      const fresh = pool.filter(s=>!window.__excluded.some(e=>e.toLowerCase().includes(s.toLowerCase())));
      return J({output:[{content:[{type:'output_text', text: JSON.stringify(
        fresh.slice(0,n).map(s=>({subject:s, claim:'The astonishing true claim about '+s})))}]}]});
    }
    if(/documentary fact carousel about/.test(txt)){
      window.__n.decks++;
      window.__tones = window.__tones || [];
      window.__tones.push(/IN COLOUR/.test(txt) ? 'colour' : 'mono');
      const subj = (txt.match(/carousel about: (.+)/)||[])[1].split('\n')[0];
      const n = +(txt.match(/Write a (\d+)-slide/)||[])[1];
      const slides = Array.from({length:n},(_,i)=> i===0
        ? {kind:'hook', title:'He fought WWII with a longbow and a broadsword', scene:'archival beach landing'}
        : i===1 ? {kind:'slide', title:'No one knew.', body:'Lt Col John Churchill refused to fight like a normal soldier. He carried a broadsword, a longbow and bagpipes into every battle.', scene:'portrait'}
        : {kind:'slide', title:'Beat number '+i, body:'A documented thing happened at this point in the story. It was verified afterwards by records.', scene:'archival scene '+i,
           tone: (/IN COLOUR/.test(txt) ? 'colour' : (i===n-1 ? 'colour' : 'mono'))});
      return J({output:[{content:[{type:'output_text', text: JSON.stringify({subject: subj, slides,
        caption:'Para one about the fact and the hook.\n\nPara two with the detail and the context around it.\n\nPara three with the aftermath and a question for you.\n\n#madjackchurchill #wwiihistory #militaryhistory #history #facts'})}]}]});
    }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:'{}'}]}]});
  };
};
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);

// a logo, so the cover divider has a mark in it
const logo = await p.evaluate(async ()=>{
  const c=document.createElement('canvas'); c.width=c.height=120; const x=c.getContext('2d');
  x.strokeStyle='#fff'; x.lineWidth=6; x.beginPath(); x.arc(60,60,52,0,7); x.stroke();
  x.fillStyle='#fff'; x.font='bold 54px sans-serif'; x.textAlign='center'; x.textBaseline='middle'; x.fillText('HC',60,62);
  const d=c.toDataURL('image/png'); await idbPut('logo', d);
  LOGO_IMG = new Image(); LOGO_IMG.src = d; await new Promise(r=>LOGO_IMG.onload=r); return true;
});

await p.click('#modeTabs button[data-mode=D]');
await p.waitForTimeout(300);
const cats = await p.$$eval('#factCat option', o=>o.map(x=>x.value));
await p.selectOption('#factCount','5');
await p.selectOption('#factSlides','5');
await p.evaluate(()=>{ $('rColourDecks').value=50; $('rColourDecks').dispatchEvent(new Event('input'));
                       $('rColourSlides').value=40; $('rColourSlides').dispatchEvent(new Event('input')); });
await p.click('#runFacts');
await p.waitForTimeout(9000);

const r1 = await p.evaluate(()=>({
  decks: S.batch.length, subjects: S.batch.map(d=>d.subject),
  slidesEach: S.batch.map(d=>d.slides.length),
  imagesEach: S.batch.map(d=>d.slides.filter(s=>s.img).length),
  ledger: LEDGER.map(e=>e.subject),
  style: S.profile.name, treat: S.profile.caption_treatment,
  capParas: (S.batch[0].caption.split('\n\n')||[]).length,
  capTags: (S.batch[0].caption.match(/#\w+/g)||[]).length,
  calls: window.__n,
  deckTones: S.batch.map(d=>d.tone),
  promptTones: window.__tones,
  slideTones: S.batch.map(d=>d.slides.map(s=>s.tone).join(',')),
  monoDeckHasColour: S.batch.filter(d=>d.tone==='mono').map(d=>d.slides.filter(s=>s.tone==='colour').length),
  colourPromptSent: S.batch[0].slides.map(s=>/Kodachrome/.test(imagePrompt(s)) ? 'C' : 'M').join('')
}));
await p.screenshot({path:'facts-ui.png', fullPage:true});

// second run must exclude the first run's subjects
await p.selectOption('#factCount','3');
await p.click('#runFacts');
await p.waitForTimeout(9000);
const r2 = await p.evaluate(()=>({
  excludedSeen: window.__excluded.length,
  allSubjects: LEDGER.map(e=>e.subject),
  duplicates: LEDGER.map(e=>e.subject.toLowerCase()).filter((v,i,a)=>a.indexOf(v)!==i)
}));

// library must be split by collection, and tone-matched
const libInfo = await p.evaluate(()=>({
  collections: [...new Set(LIB.map(x=>x.collection||'General'))],
  perColl: LIB.reduce((a,x)=>{ const c=x.collection||'General'; a[c]=(a[c]||0)+1; return a; },{}),
  tones: LIB.reduce((a,x)=>{ a[x.tone||'?']=(a[x.tone||'?']||0)+1; return a; },{}),
  current: currentCollection(),
  // a golf-style profile must not see any Facts image
  leakCheck: (()=>{ const before=S.profile; S.profile=PRESETS[0];
      const pick = libPick(new Set(), S.profile, {kind:'slide',scene:'archival scene 2'});
      S.profile=before; return pick ? (pick.collection||'General') : 'none'; })(),
  // and a mono slide must not be handed a colour frame — nor a colour slide a grey one
  toneMatch: (()=>{ const mono = libPick(new Set(), S.profile, {kind:'slide', tone:'mono', scene:'archival scene 2'});
      return mono ? mono.tone : 'none'; })(),
  colourMatch: (()=>{ const col = libPick(new Set(), S.profile, {kind:'slide', tone:'colour', scene:'archival scene 2'});
      return col ? col.tone : 'none'; })(),
  // every stored tone must have been read off the pixels
  unchecked: LIB.filter(x=>!x.toneChecked).length
}));

// add a real archival portrait to the cover inset, then re-render
await p.evaluate(async ()=>{
  const c=document.createElement('canvas'); c.width=c.height=300; const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,300); g.addColorStop(0,'#8c8c8c'); g.addColorStop(1,'#2e2e2e');
  x.fillStyle=g; x.fillRect(0,0,300,300);
  x.fillStyle='#c8c8c8'; x.beginPath(); x.arc(150,120,58,0,7); x.fill();
  x.fillRect(72,190,156,110);
  const s = S.batch[0].slides[0];
  s.inset = c.toDataURL('image/jpeg',0.9);
  await cacheInset(s); drawOne(s.id);
});
await p.waitForTimeout(600);
const insetOk = await p.evaluate(()=>!!IMG_CACHE['inset:'+S.batch[0].slides[0].id]);

// full-res renders of a cover, a body slide, and one slide of each tone
const out = await p.evaluate(()=>{
  const d = S.batch[0];
  const all = S.batch.flatMap(x=>x.slides);
  const pick = [d.slides[0], d.slides[1],
                all.find(s=>s.tone === 'colour' && s.img), all.find(s=>s.tone === 'mono' && s.img)].filter(Boolean);
  return pick.map(s=>{ const c=document.createElement('canvas'); renderSlide(s, c, S.profile, 0.6); return c.toDataURL('image/jpeg',0.9); });
});
out.forEach((d,i)=>fs.writeFileSync(`facts-${i}.jpg`, Buffer.from(d.split(',')[1],'base64')));
console.log(JSON.stringify({cats, r1, r2, libInfo, insetOk, errs}, null, 1));
await b.close();
