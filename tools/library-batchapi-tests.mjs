import { chromium } from 'playwright-core';
const stub = () => {
  const mk = h => { const c=document.createElement('canvas'); c.width=160;c.height=284;
    const x=c.getContext('2d'); x.fillStyle='hsl('+h+',50%,32%)'; x.fillRect(0,0,160,284);
    return c.toDataURL('image/jpeg',0.7).split(',')[1]; };
  let hue=0;
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {img:0, batchCreate:0, poll:0};
  window.__jobState = 'JOB_STATE_PENDING';
  window.fetch = async (url, opts) => {
    const u = String(url);
    if(u.includes(':batchGenerateContent')){
      window.__n.batchCreate++;
      const body = JSON.parse(opts.body);
      window.__reqKeys = body.batch.input_config.requests.requests.map(r=>r.metadata.key);
      window.__hasModalities = body.batch.input_config.requests.requests
        .every(r=>(r.request.generation_config||{}).responseModalities);
      return J({name:'batches/test-123', metadata:{state:'JOB_STATE_PENDING'}});
    }
    if(u.includes('/batches/test-123')){
      window.__n.poll++;
      if(window.__jobState !== 'JOB_STATE_SUCCEEDED') return J({name:'batches/test-123', state:window.__jobState, metadata:{state:window.__jobState}});
      return J({name:'batches/test-123', state:'JOB_STATE_SUCCEEDED', dest:{inlinedResponses:
        window.__reqKeys.map(k=>{ hue=(hue+53)%360; return {metadata:{key:k},
          response:{candidates:[{content:{parts:[{inlineData:{mimeType:'image/jpeg', data:mk(hue)}}]}}]}}; })}});
    }
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++; hue=(hue+29)%360;
      return J({output:[{content:[{type:'text', text: mk(hue)}]}]}); }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    const m = txt.match(/Write a (\d+)-slide deck/); const n = m ? +m[1] : 4;
    return J({output:[{content:[{type:'output_text', text: JSON.stringify({
      slides: Array.from({length:n},(_,i)=> i===0 ? {kind:'hook',title:'Cover',scene:'sc'}
        : {kind:'slide',title:'P'+i,body:'B'+i,scene:'sc'+i}), caption:'cap'})}]}]});
  };
};
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1000);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);

// 1. normal deck -> every generated image lands in the library
await p.fill('#hookInput','4 things to fix'); await p.click('#genDeck');
await p.waitForTimeout(4000);
const lib1 = await p.evaluate(()=>({items:LIB.length, calls:window.__n.img}));

// 2. library ON -> cover generates, body slides come free from the library
await p.click('#libToggle'); await p.waitForTimeout(150);
const mirrored = await p.evaluate(()=>$('batchLibToggle').dataset.on);
await p.fill('#hookInput','4 more things to fix'); await p.click('#genDeck');
await p.waitForTimeout(4500);
const lib2 = await p.evaluate(()=>({
  callsTotal: window.__n.img,
  slideImgs: S.slides.filter(s=>s.img).length,
  fromLib: LIB.filter(x=>x.used>0).length,
  libItems: LIB.length
}));

// 3. batch with half-price mode -> one job, no direct image calls, results land on poll
await p.click('#modeTabs button[data-mode=C]');
await p.evaluate(()=>{ localStorage.setItem('cb.useLib','0'); $('batchLibToggle').dataset.on='0'; $('libToggle').dataset.on='0'; });
await p.waitForTimeout(150);
await p.fill('#batchHooks','3 alpha hooks here\n3 beta hooks here');
await p.click('#batchApiToggle'); await p.waitForTimeout(150);
const before = await p.evaluate(()=>window.__n.img);
await p.click('#runBatch');
await p.waitForTimeout(5000);
const job = await p.evaluate(()=>({
  created: window.__n.batchCreate, directCalls: window.__n.img - 0,
  keys: (window.__reqKeys||[]).length, modalities: window.__hasModalities,
  jobsStored: JSON.parse(localStorage.getItem('cb.jobs')||'[]').length,
  jobRows: document.querySelectorAll('.jobRow').length,
  slideStates: S.batch.flatMap(d=>d.slides).map(s=>s.status).filter(x=>x==='queued').length
}));
// state moves pending -> running and the row reflects it
await p.evaluate(()=>{ window.__jobState = 'JOB_STATE_RUNNING'; });
await p.click('#jobCheck'); await p.waitForTimeout(800);
const runningRow = await p.$eval('.jobRow', e=>e.className + ' | ' + e.textContent.trim());
const note = await p.$eval('#jobsNote', e=>e.textContent.slice(0,60));
// job completes
await p.evaluate(()=>{ window.__jobState = 'JOB_STATE_SUCCEEDED'; });
await p.click('#jobCheck');
await p.waitForTimeout(2500);
const after = await p.evaluate((before)=>({
  imgs: S.batch.flatMap(d=>d.slides).filter(s=>s.img).length,
  total: S.batch.flatMap(d=>d.slides).length,
  libNow: LIB.length,
  done: JSON.parse(localStorage.getItem('cb.jobs')||'[]').filter(j=>j.done).length,
  directImageCalls: window.__n.img
}), before);
await p.click('#btnLibrary'); await p.waitForTimeout(500);
await p.screenshot({path:'ui-library.png'});
const stats = await p.$eval('#libStats', e=>e.textContent);
console.log(JSON.stringify({lib1, mirrored, lib2, job, runningRow, note, after, stats, errs}, null, 1));
await b.close();
