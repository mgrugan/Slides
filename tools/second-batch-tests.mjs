import { chromium } from 'playwright-core';
/* Batch 1 goes to a half-price job. While it is pending, run batch 2 synchronously
   with images on. Batch 1's decks must survive, batch 2 must generate normally,
   and batch 1's images must still land when the job completes. */
const stub = () => {
  const mk = h => { const c=document.createElement('canvas'); c.width=100;c.height=178;
    const x=c.getContext('2d'); x.fillStyle='hsl('+h+',60%,35%)'; x.fillRect(0,0,100,178);
    return c.toDataURL('image/jpeg',0.7).split(',')[1]; };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {img:0, jobs:0}; window.__jobState='JOB_STATE_RUNNING';
  window.fetch = async (url, opts) => {
    const u = String(url);
    if(u.includes(':batchGenerateContent')){
      window.__n.jobs++;
      const body = JSON.parse(opts.body);
      window.__reqKeys = body.batch.input_config.requests.requests.map(r=>r.metadata.key);
      return J({name:'batches/j'+window.__n.jobs, state:'JOB_STATE_PENDING'});
    }
    if(u.includes('/batches/j1')){
      if(window.__jobState !== 'JOB_STATE_SUCCEEDED') return J({name:'batches/j1', state:window.__jobState});
      return J({name:'batches/j1', state:'JOB_STATE_SUCCEEDED', dest:{inlinedResponses:
        window.__reqKeys.map(k=>({metadata:{key:k}, response:{candidates:[{content:{parts:[
          {inlineData:{mimeType:'image/jpeg', data: mk(210)}}]}}]}}))}});
    }
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++;
      return J({output:[{content:[{type:'text', text: mk(25)}]}]}); }
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
await p.click('#modeTabs button[data-mode=C]');

// batch 1 -> half price job (2 decks x 3 slides = 6 images)
await p.fill('#batchHooks','2 alpha\n2 beta');
await p.click('#batchApiToggle');
await p.click('#runBatch');
await p.waitForTimeout(3500);
const one = await p.evaluate(()=>({decks:S.batch.length, jobSlides:S.batch.flatMap(d=>d.slides).filter(s=>s._job).length, imgCalls:window.__n.img}));

// batch 2 -> synchronous, images on
await p.click('#batchApiToggle');                       // half price back off
await p.fill('#batchHooks','2 gamma');
await p.click('#runBatch');
await p.waitForTimeout(6000);
const two = await p.evaluate(()=>({
  decks: S.batch.length,
  hooks: S.batch.map(d=>d.hook),
  imgCalls: window.__n.img,
  jobsCreated: window.__n.jobs,
  stillWaiting: S.batch.flatMap(d=>d.slides).filter(s=>s._job).length,
  gammaImgs: S.batch.filter(d=>/gamma/.test(d.hook)).flatMap(d=>d.slides).filter(s=>s.img).length
}));

// job lands -> batch 1 fills in
await p.evaluate(()=>{ window.__jobState='JOB_STATE_SUCCEEDED'; });
await p.click('#jobCheck');
await p.waitForTimeout(2500);
const three = await p.evaluate(()=>({
  alphaBetaImgs: S.batch.filter(d=>/alpha|beta/.test(d.hook)).flatMap(d=>d.slides).filter(s=>s.img).length,
  gammaImgs: S.batch.filter(d=>/gamma/.test(d.hook)).flatMap(d=>d.slides).filter(s=>s.img).length,
  totalImgCalls: window.__n.img,
  statuses: S.batch.map(d=>d.status)
}));
console.log(JSON.stringify({one, two, three, errs}, null, 1));
await b.close();
