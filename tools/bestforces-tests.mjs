/* Best Forces — a defence news page on the plain facts layout.

   Two things here carry real risk and neither is visible in a screenshot.

   THE PICTURES. Everything on this page is generated, so a realistic frame of a strike
   that actually happened is a fabricated record of a real event. That is the specific
   failure that poisons reporting on a live war, and it is also what gets an account
   labelled disinformation and pulled. The frames are therefore illustrative by
   construction — hardware, terrain, equipment, maps — and the bans are asserted here
   one at a time because a brief that loses any of them still looks fine.

   THE SOURCING. On a live conflict the same event has two official accounts and a dozen
   unverified ones. A page that flattens that is not reporting. Every claim has to carry
   who said it, a belligerent's claim has to stay a claim, and casualty figures must
   never lead. Those are prompt lines, so they are invisible until a batch has already
   been posted.

   The layout half is quick: it must be the same page History and Conspiracy are set in,
   with one deliberate exception — the archival image brief, which on a war being fought
   this week would return 1944. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const bi = PRESETS.findIndex(x=>x.name === 'Best Forces');
  const fi = PRESETS.findIndex(x=>x.name === 'Documentary facts');
  out.presetExists = bi >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[bi])); S.styleKey = 'preset:'+bi;
  await fontReady(S.profile);
  const B = PRESETS[bi], F = PRESETS[fi];

  // --- it is the base template, field for field
  const shared = ['caption_treatment','font_family','body_font_family','uppercase','text_align',
                  'title_size_pct','body_size_pct','title_gap_em','title_line_em',
                  'max_width_pct','body_width_pct','scrim_pct','scrim_alpha','bottom_pad_pct',
                  'text_block_top_pct','hook_top_pct','divider','portrait_inset','auto_inset',
                  'text_shadow','logo_scale_pct','aspect_ratio'];
  const drift = shared.filter(k => B[k] !== F[k]);
  out.matchesTheBaseLayout = drift.length === 0;
  out.whatDrifted = drift.join(',');
  out.noneOfTheClientFurniture = !B.wordmark && !B.accent_color && !B.alt_align &&
                                 !B.glow_pct && !B.handle_text && !B.badge_from_angle && !B.seamless;

  // --- and it is in the dropdown, for a returning user as well as a new one
  out.categoryIsListed = 'bestforces' in FACT_DEFAULTS;

  // --- the one deliberate difference: today's war, not 1944
  out.imageryIsPresentDay = B.imagery === 'contemporary-press-photograph' &&
                            /contemporary press photograph/.test(B.image_prompt_suffix) &&
                            /nothing that reads as archival/.test(B.image_prompt_suffix);
  out.theBaseStyleKeptItsArchivalBrief = /authentic archival documentary photograph/.test(F.image_prompt_suffix);

  // --- the picture rules, one at a time
  const banned = ['casualties','no injuries','no blood','no bodies','no destroyed homes',
                  'no distressed civilians','No identifiable faces'];
  out.styleBansEveryOne = banned.every(x => B.image_prompt_suffix.includes(x) &&
                                            B.image_prompt_suffix_colour.includes(x));
  out.styleSaysIllustrativeNotDocumentary = /ILLUSTRATIVE, NOT DOCUMENTARY/.test(B.image_prompt_suffix) &&
    /mistaken for footage of a specific real incident/.test(B.image_prompt_suffix);
  out.theCoverIsHeldToItToo = /THIS IS THE COVER FRAME/.test(B.hook_image_suffix) &&
    /Still no people, no place that can be identified/.test(B.hook_image_suffix);

  const dp = forcesDeckPrompt('bestforces', {subject:'x', hook:'y', n:6, angle:'whathappened',
                                             org:'Two states', source:'Reuters', day:'2026-09-02'});
  out.briefSaysIllustrative = /The pictures here are ILLUSTRATIVE/.test(dp) &&
    /a realistic frame of an event that actually happened is a fabricated record/.test(dp);
  out.briefListsWhatMayBeShown = /a type of aircraft, vessel, vehicle, drone, launcher or radar/.test(dp) &&
                                 /a printed map or chart with no legible text/.test(dp);
  out.briefBansTheAftermath = /NEVER: a named real place being struck or burning/.test(dp) &&
                              /a distressed civilian, a crowd, a funeral, a prisoner, a child/.test(dp);
  out.briefBansFaces = /NEVER a recognisable person/.test(dp) && /No faces in focus at all/.test(dp);
  out.briefBansInsignia = /never ask for a national flag, a unit patch, a roundel/i.test(dp) &&
    /what make a generated frame read as documentation of a specific real unit/.test(dp);

  // --- the sourcing rules
  out.everyClaimIsAttributed = /EVERY factual claim names who reported it/.test(dp);
  out.belligerentClaimsStayClaims = /reported as that party's claim and never as established fact/.test(dp) &&
                                    /Say "X said" and not "X did"/.test(dp);
  out.conflictingAccountsBothStand = /give both and say plainly that they differ/.test(dp) &&
                                     /Never resolve it for the reader/.test(dp);
  out.unconfirmedIsLabelled = /labelled unconfirmed on the slide/.test(dp);
  out.casualtiesNeverLead = /Casualty figures never open a post/.test(dp) &&
                            /never used for effect/.test(dp);
  out.noForecastingOrAdvocacy = /never forecast an outcome/.test(dp) &&
                                /never suggest what any country or reader should do/.test(dp);
  out.nothingOperational = /no live positions of units/.test(dp) &&
                           /nothing that reads as targeting information/.test(dp);
  out.noCheering = /No glorification and no cheering/.test(dp);
  out.neverInventsADesignation = /Never invent or round a figure, a date, a unit, a designation or a place name/.test(dp);

  // --- the plain shape, and the length the run asks for
  out.slidesAreTitlePlusBody = /SHORT TITLE of 2 to 5 words in caps/.test(dp) &&
                               /2 to 3 short declarative sentences/.test(dp);
  out.coverIsHeadlineOnly = /headline of 6 to 12 words and nothing else/.test(dp);
  out.carriesTheAngle = /THIS POST'S ANGLE — THE EVENT, IN ORDER, SOURCED/.test(dp);
  out.carriesTheSource = /SOURCE: Reuters/.test(dp) && /reported around/.test(dp);
  out.lengthIsExact = catCfg('bestforces').fixed_len === true &&
                      /^Write a 4-slide carousel/.test(
                        forcesDeckPrompt('bestforces', {subject:'x', hook:'y', n:4, angle:'themap'}));

  // --- the rotation, so a daily page is not one post repeated
  const set = angleSet('bestforces');
  out.angleCount = set.length;
  out.anglesDocumented = set.every(a => a.brief.length > 150 && a.cover && a.close && a.swipe && a.badge);
  out.anglesAreDistinct = new Set(set.map(a=>a.label)).size === set.length;
  out.dispatchReachesForces = !!ANGLE_PROMPTS['bestforces'] &&
    ANGLE_PROMPTS['bestforces']('bestforces', {subject:'x', hook:'y', n:5, angle:'thehardware'})
      .includes('defence and current-conflict news account');

  // --- the scan, which the default would have refused this subject outright
  const conf = catCfg('bestforces');
  out.categoryWired = conf.mode === 'angles' && conf.angles === 'bestforces' &&
                      conf.style === 'Best Forces' && conf.news === true && conf.news_days === 3;
  out.scanHasItsOwnBrief = !!conf.scan && conf.scan.what !== SCAN_DEFAULT.what;
  out.scanWantsARecordDevelopment = /A DEVELOPMENT OF RECORD/.test(conf.scan.what) &&
                                    /a wire service, a national broadcaster, a defence ministry/.test(conf.scan.what);
  out.scanDemandsANamedSource = /A story without a named source is not a story here/.test(conf.scan.what);
  out.scanTreatsDisagreementAsTheStory = /that conflict is itself the story/.test(conf.scan.what);
  out.scanRefusesTheUnverified = /carried only by social media, an anonymous briefing/.test(conf.scan.not) &&
                                 /an invented story is not a mistake, it is disinformation/.test(conf.scan.not);
  out.scanRefusesVictimsAndGore = /Casualty counts as the subject of a post, individual victims/.test(conf.scan.not);
  out.scanRefusesForecastsAndAdvocacy = /anything whose substance is a prediction/.test(conf.scan.not) &&
                                        /recruitment, advocacy or targeting/.test(conf.scan.not);
  out.theScanBriefReachesTheScan = await (async ()=>{
    const keep = window.callModel;
    let sent = '';
    window.callModel = async o => { sent = o.parts[0].text; return {text:'[]'}; };
    try{ await scanNewsDay('bestforces', '2026-09-02', 3, []); }catch(e){}
    window.callModel = keep;
    return /a defence and current-conflict news account/.test(sent) &&
           /A DEVELOPMENT OF RECORD/.test(sent) &&
           !/warm human-interest/.test(sent);        // the default brief did not come along too
  })();
  out.theScanIsGrounded = await (async ()=>{
    const keep = window.callModel;
    let searched = null;
    window.callModel = async o => { searched = o.search; return {text:'[]'}; };
    try{ await scanNewsDay('bestforces', '2026-09-02', 3, []); }catch(e){}
    window.callModel = keep;
    return searched === true;
  })();

  // --- and the pages it sits beside are untouched
  out.otherNewsPagesKeepTheirOwn = catCfg('fun').scan === undefined &&
                                   catCfg('trendpopzz').scan.lead !== conf.scan.lead;
  out.plainPagesStillHaveNoScan = !catCfg('History').scan && !catCfg('Conspiracy').scan;
  return out;
});
await b.close();

const want = {
  presetExists:true, matchesTheBaseLayout:true, whatDrifted:'', noneOfTheClientFurniture:true,
  categoryIsListed:true,
  imageryIsPresentDay:true, theBaseStyleKeptItsArchivalBrief:true,
  styleBansEveryOne:true, styleSaysIllustrativeNotDocumentary:true, theCoverIsHeldToItToo:true,
  briefSaysIllustrative:true, briefListsWhatMayBeShown:true, briefBansTheAftermath:true,
  briefBansFaces:true, briefBansInsignia:true,
  everyClaimIsAttributed:true, belligerentClaimsStayClaims:true, conflictingAccountsBothStand:true,
  unconfirmedIsLabelled:true, casualtiesNeverLead:true, noForecastingOrAdvocacy:true,
  nothingOperational:true, noCheering:true, neverInventsADesignation:true,
  slidesAreTitlePlusBody:true, coverIsHeadlineOnly:true, carriesTheAngle:true, carriesTheSource:true,
  lengthIsExact:true,
  angleCount:6, anglesDocumented:true, anglesAreDistinct:true, dispatchReachesForces:true,
  categoryWired:true, scanHasItsOwnBrief:true, scanWantsARecordDevelopment:true,
  scanDemandsANamedSource:true, scanTreatsDisagreementAsTheStory:true, scanRefusesTheUnverified:true,
  scanRefusesVictimsAndGore:true, scanRefusesForecastsAndAdvocacy:true,
  theScanBriefReachesTheScan:true, theScanIsGrounded:true,
  otherNewsPagesKeepTheirOwn:true, plainPagesStillHaveNoScan:true
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
