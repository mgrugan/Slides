import { chromium } from 'playwright-core';
const CONC = process.argv[2] || '4';
// realistic latency: ~2.5s per image call, ~4s per deck write
const stub = () => {
  const img = () => { const c=document.createElement('canvas'); c.width=400;c.height=500;
    const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,200,500);
    g.addColorStop(0,'#e0a23c'); g.addColorStop(1,'#1c4f8a'); x.fillStyle=g; x.fillRect(0,0,400,500);
    return c.toDataURL('image/jpeg',0.9).split(',')[1]; };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  const wait = ms => new Promise(r=>setTimeout(r, ms));
  window.__pool = Array.from({length:200},(_,i)=>'Subject '+(i+1));
  window.fetch = async (url, opts) => {
    const txt = (JSON.parse(opts.body).input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ await wait(2500);
      return J({output:[{content:[{type:'text', text: img()}]}]}); }
    if(/Pick \d+ subjects/.test(txt)){ await wait(3000);
      const ask=+txt.match(/Pick (\d+) subjects/)[1];
      const excl=(txt.match(/ALREADY COVERED[\s\S]*?Return/)||[''])[0];
      const fresh=window.__pool.filter(s=>!excl.includes(s));
      return J({output:[{content:[{type:'output_text', text: JSON.stringify(
        fresh.slice(0,ask).map(s=>({subject:s, claim:'A claim about '+s})))}]}]}); }
    if(/documentary fact carousel about/.test(txt)){ await wait(4000);
      const subj=(txt.match(/carousel about: (.+)/)||[])[1].split('\n')[0];
      const n=+(txt.match(/Write a (\d+)-slide/)||[])[1];
      return J({output:[{content:[{type:'output_text', text: JSON.stringify({subject:subj,
        slides:Array.from({length:n},(_,i)=> i===0
          ? {kind:'hook', title:'Cover', scene:'a scene', tone:'mono'}
          : {kind:'slide', title:'Beat '+i, body:'x', scene:'a street', tone:'mono'}),
        caption:'a\n\nb\n\nc\n\n#a #b #c'})}]}]}); }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:'{}'}]}]});
  };
};
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1200);
await p.evaluate(c=>{ localStorage.setItem('cb.conc', c); localStorage.setItem('cb.useLibFacts','off'); }, CONC);
await p.reload(); await p.waitForTimeout(1200);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('#modeTabs button[data-mode=D]'); await p.waitForTimeout(200);
await p.evaluate(()=>{ $('factCount').value='10'; $('factSlides').value='6'; });
const t0 = Date.now();
await p.click('#runFacts');
await p.waitForFunction(()=>!$('runFacts').disabled, null, {timeout: 900000});
const secs = ((Date.now()-t0)/1000).toFixed(1);
const r = await p.evaluate(()=>({decks:S.batch.length, imgs:S.batch.reduce((a,d)=>a+d.slides.filter(s=>s.img).length,0), spend:$('spendLine').textContent}));
console.log('conc='+CONC, secs+'s', JSON.stringify(r));
await b.close();
