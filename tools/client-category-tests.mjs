/* A blank category you write yourself. There was already an "Add" button, but it was
   buried inside the prompt panel and it seeded placeholder text, so a new category
   quietly ran with "Describe the kind of fact you want here." as its brief.

   This suite also covered a client peptide category — hook-driven, its own CTA slide,
   its backgrounds kept out of the Facts shelf. That category was retired along with the
   other client accounts, so those sections went with it; the add-a-category machinery
   underneath is still the four shipping categories' own, and is what is checked here. */
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

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
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

// the four shipping categories are plain prompt strings, read the same way as before
const shipping = await p.evaluate(()=>({
  othersUnchanged: ['History','Science','Conspiracy','Terrifying']
    .every(k => typeof FACT_CATS[k] === 'string' && catPrompt(k) === FACT_CATS[k]),
  historyPromptIntact: factDeckPrompt('History', {subject:'X', claim:'Y'}, 6, 'mono')
    .includes(FACT_CATS.History),
  // and a category added by hand sits alongside them without disturbing them
  countAfterAdding: Object.keys(FACT_CATS).length
}));

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

if(!shipping.othersUnchanged) fail.push('the shipping categories changed shape');
if(!shipping.historyPromptIntact) fail.push('the fact prompt no longer carries its category brief');
if(shipping.countAfterAdding !== 5) fail.push('expected the four shipping categories plus the new one, got '+
  shipping.countAfterAdding);

console.log(JSON.stringify({blank, shipping, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  a blank category to write yourself, beside the four that ship');
await b.close();
process.exit(fail.length ? 1 : 0);
