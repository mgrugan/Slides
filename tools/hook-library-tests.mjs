import { chromium } from 'playwright-core';
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));

// simulate an existing user whose saved category prefs predate the new group
await p.addInitScript(()=>{ localStorage.setItem('cb.cats', JSON.stringify(['Educational','Storytelling'])); localStorage.setItem('cb.niche','golfers'); });
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(900);
await p.keyboard.press('Escape');   // first-run settings drawer
await p.waitForTimeout(300);

const data = await p.evaluate(()=>{
  const nums = HOOK_DATA.filter(h=>h.c==='Numbered');
  return {
    total: HOOK_DATA.length,
    numbered: nums.length,
    unique: new Set(nums.map(h=>h.t)).size,
    cats: [...new Set(HOOK_DATA.map(h=>h.c))],
    leadingCount: nums.filter(h=>/^\d+\b/.test(h.t)).length,
    placeholders: nums.filter(h=>/\(insert/.test(h.t)).length,
    sample: nums.slice(0,3).map(h=>h.t)
  };
});
// migration: legacy prefs kept, new group on
const chips = await p.$$eval('#catBox button', bs=>bs.map(b=>b.textContent.trim()+':'+(b.classList.contains('on')?'on':'off')));

// counting hook drives the slide count
await p.fill('#hookInput','7 hacks to break 90 in 30 days');
await p.waitForTimeout(200);
const count7 = await p.inputValue('#slideCount');
await p.fill('#hookInput','12 golf tips for beginners');
await p.waitForTimeout(200);
const count12 = await p.inputValue('#slideCount');
await p.fill('#hookInput','30 days of putting practice');
await p.waitForTimeout(200);
const count30 = await p.inputValue('#slideCount');

// toggling persists as an OFF list (chips live behind Suggest > which styles)
await p.evaluate(()=>$('suggestPanel').classList.remove('hide'));
await p.waitForTimeout(200);
await p.click('#modeA details summary');
await p.waitForTimeout(200);
await p.click('#catBox button[data-cat="Numbered"]');
await p.waitForTimeout(150);
const stored = await p.evaluate(()=>localStorage.getItem('cb.catsOff'));
console.log(JSON.stringify({data, chips, count7, count12, count30, stored, errs}, null, 1));
await b.close();
