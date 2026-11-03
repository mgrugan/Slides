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

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
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
  out.theRoundReachesFurtherWhenItComesBackDry = await (async ()=>{
    /* A round that adds nothing means the category is crowded, and asking the same way
       again gets the same answer. With a cap on what one reply may be asked for, the
       round reaches further by making MORE calls rather than a bigger one — so what is
       measured is the size of the wave, with the per-call cap pinned separately. */
    LEDGER.length = 0;
    const keep = window.callModel;
    let calls = 0;
    const waves = [];
    const realAll = Promise.all.bind(Promise);
    Promise.all = (...a) => { waves.push(calls); return realAll(...a); };
    window.callModel = async () => { calls++;
      return {text: JSON.stringify([{subject:'The Same Story Every Time', claim:'c'}])}; };
    await pickSubjects('History', '', 50);
    Promise.all = realAll;
    window.callModel = keep;
    const per = waves.map((v, i) => (i + 1 < waves.length ? waves[i+1] : calls) - v).filter(x => x > 0);
    out.callsPerRound = per.join(',');
    return per.length > 1 && per[per.length - 1] > per[0];
  })();
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

  /* --- A REPLY THAT RAN OUT OF ROOM. Asking for fifty subjects in one reply, each
     needing a claim and each having to clear a long bar, is a reply that gets cut off
     with the array still open. JSON.parse fails on it, and the picker used to treat
     that as the end of the run — so clicking 50 returned however many had arrived
     before the first long reply truncated. Both halves are fixed: the objects that DID
     close are salvaged, and a reply nobody can read costs one call rather than the run. */
  /* Subject names that are genuinely distinct to the DEDUPER, not just to a human.
     Two stand-ins called "Reply 7 Subject 3" and "Reply 7 Subject 5" share "reply",
     "subject" and the 7, and the rare-token rule correctly reads them as one subject —
     so a lazily-named stub measures the tokeniser instead of the picker. Every name
     here is built from two invented words that appear nowhere else. */
  let wordN = 0;
  const uniqueName = () => { const a = 'zel' + (wordN++).toString(36) + 'ix';
                             const b = 'vorn' + (wordN++).toString(36) + 'ad';
                             return a + ' ' + b; };
  const truncating = completes => {
    let call = 0;
    return async o => {
      call++;
      const asked = +(/Pick (\d+) subjects/.exec(o.parts[0].text) || [0,0])[1];
      const items = [];
      for(let i = 0; i < Math.min(asked, completes); i++)
        items.push('{"subject":"' + uniqueName() + '","claim":"a claim"}');
      // ran out of room mid-object, so no closing bracket — exactly what a cut reply is
      return {text: '[' + items.join(',') + (asked > completes ? ',{"subject":"Subj' : ']')};
    };
  };
  /* A picker that throws is itself a regression — it is what the old code did on the
     first truncated reply — so it is reported as a failed expectation rather than
     allowed to take the whole suite down with it. */
  const withModel = async (fn, want) => {
    LEDGER.length = 0;
    const keep = window.callModel;
    let calls = 0;
    window.callModel = async o => { calls++; return fn(o); };
    try{
      const got = await pickSubjects('History', '', want);
      return {n: got.length, calls, unique: new Set(got.map(x=>x.subject)).size};
    }catch(e){
      return {n: 0, calls, unique: 0, threw: e.message};
    }finally{ window.callModel = keep; }
  };

  // extractJSON throws when it cannot salvage, which is the regression — catch it so
  // the suite reports a failed expectation instead of dying on the first one
  const parsed = t => { try{ return extractJSON(t, true); }catch(e){ return null; } };
  out.salvagesATruncatedList = (()=>{
    const v = parsed('[{"subject":"A","claim":"x"},{"subject":"B","claim":"y"},{"subject":"C');
    return !!v && v.length === 2 && v[1].subject === 'B';
  })();
  out.aBraceInsideAStringIsNotAnObject = (()=>{
    const v = parsed('[{"subject":"A {weird} name","claim":"x"},{"subject":"B","claim":"y"},{"sub');
    return !!v && v.length === 2 && v[0].subject === 'A {weird} name';
  })();
  out.aCompleteListIsStillParsedWhole = (parsed('[{"subject":"A"},{"subject":"B"}]')||[]).length === 2;

  const cut25 = await withModel(truncating(25), 50);
  out.fiftyArrivesWhenRepliesAreCutAt25 = cut25.n === 50 && cut25.unique === 50;
  const cut8 = await withModel(truncating(8), 50);
  out.fiftyArrivesWhenRepliesAreCutAt8 = cut8.n === 50 && cut8.unique === 50;
  out.aSmallRunStillTakesOneCall = (await withModel(truncating(25), 10)).calls === 1;

  out.oneUnreadableReplyDoesNotEndTheRun = await (async ()=>{
    /* Every third reply is junk. The run must route around it rather than stop. */
    let call = 0;
    const flaky = async o => {
      call++;
      if(call % 3 === 0) return {text:'I am sorry, I cannot help with that request.'};
      const asked = +(/Pick (\d+) subjects/.exec(o.parts[0].text) || [0,0])[1];
      return {text: JSON.stringify(Array.from({length:asked}, ()=>
        ({subject: uniqueName(), claim:'c'})))};
    };
    const got = await withModel(flaky, 50);
    return got.n === 50;
  })();
  out.allGarbageStillFailsClearly = await (async ()=>{
    LEDGER.length = 0;
    const keep = window.callModel;
    window.callModel = async () => ({text:'I cannot help with that'});
    let msg = '';
    try{ await pickSubjects('History', '', 50); }catch(e){ msg = e.message; }
    window.callModel = keep;
    return /could not read subjects/.test(msg);
  })();

  out.noSingleReplyIsAskedForTooMany = await (async ()=>{
    /* The cap is the point: a reply that is never asked for more than a dozen rarely
       runs out of room in the first place. */
    LEDGER.length = 0;
    const keep = window.callModel;
    let biggest = 0;
    window.callModel = async o => {
      const asked = +(/Pick (\d+) subjects/.exec(o.parts[0].text) || [0,0])[1];
      biggest = Math.max(biggest, asked);
      return {text: JSON.stringify(Array.from({length:asked}, (_,i)=>({subject:'Q'+biggest+'-'+i, claim:'c'})))};
    };
    await pickSubjects('History', '', 50);
    window.callModel = keep;
    out.biggestSingleAsk = biggest;
    return biggest <= PICK_CHUNK;
  })();
  out.unreadableRepliesAreReported = /replies unreadable/.test(
    shortfallLine(50, 20, {returned:20, covered:0, repeated:0, unreadable:4}));

  /* --- THE CEILING. Asking one question repeatedly does not produce more answers: a
     model has a finite set of subjects it considers good enough for a given line of
     questioning, and the avoid list only rules out what it already said. Measured
     against a stub with a pool of twelve, a run for fifty returned twelve and burned
     twenty calls getting there — which is the behaviour that was reported twice.

     The fix is to ask different questions. Each call in a wave carries its own lens —
     an era, a region, a field — so the calls cannot converge, and the rounds keep
     moving along the list. */
  const pooled = perLens => {
    return async o => {
      const prompt = o.parts[0].text;
      const asked = +(/Pick (\d+) subjects/.exec(prompt) || [0,0])[1];
      const lens = (/WHERE TO LOOK THIS TIME: ([^.]+)\./.exec(prompt) || [0,''])[1];
      const avoid = new Set();
      const m = prompt.match(/ALREADY COVERED[^]*?(?=\nReturn ONLY|$)/);
      if(m) m[0].split('\n').forEach(l=>{ const t = l.replace(/^\s*·\s*/,'').trim(); if(t) avoid.add(t); });
      const tag = lens.replace(/[^a-z]/gi,'').slice(0,8).toLowerCase() || 'none';
      const universe = Array.from({length: perLens}, (_,i)=>
        ({subject:'zel'+tag+i.toString(36)+'ix vorn'+tag+(i*7).toString(36)+'ad', claim:'c'}));
      return {text: JSON.stringify(universe.filter(x=>!avoid.has(x.subject)).slice(0, asked))};
    };
  };
  const withFocus = async (fn, want, focus) => {
    LEDGER.length = 0;
    const keep = window.callModel;
    let calls = 0;
    window.callModel = async o => { calls++; return fn(o); };
    try{ const got = await pickSubjects('History', focus || '', want);
         return {n: got.length, calls, unique: new Set(got.map(x=>x.subject)).size}; }
    catch(e){ return {n:0, calls, unique:0, threw:e.message}; }
    finally{ window.callModel = keep; }
  };

  out.everyCallInAWaveAsksSomethingDifferent = await (async ()=>{
    LEDGER.length = 0;
    const keep = window.callModel;
    const lenses = [];
    window.callModel = async o => {
      lenses.push((/WHERE TO LOOK THIS TIME: ([^.]+)\./.exec(o.parts[0].text) || [0,''])[1]);
      return {text:'[]'};
    };
    await pickSubjects('History', '', 50);
    window.callModel = keep;
    const firstWave = lenses.slice(0, 5);
    out.lensesSeen = lenses.length;
    return firstWave.every(x => x) && new Set(firstWave).size === firstWave.length;
  })();
  out.theLensNeverReplacesTheCategory = await (async ()=>{
    LEDGER.length = 0;
    const keep = window.callModel;
    let sent = '';
    window.callModel = async o => { sent = o.parts[0].text; return {text:'[]'}; };
    await pickSubjects('History', '', 12);
    window.callModel = keep;
    return /CATEGORY — History/.test(sent) && /not a replacement for/.test(sent) &&
           /rather than forcing something weak to fit/.test(sent);
  })();

  const thin = await withFocus(pooled(4), 50);
  out.fiftyArrivesWhenEachLensIsThin = thin.n === 50 && thin.unique === 50;
  const rich = await withFocus(pooled(12), 50);
  out.andFewerCallsWhenTheyAreNot = rich.n === 50 && rich.calls < thin.calls;
  out.callsForFifty = thin.calls + ' thin · ' + rich.calls + ' rich';
  out.aSmallRunIsStillCheap = (await withFocus(pooled(8), 10)).calls <= 2;

  out.aTypedFocusStillGetsItsFifty = await (async ()=>{
    /* The focus and the lens compose. Dropping the lens when somebody typed a focus put
       that run back on one line of questioning and straight back into the ceiling. */
    const got = await withFocus(pooled(12), 50, 'shipwrecks');
    return got.n === 50;
  })();
  out.andTheFocusSurvivesTheLens = await (async ()=>{
    LEDGER.length = 0;
    const keep = window.callModel;
    let sent = '';
    window.callModel = async o => { sent = o.parts[0].text; return {text:'[]'}; };
    await pickSubjects('History', 'shipwrecks', 12);
    window.callModel = keep;
    return /FOCUS: shipwrecks/.test(sent) && /WHERE TO LOOK THIS TIME/.test(sent) &&
           /the focus and category above/.test(sent);
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
  theOldLimitsWouldHaveFallenShort:true, theRoundReachesFurtherWhenItComesBackDry:true,
  theBriefSaysTheCountIsNotNegotiable:true,
  aShortRunIsReported:true, itSaysHowManyCameBack:true, itNamesTooFewReturned:true,
  itNamesTheLedgerWhenThatIsTheCause:true, itNamesTheModelRepeatingItself:true,
  theThreeCausesReadDifferently:true,
  theScanSweepsAgain:true, theScanReportsItsShortfall:true,
  theScanTopsUpToTheNumber:true, scanReturned:10,
  theAnglePickerPersistsToo:true,
  everyCallInAWaveAsksSomethingDifferent:true, theLensNeverReplacesTheCategory:true,
  fiftyArrivesWhenEachLensIsThin:true, andFewerCallsWhenTheyAreNot:true,
  aSmallRunIsStillCheap:true, aTypedFocusStillGetsItsFifty:true, andTheFocusSurvivesTheLens:true,
  salvagesATruncatedList:true, aBraceInsideAStringIsNotAnObject:true,
  aCompleteListIsStillParsedWhole:true,
  fiftyArrivesWhenRepliesAreCutAt25:true, fiftyArrivesWhenRepliesAreCutAt8:true,
  aSmallRunStillTakesOneCall:true, oneUnreadableReplyDoesNotEndTheRun:true,
  allGarbageStillFailsClearly:true, noSingleReplyIsAskedForTooMany:true,
  unreadableRepliesAreReported:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(36) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log('  ·   calls to reach 50: ' + r.callsForFifty);
console.log('  ·   biggest single ask on a run of 50: ' + r.biggestSingleAsk +
            ' · calls per round when dry: ' + r.callsPerRound);
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
