/* Facts run with their library on by default. Two things must hold whatever the
   library contains: every cover is generated fresh, and nothing outside the Facts
   collection is ever pulled into a documentary carousel. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

const defaults = await p.evaluate(()=>({
  factsLibOn: $('factLibToggle').dataset.on === '1',
  factsLibLabel: $('factLibToggle').textContent.trim(),
  generalLibUntouched: $('libToggle').dataset.on === '0'      // other modes keep their own setting
}));

const plan = await p.evaluate(async ()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  // a stocked Facts collection, plus decoys in other collections
  LIB.length = 0;
  const mk = (id, coll, imagery) => ({id, data:'', thumb:'', scene:'an archival scene', tags:['archival','scene'],
    imagery, aspect:'4:5', collection:coll, tone:'mono', toneChecked:true, bytes:1000,
    stats:{bands:[0.4,0.4,0.4], sd:[0.1,0.1,0.1]}, created:1, used:0});
  for(let i=0;i<6;i++) LIB.push(mk('f'+i, 'Facts', 'archival-documentary-photograph'));
  for(let i=0;i<6;i++) LIB.push(mk('g'+i, 'General', 'photorealistic-editorial'));
  for(let i=0;i<6;i++) LIB.push(mk('c'+i, 'Cartoon', 'flat-vector-cartoon'));

  const deck = {id:'d1', subject:'Test', tone:'mono', slides:[]};
  deck.slides = Array.from({length:5},(_,i)=>({id:'s'+i, kind:i?'slide':'hook', title:'T'+i,
    body:'b', scene:'an archival scene', tone:'mono', _deck:deck}));

  const on  = planImages(deck.slides, true);
  const off = planImages(deck.slides, false);

  return {
    coverIsFresh: on.fresh.some(s=>s.kind === 'hook'),
    coverNeverReused: !on.reused.some(([s])=>s.kind === 'hook'),
    bodyReused: on.reused.length,
    onlyFacts: on.reused.every(([,item])=>item.collection === 'Facts'),
    noRepeatInDeck: new Set(on.reused.map(([,i])=>i.id)).size === on.reused.length,
    offGeneratesEverything: off.fresh.length === 5 && off.reused.length === 0,
    // an empty Facts collection must fall through to the API, not borrow from elsewhere
    emptyFalls: (()=>{ LIB.length = 0;
      LIB.push(mk('g9','General','photorealistic-editorial'));
      const r = planImages(deck.slides, true);
      return r.fresh.length === 5 && r.reused.length === 0; })()
  };
});

const fail = [];
if(!defaults.factsLibOn) fail.push('facts library is not on by default');
if(defaults.factsLibLabel !== 'Library on') fail.push('facts toggle mislabelled: '+defaults.factsLibLabel);
if(!defaults.generalLibUntouched) fail.push('turning facts on changed the other modes');
if(!plan.coverIsFresh) fail.push('the cover was not sent for fresh generation');
if(!plan.coverNeverReused) fail.push('the cover was taken from the library');
if(plan.bodyReused !== 4) fail.push('expected 4 body slides from the library, got '+plan.bodyReused);
if(!plan.onlyFacts) fail.push('a background from another collection was used');
if(!plan.noRepeatInDeck) fail.push('the same background was used twice in one deck');
if(!plan.offGeneratesEverything) fail.push('library off still reused backgrounds');
if(!plan.emptyFalls) fail.push('an empty Facts collection borrowed from another collection');

console.log(JSON.stringify({defaults, plan, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  covers fresh, bodies from Facts only');
await b.close();
process.exit(fail.length ? 1 : 0);
