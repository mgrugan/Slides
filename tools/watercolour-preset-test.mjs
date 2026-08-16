import { chromium } from 'playwright-core';
import fs from 'fs';
const REF = fs.readdirSync('/root/.claude/uploads/52ad29f1-ecfc-555a-b76d-09c17dd971e1')
  .map(f=>'/root/.claude/uploads/52ad29f1-ecfc-555a-b76d-09c17dd971e1/'+f)
  .sort((a,b)=>fs.statSync(b).mtimeMs-fs.statSync(a).mtimeMs)[0];
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1200);
await p.keyboard.press('Escape'); await p.waitForTimeout(300);

const ref = 'data:image/jpeg;base64,' + fs.readFileSync(REF).toString('base64');
const info = await p.evaluate(async (ref)=>{
  // select the Watercolour preset
  const i = PRESETS.findIndex(x=>x.name==='Watercolour');
  applyStyle('preset:'+i, PRESETS[i]);
  await fontReady(S.profile);
  // a cover + a body slide, using the reference art as the background
  loadDeck({slides:[
    {kind:'hook',  title:'5 Habits That Separate Fighters Who Improve From Fighters Who Plateau', scene:'x'},
    {kind:'slide', title:'You spar to win', body:'You treat every round like a fight. Fighters who improve use rounds to test one thing. That is why their skills move and yours do not.', scene:'x'}
  ], caption:'c'});
  for(const s of S.slides) setImage(s, ref);
  await new Promise(r=>setTimeout(r, 900));
  drawAll();
  return {preset: S.profile.name, font: S.profile.font_family, aspect: S.profile.aspect_ratio,
          shadow: S.profile.shadow_color, treat: S.profile.caption_treatment,
          dims: [...document.querySelectorAll('.card canvas')].map(c=>c.width+'x'+c.height)};
}, ref);
await p.waitForTimeout(1500);
await p.locator('.card').first().screenshot({path:'wc-hook.png'});
await p.locator('.card').nth(1).screenshot({path:'wc-body.png'});
await p.click('#btnStyle'); await p.waitForTimeout(500);
await p.screenshot({path:'wc-styles.png'});
console.log(JSON.stringify({ref:REF.split('/').pop(), ...info, errs}, null, 1));
await b.close();
