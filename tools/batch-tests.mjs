import { chromium } from 'playwright-core';
const stub = () => {
  const mk = (hue) => { const c=document.createElement('canvas'); c.width=200;c.height=356;
    const x=c.getContext('2d'); x.fillStyle='hsl('+hue+',45%,30%)'; x.fillRect(0,0,200,356);
    return c.toDataURL('image/jpeg',0.7).split(',')[1]; };
  let hue = 0, imgCalls = 0;
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {img:0, deck:0, hooks:0};
  window.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){
      window.__n.img++; hue = (hue+37)%360;
      return J({output:[{content:[{type:'text', text: mk(hue)}]}]});   // image-as-text shape
    }
    if(/JSON array of exactly 10 strings/i.test(txt) || /Return ONLY a JSON array of exactly 10/i.test(txt)){
      window.__n.hooks++;
      return J({output:[{content:[{type:'output_text',
        text: JSON.stringify(Array.from({length:10},(_,i)=>(i+3)+' ways to fix mistake number '+(i+1)))}]}]});
    }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    window.__n.deck++;
    const m = txt.match(/Write a (\d+)-slide deck/);
    const n = m ? +m[1] : 5;
    const slides = Array.from({length:n},(_,i)=> i===0
      ? {kind:'hook', title:'Cover '+window.__n.deck, scene:'a scene'}
      : {kind:'slide', title:'Point '+i, body:'Body copy for point '+i+'.', scene:'a scene'});
    return J({output:[{content:[{type:'output_text', text: JSON.stringify({slides, caption:'caption '+window.__n.deck})}]}]});
  };
};
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
const dls=[]; p.on('download', d=>dls.push(d.suggestedFilename()));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1000);
await p.fill('#apiKey','FAKE');
await p.evaluate(()=>{ localStorage.setItem('cb.niche','intermediate lifters'); $('niche').value='intermediate lifters'; });
await p.keyboard.press('Escape');
await p.waitForTimeout(300);

await p.click('#modeTabs button[data-mode=C]');
await p.waitForTimeout(200);
await p.click('#batchSuggest');
await p.waitForTimeout(900);
const filled = (await p.inputValue('#batchHooks')).split('\n').filter(Boolean);

await p.click('#runBatch');
await p.waitForTimeout(14000);
const st = await p.evaluate(()=>({
  decks: S.batch.length,
  statuses: S.batch.map(d=>d.status),
  perDeckSlides: S.batch.map(d=>d.slides.length),
  imagesEach: S.batch.map(d=>d.slides.filter(s=>s.img).length),
  calls: window.__n,
  rows: document.querySelectorAll('#batchList .batchRow').length,
  thumbPainted: [...document.querySelectorAll('#batchList canvas')].map(c=>c.width+'x'+c.height)[0]
}));
await p.screenshot({path:'ui-batch.png', fullPage:true});

// open one in the editor, edit it, confirm it writes back into the batch
await p.click('#batchList .batchRow:nth-child(3) [data-a=open]');
await p.waitForTimeout(700);
await p.locator('.card .cw').first().click();
await p.waitForTimeout(200);
await p.locator('.card .edit textarea').first().fill('EDITED TITLE');
await p.waitForTimeout(500);
const roundTrip = await p.evaluate(()=>({open:S.openBatch, inBatch:S.batch[2].slides[0].title, inEditor:S.slides[0].title}));

// downloads — fake JSZip so the archive layout is verifiable without the CDN
await p.evaluate(()=>{
  window.__zip = {files:[], made:0};
  window.JSZip = function(){
    this.folder = name => ({ file: (f)=> window.__zip.files.push(name+'/'+f) });
    this.file = f => window.__zip.files.push(f);
    this.generateAsync = async () => { window.__zip.made++; return new Blob(['x']); };
  };
});
await p.click('#batchDownloadAll');
await p.waitForTimeout(4000);
const zipAll = await p.evaluate(()=>({n:window.__zip.files.length, made:window.__zip.made,
  sample:window.__zip.files.slice(0,3), captions:window.__zip.files.filter(f=>/caption/.test(f)).length}));
await p.evaluate(()=>{ window.__zip.files=[]; window.__zip.made=0; });
await p.click('#batchList .batchRow:nth-child(2) [data-a=zip]');
await p.waitForTimeout(2000);
const zipOne = await p.evaluate(()=>({n:window.__zip.files.length, sample:window.__zip.files.slice(0,2)}));

// reload: batch must survive with images
await p.reload();
await p.waitForTimeout(2500);
const after = await p.evaluate(()=>({decks:S.batch.length, imgs:S.batch.flatMap(d=>d.slides).filter(s=>s.img).length, rows:document.querySelectorAll('#batchList .batchRow').length}));
console.log(JSON.stringify({filled:filled.length, sample:filled[0], st, roundTrip, zipAll, zipOne, after, errs}, null, 1));
await b.close();
