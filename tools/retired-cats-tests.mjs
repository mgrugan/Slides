/* The client accounts were retired, leaving the four facts categories.

   Removing a category is not just deleting it from the defaults, and the two ways it
   goes wrong are both invisible:

     - a RETURNING user has the old list in localStorage, and the merge that keeps their
       own categories would put every retired one straight back;
     - a saved project remembers its style by position in the array, so deleting presets
       shifts every index after them and the project silently starts merging a different
       style's fields into its own. That is the same class of fault as the one that drew
       twenty history decks in a viral news page's skin.

   Both are checked here, along with the thing that actually matters: the four that
   remain still work, and a category the user made themselves is not collateral. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1500);

const KEPT = ['History','Conspiracy','Terrifying','Science'];
const GONE = ['Peptides (Peptorium)','Pickuplines','Thrifting','iDisney','Obsession','fun',
              'trendpopzz','bestforces'];

const r = await p.evaluate(({KEPT, GONE})=>{
  const out = {};
  out.onlyTheFourRemain = Object.keys(FACT_DEFAULTS).sort().join(',') === KEPT.slice().sort().join(',');
  out.theFourStillHavePrompts = KEPT.every(c => catPrompt(c).length > 100);
  out.theFourAreAllSubjectDriven = KEPT.every(c => catCfg(c).mode === 'subjects' && !catCfg(c).angles);
  out.noneOfTheRetiredAreDefaults = GONE.every(c => !(c in FACT_DEFAULTS));

  // --- the styles that went with them
  const names = PRESETS.map(x=>x.name);
  out.theAccountSkinsAreGone = ['Pickuplines','Thrifting','Fun','Trendpop','iDisney','Obsession','Best Forces']
    .every(n => !names.includes(n));
  out.theFactsStyleRemains = names.includes(FACTS_STYLE);
  out.theGenericStylesRemain = ['Photographic','Flat cartoon','Realistic photo','Watercolour']
    .every(n => names.includes(n));

  // --- and the rotations, which no category uses any more
  out.noRotationsLeft = Object.keys(ANGLE_SETS).length === 0 && Object.keys(ANGLE_PROMPTS).length === 0;
  out.nothingIsAnAnglePage = Object.keys(FACT_DEFAULTS)
    .every(c => !(catCfg(c).mode === 'angles' && angleSet(catCfg(c).angles).length > 0));

  /* --- A SAVED PROJECT finds its style by NAME. The index it also stores is now wrong
     for anything that used to sit after a removed preset, and trusting it would merge
     the wrong style's fields in. */
  out.aStyleIsFoundByName = (()=>{
    const want = PRESETS.find(x=>x.name === FACTS_STYLE);
    return presetFor('preset:99', {name:FACTS_STYLE}) === want;        // nonsense index, right name
  })();
  out.aStaleIndexIsNotTrusted = presetFor('preset:1', {name:'Thrifting'}) === null;
  out.anIndexStillWorksWhenThereIsNoName = (()=>{
    return presetFor('preset:0', {}) === PRESETS[0];                   // a project from before names
  })();
  out.aRetiredStyleLeavesTheProjectAlone = (()=>{
    /* Someone's saved Thrifting project still opens: its own stored copy of the style
       is complete, so it draws as it always did, and nothing is merged into it. */
    const keep = S.profile, keyWas = S.styleKey;
    S.profile = {name:'Thrifting', title_size_pct:0.064, caption_treatment:'documentary', v:4};
    S.styleKey = 'preset:6';
    const added = refreshBuiltinProfile();
    const intact = S.profile.name === 'Thrifting' && S.profile.title_size_pct === 0.064;
    S.profile = keep; S.styleKey = keyWas;
    return added.length === 0 && intact;
  })();
  return out;
}, {KEPT, GONE});

// --- a returning user's saved list must not resurrect them
const returning = await p.evaluate(({GONE})=>{
  const saved = {History:'x', Terrifying:'y'};
  GONE.forEach(c=>{ saved[c] = 'a stale client prompt'; });
  saved['My Own Category'] = 'something the user wrote themselves';
  localStorage.setItem('cb.factCats', JSON.stringify(saved));
  return true;
}, {GONE});
await p.reload();
await p.waitForTimeout(1500);
const after = await p.evaluate(({KEPT, GONE})=>({
  listed: [...document.getElementById('factCat').options].map(o=>o.value),
  retiredBack: GONE.filter(c => c in FACT_CATS),
  keptPresent: KEPT.every(c => c in FACT_CATS),
  ownKept: FACT_CATS['My Own Category'] === 'something the user wrote themselves',
  ownEditToAKeptOneSurvives: FACT_CATS['History'] === 'x'
}), {KEPT, GONE});
await b.close();

const want = {
  onlyTheFourRemain:true, theFourStillHavePrompts:true, theFourAreAllSubjectDriven:true,
  noneOfTheRetiredAreDefaults:true,
  theAccountSkinsAreGone:true, theFactsStyleRemains:true, theGenericStylesRemain:true,
  noRotationsLeft:true, nothingIsAnAnglePage:true,
  aStyleIsFoundByName:true, aStaleIndexIsNotTrusted:true, anIndexStillWorksWhenThereIsNoName:true,
  aRetiredStyleLeavesTheProjectAlone:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(36) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
const checks = {
  retiredStayGoneForAReturningUser: after.retiredBack.length === 0,
  theFourAreStillListed: after.keptPresent,
  aUserMadeCategorySurvives: after.ownKept,
  andTheirEditsToTheFourSurvive: after.ownEditToAKeptOneSurvives
};
for(const [k,v] of Object.entries(checks)){
  if(!v) bad++;
  console.log((v?'  ok  ':'FAIL  ') + k.padEnd(36) + JSON.stringify(v));
}
console.log('  ·   dropdown for a returning user: ' + after.listed.join(', '));
if(after.retiredBack.length) console.log('  ·   came back: ' + after.retiredBack.join(', '));
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
