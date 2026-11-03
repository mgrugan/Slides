/* A plain facts category must be drawn in the documentary layout, whatever was on
   screen a moment earlier.

   This broke the day the second documentary style existed. The rule was "if the loaded
   style is already documentary, leave it" — which meant "already the right one" when the
   documentary preset was the only one, and stopped meaning that once the client skins
   were documentary too. Running @fun and then Conspiracy drew the history page in the
   news page's lime.

   So the test is not "does History pick a documentary style" — it always did. It is
   "does History pick THE documentary style, starting from any other style", which is the
   case that was wrong. The client skins are retired, but a style the user saves from the
   editor can be documentary as well, so the hazard is still reachable and the suite still
   starts from one: a documentary style that is not the facts style. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {};
  const PLAIN = ['History','Conspiracy','Terrifying','Science'];

  out.theDefaultExists = PRESETS.some(x => x.name === FACTS_STYLE);
  out.plainCategoriesNameNoStyle = PLAIN.every(c => !catCfg(c).style);

  /* A documentary style that is NOT the facts style — what a user gets by setting the
     treatment in the editor and saving. This is the start state the old rule mistook for
     "already correct", and it is why the resolution is by name and not by treatment. */
  PRESETS.push(Object.assign(JSON.parse(JSON.stringify(PRESETS[PRESETS.findIndex(x=>x.name === FACTS_STYLE)])),
    {name:'My own documentary', accent:'#d5fd43', glow_color:'#d5fd43',
     title_size_pct:0.072, body_size_pct:0.052}));
  const FROM = PRESETS.map(x=>x.name).filter(n => n !== FACTS_STYLE);
  out.startsFrom = FROM.join(', ');
  out.oneOfThoseStartsIsDocumentary = PRESETS
    .some(x => x.name !== FACTS_STYLE && x.caption_treatment === 'documentary');

  /* Run the style step the way runFacts runs it. Stopping the run right after is what
     keeps this a test of the style choice rather than of the whole writer. */
  const styleFor = async (cat, startFrom) => {
    const si = PRESETS.findIndex(x => x.name === startFrom);
    applyStyle('preset:'+si, PRESETS[si]);
    $('factCat').value = cat;
    const keep = window.callModel;
    window.callModel = async () => { throw new Error('stop here'); };
    try{ await runFacts({}); }catch(e){}
    window.callModel = keep;
    return S.profile.name;
  };

  // --- the bug: a plain page opened straight after some other style
  const wrong = [];
  for(const cat of PLAIN)
    for(const from of FROM){
      const got = await styleFor(cat, from);
      if(got !== FACTS_STYLE) wrong.push(cat + ' after ' + from + ' → ' + got);
    }
  out.plainPagesAlwaysGetTheFactsStyle = wrong.length === 0;
  out.whatWentWrong = wrong.slice(0, 4).join(' | ');

  // --- and the one case that always worked, kept as a control
  out.plainPagesFromAPlainStart = await styleFor('History', 'Photographic') === FACTS_STYLE;

  /* Discrimination: the old rule, applied to the same start state, gets it wrong. If this
     ever reads false the suite has stopped being able to see the bug it was written for. */
  out.theOldRuleWouldStillFailHere = (()=>{
    const si = PRESETS.findIndex(x => x.name === 'My own documentary');
    applyStyle('preset:'+si, PRESETS[si]);
    const oldRuleWouldSwitch = (S.profile.caption_treatment||'') !== 'documentary';
    return !oldRuleWouldSwitch && S.profile.name !== FACTS_STYLE;
  })();

  // --- a live edit to the facts style is not clobbered by running a facts category
  out.liveEditsToTheFactsStyleSurvive = await (async ()=>{
    const si = PRESETS.findIndex(x => x.name === FACTS_STYLE);
    applyStyle('preset:'+si, PRESETS[si]);
    S.profile.title_size_pct = 0.099;
    $('factCat').value = 'History';
    const keep = window.callModel;
    window.callModel = async () => { throw new Error('stop here'); };
    try{ await runFacts({}); }catch(e){}
    window.callModel = keep;
    return S.profile.title_size_pct === 0.099;
  })();
  return out;
});
await b.close();

const want = {
  theDefaultExists:true, plainCategoriesNameNoStyle:true,
  oneOfThoseStartsIsDocumentary:true,
  plainPagesAlwaysGetTheFactsStyle:true, whatWentWrong:'',
  plainPagesFromAPlainStart:true, theOldRuleWouldStillFailHere:true,
  liveEditsToTheFactsStyleSurvive:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(32) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
console.log('  ·   started from: ' + r.startsFrom);
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
