/* The Great Emu War carousel came back without a single emu in it. Two causes: the
   writer was handed a menu of ways to avoid the subject ("the setting, the equipment,
   the landscape, the aftermath"), and the image prompt never mentioned what the
   carousel was even about, so a hedged scene like "a wheat field at dawn" had nothing
   downstream to correct it. Facts only — the other styles must be untouched. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

// 1 — what the writer is told
const brief = await p.evaluate(()=>{
  const t = factDeckPrompt(Object.keys(FACT_CATS)[0], {subject:'The Great Emu War', claim:'Australia lost a war to birds'}, 5, 'mono');
  return {
    demandsSubject: /SHOW THE THING/.test(t) && /must contain the actual subject/.test(t),
    usesEmuExample: /emus? in the frame/i.test(t),
    demandsMotion: /Photograph the MOMENT, not the aftermath/.test(t),
    limitsAftermath: /At most one slide/.test(t),
    // the likeness rule must be narrow, and must say so
    likenessNarrow: /covers that one person's face and nothing else/.test(t) &&
                    /not a reason to photograph an empty room/.test(t),
    animalsShownFully: /Animals, machines, vehicles, buildings, crowds/.test(t),
    bansAbstraction: /Banned as lazy/.test(t) && /empty fields/.test(t),
    coverIsLiteral: /most literal image in the whole story/.test(t),
    // the old escape hatches must be gone
    noAvoidanceMenu: !/Describe the setting, the equipment, the landscape, the aftermath/.test(t),
    noAftermathRequirement: !/one image of the aftermath, the wreckage/.test(t)
  };
});

// 2 — what the image model is told, even when the writer hedged
const prompts = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  const deck = {id:'d1', subject:'The Great Emu War', hook:'Australia lost a war to birds', tone:'mono', slides:[]};
  deck.slides = [
    {id:'s0', kind:'hook', title:'Australia lost a war to birds', scene:'a wheat field at dawn', tone:'mono', _deck:deck},
    {id:'s1', kind:'slide', title:'They scattered', body:'b', scene:'dust rising over the wheatbelt', tone:'mono', _deck:deck}
  ];
  const cover = imagePrompt(deck.slides[0]), body = imagePrompt(deck.slides[1]);

  // a style with no scrim keeps the old "keep it calm" wording
  const golf = PRESETS[0];
  const plain = (()=>{ const before = S.profile; S.profile = JSON.parse(JSON.stringify(golf));
    const r = imagePrompt({id:'g', kind:'slide', title:'t', scene:'a fairway at dawn'});
    S.profile = before; return r; })();

  return {
    coverNamesSubject: cover.includes('The Great Emu War'),
    bodyNamesSubject: body.includes('The Great Emu War'),
    demandsVisible: /subject itself must be clearly visible/.test(cover),
    coverSaysStopScrolling: /stop someone scrolling/.test(cover),
    bodyHasMotion: /(mid-movement|motion blur|still moving|towards the camera|tight on the subject|running away behind it|looking up at the subject|beyond it)/.test(body),
    // the scrim style asks for a clear caption band, not an empty picture
    scrimWording: /free of the main point of interest/.test(cover) && /full and alive/.test(cover),
    noDeadWording: !/visually calm, uncluttered and even in tone/.test(cover),
    // other styles are untouched
    plainKeepsOldWording: /visually calm, uncluttered and even in tone/.test(plain),
    plainHasNoSubjectLine: !/This photograph documents/.test(plain)
  };
});

// 3 — an existing project picks the new brief up on reload
const refresh = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  const old = JSON.parse(JSON.stringify(PRESETS[di]));
  old.v = 2; delete old.subject_context;                 // a project from the previous version
  old.text_color = '#FF0000';                            // and a hand edit that must survive
  S.profile = old; S.styleKey = 'preset:'+di;
  const added = refreshBuiltinProfile();
  return {picksUpSubjectContext: S.profile.subject_context === true,
          version: S.profile.v, editKept: S.profile.text_color === '#FF0000', added};
});

const fail = [];
for(const [k,v] of Object.entries(brief)) if(!v) fail.push('writer brief: '+k);
for(const [k,v] of Object.entries(prompts)) if(!v) fail.push('image prompt: '+k);
if(!refresh.picksUpSubjectContext) fail.push('existing projects do not pick up the new brief');
if(refresh.version !== 3) fail.push('version not bumped to 3');
if(!refresh.editKept) fail.push('a hand edit was clobbered');

console.log(JSON.stringify({brief, prompts, refresh, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  the subject is in the frame, and in the prompt');
await b.close();
process.exit(fail.length ? 1 : 0);
