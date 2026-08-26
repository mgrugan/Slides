/* Two additions to Mode D, and nothing else moving.

   1. A blank category. There was already an "Add" button, but it was buried inside the
      prompt panel and it seeded placeholder text, so a new category quietly ran with
      "Describe the kind of fact you want here." as its brief.

   2. A client category: peptide facts built from a counting hook rather than a single
      story, the hooks shown for approval before anything is written, a closing slide
      for the client's site, and its backgrounds kept in the General library instead of
      the Facts one — the client's images are not the channel's stock. */
import { chromium } from 'playwright-core';

const stub = () => {
  const mk = () => { const c=document.createElement('canvas'); c.width=200;c.height=250;
    const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,0,250);
    g.addColorStop(0,'#c9c9c9'); g.addColorStop(1,'#3a3a3a'); x.fillStyle=g; x.fillRect(0,0,200,250);
    x.fillStyle='#8a8a8a'; for(let i=0;i<60;i++) x.fillRect(Math.random()*200, Math.random()*250, 6, 3);
    return c.toDataURL('image/jpeg',0.8).split(',')[1]; };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {hooks:0, decks:0, img:0, subjects:0};
  window.__hookPrompts = []; window.__deckPrompts = [];
  window.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){ window.__n.img++;
      return J({output:[{content:[{type:'text', text: mk()}]}]}); }
    if(/cover-slide headlines for short fact carousels/.test(txt)){
      window.__n.hooks++; window.__hookPrompts.push(txt);
      const n = +(txt.match(/Write (\d+) cover-slide headlines/)||[])[1];
      const pool = ['5 things the research on BPC-157 actually shows',
                    '4 peptide claims that do not survive a close read',
                    '6 questions to ask before trusting a peptide study',
                    '3 reasons peptide research is slower than the marketing',
                    '7 peptides named after the thing they were found in',
                    '5 milestones in the history of peptide chemistry',
                    '4 ways a peptide differs from a protein'];
      return J({output:[{content:[{type:'output_text',
        text: JSON.stringify(Array.from({length:n},(_,i)=>pool[i % pool.length]))}]}]});
    }
    if(/fact carousel for this cover headline/.test(txt)){
      window.__n.decks++; window.__deckPrompts.push(txt);
      const items = +(txt.match(/THE HEADLINE PROMISES (\d+) POINTS/)||[])[1];
      const hook = (txt.match(/cover headline, verbatim or lightly tightened: "(.+?)"/)||[])[1];
      const slides = [{kind:'hook', title:hook, scene:'a centrifuge mid-spin in a bright laboratory'}];
      for(let i=1;i<=items;i++) slides.push({kind:'slide', title:'Point '+i,
        body:'A documented thing about peptides, stated flatly and without a promise.',
        scene:'a researcher\'s hands at a bench, slide '+i, tone:'mono'});
      return J({output:[{content:[{type:'output_text', text: JSON.stringify({slides,
        cta:'Read the research summaries at peptorium.com.',
        cta_scene:'sealed glass vials in a rack under soft daylight',
        caption:'Para one.\n\nPara two.\n\nPara three.\n\n#peptides #research #science'})}]}]});
    }
    if(/Pick \d+ subjects/.test(txt)){ window.__n.subjects++;
      return J({output:[{content:[{type:'output_text', text:'[]'}]}]}); }
    if(/single word: ok/.test(txt)) return J({output:[{content:[{type:'output_text', text:'ok'}]}]});
    return J({output:[{content:[{type:'output_text', text:'{}'}]}]});
  };
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(stub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);
await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await p.click('#modeTabs button[data-mode=D]');
await p.waitForTimeout(300);

// ---------- 1. a blank category, prompted by hand ----------
const blank = {};
blank.newButtonVisible = await p.isVisible('#factNewCatBtn');
await p.click('#factNewCatBtn');
blank.panelOpened = await p.isVisible('#factNewCat');
await p.fill('#factNewCat','Unsolved');
await p.press('#factNewCat','Enter');                 // Enter must work as well as Add
await p.waitForTimeout(200);
Object.assign(blank, await p.evaluate(()=>({
  created: 'Unsolved' in FACT_CATS,
  startsEmpty: catPrompt('Unsolved') === '',
  selected: $('factCat').value,
  inDropdown: [...$('factCat').options].some(o=>o.value === 'Unsolved'),
  textareaEmpty: $('factPromptText').value === '',
  persisted: catPrompt.call(null,'Unsolved') === '' &&
             JSON.parse(localStorage.getItem('cb.factCats')||'{}').Unsolved === ''
})));
// running an unwritten category must say so rather than generate from nothing
await p.click('#runFacts');
await p.waitForTimeout(900);
Object.assign(blank, await p.evaluate(()=>({
  askedTheModel: window.__n.subjects + window.__n.hooks,
  promptPanelOpen: !$('factPromptPanel').classList.contains('hide'),
  decks: S.batch.length
})));
// write the prompt and it is kept
await p.fill('#factPromptText','Unsolved disappearances with a documented paper trail.');
await p.click('#factPromptSave');
await p.waitForTimeout(200);
Object.assign(blank, await p.evaluate(()=>({
  saved: catPrompt('Unsolved'),
  survivesReload: JSON.parse(localStorage.getItem('cb.factCats')).Unsolved
})));

