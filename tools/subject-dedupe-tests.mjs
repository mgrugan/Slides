/* Subjects were repeating. Two causes:

   The ledger matched on the exact normalised name, so "The Great Emu War" and "Great
   Emu War of 1932" were two different entries for one carousel.

   And the writer renames the subject: the picker checked "Nikola Tesla" against the
   ledger, the writer returned "The death of Nikola Tesla", and only the second was
   recorded — leaving the first free to be suggested again.

   The risk in fixing this is the opposite error, so the second half of this test is
   entirely about subjects that must NOT be treated as the same. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

const r = await p.evaluate(async ()=>{
  LEDGER.length = 0;
  const covered = ['The Great Emu War','Nikola Tesla','Marie Curie','Operation Paperclip',
                   'The Halifax Explosion','The Dyatlov Pass incident','Wojtek the bear',
                   'The Radium Girls','Mansa Musa','Hedy Lamarr','Operation Mongoose',
                   'The Boston Molasses Flood','Sophie Scholl','The Antikythera Mechanism'];
  covered.forEach(s=>LEDGER.push({subject:s, title:'t', cat:'History', date:1}));

  const dupes = [
    'Great Emu War of 1932', 'the great emu war', 'The Emu War',
    'The death of Nikola Tesla', 'Nikola Tesla and the FBI',
    "Marie Curie's radioactive notebooks",
    'Operation Paperclip and the Nazi scientists',
    'Halifax Explosion', 'Dyatlov Pass', 'Wojtek', 'Radium Girls',
    'The Antikythera mechanism'
  ];
  // a numbered series is the sharpest false-positive risk: one shared name, different story
  LEDGER.push({subject:'Apollo 1', title:'t', cat:'History', date:1});
  const distinct = [
    'Apollo 13', 'Apollo 11',
    'Operation Mongoose and the exploding cigar',   // already covered, should be caught
    'Operation Northwoods', 'Operation Gladio', 'Operation Ajax',
    'The Texas City Explosion',            // shares only "explosion" with Halifax
    'The Dancing Plague of 1518',
    'The Tunguska Event', 'Emperor Norton', 'The Mary Celeste',
    'Ada Lovelace', 'Phineas Gage', 'The Christmas Truce',
    'The Great Fire of London',            // shares only "great"/"fire"
    'The Cadaver Synod', 'Sequoyah'
  ];

  const caught = dupes.filter(s=>ledgerHas(s));
  const missed = dupes.filter(s=>!ledgerHas(s));
  const blocked = distinct.filter(s=>ledgerHas(s));

  // the rename hole: ask for one name, get another back, and both must be remembered
  LEDGER.length = 0;
  await ledgerAdd('Nikola Tesla', 'He died penniless', 'History', 'The last days of Nikola Tesla');
  const remembersAsked = ledgerHas('Nikola Tesla');
  const remembersReturned = ledgerHas('The last days of Nikola Tesla');
  const entryHasAlt = !!LEDGER[0].alt;

  // and adding the same story a second time must not create a second entry
  await ledgerAdd('Tesla, Nikola', 't', 'History');
  const noDoubleEntry = LEDGER.length === 1;

  // within a single pick, two spellings of one story must not both survive
  const numbered = {sameNumberIsDupe: sameSubject('Apollo 1', 'Apollo 1 fire'),
                    differentNumberIsNot: !sameSubject('Apollo 1', 'Apollo 13'),
                    yearStillMatches: sameSubject('The Dancing Plague', 'The Dancing Plague of 1518')};
  const batch = [{subject:'The Great Emu War'}, {subject:'Great Emu War of 1932'}, {subject:'Wojtek the bear'}];
  const kept = [];
  for(const o of batch) if(!kept.some(pr => sameSubject(pr.subject, o.subject))) kept.push(o);

  return {caught: caught.length, missed, blocked, dupeTotal: dupes.length, numbered,
          remembersAsked, remembersReturned, entryHasAlt, noDoubleEntry,
          keptInBatch: kept.map(o=>o.subject)};
});

const fail = [];
if(r.missed.length) fail.push('these repeats were not caught: '+r.missed.join(' | '));
if(r.blocked.length > 1 || (r.blocked.length === 1 && !/Mongoose/.test(r.blocked[0])))
  fail.push('these distinct subjects were wrongly blocked: '+r.blocked.join(' | '));
if(!r.blocked.some(s=>/Mongoose/.test(s))) fail.push('a genuine repeat of Operation Mongoose slipped through');
for(const [k,v] of Object.entries(r.numbered)) if(!v) fail.push('numbered subjects: '+k);
if(!r.remembersAsked) fail.push('the name we asked for was not recorded');
if(!r.remembersReturned) fail.push('the name the writer returned was not recorded');
if(!r.entryHasAlt) fail.push('no alias stored on the entry');
if(!r.noDoubleEntry) fail.push('the same story was added twice');
if(r.keptInBatch.length !== 2) fail.push('a single run kept two spellings of one story: '+r.keptInBatch.join(' | '));

console.log(JSON.stringify({...r, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  repeats caught, distinct subjects left alone');
await b.close();
process.exit(fail.length ? 1 : 0);
