import { chromium } from 'playwright-core';
import fs from 'fs';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1200); await p.keyboard.press('Escape');

const r = await p.evaluate(async ()=>{
  const make = (borderPct, borderCol) => {
    const c = document.createElement('canvas'); c.width=400; c.height=500;
    const x = c.getContext('2d');
    x.fillStyle = borderCol; x.fillRect(0,0,400,500);
    const bw = Math.round(400*borderPct), bh = Math.round(500*borderPct);
    // a busy photograph inside the margin
    const g = x.createLinearGradient(0,bh,0,500-bh); g.addColorStop(0,'#666'); g.addColorStop(1,'#111');
    x.fillStyle = g; x.fillRect(bw,bh,400-2*bw,500-2*bh);
    x.fillStyle = '#bbb';
    for(let i=0;i<120;i++) x.fillRect(bw+Math.random()*(400-2*bw), bh+Math.random()*(500-2*bh), 7, 4);
    return c.toDataURL('image/jpeg',0.92);
  };
  const load = src => new Promise(res=>{ const im=new Image(); im.onload=()=>{ measureCrop(im); res(im); }; im.src=src; });

  const white = await load(make(0.06,'#f4f2ee'));   // white paper margin, like the reported ones
  const black = await load(make(0.05,'#050505'));   // letterboxed
  const clean = await load(make(0.0,'#000000'));    // nothing to trim

  // does the render actually lose the border?
  const edgeLum = (im) => {
    const s = {id:'t', kind:'slide', title:'T', body:'B', scene:''};
    IMG_CACHE['t'] = im;
    const c = document.createElement('canvas');
    renderSlide(s, c, S.profile, 1);
    const x = c.getContext('2d'); const d = x.getImageData(0,0,c.width,20).data;
    let sum=0; for(let i=0;i<d.length;i+=4) sum += (d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114)/255;
    return +(sum/(d.length/4)).toFixed(3);
  };
  const withTrim = edgeLum(white);
  localStorage.setItem('cb.edgeTrim','0'); measureCrop(white);
  const withoutTrim = edgeLum(white);
  localStorage.setItem('cb.edgeTrim','1'); measureCrop(white);

  return {
    whiteCrop: white._crop, blackCrop: black._crop, cleanCrop: clean._crop,
    whiteTrimmedPct: white._crop ? +(100*white._crop.sx/white.naturalWidth).toFixed(1) : 0,
    topEdgeLum_trimmed: withTrim, topEdgeLum_untrimmed: withoutTrim
  };
});
console.log(JSON.stringify({...r, errs}, null, 1));
await b.close();
