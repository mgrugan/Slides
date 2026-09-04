/* A plain facts category must be drawn in the documentary layout, whatever was on
   screen a moment earlier.

   This broke the day the second documentary style existed. The rule was "if the loaded
   style is already documentary, leave it" — which meant "already the right one" when
   the documentary preset was the only one, and means "possibly a client skin" now that
   five client accounts are documentary too. Running @fun and then Conspiracy drew the
   history page in the news page's lime.

   So the test is not "does History pick a documentary style" — it always did. It is
   "does History pick THE documentary style, starting from each of the client skins in
   turn", which is the case that was wrong. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {};
  const PLAIN = ['History','Conspiracy','Terrifying','Science'];
  const CLIENTS = ['Fun','Trendpop','Obsession','Thrifting','iDisney','Pickuplines'];

  out.theDefaultExists = PRESETS.some(x => x.name === FACTS_STYLE);
  out.plainCategoriesNameNoStyle = PLAIN.every(c => !catCfg(c).style);
  out.clientCategoriesDoNameOne = ['fun','trendpopzz','Obsession','Thrifting','iDisney','Pickuplines']
    .every(c => !!catCfg(c).style);

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

  // --- the bug: a plain page opened straight after any client page
  const wrong = [];
  for(const cat of PLAIN)
    for(const from of CLIENTS){
      const got = await styleFor(cat, from);
      if(got !== FACTS_STYLE) wrong.push(cat + ' after ' + from + ' → ' + got);
    }
  out.plainPagesAlwaysGetTheFactsStyle = wrong.length === 0;
  out.whatWentWrong = wrong.slice(0, 4).join(' | ');

  // --- and from a non-documentary style, which always worked
  out.plainPagesFromAPlainStart = await styleFor('History', 'Photographic') === FACTS_STYLE;

  // --- the client pages still get their own, including after each other
  const clientOK = [];
  for(const [cat, want] of [['fun','Fun'], ['trendpopzz','Trendpop'], ['Obsession','Obsession'],
                            ['Thrifting','Thrifting'], ['iDisney','iDisney'], ['Pickuplines','Pickuplines']])
    clientOK.push(await styleFor(cat, 'Fun') === want);
  out.clientPagesKeepTheirSkin = clientOK.every(Boolean);
  out.clientPagesFromAPlainStart = await styleFor('trendpopzz', 'Documentary facts') === 'Trendpop';

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
  theDefaultExists:true, plainCategoriesNameNoStyle:true, clientCategoriesDoNameOne:true,
  plainPagesAlwaysGetTheFactsStyle:true, whatWentWrong:'',
  plainPagesFromAPlainStart:true,
  clientPagesKeepTheirSkin:true, clientPagesFromAPlainStart:true,
  liveEditsToTheFactsStyleSurvive:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(32) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