// ---------- 2. the client category ----------
const cat = await p.evaluate(()=>Object.keys(FACT_CATS).find(c=>/peptor/i.test(c) || /peptide/i.test(c)));
const setup = await p.evaluate(c=>({
  exists: !!c,
  mode: catCfg(c).mode,
  cta: catCfg(c).cta,
  collection: catCfg(c).collection,
  hasPrompt: catPrompt(c).length > 40,
  // the other categories must still be plain strings, read the same way as before
  othersUnchanged: ['History','Science','Conspiracy','Terrifying']
    .every(k => typeof FACT_CATS[k] === 'string' && catPrompt(k) === FACT_CATS[k]),
  historyPromptIntact: factDeckPrompt('History', {subject:'X', claim:'Y'}, 6, 'mono').includes(FACT_CATS.History)
}), cat);

await p.selectOption('#factCat', cat);
await p.waitForTimeout(200);
await p.selectOption('#factCount','3');
const label = await p.textContent('#runFacts');

// hooks first, and nothing written until they are approved
await p.click('#runFacts');
await p.waitForTimeout(2500);
const review = await p.evaluate(()=>({
  panelShown: !$('factHookPanel').classList.contains('hide'),
  lines: $('factHookText').value.split('\n').filter(Boolean),
  decksWritten: window.__n.decks,
  imagesMade: window.__n.img,
  batch: S.batch.length,
  hookPromptMentionsCategory: /peptide/i.test(window.__hookPrompts[0]||''),
  hookPromptIsNumbered: /open with a count written as a digit/i.test(window.__hookPrompts[0]||'')
}));

// edit the list — one deleted, one rewritten — then create
await p.evaluate(()=>{
  const lines = $('factHookText').value.split('\n').filter(Boolean);
  lines.pop();
  lines[0] = '4 things the research on BPC-157 actually shows';
  $('factHookText').value = lines.join('\n');
});
await p.click('#factHookCreate');
await p.waitForTimeout(9000);

const made = await p.evaluate(()=>{
  const decks = S.batch;
  return {
    decks: decks.length,
    hooks: decks.map(d=>d.hook),
    editedHookUsed: decks.some(d=>/^4 things the research on BPC-157/.test(d.hook)),
    // cover + the promised points + the closing slide
    lengths: decks.map(d=>({promised: hookItemCount(d.hook), slides: d.slides.length})),
    lastTitles: decks.map(d=>d.slides[d.slides.length-1].title),
    lastBodies: decks.map(d=>d.slides[d.slides.length-1].body),
    ctaIsOnlyAtTheEnd: decks.every(d=>d.slides.slice(0,-1).every(s=>!/peptorium/i.test(s.title+' '+s.body))),
    ctaHasScene: decks.every(d=>!!d.slides[d.slides.length-1].scene),
    everySlideHasImage: decks.every(d=>d.slides.every(s=>s.img)),
    coverIsHook: decks.every(d=>d.slides[0].kind === 'hook'),
    captions: decks.every(d=>d.caption.includes('#peptides')),
    ledger: LEDGER.filter(e=>/pept/i.test(e.cat||'')).length,
    styleIsDocumentary: S.profile.caption_treatment === 'documentary',
    panelHidden: $('factHookPanel').classList.contains('hide')
  };
});

// ---------- 3. where the images went ----------
const lib = await p.evaluate(()=>({
  perColl: LIB.reduce((a,x)=>{ const c=x.collection||'General'; a[c]=(a[c]||0)+1; return a; },{}),
  styleCollection: currentCollection(),            // Facts — the documentary preset's own
  deckCollection: S.batch[0].collection,
  // a peptide slide must be offered General backgrounds, never the Facts shelf
  picksFromGeneral: (()=>{
    const s = S.batch[0].slides[1];
    LIB.forEach(x=>{ x.toneChecked = true; });
    const pick = libPick(new Set(), S.profile, s);
    return pick ? (pick.collection||'General') : 'none';
  })(),
  // and an ordinary facts slide still gets the Facts shelf
  factsStillFacts: (()=>{
    const s = {kind:'slide', tone:'mono', scene:'a bench', _deck:{id:'x'}};
    const pick = libPick(new Set(), S.profile, s);
    return pick ? (pick.collection||'General') : 'none';
  })()
}));

// ---------- 4. its own logo, like every other fact category ----------
const logo = await p.evaluate(async c=>{
  const mk = t => { const x=document.createElement('canvas'); x.width=x.height=120;
    const g=x.getContext('2d'); g.fillStyle='#fff'; g.font='bold 60px sans-serif';
    g.textAlign='center'; g.textBaseline='middle'; g.fillText(t,60,62); return x.toDataURL('image/png'); };
  CAT_LOGOS[c] = await makeThumb(mk('P'), 512, 'image/png');
  CAT_LOGOS['History'] = await makeThumb(mk('H'), 512, 'image/png');
  await idbPut('logos', CAT_LOGOS);
  await cacheCatLogos();
  const slide = S.batch[0].slides[0];
  const mine = logoFor(slide), other = logoFor({_deck:{cat:'History'}});
  return {hasOwn: !!mine, differsFromAnother: !!mine && !!other && mine !== other,
          stored: !!(await idbGet('logos'))[c]};
}, cat);

