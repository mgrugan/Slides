/* Three things:
     - a middle library setting, where the front of each carousel is generated and the
       back half comes free from storage
     - a visible count of what was generated, how much of it was a retry, and what came
       free — retries were the invisible part of the bill
     - concurrency as a setting rather than a hardcoded 3                              */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

// --- the three modes ---
const modes = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;
  LIB.length = 0;
  for(let i = 0; i < 40; i++) LIB.push({id:'L'+i, data:'', thumb:'', scene:'a street at night',
    tags: tagsFrom('a street at night'), tagsV: TAGS_V, imagery: S.profile.imagery,
    aspect: S.profile.aspect_ratio, collection: currentCollection(), tone:'mono',
    toneChecked:true, bytes:1, stats:{}, created:1, used:0});

  const decks = Array.from({length:4},(_,d)=>{
    const deck = {id:'d'+d, subject:'S'+d, hook:'H'+d, tone:'mono', slides:[]};
    deck.slides = Array.from({length:6},(_,i)=>({id:'d'+d+'s'+i, kind:i?'slide':'hook',
      title:'T'+i, body:'b', scene:'a street at night', tone:'mono', _deck:deck}));
    return deck;
  });
  const all = decks.flatMap(d=>d.slides);
  const run = m => {
    const {fresh, reused} = planImages(all, m);
    const freshIdx = {}, reusedIdx = {};
    fresh.forEach(s=>{ const d = s._deck.id; (freshIdx[d] = freshIdx[d] || []).push(+s.id.split('s')[1]); });
    reused.forEach(([s])=>{ const d = s._deck.id; (reusedIdx[d] = reusedIdx[d] || []).push(+s.id.split('s')[1]); });
    return {fresh: fresh.length, reused: reused.length,
            firstDeckFresh: (freshIdx.d0||[]).sort((a,b)=>a-b),
            firstDeckReused: (reusedIdx.d0||[]).sort((a,b)=>a-b)};
  };
  return {off: run('off'), all: run('all'), half: run('half'),
          // the old boolean callers must keep working
          legacyTrue: run(true), legacyFalse: run(false)};
});

// --- the toggle cycles through all three and remembers ---
const toggle = await p.evaluate(()=>{
  const btn = $('factLibToggle');
  const seen = [];
  for(let i = 0; i < 4; i++){ seen.push(btn.dataset.mode + ':' + btn.textContent.trim()); btn.click(); }
  const stored = localStorage.getItem('cb.useLibFacts');
  // and the general pair stays in step with each other
  $('libToggle').click();
  const paired = $('batchLibToggle').dataset.mode === $('libToggle').dataset.mode;
  return {seen, stored, paired,
          readsLegacyOne: (localStorage.setItem('cb.tmp','1'), libMode('cb.tmp')),
          readsLegacyZero: (localStorage.setItem('cb.tmp','0'), libMode('cb.tmp')),
          defaultsWhenUnset: (localStorage.removeItem('cb.tmp'), libMode('cb.tmp','half'))};
});

// --- the counter ---
const counter = await p.evaluate(async ()=>{
  SPEND.images = 0; SPEND.batchImages = 0; SPEND.retries = 0; SPEND.reused = 0;
  renderSpend();
  const empty = $('spendLine').textContent;
  spend('images', 10); spend('retries', 3); spend('reused', 8); spend('batchImages', 4);
  const line = $('spendLine').textContent;
  return {empty, line,
          countsTotal: /14 images generated/.test(line),
          showsBatch: /4 at half price/.test(line),
          showsRetries: /3 of them retries/.test(line),
          showsFree: /8 free from the library/.test(line),
          // 10 x 0.067 + 4 x 0.0335 = 0.804
          cost: /\$0\.80/.test(line)};
});

// --- concurrency ---
const speed = await p.evaluate(()=>{
  const out = {};
  localStorage.removeItem('cb.conc'); out.dflt = conc(); out.dfltWrite = writeConc();
  localStorage.setItem('cb.conc','8'); out.fast = conc(); out.fastWrite = writeConc();
  localStorage.setItem('cb.conc','2'); out.slow = conc(); out.slowWrite = writeConc();
  localStorage.setItem('cb.conc','99'); out.clamped = conc();
  localStorage.setItem('cb.conc','nonsense'); out.garbage = conc();
  localStorage.setItem('cb.conc','4');
  out.hasControl = !!$('concurrency');
  // nothing may still be hardcoded to the old 3
  out.noHardcoded = !/runQueue\([^,]+, 3,/.test(document.documentElement.innerHTML);
  return out;
});

const fail = [];
if(modes.off.reused !== 0 || modes.off.fresh !== 24) fail.push('off: '+JSON.stringify(modes.off));
if(modes.all.fresh !== 4 || modes.all.reused !== 20) fail.push('all: '+JSON.stringify(modes.all));
// 6 slides: cover + slides 1,2 generated, slides 3,4,5 from the library
if(modes.half.fresh !== 12 || modes.half.reused !== 12) fail.push('half: '+JSON.stringify(modes.half));
if(modes.half.firstDeckFresh.join() !== '0,1,2') fail.push('half generated the wrong slides: '+modes.half.firstDeckFresh.join());
if(modes.half.firstDeckReused.join() !== '3,4,5') fail.push('half reused the wrong slides: '+modes.half.firstDeckReused.join());
if(JSON.stringify(modes.legacyTrue) !== JSON.stringify(modes.all)) fail.push('a boolean true no longer means "all"');
if(JSON.stringify(modes.legacyFalse) !== JSON.stringify(modes.off)) fail.push('a boolean false no longer means "off"');
if(toggle.seen.join('|') !== 'all:Library on|half:Library half|off:Library off|all:Library on')
  fail.push('the toggle does not cycle off -> all -> half: '+toggle.seen.join('|'));
if(!['off','all','half'].includes(toggle.stored)) fail.push('the mode was not stored: '+toggle.stored);
if(!toggle.paired) fail.push('the two general library buttons drifted apart');
if(toggle.readsLegacyOne !== 'all') fail.push('an existing "1" setting no longer means on');
if(toggle.readsLegacyZero !== 'off') fail.push('an existing "0" setting no longer means off');
if(toggle.defaultsWhenUnset !== 'half') fail.push('the default was ignored');
if(counter.empty !== '') fail.push('the counter shows before anything happened');
for(const k of ['countsTotal','showsBatch','showsRetries','showsFree','cost'])
  if(!counter[k]) fail.push('counter: '+k+' — '+counter.line);
if(speed.dflt !== 4) fail.push('default concurrency is '+speed.dflt+', expected 4');
if(speed.fast !== 8 || speed.slow !== 2) fail.push('the setting is not honoured');
if(speed.clamped !== 8) fail.push('concurrency is not clamped: '+speed.clamped);
if(speed.garbage !== 4) fail.push('garbage input is not handled: '+speed.garbage);
if(speed.dfltWrite !== 2 || speed.fastWrite !== 4) fail.push('writing concurrency wrong: '+speed.dfltWrite+'/'+speed.fastWrite);
if(!speed.hasControl) fail.push('no concurrency control in Settings');
if(!speed.noHardcoded) fail.push('a queue is still hardcoded to 3');

console.log(JSON.stringify({modes, toggle, counter, speed, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  half-and-half, a visible bill, and an adjustable throttle');
await b.close();
process.exit(fail.length ? 1 : 0);
