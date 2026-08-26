/* A hook that promises a number has to deliver it. The count was only read from
   leading digits, so "Six muscle growth myths" fell through to the picker's default
   and every listicle came out the same length. Numbers must also be written as
   digits, not words. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

const counts = await p.evaluate(()=>{
  const cases = [
    // the reported cases — spelled out, and not always at the very start
    ['Six muscle growth myths keeping you under 160 pounds.', 6],
    ['Six training milestones that opened up after eating 3,000 daily calories.', 6],
    ['Five recovery factors for chest growth that matter more than exercise variety.', 5],
    ['Six mechanical adjustments that add weight to your bench press this week.', 6],
    ['Six diagnostic questions to audit a stalled muscle-building phase.', 6],
    // digits still work
    ['7 hacks to get abs in 30 days', 7],
    ['12 lessons from a decade of lifting', 12],
    ['3 rules I follow every week', 3],
    // measurements are not counts
    ['The 60-second test that tells you if your form is wrong', 0],
    ['12 weeks to a bigger squat — the plan I would run again', 0],
    ['21 days of cold showers — the honest results', 0],
    ['5 minutes a day for 30 days — what it did to my back', 0],
    // the first real count wins, past any measurement
    ['3 hours a week is enough if you do these 5 things', 5],
    ['14 days, 5 changes, one better squat', 5],
    // out of range, and none at all
    ['20 things nobody tells you', 0],
    ['Why your bench press has stalled', 0]
  ];
  const got = cases.map(([h, want])=>({hook:h.slice(0,44), want, got: hookItemCount(h)}));

  $('batchCount').value = 7;
  const lens = {six: deckLen('Six muscle growth myths keeping you under 160 pounds.'),
                five: deckLen('Five recovery factors for chest growth.'),
                seven: deckLen('7 hacks to get abs'),
                none: deckLen('Why your bench press has stalled')};

  // the picker follows the hook typed into the composer
  $('hookInput').value = 'Five recovery factors for chest growth';
  syncCountToHook();
  const pickerFive = $('slideCount').value;
  $('hookInput').value = '9 mistakes keeping you stuck';
  syncCountToHook();
  const pickerNine = $('slideCount').value;

  return {cases: got, wrong: got.filter(c=>c.got !== c.want), lens, pickerFive, pickerNine};
});

const words = await p.evaluate(()=>{
  const raw = JSON.stringify([
    'Six muscle growth myths keeping you under 160 pounds',
    'Five recovery factors for chest growth',
    'Twelve lessons from a decade of lifting',
    'One thing that fixed my back'
  ]);
  const out = parseHookList(raw, 10);
  return {out,
    digitised: out.slice(0,3).every(h=>/^\d/.test(h)),
    oneLeftAlone: out[3] === 'One thing that fixed my back',
    // both hook writers must ask for digits
    batchPromptAsks: /Write counts as digits/.test(
      (function(){ const n = $('niche').value; $('niche').value = 'lifting';
        const s = 'x'; $('niche').value = n; return document.documentElement.innerHTML; })()
    )};
});

const trim = await p.evaluate(()=>{
  const mk = (n) => Array.from({length:n+1},(_,i)=>({id:'s'+i, kind:i?'slide':'hook', title:'T'+i}));
  const over  = trimToPromise('Five recovery factors for chest growth', mk(7));
  const exact = trimToPromise('Five recovery factors for chest growth', mk(5));
  const under = trimToPromise('Five recovery factors for chest growth', mk(3));
  const noNum = trimToPromise('Why your bench press has stalled', mk(7));
  return {overBody: over.filter(s=>s.kind!=='hook').length,
          overKeepsCover: over[0].kind === 'hook',
          exactBody: exact.filter(s=>s.kind!=='hook').length,
          underBody: under.filter(s=>s.kind!=='hook').length,
          noNumBody: noNum.filter(s=>s.kind!=='hook').length,
          warned: [...document.querySelectorAll('#log div')].some(d=>/only 3 came back/.test(d.textContent))};
});

/* None of this may reach the facts side. Facts take their length from the Slides
   picker, and a fact subject that happens to contain a number is not a listicle. */
const facts = await p.evaluate(()=>{
  const cat = Object.keys(FACT_CATS)[0];
  const numbered = factDeckPrompt(cat, {subject:'The Great Emu War', claim:'Six soldiers and 10,000 rounds'}, 5, 'mono');
  const plain    = factDeckPrompt(cat, {subject:'Wojtek the bear', claim:'A bear enlisted as a private'}, 8, 'mono');
  return {
    noPromiseLine: !/THE HOOK PROMISES/.test(numbered),
    lengthFromPicker5: /Write a 5-slide/.test(numbered),
    lengthFromPicker8: /Write a 8-slide/.test(plain),
    /* A fact deck built from a subject is never put through the listicle trimmer. The
       client categories that are built from a counting hook are, but only behind their
       own gate — so a subject that happens to contain a number is still safe. */
    trimmerOnlyBehindTheHookGate: (()=>{
      const src = String(runFacts);
      if(/deckLen\(/.test(src)) return false;
      const i = src.indexOf('trimToPromise');
      return i < 0 || /if\(byHook\)\{[^}]*$/.test(src.slice(0, i));
    })(),
    lengthNotFromTheHookForSubjects: !/n:\s*hookItemCount\(h\)[^\n]*\n[^\n]*subject/.test(String(runFacts)),
    countNotInFactPrompt: !/hookItemCount/.test(factDeckPrompt.toString())
  };
});

const fail = [];
for(const [k,v] of Object.entries(facts)) if(!v) fail.push('facts affected: '+k);
if(counts.wrong.length) fail.push('count wrong for: '+JSON.stringify(counts.wrong));
if(counts.lens.six !== 7) fail.push('a six-item hook makes '+counts.lens.six+' slides');
if(counts.lens.five !== 6) fail.push('a five-item hook makes '+counts.lens.five+' slides');
if(counts.lens.seven !== 8) fail.push('a seven-item hook makes '+counts.lens.seven+' slides');
if(counts.lens.none !== 7) fail.push('a hook with no number ignored the picker: '+counts.lens.none);
if(counts.pickerFive !== '6') fail.push('picker did not follow a spelled-out hook: '+counts.pickerFive);
if(counts.pickerNine !== '10') fail.push('picker did not follow a digit hook: '+counts.pickerNine);
if(!words.digitised) fail.push('number words survived: '+JSON.stringify(words.out));
if(!words.oneLeftAlone) fail.push('"One" was converted, which breaks ordinary prose: '+words.out[3]);
if(trim.overBody !== 5) fail.push('an over-long deck was not trimmed: '+trim.overBody);
if(!trim.overKeepsCover) fail.push('trimming dropped the cover');
if(trim.exactBody !== 5) fail.push('an exact deck was altered: '+trim.exactBody);
if(trim.underBody !== 3) fail.push('a short deck was padded: '+trim.underBody);
if(trim.noNumBody !== 7) fail.push('a deck with no promised number was trimmed: '+trim.noNumBody);
if(!trim.warned) fail.push('coming up short was not reported');

console.log(JSON.stringify({counts, words, trim, facts, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  the hook sets the length, in digits');
await b.close();
process.exit(fail.length ? 1 : 0);
