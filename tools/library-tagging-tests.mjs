import { chromium } from 'playwright-core';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(900);
await p.keyboard.press('Escape');

const r = await p.evaluate(async ()=>{
  // build a synthetic library: golf, gym and kitchen scenes with different tones
  const paint = (fn) => { const c=document.createElement('canvas'); c.width=90; c.height=160;
    fn(c.getContext('2d'), 90, 160); return c.toDataURL('image/jpeg',0.8); };
  const flatBottom = (x,w,h)=>{ x.fillStyle='#7ab87a'; x.fillRect(0,0,w,h);         // busy top, flat bottom
    for(let i=0;i<200;i++){ x.fillStyle='hsl('+(i*7%360)+',70%,50%)'; x.fillRect(Math.random()*w, Math.random()*h*0.33, 4, 4); } };
  const flatTop = (x,w,h)=>{ x.fillStyle='#1d2b1d'; x.fillRect(0,0,w,h);            // flat dark top, busy bottom
    for(let i=0;i<200;i++){ x.fillStyle='hsl('+(i*11%360)+',70%,60%)'; x.fillRect(Math.random()*w, h*0.7+Math.random()*h*0.3, 4, 4); } };
  const seed = [
    ['a wide fairway at dawn with morning mist over the green', flatBottom],
    ['a golfer putting on a fast green near a bunker', flatBottom],
    ['a loaded barbell on a rack in an empty gym at dawn', flatTop],
    ['dumbbells and a bench in a dark commercial gym', flatTop],
    ['a chef chopping vegetables on a wooden kitchen counter', flatTop]
  ];
  for(const [scene, fn] of seed){
    const item = {id: uid(), data: paint(fn), scene, tags: tagsFrom(scene),
      imagery:'photographic', aspect:'9:16', created: Date.now(), used:0};
    await libAdd(item);
    item.stats = await analyzeImage(item.data);
    await libSave(item);
  }
  const tagSample = LIB.map(x=>({scene:x.scene.slice(0,30), tags:x.tags.slice(0,5)}));

  // does a gym slide pick a gym image?
  const gymSlide = {kind:'slide', scene:'a squat rack loaded with plates in a quiet gym', title:'Squat'};
  const golfSlide = {kind:'slide', scene:'an approach shot landing on the fairway', title:'Approach'};
  const gymPick = libPick(new Set(), S.profile, gymSlide);
  const golfPick = libPick(new Set(), S.profile, golfSlide);

  // does caption position steer the choice? text low -> wants a flat bottom band
  const pLow = {...S.profile, text_block_top_pct: 0.75, imagery:'photographic', aspect_ratio:'9:16'};
  const pHigh = {...S.profile, text_block_top_pct: 0.10, imagery:'photographic', aspect_ratio:'9:16'};
  const neutral = {kind:'slide', scene:'', title:''};
  const lowPick = libPick(new Set(), pLow, neutral);
  const highPick = libPick(new Set(), pHigh, neutral);

  return {
    tagSample,
    gymPick: gymPick.scene.slice(0,34), golfPick: golfPick.scene.slice(0,34),
    statsOk: LIB.every(x=>x.stats && x.stats.bands && x.stats.bands.length===3),
    bands: LIB.slice(0,2).map(x=>({scene:x.scene.slice(0,18), sd:x.stats.bands.map(b=>b.sd)})),
    lowPickFlatBottom: lowPick.stats.bands[2].sd < lowPick.stats.bands[0].sd,
    highPickFlatTop: highPick.stats.bands[0].sd < highPick.stats.bands[2].sd,
    noRepeatInDeck: (()=>{ const seen=new Set(); const picks=[];
      for(let i=0;i<3;i++){ const it=libPick(seen, S.profile, gymSlide); seen.add(it.id); picks.push(it.id); }
      return new Set(picks).size === 3; })()
  };
});
// search + tag chips
await p.click('#btnLibrary'); await p.waitForTimeout(400);
const chips = await p.$$eval('#libTags button', b=>b.map(x=>x.textContent));
await p.fill('#libSearch','gym'); await p.waitForTimeout(300);
const filtered = await p.$$eval('#libGrid .libItem', e=>e.length);
await p.fill('#libSearch',''); await p.waitForTimeout(200);
await p.screenshot({path:'ui-lib-tags.png'});
console.log(JSON.stringify({...r, chips, filteredToGym: filtered, errs}, null, 1));
await b.close();
