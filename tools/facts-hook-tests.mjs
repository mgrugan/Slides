/* The facts pages were not performing: the subjects were "years that happened", the
   covers read like captions, and the frames looked like stock.

   Three separate briefs decide that and they are easy to confuse, so each is pinned
   here on its own:

     - the SUBJECT picker decides what the post is about, and no amount of good writing
       rescues a boring subject;
     - the DECK brief decides how the cover line is built, which is what a reader
       actually sees before deciding to stop;
     - the STYLE decides what the cover photograph is, and an "authentic archival
       photograph" brief left alone returns something calm and well-composed, which is
       the same thing as returning stock. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {};
  const fi = PRESETS.findIndex(x=>x.name === 'Documentary facts');
  S.profile = JSON.parse(JSON.stringify(PRESETS[fi])); S.styleKey = 'preset:'+fi;

  /* The subject prompt is built inside pickSubjects, so it is read by stubbing the
     model and keeping what was sent rather than by duplicating the string here. */
  const subjectPrompt = await (async ()=>{
    // the do-not-repeat list is only sent when there is something to send
    LEDGER.push({subject:'The Great Emu War', title:'', cat:'History', date:Date.now()});
    const keep = window.callModel;
    let sent = '';
    window.callModel = async o => { sent = o.parts[0].text; return {text:'[]'}; };
    try{ await pickSubjects('Conspiracy', '', 4); }catch(e){}
    window.callModel = keep;
    return sent;
  })();

  // --- the subject has to clear a bar
  out.thereIsABar = /THE BAR/.test(subjectPrompt) && /The test is "no way"/.test(subjectPrompt);
  out.itHasToBeSayableInOneSentence = /survive being said in ONE sentence/.test(subjectPrompt);
  out.itHasToBePhotographable = /There has to be a PICTURE in it/.test(subjectPrompt);
  out.itReachesForTheExtreme = /Reach for the extreme/.test(subjectPrompt) &&
                               /hidden for forty years|insane in hindsight/.test(subjectPrompt);
  out.controversyIsAllowedWhenDocumented = /CONTROVERSY IS GOOD where it is documented/.test(subjectPrompt);
  out.butNotTheUndocumentedKind = /open allegation, a live case, a conspiracy theory stated as fact/.test(subjectPrompt);
  out.datesAreBanned = /whose most interesting sentence is a date/.test(subjectPrompt) &&
                       /anniversaries/.test(subjectPrompt);
  out.topicsAreBanned = /Topics rather than events/.test(subjectPrompt) &&
                        /the history of/.test(subjectPrompt);
  out.theWornOutOnesAreBanned = /Titanic, Chernobyl, Area 51/.test(subjectPrompt);
  out.theClaimIsAHeadlineNotATopic = /The "claim" is the COVER HEADLINE, not a description/.test(subjectPrompt);
  out.stillDemandsTheTruth = /real, well-documented/.test(subjectPrompt) &&
                             /If the striking version is a myth, pick something else/.test(subjectPrompt);
  out.stillCarriesTheLedger = /ALREADY COVERED/.test(subjectPrompt) &&
                              /The Great Emu War/.test(subjectPrompt);

  // --- the cover line is engineered
  const dp = factDeckPrompt('Conspiracy', {subject:'Guatemala syphilis experiments',
                                           claim:'US doctors deliberately infected 1,300 Guatemalans'}, 6, 'colour');
  out.coverHasItsOwnRules = /THE COVER HEADLINE — it decides whether any of the rest is seen/.test(dp);
  out.coverLeadsWithTheConcrete = /LEAD WITH THE CONCRETE THING/.test(dp) &&
                                  /A DARK CHAPTER IN MEDICAL HISTORY" does not/.test(dp);
  out.coverNamesAnActor = /the passive voice kills it/.test(dp);
  out.coverOpensALoop = /Close one loop and open another/.test(dp);
  out.coverMustBeTrueAlone = /literally true read alone/.test(dp) && /oversells/.test(dp);
  out.coverBansTheDeadWords = ['you won\'t believe','shocking','the truth about','a dark chapter',
                               'little-known','changed everything'].every(w => dp.includes(w));
  out.coverBansOpeningOnADate = /never open on a date/.test(dp);
  out.structureSurvived = /Slide 2 opens the story/.test(dp) && /The last slide closes it/.test(dp);
  out.truthRulesSurvived = /Every claim must be genuinely documented/.test(dp) &&
                           /Never invent a statistic/.test(dp);
  out.theFaceRuleSurvived = /do NOT describe the face of the specific real named individual/.test(dp);

  // --- and the cover frame is directed away from stock
  out.styleHasACoverBrief = !!S.profile.hook_image_suffix;
  out.coverBriefBansStock = /If it could be a stock photograph it is wrong/.test(S.profile.hook_image_suffix);
  out.coverBriefWantsThePeak = /MID-ACTION at the peak of the moment/.test(S.profile.hook_image_suffix);
  out.coverBriefBansTheTidyRecordShot = /NOT a calm, tidy, well-balanced record shot/.test(S.profile.hook_image_suffix) &&
                                        /not an empty place where something once happened/.test(S.profile.hook_image_suffix);
  out.coverBriefKeepsTheFootClear = /Keep the lower third simple and dark/.test(S.profile.hook_image_suffix);
  out.versionBumped = PRESETS[fi].v >= 4;

  // --- it reaches the cover's image prompt and only the cover's
  const deck = {id:'d', cat:'Conspiracy', slides:[]};
  deck.slides = [{id:'h', kind:'hook', title:'x', scene:'a doctor filling a syringe', tone:'colour', _deck:deck},
                 {id:'s', kind:'slide', title:'y', body:'z', scene:'a ward at night', tone:'colour', _deck:deck}];
  out.theCoverGetsIt = /THIS IS THE COVER FRAME/.test(imagePrompt(deck.slides[0], false));
  out.theSlidesDoNot = !/THIS IS THE COVER FRAME/.test(imagePrompt(deck.slides[1], false));
  out.theSlidesKeepTheArchivalLook = /authentic period colour photograph/.test(imagePrompt(deck.slides[1], false));

  // --- and none of this leaked onto the client accounts
  out.clientPagesUntouched = (()=>{
    const keepP = S.profile;
    const j = PRESETS.findIndex(x=>x.name === 'Fun');
    S.profile = JSON.parse(JSON.stringify(PRESETS[j]));
    const funBrief = funDeckPrompt('fun', {subject:'x', hook:'y', n:6, angle:'blewup'});
    S.profile = keepP;
    return !/THE COVER HEADLINE — it decides/.test(funBrief) && !PRESETS[j].hook_image_suffix;
  })();
  return out;
});
await b.close();

const want = {
  thereIsABar:true, itHasToBeSayableInOneSentence:true, itHasToBePhotographable:true,
  itReachesForTheExtreme:true, controversyIsAllowedWhenDocumented:true,
  butNotTheUndocumentedKind:true, datesAreBanned:true, topicsAreBanned:true,
  theWornOutOnesAreBanned:true, theClaimIsAHeadlineNotATopic:true,
  stillDemandsTheTruth:true, stillCarriesTheLedger:true,
  coverHasItsOwnRules:true, coverLeadsWithTheConcrete:true, coverNamesAnActor:true,
  coverOpensALoop:true, coverMustBeTrueAlone:true, coverBansTheDeadWords:true,
  coverBansOpeningOnADate:true, structureSurvived:true, truthRulesSurvived:true,
  theFaceRuleSurvived:true,
  styleHasACoverBrief:true, coverBriefBansStock:true, coverBriefWantsThePeak:true,
  coverBriefBansTheTidyRecordShot:true, coverBriefKeepsTheFootClear:true, versionBumped:true,
  theCoverGetsIt:true, theSlidesDoNot:true, theSlidesKeepTheArchivalLook:true,
  clientPagesUntouched:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(34) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
