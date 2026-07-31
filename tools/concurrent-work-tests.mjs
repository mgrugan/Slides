import { chromium } from 'playwright-core';
/* A job is pending. Meanwhile: generate a normal deck, and hand-regenerate one slide
   that the job already covers. Neither should double-pay, and the hand-made image
   must survive when the job lands. */
const stub = () => {
  const mk = h => { const c=document.createElement('canvas'); c.width=120;c.height=213;
    const x=c.getContext('2d'); x.fillStyle='hsl('+h+',60%,35%)'; x.fillRect(0,0,120,213);
    return c.toDataURL('image/jpeg',0.7).split(',')[1]; };
  let hue=0;
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {img:0}; window.__jobState='JOB_STATE_RUNNING';
  window.fetch = async (url, opts) => {
    const u = String(url);
    if(u.includes(':batchGenerateContent')){
      const body = JSON.parse(opts.body);
      window.__reqKeys = body.batch.input_config.requests.requests.map(r=>r.metadata.key);
      return J({name:'batches/j1', state:'JOB_STATE_PENDING'});
    }
    if(u.includes('/batches/j1')){
      if(window.__jobState !== 'JOB_STATE_SUCCEEDED') return J({name:'batches/j1', state:window.__jobState});
      return J({name:'batches/j1', state:'JOB_STATE_SUCCEEDED', dest:{inlinedResponses:
        window.__reqKeys.map(k=>({metadata:{key:k}, response:{candidates:[{content:{parts:[
          {inlineData:{mimeType:'image/jpeg', data: mk(200)}}]}}]}}))}});   // batch images are hue 200
    }
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++; hue=(hue+31)%360;
      return J({output:[{content:[{type:'text', text: mk(30)}]}]}); }   // manual images are hue 30
    const m = txt.match(/Write a (\d+)-slide deck/); const n = m ? +m[1] : 3;
    return J({output:[{content:[{type:'output_text', text: JSON.stringify({
      slides: Array.from({length:n},(_,i)=> i===0 ? {kind:'hook',title:'Cover',scene:'s'}
        : {kind:'slide',title:'P'+i,body:'B',scene:'s'+i}), caption:'c'})}]}]});
  };
};
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(900);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.evaluate(()=>localStorage.setItem('cb.useLib','0'));

// batch run with half-price on -> job holds 3 slides
await p.click('#modeTabs button[data-mode=C]');
await p.fill('#batchHooks','2 things about form');
await p.click('#batchApiToggle');
await p.click('#runBatch');
await p.waitForTimeout(3000);
const submitted = await p.evaluate(()=>({onJob:S.batch[0].slides.filter(s=>s._job).length, calls:window.__n.img}));

// meanwhile: open that deck and press "Generate missing images" -> must skip the job's slides
await p.click('#batchList .batchRow [data-a=open]');
await p.waitForTimeout(600);
await p.click('#btnMore'); await p.waitForTimeout(200);
await p.click('#genAllImages');
await p.waitForTimeout(2000);
const afterGenAll = await p.evaluate(()=>({calls:window.__n.img, imgs:S.slides.filter(s=>s.img).length}));

// hand-regenerate slide 2 -> that one call is allowed and clears the job claim
await p.evaluate(()=>genImage(S.slides[1], true));
await p.waitForTimeout(1500);
const manual = await p.evaluate(()=>({calls:window.__n.img, slide2Job:S.slides[1]._job, hasImg:!!S.slides[1].img}));
const batchIntact = await p.evaluate(()=>S.batch[0].slides.length);

// a separate Mode A deck while the job runs -> normal generation still works
await p.click('#modeTabs button[data-mode=A]');
await p.fill('#hookInput','2 unrelated things'); await p.click('#genDeck');
await p.waitForTimeout(3000);
const modeA = await p.evaluate(()=>({calls:window.__n.img, imgs:S.slides.filter(s=>s.img).length}));

// job lands: must not clobber the hand-made image
await p.evaluate(()=>{ window.__jobState='JOB_STATE_SUCCEEDED'; });
await p.click('#modeTabs button[data-mode=C]');
await p.click('#jobCheck');
await p.waitForTimeout(2000);
const landed = await p.evaluate(()=>{
  const d = S.batch[0];
  const px = s => { const c=document.createElement('canvas'); const i=IMG_CACHE[s.id];
    if(!i||!i.naturalWidth) return 'none'; c.width=c.height=1;
    const x=c.getContext('2d'); x.drawImage(i,0,0,1,1); const q=x.getImageData(0,0,1,1).data;
    return q[1] > q[0] ? 'batch(blue-green)' : 'manual(orange)'; };
  return {slides: d.slides.map(px), libCount: LIB.length,
          log: [...document.querySelectorAll('#log div')].map(x=>x.textContent).filter(t=>/kept as-is|already paid/.test(t))};
});
console.log(JSON.stringify({submitted, afterGenAll, manual, batchIntact, modeA, landed, errs}, null, 1));
await b.close();
