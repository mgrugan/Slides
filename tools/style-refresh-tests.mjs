import { chromium } from 'playwright-core';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs=[]; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1200);
const r = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment==='documentary');
  // a v1 project: old image brief, and hand-tuned typography that must survive
  const old = JSON.parse(JSON.stringify(PRESETS[di]));
  delete old.v; delete old.shot_ladder;
  old.image_prompt_suffix = 'authentic archival documentary photograph, period-accurate clothing equipment and setting.';
  old.font_size_pct = 0.123; old.text_color = '#FF0000';       // user edits
  S.profile = old; S.styleKey = 'preset:'+di;
  const want = PRESETS[di].v;                                  // whatever the preset is on now
  const added = refreshBuiltinProfile();
  return {added,
    briefRefreshed: !/equipment/.test(S.profile.image_prompt_suffix),
    ladderOn: S.profile.shot_ladder === true,
    version: S.profile.v, want,
    editsKept: S.profile.font_size_pct === 0.123 && S.profile.text_color === '#FF0000',
    // running it twice must be a no-op
    secondRun: (()=>refreshBuiltinProfile())().length};
});
const fail=[];
if(!r.briefRefreshed) fail.push('old image brief survived the version bump');
if(!r.ladderOn) fail.push('shot ladder not picked up');
if(r.version !== r.want) fail.push('version not stamped: '+r.version+' want '+r.want);
if(!r.editsKept) fail.push('typography edits were clobbered');
if(r.secondRun !== 0) fail.push('refresh is not idempotent');
console.log(JSON.stringify({...r, errs},null,1));
console.log(fail.length ? 'FAIL\n'+fail.map(f=>' - '+f).join('\n') : 'PASS  prompt fixes reach existing projects, edits survive');
await b.close();
process.exit(fail.length?1:0);
