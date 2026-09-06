/* A run has to deliver the number of carousels it was asked for.

   Three pickers feed the three kinds of category and all three had the same shape of
   fault: a couple of thin rounds and they gave up, with a one-line report that said the
   total and nothing about WHY. That matters because the three causes want opposite
   fixes — a model returning too few needs a focus, a ledger rejecting everything needs
   clearing, and a model repeating itself needs steering — and the old message could not
   tell them apart.

   The model is stubbed throughout, and stubbed to behave the way the real one does when
   a run comes up short: thin early rounds, overlap with the ledger, and repeats of
   itself. Testing against a generous stub would prove nothing. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {};
  const logs = [];
  const realLog = window.log;
  window.log = (m, c) => { logs.push(String(m)); realLog(m, c); };

  /* A model that hands back a few new subjects per round and pads the rest with things
     it has already said — which is exactly what a crowded category produces. */
  const thinModel = (fresh, pad) => {
    let call = 0;
    return async () => {
      call++;
      const list = [];
      for(let i = 0; i < fresh; i++) list.push({subject:'Fresh Story ' + call + '-' + i, claim:'c'});
      for(let i = 0; i < pad; i++)   list.push({subject:'Repeated Story ' + i, claim:'c'});
      return {text: JSON.stringify(list)};
    };
  };

  // --- a thin model still fills the run, because the picker keeps going
  out.aThinModelStillFillsTheRun = await (async ()=>{
    LEDGER.length = 0; logs.length = 0;
    const keep = window.callModel;
    window.callModel = thinModel(3, 4);           // 3 new + 4 repeats a round
    const got = await pickSubjects('History', '', 20);
    window.callModel = keep;
    out.howManyCameBack = got.length;
    return got.length === 20;
  })();
  out.andTheyAreAllDifferent = out.howManyCameBack ===
    new Set((await (async ()=>{
      LEDGER.length = 0;
      const keep = window.callModel; window.callModel = thinModel(3, 4);
      const g = await pickSubjects('History', '', 20);
      window.callModel = keep; return g;
    })()).map(x=>x.subject)).size;

  // --- the old limits could not have done that
  out.theOldLimitsWouldHaveFallenShort = (()=>{
    /* Five rounds at three new subjects each is fifteen, and it stopped after two dry
       rounds besides. The numbers are read off the source rather than re-derived, so
       this fails if someone tightens them back. */
    const src = pickSubjects.toString();
    return /round < 8/.test(src) && /dry < 3/.test(src);
  })();
  out.theAskGrowsWhenARoundIsDry = /dry \* need/.test(pickSubjects.toString());
  out.theBriefSaysTheCountIsNotNegotiable = await (async ()=>{
    const keep = window.callModel;
    let sent = '';
    window.callModel = async o => { sent = o.parts[0].text; return {text:'[]'}; };
    LEDGER.length = 0;
    try{ await pickSubjects('History', '', 5); }catch(e){}
    window.callModel = keep;
    return /RETURN ALL \d+\./.test(sent) &&
           /a short list is a failure of searching rather than a sign of standards/.test(sent);
  })();

  // --- and when it genuinely cannot, it says which of the three things went wrong
  const shortRun = async (fresh, pad, ledger) => {
    LEDGER.length = 0;
    (ledger||[]).forEach(sj=>LEDGER.push({subject:sj, title:'', cat:'History', date:Date.now()}));
    logs.length = 0;
    const keep = window.callModel;
    window.callModel = thinModel(fresh, pad);
    const got = await pickSubjects('History', '', 20);
    window.callModel = keep;
    return {got: got.length, log: logs.filter(l=>/asked for 20 carousels/.test(l))[0] || ''};
  };
  /* The three causes, each produced by a model behaving the way that cause looks:
     one new idea a round and nothing rejected; plenty of ideas the ledger already has;
     and the same two ideas over and over. They must not read the same. */
  const starved = await shortRun(1, 0);
  out.aShortRunIsReported = /asked for 20 carousels and got \d+/.test(starved.log);
  out.itSaysHowManyCameBack = /\d+ came back/.test(starved.log);
  out.itNamesTooFewReturned = /returning too few to choose from/.test(starved.log);

  const crowded = await shortRun(0, 6, ['Repeated Story 0','Repeated Story 1','Repeated Story 2',
                                        'Repeated Story 3','Repeated Story 4','Repeated Story 5']);
  out.itNamesTheLedgerWhenThatIsTheCause = /already covered/.test(crowded.log) &&
                                           /crowding this category out/.test(crowded.log);

  const circling = await shortRun(0, 2);
  out.itNamesTheModelRepeatingItself = /repeats of each other/.test(circling.log) &&
                                       /circling the same stories/.test(circling.log);
  out.theThreeCausesReadDifferently = new Set([starved.log, crowded.log, circling.log]).size === 3;

  // --- the news scan sweeps the days again instead of one pass and out
  out.theScanSweepsAgain = /pass < 3/.test(scanNews.toString()) &&
                           /a whole pass added nothing/.test(scanNews.toString());
  out.theScanReportsItsShortfall = /shortfallLine/.test(scanNews.toString());
  out.theScanTopsUpToTheNumber = await (async ()=>{
    LEDGER.length = 0;
    const keep = window.callModel;
    let day = 0;
    // two stories a day on the first sweep, which for 3 days is 6 of the 10 asked for
    window.callModel = async () => {
      day++;
      return {text: JSON.stringify([0,1].map(i=>({subject:'Story '+day+'-'+i, claim:'c',
        person:'P', org:'', source:'s', date:'2026-09-01'})))};
    };
    const got = await scanNews('fun', 10, 3, '2026-09-01');
    window.callModel = keep;
    out.scanReturned = got.length;
    return got.length === 10;
  })();

  // --- the rotation picker got the same treatment
  out.theAnglePickerPersistsToo = /round < 7/.test(pickAngleIdeas.toString()) &&
                                  /dry < 3/.test(pickAngleIdeas.toString()) &&
                                  /dry \* need/.test(pickAngleIdeas.toString());
  window.log = realLog;
  return out;
});
await b.close();

const want = {
  aThinModelStillFillsTheRun:true, howManyCameBack:20, andTheyAreAllDifferent:true,
  theOldLimitsWouldHaveFallenShort:true, theAskGrowsWhenARoundIsDry:true,
  theBriefSaysTheCountIsNotNegotiable:true,
  aShortRunIsReported:true, itSaysHowManyCameBack:true, itNamesTooFewReturned:true,
  itNamesTheLedgerWhenThatIsTheCause:true, itNamesTheModelRepeatingItself:true,
  theThreeCausesReadDifferently:true,
  theScanSweepsAgain:true, theScanReportsItsShortfall:true,
  theScanTopsUpToTheNumber:true, scanReturned:10,
  theAnglePickerPersistsToo:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(36) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
