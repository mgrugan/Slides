import { chromium } from 'playwright-core';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1200);
const r = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment==='documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;
  const mkDeck = (subject, n) => {
    const deck = {id:'d-'+subject, subject, slides:[]};
    deck.slides = Array.from({length:n},(_,i)=>({id:subject+i, kind:i?'slide':'hook',
      title:'t'+i, scene:'scene '+i, tone:'mono', _deck:deck}));
    return deck;
  };
  const d1 = mkDeck('Mad Jack Churchill', 6), d2 = mkDeck('The Radium Girls', 6);
  const shots = d => d.slides.map(s=>shotSuffix(S.profile, s).trim());
  // an untoned, non-documentary style must be untouched
  const golf = PRESETS[0];
  const golfShot = shotSuffix(golf, {kind:'slide', id:'g', scene:'x'});
  return {
    d1: shots(d1), d2: shots(d2),
    d1Unique: new Set(shots(d1).slice(1)).size,
    sameStart: shots(d1)[1] === shots(d2)[1],
    coverIsCover: /most arresting/.test(shots(d1)[0]) && /most arresting/.test(shots(d2)[0]),
    golfShot,
    stable: shotSuffix(S.profile, d1.slides[2]) === shotSuffix(S.profile, d1.slides[2]),
    samplePrompt: imagePrompt(d1.slides[2]).slice(0,260)
  };
});
const fail=[];
if(r.d1Unique !== 5) fail.push('body slides repeat a shot: '+r.d1Unique+'/5 unique');
if(r.sameStart) fail.push('two different decks start on the same shot');
if(!r.coverIsCover) fail.push('cover did not get the cover instruction');
if(r.golfShot !== '') fail.push('shot ladder leaked into a style that did not ask for it');
if(!r.stable) fail.push('shot is not stable across calls');
console.log(JSON.stringify(r,null,1));
console.log(fail.length ? 'FAIL\n'+fail.map(f=>' - '+f).join('\n') : 'PASS  every slide gets its own camera');
await b.close();
process.exit(fail.length?1:0);
