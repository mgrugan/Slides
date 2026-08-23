/* Two deep-sea photographs were turning up on half the slides in a run.

   planImages plans the WHOLE run before a single image is marked used, so item.used
   never moved during the pass and the same top scorer won in every carousel — the
   per-deck exclude only ever stopped repeats inside one carousel.

   And when nothing matches the subject, the 48-point subject term is zero for every
   candidate, so the winner is decided by the stats term: up to 24 points for a flat,
   dark frame that is easy to caption. A deep-sea photograph is the flattest, darkest
   thing in any library, so it won every unrelated slide. The usage penalty capped at
   18 after three uses and could never overcome that. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

const r = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  const item = (id, scene, sd, m) => ({id, data:'', thumb:'', scene,
    tags: tagsFrom(scene), tagsV: TAGS_V, imagery: S.profile.imagery,
    aspect: S.profile.aspect_ratio, collection: currentCollection(), tone:'mono',
    toneChecked:true, bytes:1, created:1, used:0,
    stats:{bands:[{m,sd},{m,sd},{m,sd}]}});

  LIB.length = 0;
  // the two culprits: perfectly smooth and very dark, so they max both stats bonuses
  LIB.push(item('anglerfish', 'a deep sea anglerfish in black water', 0.02, 0.08));
  LIB.push(item('jellyfish',  'a jellyfish drifting in deep blue water', 0.03, 0.10));
  // ordinary backgrounds: busier and brighter, so they lose on aesthetics alone
  for(let i = 0; i < 18; i++) LIB.push(item('plain'+i, 'a corridor at night '+i, 0.22, 0.42));

  // 12 carousels of 6, none of which is about the sea
  const decks = Array.from({length:12},(_,d)=>{
    const deck = {id:'d'+d, subject:'Operation '+d, hook:'H'+d, tone:'mono', slides:[]};
    deck.slides = Array.from({length:6},(_,i)=>({id:'d'+d+'s'+i, kind:i?'slide':'hook',
      title:'T', body:'b', scene:'an office corridor', tone:'mono', _deck:deck}));
    return deck;
  });
  const all = decks.flatMap(d=>d.slides);
  const {reused} = planImages(all, 'all');

  const count = {};
  reused.forEach(([,it])=>{ count[it.id] = (count[it.id]||0)+1; });
  const uses = Object.values(count).sort((a,b)=>b-a);
  const bodySlides = all.filter(s=>s.kind !== 'hook').length;

  // and a stored heavy user must lose to a fresh one, across runs
  LIB.forEach(x=>{ x.used = 0; });
  const heavy = LIB.find(x=>x.id === 'anglerfish');
  heavy.used = 20;
  const idf = libIDF();
  const slide = {kind:'slide', tone:'mono', scene:'an office corridor'};
  const heavyScore = libScore(heavy, slide, S.profile, idf);
  const freshScore = libScore(LIB.find(x=>x.id === 'plain0'), slide, S.profile, idf);

  return {
    bodySlides,
    distinctUsed: Object.keys(count).length,
    mostUsed: uses[0],
    topTwoShare: +(((uses[0]||0) + (uses[1]||0)) / bodySlides).toFixed(2),
    spread: uses,
    heavyScore: +heavyScore.toFixed(1),
    freshScore: +freshScore.toFixed(1)
  };
});

const fail = [];
// 12 decks x 5 body slides = 60 picks from a library of 20
if(r.bodySlides !== 60) fail.push('setup wrong: '+r.bodySlides+' body slides');
if(r.distinctUsed < 15) fail.push('only '+r.distinctUsed+' of 20 backgrounds were used at all');
if(r.mostUsed > 6) fail.push('one background was used '+r.mostUsed+' times out of 60');
if(r.topTwoShare > 0.2) fail.push('two backgrounds still cover '+(r.topTwoShare*100)+'% of the slides');
if(r.heavyScore >= r.freshScore)
  fail.push('a background used 20 times still beats an unused one: '+r.heavyScore+' vs '+r.freshScore);

console.log(JSON.stringify({...r, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  the library spreads instead of picking favourites');
await b.close();
process.exit(fail.length ? 1 : 0);