const fail = [];
if(!blank.newButtonVisible) fail.push('no visible way to start a new category');
if(!blank.panelOpened) fail.push('the new-category field did not open');
if(!blank.created) fail.push('the category was not created');
if(!blank.startsEmpty) fail.push('a new category still comes with placeholder text');
if(blank.selected !== 'Unsolved') fail.push('the new category was not selected: '+blank.selected);
if(!blank.inDropdown) fail.push('the new category is missing from the dropdown');
if(!blank.textareaEmpty) fail.push('the prompt box was not left blank to write in');
if(!blank.persisted) fail.push('the new category was not stored');
if(blank.askedTheModel) fail.push('a category with no prompt was run against the model anyway');
if(!blank.promptPanelOpen) fail.push('running an unwritten category did not open its prompt');
if(blank.decks) fail.push('an unwritten category produced decks');
if(!/paper trail/.test(blank.saved||'')) fail.push('the written prompt was not kept: '+blank.saved);
if(blank.survivesReload !== blank.saved) fail.push('the written prompt was not stored');

if(!setup.exists) fail.push('no client peptide category');
if(setup.mode !== 'hooks') fail.push('the client category is not hook-driven');
if(!/peptorium\.com/.test(setup.cta||'')) fail.push('no CTA site on the client category');
if(setup.collection !== 'General') fail.push('the client category is not pointed at General: '+setup.collection);
if(!setup.hasPrompt) fail.push('the client category has no brief');
if(!setup.othersUnchanged) fail.push('the existing categories changed shape');
if(!setup.historyPromptIntact) fail.push('the ordinary fact prompt no longer carries its category brief');
if(!/hook/i.test(label||'')) fail.push('the button does not say the hooks come first: '+label);

if(!review.panelShown) fail.push('the hooks were not shown for review');
if(review.lines.length !== 3) fail.push('asked for 3 hooks, got '+review.lines.length);
if(review.decksWritten || review.batch) fail.push('carousels were written before the hooks were approved');
if(review.imagesMade) fail.push('images were generated before the hooks were approved');
if(!review.hookPromptMentionsCategory) fail.push('the hook prompt ignores the category brief');
if(!review.hookPromptIsNumbered) fail.push('the hooks are not the numbered/counting kind');

if(made.decks !== 2) fail.push('created '+made.decks+' carousels from 2 approved hooks');
if(!made.editedHookUsed) fail.push('an edited hook was not the one used');
for(const l of made.lengths)
  if(l.slides !== l.promised + 2) fail.push('a hook promising '+l.promised+' produced '+l.slides+
    ' slides, expected '+(l.promised+2)+' (cover + points + closing slide)');
if(!made.lastTitles.every(t=>/peptorium\.com/i.test(t))) fail.push('the last slide does not name the site: '+made.lastTitles.join(' | '));
if(!made.lastBodies.every(x=>x && x.length > 10)) fail.push('the closing slide has no copy');
if(!made.ctaIsOnlyAtTheEnd) fail.push('the call to action leaked into the body slides');
if(!made.ctaHasScene) fail.push('the closing slide has no scene to photograph');
if(!made.everySlideHasImage) fail.push('some slides came out without an image');
if(!made.coverIsHook) fail.push('the hook is not the cover');
if(!made.captions) fail.push('no caption came through');
if(made.ledger < 2) fail.push('the used hooks were not recorded, so they can repeat');
if(!made.styleIsDocumentary) fail.push('the client decks are not in the facts style');
if(!made.panelHidden) fail.push('the review panel stayed open after creating');

if(lib.styleCollection !== 'Facts') fail.push('the facts style no longer uses the Facts collection');
if(lib.deckCollection !== 'General') fail.push('the client deck is not marked General');
if((lib.perColl.Facts||0) > 0) fail.push((lib.perColl.Facts)+' client backgrounds went into Facts storage');
if((lib.perColl.General||0) < 8) fail.push('the client backgrounds did not reach General: '+JSON.stringify(lib.perColl));
if(lib.picksFromGeneral !== 'General') fail.push('a client slide was offered a '+lib.picksFromGeneral+' background');
if(lib.factsStillFacts !== 'none' && lib.factsStillFacts !== 'Facts')
  fail.push('an ordinary facts slide was offered a '+lib.factsStillFacts+' background');

if(!logo.hasOwn) fail.push('the client category cannot carry its own logo');
if(!logo.differsFromAnother) fail.push('the client logo is not distinct from another category\'s');
if(!logo.stored) fail.push('the client logo was not stored');

console.log(JSON.stringify({blank, setup, label, review, made, lib, logo, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  a blank category to write yourself, and a client mode that reviews its hooks first');
await b.close();
process.exit(fail.length ? 1 : 0);
