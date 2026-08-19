/* Asking for 20 carousels produced about six. pickSubjects made one call, filtered the
   reply against the ledger and returned the survivors — with a hundred subjects already
   covered, most of the twenty collided and there was no top-up.

   And with the library on, a batch could reuse each background only ONCE across the
   whole run, because the "no repeats" set was held for the entire batch instead of per
   carousel. The bigger the batch, the less the library did. */
import { chromium } from 'playwright-core';

const ASK = 30, SLIDES = 5;      // a real option, and enough to need several top-up rounds

const stub = () => {
  const img = () => {
    const c = document.createElement('canvas'); c.width = 540; c.height = 675;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,300,675); g.addColorStop(0,'#8a7f6d'); g.addColorStop(1,'#20242b');
    x.fillStyle = g; x.fillRect(0,0,540,675);
    return c.toDataURL('image/jpeg',0.9).split(',')[1];
  };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {subjectCalls:0, asked:[], decks:0, img:0};
  window.__pool = Array.from({length:400},(_,i)=>'Subject Number '+(i+1));
  window.fetch = async (url, opts) => {
    const txt = (JSON.parse(opts.body).input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++; return J({output:[{content:[{type:'text', text: img()}]}]}); }
    if(/Pick \d+ subjects/.test(txt)){
      window.__n.subjectCalls++;
      const ask = +txt.match(/Pick (\d+) subjects/)[1];
      window.__n.asked.push(ask);
      const excl = (txt.match(/ALREADY COVERED[\s\S]*?Return/)||[''])[0];
      // deliberately mean: only ever hands back 12 at a time, so one call cannot satisfy 25
      const fresh = window.__pool.filter(s=>!excl.includes(s));
      return J({output:[{content:[{type:'output_text', text: JSON.stringify(
        fresh.slice(0, Math.min(12, ask)).map(s=>({subject:s, claim:'A true claim about '+s})))}]}]});
    }
    if(/documentary fact carousel about/.test(txt)){
      window.__n.decks++;
      const subj = (txt.match(/carousel about: (.+)/)||[])[1].split('\n')[0];
      const n = +(txt.match(/Write a (\d+)-slide/)||[])[1];
      const slides = Array.from({length:n},(_,i)=> i===0
        ? {kind:'hook', title:'Cover '+subj, scene:'a scene', tone:'mono'}
        : {kind:'slide', title:'Beat '+i, body:'Something documented happened here.', scene:'a street', tone:'mono'});
      return J({output:[{content:[{type:'output_text', text: JSON.stringify({subject:subj, slides,
        caption:'One.\n\nTwo.\n\nThree.\n\n#a #b #c'})}]}]});
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

// the picker must offer the counts we claim to support
const options = await p.evaluate(()=>[...$('factCount').options].map(o=>+o.value));

// pre-load the ledger, which is what made the shortfall show up in the first place
await p.evaluate(async ()=>{
  for(let i = 0; i < 60; i++) LEDGER.push({subject:'Old Subject '+i, title:'t', cat:'History', date:1});
  await saveLedger();
});

await p.click('#modeTabs button[data-mode=D]');
await p.waitForTimeout(300);
await p.evaluate(([n, sl])=>{ $('factCount').value = String(n); $('factSlides').value = String(sl); }, [ASK, SLIDES]);
await p.click('#runFacts');
await p.waitForFunction(()=>!$('runFacts').disabled, null, {timeout: 400000});

const run = await p.evaluate(()=>({
  decks: S.batch.length,
  written: S.batch.filter(d=>d.slides.length).length,
  slides: S.batch.reduce((a,d)=>a+d.slides.length,0),
  uniqueSubjects: new Set(S.batch.map(d=>d.subject)).size,
  subjectCalls: window.__n.subjectCalls,
  asked: window.__n.asked,
  decodedResident: Object.keys(IMG_CACHE).length
}));

/* the library must be reusable across carousels, never twice inside one */
const lib = await p.evaluate(()=>{
  LIB.length = 0;
  for(let i = 0; i < 6; i++) LIB.push({id:'L'+i, data:'', thumb:'', scene:'a street', tags:['street'],
    imagery: S.profile.imagery, aspect: S.profile.aspect_ratio, collection: currentCollection(),
    tone:'mono', toneChecked:true, bytes:1, stats:{}, created:1, used:0});

  const decks = Array.from({length:8},(_,d)=>{
    const deck = {id:'d'+d, subject:'S'+d, hook:'H'+d, tone:'mono', slides:[]};
    deck.slides = Array.from({length:5},(_,i)=>({id:'d'+d+'s'+i, kind:i?'slide':'hook',
      title:'T', body:'b', scene:'a street', tone:'mono', _deck:deck}));
    return deck;
  });
  const all = decks.flatMap(d=>d.slides);
  const {fresh, reused} = planImages(all, true);

  const perDeck = {};
  reused.forEach(([s,item])=>{
    const k = s._deck.id;
    (perDeck[k] = perDeck[k] || []).push(item.id);
  });
  const repeatsInsideADeck = Object.values(perDeck).filter(ids=>new Set(ids).size !== ids.length).length;
  const usedAcrossDecks = {};
  Object.values(perDeck).flat().forEach(id=>{ usedAcrossDecks[id] = (usedAcrossDecks[id]||0)+1; });

  return {
    bodySlides: all.filter(s=>s.kind !== 'hook').length,
    reused: reused.length,
    freshCovers: fresh.filter(s=>s.kind === 'hook').length,
    freshBodies: fresh.filter(s=>s.kind !== 'hook').length,
    repeatsInsideADeck,
    reusedAcrossDecks: Object.values(usedAcrossDecks).some(n=>n > 1),
    decksServed: Object.keys(perDeck).length
  };
});

const fail = [];
if(!options.includes(50)) fail.push('the picker does not offer 50: '+options.join());
if(run.decks !== ASK) fail.push('asked for '+ASK+' carousels, got '+run.decks);
if(run.written !== ASK) fail.push('only '+run.written+' of '+ASK+' were written');
if(run.uniqueSubjects !== ASK) fail.push('subjects repeated: '+run.uniqueSubjects+' unique of '+ASK);
if(run.slides !== ASK*SLIDES) fail.push('slide total '+run.slides+', expected '+ASK*SLIDES);
if(run.subjectCalls < 2) fail.push('did not top up — one call for '+ASK+' subjects');
if(run.decodedResident > 32) fail.push('image cache unbounded at scale: '+run.decodedResident);
// 8 decks x 4 body slides = 32 reuses from a library of 6, which is only possible
// if a background may serve more than one carousel
if(lib.reused !== 32) fail.push('library served '+lib.reused+' of 32 body slides');
if(lib.freshBodies) fail.push(lib.freshBodies+' body slides generated while the library had stock');
if(lib.freshCovers !== 8) fail.push('covers were not all generated fresh: '+lib.freshCovers);
if(lib.repeatsInsideADeck) fail.push(lib.repeatsInsideADeck+' carousels repeated a background inside themselves');
if(!lib.reusedAcrossDecks) fail.push('a background was still limited to one carousel per run');

console.log(JSON.stringify({options, run, lib, errs: errs.slice(0,3)}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  the count is delivered, and the library actually gets used');
await b.close();
process.exit(fail.length ? 1 : 0);
