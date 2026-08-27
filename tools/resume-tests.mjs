/* A run cut off by a closed laptop leaves decks half-made: some written with all their
   images, some written with none, some never written at all. Everything already
   generated has been paid for, so picking the run back up must fill exactly the gaps
   and touch nothing else.

   Two ways money was being lost before this: there was no way to resume at all short of
   running the whole batch again, and a batch job that landed after a reload could not
   find its slides — the link between a slide and its job was never saved, so paid
   images were filed in the library and the slide stayed empty. */
import { chromium } from 'playwright-core';

const stub = () => {
  /* Every image is different, so a regenerated slide can never be mistaken for a kept
     one — and the model is obedient about tone, so nothing is retried and the call
     count means exactly what it says. */
  const mk = (colour) => { const c=document.createElement('canvas'); c.width=120;c.height=150;
    const x=c.getContext('2d');
    const g=x.createLinearGradient(0,0,0,150);
    if(colour){ g.addColorStop(0,'#e0a23c'); g.addColorStop(1,'#1c4f8a'); }
    else { g.addColorStop(0,'#c9c9c9'); g.addColorStop(1,'#3a3a3a'); }
    x.fillStyle=g; x.fillRect(0,0,120,150);
    x.fillStyle = colour ? '#c23b22' : '#8a8a8a';
    for(let i=0;i<40;i++) x.fillRect(Math.random()*120, Math.random()*150, 5, 3);
    return c.toDataURL('image/jpeg',0.7).split(',')[1]; };
  const J = o => new Response(JSON.stringify(o), {status:200, headers:{'content-type':'application/json'}});
  window.__n = {subjects:0, decks:0, img:0};
  window.__imgFor = [];
  window.fetch = async (url, opts) => {
    const body = (opts && opts.body) ? JSON.parse(opts.body) : {};
    const txt = (body.input||[]).map(p=>p.text||'').join(' ');
    if(/no text anywhere in the image/i.test(txt)){
      window.__n.img++; window.__imgFor.push(txt.slice(0,120));
      return J({output:[{content:[{type:'text', text: mk(/FULL COLOUR PHOTOGRAPH/.test(txt))}]}]});
    }
    if(/Pick \d+ subjects/.test(txt)){
      window.__n.subjects++;
      const n = +(txt.match(/Pick (\d+) subjects/)||[])[1];
      const pool = ['Mad Jack Churchill','Operation Mincemeat','The Radium Girls','Vasili Arkhipov',
                    'Ignaz Semmelweis','The Halifax Explosion','Witold Pilecki','Hedy Lamarr',
                    'Wojtek the bear','The Antikythera Mechanism','Sophie Scholl','Mansa Musa'];
      const covered = (txt.match(/ALREADY COVERED[\s\S]*?Return/)||[''])[0];
      const fresh = pool.filter(s=>!covered.includes(s));
      return J({output:[{content:[{type:'output_text', text: JSON.stringify(
        fresh.slice(0,n).map(s=>({subject:s, claim:'The true claim about '+s})))}]}]});
    }
    if(/documentary fact carousel about/.test(txt)){
      window.__n.decks++;
      const subj = (txt.match(/carousel about: (.+)/)||[])[1].split('\n')[0];
      const n = +(txt.match(/Write a (\d+)-slide/)||[])[1];
      const slides = Array.from({length:n},(_,i)=> i===0
        ? {kind:'hook', title:'The claim about '+subj, scene:'the opening scene of '+subj}
        : {kind:'slide', title:'Beat '+i, body:'A documented thing happened, verified afterwards by records.',
           scene:'scene '+i+' of '+subj, tone:'mono'});
      return J({output:[{content:[{type:'output_text', text: JSON.stringify({subject:subj, slides,
        caption:'One.\n\nTwo.\n\nThree.\n\n#a #b #c'})}]}]});
    }
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
// the key is only remembered when the box is ticked, so it goes back in after every reload
const key = async () => { await p.fill('#apiKey','FAKE'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); };
await key();
// generate everything, so the counts below are unambiguous
await p.evaluate(()=>{ localStorage.setItem('cb.useLibFacts','off'); localStorage.setItem('cb.libSave','0'); });

await p.click('#modeTabs button[data-mode=D]');
await p.waitForTimeout(300);
await p.selectOption('#factCount','3');
await p.selectOption('#factSlides','5');
await p.click('#runFacts');
await p.waitForTimeout(10000);

const first = await p.evaluate(()=>({
  decks: S.batch.length,
  images: S.batch.flatMap(d=>d.slides).filter(s=>s.img).length,
  calls: window.__n.img,
  buttonHidden: $('finishRun').classList.contains('hide')     // nothing missing, nothing to offer
}));

// --- the interruption: a deck left unwritten, and three images never made ---
const kept = await p.evaluate(async ()=>{
  const d0 = S.batch[0];
  d0.slides.slice(2).forEach(s=>{ s.img = ''; s.status = ''; });
  d0.status = 'partial';
  S.batch[2].slides = []; S.batch[2].status = 'queued';
  await idbPut('project', projectJSON(true));
  localStorage.setItem(LS.project, JSON.stringify(projectJSON(false)));
  return {survivors: S.batch[0].slides.slice(0,2).map(s=>s.img.length),
          deck1: S.batch[1].slides.map(s=>s.img.slice(-24))};
});

await p.reload();
await p.waitForTimeout(1600);
await key();

const restored = await p.evaluate(()=>{
  const w = pendingWork();
  return {decks: S.batch.length,
          unwritten: w.decks.length, missing: w.slides.length, waiting: w.waiting,
          label: $('finishRun').textContent,
          shown: !$('finishRun').classList.contains('hide'),
          warned: [...document.querySelectorAll('#log div')].some(d=>/stopped part-way/.test(d.textContent)),
          callsSoFar: window.__n.img};
});

await p.click('#finishRun');
await p.waitForTimeout(9000);

const done = await p.evaluate(()=>({
  newImageCalls: window.__n.img,       // this page load only — the reload reset the counter
  deckCalls: window.__n.decks,
  subjectCalls: window.__n.subjects,
  everyDeckWritten: S.batch.every(d=>d.slides.length),
  everySlideHasImage: S.batch.every(d=>d.slides.every(s=>s.img)),
  statuses: S.batch.map(d=>d.status),
  deck1Unchanged: S.batch[1].slides.map(s=>s.img.slice(-24)),
  survivors: S.batch[0].slides.slice(0,2).map(s=>s.img.length),
  buttonHidden: $('finishRun').classList.contains('hide'),
  ledgerDupes: LEDGER.map(e=>e.subject.toLowerCase()).filter((v,i,a)=>a.indexOf(v)!==i)
}));

// --- an image already owed by a batch job is never bought twice ---
const owed = await p.evaluate(async ()=>{
  const s = S.batch[0].slides[3];
  const before = window.__n.img;
  s.img = ''; s.status = 'queued'; s._job = 'jobs/pending-1';
  JOBS.push({name:'jobs/pending-1', model:'m', created:Date.now(), count:1,
             state:'JOB_STATE_RUNNING', slideIds:[s.id]});
  saveJobs();
  const w = pendingWork();
  // and a slide the job covers but which lost its link still counts as owed
  const s2 = S.batch[1].slides[3];
  const hadImg = s2.img; s2.img = ''; s2._job = null;
  JOBS[JOBS.length-1].slideIds.push(s2.id);
  const w2 = pendingWork();
  s2.img = hadImg;
  return {skipsOwned: !w.slides.includes(s), waiting: w.waiting,
          skipsByIdAlone: !w2.slides.includes(s2), waitingBoth: w2.waiting, before};
});
// the button hides itself when the only thing outstanding is already bought, so this
// asks for it directly: it must refuse, and say why
const owedButtonHidden = await p.evaluate(()=>$('finishRun').classList.contains('hide'));
await p.evaluate(()=>finishRun());
await p.waitForTimeout(2500);
const afterOwed = await p.evaluate(()=>({
  buttonHidden: $('finishRun').classList.contains('hide'),
  stillEmpty: !S.batch[0].slides[3].img,
  calls: window.__n.img,
  said: [...document.querySelectorAll('#log div')].some(d=>/still with the batch job/.test(d.textContent))
}));

// --- the link between a slide and its job survives a reload ---
const linked = await p.evaluate(async ()=>{
  await idbPut('project', projectJSON(true));
  const saved = JSON.parse(JSON.stringify(projectJSON(true)));
  const slide = saved.batch[0].slides[3];
  return {jobSaved: slide.job === 'jobs/pending-1'};
});
await p.reload();
await p.waitForTimeout(1500);
await key();
const afterReload = await p.evaluate(()=>({
  jobRestored: S.batch[0].slides[3]._job === 'jobs/pending-1',
  stillNotOffered: !pendingWork().slides.includes(S.batch[0].slides[3])
}));

const fail = [];
if(first.decks !== 3) fail.push('setup: '+first.decks+' decks');
if(first.images !== 15) fail.push('setup: '+first.images+' images of 15');
if(!first.buttonHidden) fail.push('the finish button shows when there is nothing to finish');
if(restored.decks !== 3) fail.push('the decks did not survive the reload: '+restored.decks);
if(restored.unwritten !== 1) fail.push('unwritten decks found: '+restored.unwritten+', expected 1');
if(restored.missing !== 3) fail.push('missing images found: '+restored.missing+', expected 3');
if(!restored.shown) fail.push('no finish button after an interrupted run');
if(!/1 deck/.test(restored.label) || !/3 images/.test(restored.label))
  fail.push('the button does not say what is left: '+restored.label);
if(!restored.warned) fail.push('nothing was said about the unfinished run on the way back in');
if(restored.callsSoFar !== 0) fail.push('images were generated on load');
// 3 gaps in the first deck + a whole 5-slide deck = 8, and not one more
if(done.newImageCalls !== 8) fail.push('generated '+done.newImageCalls+' images, expected exactly 8');
if(done.deckCalls !== 1) fail.push('wrote '+done.deckCalls+' decks, expected 1');
if(done.subjectCalls !== 0) fail.push('picked fresh subjects instead of using the ones already chosen');
if(!done.everyDeckWritten) fail.push('a deck was left unwritten');
if(!done.everySlideHasImage) fail.push('a slide was left without an image');
if(done.deck1Unchanged.join() !== kept.deck1.join()) fail.push('an untouched deck was regenerated');
if(done.survivors.join() !== kept.survivors.join()) fail.push('images that already existed were replaced');
if(!done.statuses.every(s=>s === 'done')) fail.push('statuses after finishing: '+done.statuses.join(','));
if(done.buttonHidden !== true) fail.push('the finish button still shows with nothing left');
if(done.ledgerDupes.length) fail.push('the resumed deck was recorded twice: '+done.ledgerDupes.join(','));
if(!owed.skipsOwned) fail.push('an image already owed by a batch job was queued for regeneration');
if(owed.waiting !== 1) fail.push('owed images counted: '+owed.waiting);
if(!owed.skipsByIdAlone) fail.push('a job-owed slide that lost its link would have been bought twice');
if(owed.waitingBoth !== 2) fail.push('owed images counted by id: '+owed.waitingBoth);
if(!owedButtonHidden || !afterOwed.buttonHidden)
  fail.push('the finish button offers work that a batch job already owes');
if(!afterOwed.stillEmpty) fail.push('the owed slide was regenerated anyway');
if(afterOwed.calls !== owed.before) fail.push('money was spent on an image the job already owes');
if(!afterOwed.said) fail.push('nothing explained that the images are with the job');
if(!linked.jobSaved) fail.push('the job link is not saved with the project');
if(!afterReload.jobRestored) fail.push('the job link did not survive a reload');
if(!afterReload.stillNotOffered) fail.push('after a reload the owed image would be bought again');

console.log(JSON.stringify({first, restored, done, owed, afterOwed, linked, afterReload, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  an interrupted run picks up exactly where it stopped');
await b.close();
process.exit(fail.length ? 1 : 0);
