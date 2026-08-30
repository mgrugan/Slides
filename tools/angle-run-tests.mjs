/* The dating account's run, end to end with the model stubbed out: planning stops for
   review and spends nothing, the approved lines come back as decks of the right shape,
   the cover carries its swipe line, and the ledger records which angle covered what —
   so the next run is told. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1600);

const r = await p.evaluate(async ()=>{
  const out = {}, asked = []; let nth = 0;
  // every reply the run needs, keyed off what the prompt is obviously asking for
  callModel = async ({parts}) => {
    const text = parts[0].text;
    asked.push(text);
    if(/Return ONLY a JSON array/.test(text)){
      const n = +(/exactly (\d+) objects/.exec(text)||[])[1] || 3;
      const list = /THIS BATCH IS ONE ANGLE ONLY — THE ACTUAL WORDS TO SEND/.test(text);
      // subjects that share no word with each other: the ledger treats a rare shared
      // token as the same subject, which is its job and not what is under test here
      return {text: JSON.stringify(Array.from({length:n}, ()=>({
        subject: Math.random().toString(36).slice(2,9),
        // distinct headlines, as the picker's own prompt demands: two identical lines in
        // the panel are one post as far as the ledger is concerned, by design
        claim: (list ? '4 openers that get a reply, take ' : 'She waited nineteen years, take ') + (++nth)
      })))};
    }
    const items = +(/HEADLINE PROMISES (\d+) POINTS/.exec(text)||[])[1] || 0;
    const slides = +(/Write a (\d+)-slide carousel/.exec(text)||[])[1] || 5;
    const body = Array.from({length: items || slides - 1}, (_,i)=>({
      kind:'slide', title:'POINT '+(i+1), body:'A sentence.', scene:'someone on a bus'}));
    if(items) body.push({kind:'slide', title:'YOUR TURN', body:'Which one?', scene:'a bar at closing'});
    return {text: JSON.stringify({
      subject:'Recorded subject', swipe:'The last one is the reason.',
      slides:[{kind:'hook', title:'A COVER LINE', scene:'a hand on a table'}].concat(body),
      caption:'one\n\ntwo\n\nthree\n\n#a #b #c'})};
  };
  LEDGER = []; S.batch = [];
  $('factCat').value = 'Pickuplines'; $('factCat').onchange();
  $('factCount').value = '3'; $('factSlides').value = '6'; $('factSeed').value = '';
  $('factImgToggle').dataset.on = '0';                 // planning and writing only, no pictures
  localStorage.removeItem('cb.angle.pickuplines');

  // ---- stage one: plan. Nothing may be written yet.
  await runFacts();
  out.planShowsPanel = !$('factHookPanel').classList.contains('hide');
  out.planWroteNothing = S.batch.length === 0;
  out.planLines = $('factHookText').value.split('\n').filter(Boolean).length;
  out.planTagged = $('factHookText').value.split('\n').filter(Boolean).every(l=>/^\[[a-z-]+\]\s+\S/.test(l));
  out.planStyle = S.profile.name;                       // the category brought its own look
  out.planLedgerUntouched = LEDGER.length === 0;
  out.plannedAngles = [...new Set($('factHookText').value.split('\n').filter(Boolean)
    .map(l=>/^\[([a-z-]+)\]/.exec(l)[1]))].length;

  // ---- stage two: approve, with one line retagged by hand as the operator might
  const edited = $('factHookText').value.split('\n').filter(Boolean);
  edited.push('6 things nobody tells you about long distance');    // typed from scratch, untagged
  const ideas = parseIdeaLines('pickuplines', edited.join('\n'));
  await runFacts({ideas});

  out.deckCount = S.batch.length;
  out.panelClosed = $('factHookPanel').classList.contains('hide');
  out.allWritten = S.batch.every(d=>d.status === 'written' || d.status === 'partial' || d.status === 'done');
  out.allHaveAngle = S.batch.every(d=>!!d.angle);
  out.allColour = S.batch.every(d=>d.tone === 'colour' && d.slides.every(s=>toneOf(s) === 'colour'));
  out.coversCarrySwipe = S.batch.every(d=>{
    const c = d.slides.find(s=>s.kind === 'hook');
    return c && c.swipe === 'The last one is the reason.';
  });
  // a list deck delivers its promised count and keeps the closing ask on the end
  out.hooksAreTheApproved = S.batch.every(d=>d.hook !== 'A COVER LINE');
  const listDeck = S.batch.find(d=>d.kind === 'list' && hookItemCount(d.hook) === 6);
  out.listBody = listDeck ? listDeck.slides.filter(s=>s.kind !== 'hook').length : -1;
  out.listCloses = listDeck ? /YOUR TURN/.test(listDeck.slides[listDeck.slides.length-1].title) : false;
  const storyDeck = S.batch.find(d=>d.kind === 'story');
  out.storyLength = storyDeck ? storyDeck.slides.length : -1;      // the run's slide count, cover included

  // ---- the ledger learned what was covered and by which angle
  out.ledgerRecorded = LEDGER.length === S.batch.length;
  // an unedited line keeps the name the picker chose; the hand-typed one falls back to its headline
  out.ledgerKeepsPicked = LEDGER.some(e=>/^[a-z0-9]{7}$/.test(e.subject)) &&
    LEDGER.some(e=>e.subject === '6 things nobody tells you about long distance');
  out.ledgerHasAngles = LEDGER.every(e=>!!e.angle && e.cat === 'Pickuplines');
  out.ledgerBlocksRepeat = ledgerHas(LEDGER[0].subject);

  // ---- and the next plan is told what has already gone out
  const planPrompts = asked.filter(t=>/Return ONLY a JSON array/.test(t));
  await runFacts();
  const later = asked.filter(t=>/Return ONLY a JSON array/.test(t)).slice(planPrompts.length);
  out.laterPlansExclude = later.some(t=>/ALREADY POSTED/.test(t));
  out.laterPlansNameThem = later.some(t=>LEDGER.some(e=>t.includes(e.subject)));
  return out;
});
await b.close();

const want = {
  planShowsPanel:true, planWroteNothing:true, planLines:3, planTagged:true, planStyle:'Pickuplines',
  planLedgerUntouched:true, plannedAngles:3,
  deckCount:4, panelClosed:true, allWritten:true, allHaveAngle:true, allColour:true, coversCarrySwipe:true,
  listBody:7, listCloses:true, storyLength:6, hooksAreTheApproved:true,
  ledgerRecorded:true, ledgerKeepsPicked:true, ledgerHasAngles:true, ledgerBlocksRepeat:true,
  laterPlansExclude:true, laterPlansNameThem:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const ok = r[k] === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k + ' = ' + JSON.stringify(r[k]) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
