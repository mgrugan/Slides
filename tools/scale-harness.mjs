import { chromium } from 'playwright-core';
const N = +process.argv[2] || 20, SLIDES = +process.argv[3] || 6;

const stub = (N) => {
  const img = () => {
    const c=document.createElement('canvas'); c.width=1080;c.height=1350;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,600,1350); g.addColorStop(0,'#8a7f6d'); g.addColorStop(1,'#20242b');
    x.fillStyle=g; x.fillRect(0,0,1080,1350);
    for(let i=0;i<2500;i++){ x.fillStyle='rgba(200,120,90,0.3)'; x.fillRect(Math.random()*1080, Math.random()*1350, 9, 9); }
    return c.toDataURL('image/jpeg',0.92).split(',')[1];
  };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {subjects:0, decks:0, img:0};
  window.__pool = Array.from({length:400},(_,i)=>'Subject Number '+(i+1));
  window.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++; return J({output:[{content:[{type:'text', text: img()}]}]}); }
    if(/Pick \d+ subjects/.test(txt)){
      window.__n.subjects++;
      const ask = +txt.match(/Pick (\d+) subjects/)[1];
      const excl = (txt.match(/ALREADY COVERED[\s\S]*?Return/)||[''])[0];
      const fresh = window.__pool.filter(s=>!excl.includes(s));
      return J({output:[{content:[{type:'output_text', text: JSON.stringify(
        fresh.slice(0, ask).map(s=>({subject:s, claim:'A true claim about '+s})))}]}]});
    }
    if(/documentary fact carousel about/.test(txt)){
      window.__n.decks++;
      const subj=(txt.match(/carousel about: (.+)/)||[])[1].split('\n')[0];
      const n=+(txt.match(/Write a (\d+)-slide/)||[])[1];
      const slides=Array.from({length:n},(_,i)=> i===0
        ? {kind:'hook', title:'Cover for '+subj, scene:'a scene', tone:'mono'}
        : {kind:'slide', title:'Beat '+i, body:'Something documented happened here at this point.', scene:'scene '+i, tone:'mono'});
      return J({output:[{content:[{type:'output_text', text: JSON.stringify({subject:subj, slides,
        caption:'One.\n\nTwo.\n\nThree.\n\n#a #b #c'})}]}]});
    }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:'{}'}]}]});
  };
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--enable-precise-memory-info']});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub, N);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);

await p.click('#modeTabs button[data-mode=D]');
await p.waitForTimeout(300);
await p.evaluate(([n, sl])=>{
  const set = (id,v) => { const s=$(id); if(![...s.options].some(o=>o.value===String(v))){
    const o=document.createElement('option'); o.value=v; o.textContent=v; s.appendChild(o); } s.value=String(v); };
  set('factCount', n); set('factSlides', sl);
}, [N, SLIDES]);

const t0 = Date.now();
await p.click('#runFacts');
// wait for the run to finish
await p.waitForFunction(()=>!$('runFacts').disabled, null, {timeout: 600000});
const ms = Date.now() - t0;

const r = await p.evaluate(()=>({
  decks: S.batch.length,
  written: S.batch.filter(d=>d.slides.length).length,
  slides: S.batch.reduce((a,d)=>a+d.slides.length,0),
  withImages: S.batch.reduce((a,d)=>a+d.slides.filter(s=>s.img).length,0),
  uniqueSubjects: new Set(S.batch.map(d=>d.subject)).size,
  ledger: LEDGER.length,
  calls: window.__n,
  decodedResident: Object.keys(IMG_CACHE).length,
  canvasMB: +([...document.querySelectorAll('canvas')].reduce((a,c)=>a+c.width*c.height,0)*4/1048576).toFixed(1),
  dataUrlMB: +(S.batch.reduce((a,d)=>a+d.slides.reduce((x,s)=>x+(s.img||'').length*2,0),0)/1048576).toFixed(1),
  saveState: $('saveState').textContent
}));
console.log(JSON.stringify({asked:N, slidesEach:SLIDES, seconds:+(ms/1000).toFixed(1), ...r, errs:errs.slice(0,3)}, null, 1));
await b.close();
