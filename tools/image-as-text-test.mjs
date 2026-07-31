import { chromium } from 'playwright-core';
/* Reproduces the reported failure exactly: interactions returns the JPEG
   base64 inside a text field, with no inline_data anywhere. */
const stub = () => {
  const mkJpeg = () => {
    const c = document.createElement('canvas'); c.width = 240; c.height = 426;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0,0,0,426); g.addColorStop(0,'#3f7d52'); g.addColorStop(1,'#12301d');
    x.fillStyle = g; x.fillRect(0,0,240,426);
    return c.toDataURL('image/jpeg',0.8).split(',')[1];       // starts with /9j/
  };
  const deck = {slides:[
    {kind:'hook', title:'You still think pump equals growth', scene:'a gym at dawn'},
    {kind:'slide', title:'One', body:'Body copy.', scene:'a barbell'}
  ], caption:'cap'};
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt))
      return J({output:[{content:[{type:'text', text: mkJpeg()}]}]});   // image bytes as "text"
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:JSON.stringify(deck)}]}]});
  };
};
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1000);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape');
await p.fill('#hookInput','You still think pump equals growth');
await p.selectOption('#slideCount','2');
await p.click('#genDeck');
await p.waitForTimeout(4000);
const r = await p.evaluate(()=>({
  statuses: S.slides.map(s=>s.status),
  withImages: S.slides.filter(s=>(s.img||'').startsWith('data:image/jpeg')).length,
  // is the image actually painted onto the canvas, not just stored?
  painted: [...document.querySelectorAll('.card canvas')].map(c=>{
    const d = c.getContext('2d').getImageData(20,20,1,1).data;
    return d[0]+','+d[1]+','+d[2];
  })
}));
await p.locator('.card').first().screenshot({path:'shot-imgfix.png'});
console.log(JSON.stringify({...r, errs}, null, 1));
await b.close();
