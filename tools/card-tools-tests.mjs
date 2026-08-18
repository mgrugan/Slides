/* Regenerate could not be clicked. The slide grid lets a card shrink to 212px, nine
   tools need 284px in a row, and the card clips its overflow — so the first two,
   Regenerate and Library, were cut off the left edge. Being in the DOM is not the
   test; being inside the card and reachable by a click is. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const page = await b.newPage();
const errs = []; page.on('pageerror', e=>errs.push(String(e)));

const results = {};
for(const width of [1400, 1000, 760, 520, 390]){
  await page.setViewportSize({width, height: 900});
  await page.goto('file:///home/user/Slides/index.html');
  await page.waitForTimeout(900);

  await page.evaluate(()=>{
    const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
    S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;
    const deck = {id:'d', subject:'X', hook:'H', tone:'mono', slides:[]};
    deck.slides = Array.from({length:3},(_,i)=>({id:'s'+i, kind:i?'slide':'hook', title:'T'+i,
      body:'b', scene:'s', tone:'mono', img:'', status:'', _deck:deck}));
    S.slides = deck.slides; S.batch = [deck];
    buildGrid();
  });
  await page.waitForTimeout(400);

  // the cover carries the most tools, so it is the case that overflows first
  results['w'+width] = await page.evaluate(()=>{
    const card = document.querySelector('#slideGrid .card');
    card.style.pointerEvents = 'auto';
    const cardBox = card.getBoundingClientRect();
    const tools = [...card.querySelectorAll('.tools button')];
    const clipped = tools.filter(btn=>{
      const r = btn.getBoundingClientRect();
      return r.left < cardBox.left - 0.5 || r.right > cardBox.right + 0.5 || r.width === 0;
    }).map(btn=>btn.dataset.a);
    return {cardWidth: Math.round(cardBox.width), count: tools.length,
            names: tools.map(t=>t.dataset.a), clipped};
  });
}

// and the button, once reachable, actually calls the generator
const wired = await page.evaluate(async ()=>{
  let called = null;
  const real = window.genImage;
  window.genImage = async (slide) => { called = slide.id; };
  const card = document.querySelector('#slideGrid .card');
  card.querySelector('[data-a=regen]').click();
  await new Promise(r=>setTimeout(r, 300));
  window.genImage = real;
  return {calledFor: called, firstSlide: S.slides[0].id};
});

const fail = [];
for(const [k,v] of Object.entries(results)){
  if(v.clipped.length) fail.push(k+' ('+v.cardWidth+'px card): clipped '+v.clipped.join(', '));
  if(!v.names.includes('regen')) fail.push(k+': no regenerate button at all');
  if(v.count !== 9) fail.push(k+': expected 9 tools on a fact cover, got '+v.count+' — '+v.names.join());
}
if(wired.calledFor !== wired.firstSlide) fail.push('the regenerate button is not wired to the generator');

console.log(JSON.stringify({results, wired, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  every tool reachable at every width');
await b.close();
process.exit(fail.length ? 1 : 0);
