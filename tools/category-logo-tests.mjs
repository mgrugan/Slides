/* Each fact category carries its own mark: a History deck and a Terrifying deck are
   different accounts wearing the same layout. A category with no logo of its own falls
   back to the single global one, so leaving them unset breaks nothing. */
import { chromium } from 'playwright-core';
import fs from 'fs';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1400);

const r = await p.evaluate(async ()=>{
  // a distinct flat mark per category, plus a transparent corner to prove PNG survives
  const mark = (css) => {
    const c = document.createElement('canvas'); c.width = c.height = 200;
    const x = c.getContext('2d');
    x.fillStyle = css; x.beginPath(); x.arc(100,100,96,0,7); x.fill();
    return c.toDataURL('image/png');
  };
  CAT_LOGOS = {History: mark('#20c020'), Terrifying: mark('#c02020')};
  await cacheCatLogos();

  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  // the global logo, used by anything with no mark of its own
  LOGO_IMG = new Image(); LOGO_IMG.src = mark('#2020c0');
  await new Promise(res=>{ LOGO_IMG.onload = res; });

  const deckFor = cat => {
    const d = {id:'d-'+cat, subject:'S', hook:'H', cat, tone:'mono', slides:[]};
    d.slides = [{id:'s-'+cat, kind:'hook', title:'TITLE HERE', scene:'x', tone:'mono', _deck:d}];
    return d;
  };
  const hist = deckFor('History'), terr = deckFor('Terrifying'), sci = deckFor('Science');

  const draw = (deck) => {
    const c = document.createElement('canvas');
    renderSlide(deck.slides[0], c, S.profile, 1);
    return c;
  };
  // sample the middle of the divider gap, where the mark sits
  const markPixel = (c) => {
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    // find the divider mark by scanning the band the cover rule occupies
    let best = null;
    for(let y = Math.round(H*0.55); y < Math.round(H*0.95); y++){
      const d = g.getImageData(Math.round(W/2), y, 1, 1).data;
      const sat = Math.max(d[0],d[1],d[2]) - Math.min(d[0],d[1],d[2]);
      if(sat > 60){ best = [d[0],d[1],d[2]]; break; }
    }
    return best;
  };
  const green = px => px && px[1] > px[0] && px[1] > px[2];
  const red   = px => px && px[0] > px[1] && px[0] > px[2];
  const blue  = px => px && px[2] > px[0] && px[2] > px[1];

  const hc = draw(hist), tc = draw(terr), sc = draw(sci);

  // resolution, without drawing
  const resolves = {
    history: logoFor(hist.slides[0]) === LOGO_CACHE['History'],
    terrifying: logoFor(terr.slides[0]) === LOGO_CACHE['Terrifying'],
    scienceFallsBack: logoFor(sci.slides[0]) === LOGO_IMG,
    noDeckFallsBack: logoFor({id:'x', kind:'hook'}) === LOGO_IMG
  };

  // transparency must survive the resize
  const png = await makeThumb(mark('#20c020'), 512, 'image/png');
  const jpg = await makeThumb(mark('#20c020'), 512);
  const cornerAlpha = await new Promise(res=>{
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im,0,0);
      res(c.getContext('2d').getImageData(2,2,1,1).data[3]);
    };
    im.src = png;
  });

  return {
    resolves,
    historyIsGreen: green(markPixel(hc)),
    terrifyingIsRed: red(markPixel(tc)),
    scienceIsGlobalBlue: blue(markPixel(sc)),
    pngKeepsTransparency: cornerAlpha === 0,
    pngIsPng: png.startsWith('data:image/png'),
    jpgStillJpg: jpg.startsWith('data:image/jpeg'),
    uiExists: !!($('factLogoPick') && $('factLogoClear') && $('factLogoImg')),
    shot: hc.toDataURL('image/jpeg', 0.85)
  };
});

fs.writeFileSync('cat-logo.jpg', Buffer.from(r.shot.split(',')[1],'base64'));
delete r.shot;

const fail = [];
for(const [k,v] of Object.entries(r.resolves)) if(!v) fail.push('resolution: '+k);
if(!r.historyIsGreen) fail.push('the History deck did not draw its own mark');
if(!r.terrifyingIsRed) fail.push('the Terrifying deck did not draw its own mark');
if(!r.scienceIsGlobalBlue) fail.push('a category with no mark did not fall back to the global one');
if(!r.pngKeepsTransparency) fail.push('a circular mark lost its transparent corners');
if(!r.pngIsPng) fail.push('logo was not stored as PNG');
if(!r.jpgStillJpg) fail.push('library thumbnails stopped being JPEG');
if(!r.uiExists) fail.push('no per-category logo controls');

console.log(JSON.stringify({...r, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  each category wears its own mark');
await b.close();
process.exit(fail.length ? 1 : 0);
