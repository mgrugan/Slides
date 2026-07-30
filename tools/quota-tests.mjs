import { chromium } from 'playwright-core';

/* Scenario stub:
   - interactions rejects generation_config image fields with a 400 (once per body containing them)
   - the image model is rate limited for the first 2 requests, then succeeds  (transient)
   - a second run switches the image model to one with a hard limit:0 quota   (permanent)
*/
const stub = () => {
  const mkImg = () => {
    const c = document.createElement('canvas'); c.width = 300; c.height = 533;
    const x = c.getContext('2d'); x.fillStyle = '#294'; x.fillRect(0,0,300,533);
    return c.toDataURL('image/jpeg',0.7).split(',')[1];
  };
  const deck = {slides:[
    {kind:'hook', title:'Cover', scene:'a course at dawn'},
    {kind:'slide', title:'One', body:'Body one.', scene:'a green'}
  ], caption:'cap'};
  const J = (o,s) => new Response(JSON.stringify(o), {status:s||200, headers:{'content-type':'application/json'}});
  window.__stats = {cfgSent:0, cfgRejected:0, imgCalls:0, rateLimited:0};
  window.__mode = 'transient';
  const QUOTA_ZERO = {error:{code:429, message:'You exceeded your current quota.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image\nPlease retry in 26.6s.', status:'RESOURCE_EXHAUSTED'}};
  const QUOTA_SOFT = {error:{code:429, message:'You exceeded your current quota.\n* Quota exceeded for metric: generate_content_free_tier_requests, limit: 10, model: img\nPlease retry in 2s.', status:'RESOURCE_EXHAUSTED'}};

  window.fetch = async (url, opts) => {
    const u = String(url), body = JSON.parse(opts.body);
    const isInteractions = u.includes('/interactions');
    const hasCfg = !!(body.generation_config || body.generationConfig);
    const txt = (isInteractions
      ? (body.input||[]).map(p=>p.text||'').join(' ')
      : ((body.contents&&body.contents[0].parts)||[]).map(p=>p.text||'').join(' '));
    const wantsImage = /no text anywhere in the image/i.test(txt);

    if(wantsImage){
      if(hasCfg){
        window.__stats.cfgSent++;
        if(isInteractions){
          window.__stats.cfgRejected++;
          return J({error:{message:"Unknown parameter 'response_modalities' at 'generation_config'.", code:'invalid_request'}}, 400);
        }
      }
      window.__stats.imgCalls++;
      if(window.__mode === 'zero') return J(QUOTA_ZERO, 429);
      if(window.__stats.imgCalls <= 2){ window.__stats.rateLimited++; return J(QUOTA_SOFT, 429); }
      return J({output:[{content:[{type:'image', mime_type:'image/jpeg', data: mkImg()}]}]});
    }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:JSON.stringify(deck)}]}]});
  };
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1200);
await p.fill('#apiKey','FAKE');
await p.keyboard.press('Escape');

// --- transient rate limit: should back off and recover ---
await p.fill('#hookInput','Test hook');
await p.selectOption('#slideCount','2');
await p.click('#genDeck');
await p.waitForTimeout(9000);
const t = await p.evaluate(()=>({
  stats: window.__stats,
  states: S.slides.map(s=>s.status),
  imgs: S.slides.filter(s=>s.img).length
}));

// --- hard zero quota: should fail fast, once, with a clear message ---
await p.evaluate(()=>{ window.__mode='zero'; window.__stats.imgCalls=0; });
await p.evaluate(()=>{ S.slides.forEach(s=>{ s.img=''; delete IMG_CACHE[s.id]; }); buildGrid(); });
const t0 = Date.now();
await p.evaluate(()=>regenAllImages());
await p.waitForTimeout(3000);
const z = await p.evaluate(()=>({
  calls: window.__stats.imgCalls,
  states: S.slides.map(s=>s.status),
  errors: S.slides.map(s=>s.error),
  logHits: [...document.querySelectorAll('#log div')].filter(d=>/No image quota/.test(d.textContent)).length,
  toasts: document.querySelectorAll('.toast').length
}));

console.log(JSON.stringify({transient:t, zero:z, elapsedMs: Date.now()-t0, errs}, null, 1));
await b.close();
