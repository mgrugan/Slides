/* "Why do covered subjects eventually disappear — I can't have any repeats."

   They do not, but three things made it look as if they did, and one of them was real.

   Enforcement was never capped: every candidate is checked against the whole ledger, so
   a repeat cannot ship however old the original is. What was capped:

   1. The backup copy. IndexedDB holds everything and is what the page reads; localStorage
      is the fallback and was written with the last 400 entries only. Invisible until the
      day IndexedDB is cleared or evicted — and then the ledger really is its most recent
      400 subjects and the rest are free to come back.
   2. The do-not-repeat list in the prompt: the last 200 entries ACROSS ALL CATEGORIES, so
      running four of them left about fifty per category visible to the model. A repeat
      still could not ship, but the model kept proposing them and each one cost a call.
   3. The on-screen list shows 120 and said nothing about the rest, which is what the
      question was actually about.

   This suite holds all three, and each assertion is paired with the measurement that
   fails if the fix is removed. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1500);

const r = await p.evaluate(async ()=>{
  const out = {};
  // a year of work: 1,000 subjects over four categories, oldest first
  const CATS = ['History','Conspiracy','Terrifying','Science'];
  LEDGER.length = 0;
  for(let i = 0; i < 1000; i++)
    LEDGER.push({subject: 'Zelphine Vorlund the ' + i + 'th expedition', title: '',
                 cat: CATS[i % 4], date: Date.now() - (1000 - i) * 3600e3});
  const oldest = LEDGER[0].subject, oldestHistory = LEDGER[0];     // index 0 is History
  await saveLedger();

  // --- 1. enforcement reaches the whole ledger, not a recent window
  out.theOldestSubjectIsStillBlocked = ledgerHas(oldest);
  out.andSoIsALooseRewordingOfIt = ledgerHas('Zelphine Vorlund 0th expedition');
  out.somethingNewIsNotBlocked = !ledgerHas('The Okhotsk relief convoy of 1903');
  out.addingARepeatIsARefusal = await (async ()=>{
    const before = LEDGER.length;
    await ledgerAdd(oldest, 't', 'History');
    return LEDGER.length === before;
  })();

  // --- 2. the backup copy holds all of it
  const backup = JSON.parse(localStorage.getItem('cb.ledger') || '[]');
  out.theBackupHoldsEverything = backup.length === LEDGER.length;
  out.backupCount = backup.length + ' of ' + LEDGER.length;
  out.theBackupStartsAtTheOldest = backup[0] && backup[0].subject === oldest;
  out.anOldCopyWouldHaveLostIt = 400 < LEDGER.length;   // what the previous cap kept

  // and a reload with IndexedDB gone recovers every one of them
  out.aReloadWithoutTheDatabaseKeepsThemAll = await (async ()=>{
    const keep = window.idbGet;
    window.idbGet = async k => k === 'ledger' ? [] : keep(k);
    LEDGER.length = 0;
    await loadLedger();
    window.idbGet = keep;
    return LEDGER.length === 1000 && ledgerHas(oldest);
  })();

  // --- and when the browser genuinely refuses the write, it shrinks and says so
  out.aRefusedWriteShrinksAndIsReported = await (async ()=>{
    const realSet = localStorage.setItem.bind(localStorage);
    const said = [];
    const keepLog = window.log;
    window.log = (m, k) => { said.push(String(m)); };
    localStorage.setItem = (k, v) => {
      if(k === 'cb.ledger' && v.length > 20000) throw new DOMException('quota', 'QuotaExceededError');
      return realSet(k, v);
    };
    LEDGER_TRIMMED = 0;
    await saveLedger();
    localStorage.setItem = realSet;
    window.log = keepLog;
    const held = JSON.parse(localStorage.getItem('cb.ledger') || '[]').length;
    out.whenRefused = 'kept ' + held + ', warned: ' + (said.find(m=>/ledger/.test(m)) || 'nothing');
    return held > 0 && held < 1000 &&
           said.some(m => /could only hold/.test(m) && /export the ledger/.test(m));
  })();

  // --- 3. the prompt's avoid list is this category's own history, and deep
  const avoidFor = async cat => {
    let sent = '';
    const keep = window.callModel;
    window.callModel = async o => { sent = o.parts[0].text; throw new Error('stop'); };
    try{ await pickSubjects(cat, '', 4); }catch(e){}
    window.callModel = keep;
    return sent;
  };
  const sent = await avoidFor('History');
  const listed = (sent.match(/ALREADY COVERED[\s\S]*?(?=\nReturn ONLY)/) || [''])[0];
  out.theModelIsToldAboutThisCategorysOldest = listed.includes(oldestHistory.subject);
  out.andNotAboutAnotherCategorys = !listed.includes(LEDGER.find(e=>e.cat === 'Conspiracy').subject);
  out.listedCount = (listed.match(/\n  · /g) || []).length;
  /* Discrimination: the old rule — the last 200 entries across all categories — could not
     have named this category's oldest subject, and a quarter of what it did name belonged
     to other pages. If this reads false the suite can no longer see the bug. */
  out.theOldRuleWouldHaveMissedIt = (()=>{
    const oldWay = LEDGER.slice(-200).map(e=>e.subject);
    out.theOldRuleSMix = oldWay.filter(s=>{
      const e = LEDGER.find(x=>x.subject === s); return e && e.cat === 'History';
    }).length + ' of ' + oldWay.length + ' were this category';
    return !oldWay.includes(oldestHistory.subject);
  })();

  // --- 4. and the screen says the rest are still held
  renderLedger();
  const shown = $('ledgerList').querySelectorAll('div').length;
  const note = $('ledgerList').textContent;
  out.theListSaysWhatItIsNotShowing = /newest 120 of 1000/.test(note) &&
                                      /still blocked/.test(note);
  out.theCountIsTheWholeLedger = /1000 covered/.test($('factLedgerCount').textContent);
  out.shown = shown + ' rows for 1000 entries';
  return out;
});
await b.close();

const want = {
  theOldestSubjectIsStillBlocked:true, andSoIsALooseRewordingOfIt:true,
  somethingNewIsNotBlocked:true, addingARepeatIsARefusal:true,
  theBackupHoldsEverything:true, theBackupStartsAtTheOldest:true,
  anOldCopyWouldHaveLostIt:true, aReloadWithoutTheDatabaseKeepsThemAll:true,
  aRefusedWriteShrinksAndIsReported:true,
  theModelIsToldAboutThisCategorysOldest:true, andNotAboutAnotherCategorys:true,
  theOldRuleWouldHaveMissedIt:true,
  theListSaysWhatItIsNotShowing:true, theCountIsTheWholeLedger:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(40) + JSON.stringify(got) +
              (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
console.log('  ·   backup ' + r.backupCount + ' · ' + r.whenRefused);
console.log('  ·   told the model about ' + r.listedCount + ' subjects · the old rule: ' + r.theOldRuleSMix);
console.log('  ·   ' + r.shown);
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
