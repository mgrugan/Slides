/* Two things at once: describe backgrounds better, and make sure the better-described
   ones do not win *because* they are better described.

   The old score was recall of the query — every extra tag an item carried was another
   chance to contain something the query asked for, so a wordy background beat an
   equally relevant plain one every time. And older items kept whatever vocabulary
   existed when they were saved, so they lost to newer ones for no good reason. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

// 1 — what the tagger now produces
const tags = await p.evaluate(()=>{
  const t = s => tagsFrom(s);
  const emu = t('sixty emus scattering across a wheat field as dust rises behind them');
  const dusk = t('a cracked enamel dish on a windowsill at dusk');
  const sunset = t('a harbour at sunset, boats at anchor');
  return {
    emu,
    hasPair: emu.includes('wheat field'),
    hasConcept: emu.includes('~animal') && emu.includes('~farm'),
    duskAndSunsetShareConcept: dusk.includes('~dusk') && sunset.includes('~dusk'),
    sunsetHasWaterConcept: sunset.includes('~water'),
    // the same stem on both sides, so "emus" in a scene meets "emu" in a query
    stemsAgree: tagsFrom('emus').includes(stem('emu')),
    noStopwords: !emu.some(x=>['the','and','as','a'].includes(x))
  };
});

// 2 — the bias: two items, equally relevant, one described at much greater length
const bias = await p.evaluate(()=>{
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;
  const base = {data:'', thumb:'', imagery: S.profile.imagery, aspect: S.profile.aspect_ratio,
                collection: currentCollection(), tone:'mono', toneChecked:true, bytes:1,
                stats:{bands:[{m:0.4,sd:0.1},{m:0.4,sd:0.1},{m:0.4,sd:0.1}]}, created:1, used:0};

  const scene = 'emus scattering across a wheat field';
  LIB.length = 0;
  // plain: describes exactly the scene. wordy: the same scene plus a great deal more.
  LIB.push({...base, id:'plain', scene, tags: tagsFrom(scene), tagsV: TAGS_V});
  LIB.push({...base, id:'wordy', scene: scene + ' with soldiers trucks rifles dust fences barns tractors ' +
    'horses fog rain lanterns crowds documents machinery hospitals harbours mountains deserts',
    tags: tagsFrom(scene + ' with soldiers trucks rifles dust fences barns tractors horses fog rain ' +
      'lanterns crowds documents machinery hospitals harbours mountains deserts'), tagsV: TAGS_V});
  // pad the library so IDF and the average tag mass mean something
  for(let i=0;i<10;i++) LIB.push({...base, id:'f'+i, scene:'a corridor at night '+i,
    tags: tagsFrom('a corridor at night '+i), tagsV: TAGS_V});

  const idf = libIDF();
  const slide = {kind:'slide', tone:'mono', scene};
  const plain = libScore(LIB.find(x=>x.id==='plain'), slide, S.profile, idf);
  const wordy = libScore(LIB.find(x=>x.id==='wordy'), slide, S.profile, idf);
  const picked = libPick(new Set(), S.profile, slide);

  // and the wordy one must still win when it genuinely is the better match
  const offScene = {kind:'slide', tone:'mono', scene:'soldiers with rifles beside a truck'};
  const plainOff = libScore(LIB.find(x=>x.id==='plain'), offScene, S.profile, idf);
  const wordyOff = libScore(LIB.find(x=>x.id==='wordy'), offScene, S.profile, idf);

  return {plain:+plain.toFixed(1), wordy:+wordy.toFixed(1), pickedId: picked && picked.id,
          plainOff:+plainOff.toFixed(1), wordyOff:+wordyOff.toFixed(1),
          avgMass: +(idf.avgMass||0).toFixed(2)};
});

// 3 — the deck's subject counts towards the query
const context = await p.evaluate(()=>{
  const deck = {id:'d', subject:'The Great Emu War', hook:'Australia lost a war to birds', slides:[]};
  const slide = {kind:'slide', scene:'dust rising over open ground', tone:'mono', _deck:deck};
  const q = queryTags(slide);
  return {usesSubject: q.has('emu'), usesScene: q.has('dust'),
          noDeckStillWorks: queryTags({kind:'slide', scene:'dust rising'}).has('dust')};
});

// 4 — older items get re-described rather than left behind
const retag = await p.evaluate(async ()=>{
  await libClear();
  const c = document.createElement('canvas'); c.width = 80; c.height = 100;
  c.getContext('2d').fillStyle = '#654'; c.getContext('2d').fillRect(0,0,80,100);
  const data = c.toDataURL('image/jpeg', 0.8);
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;

  // an item as an older version would have stored it: thin tags, no version stamp
  await keepInLibrary({id:'old', kind:'slide', title:'T', scene:'emus scattering across a wheat field', tone:'mono'}, data);
  await new Promise(r=>setTimeout(r, 700));
  const item = LIB[0];
  const before = {tags: item.tags.slice(), v: item.tagsV};

  // write a genuinely old-shaped record straight into storage: libSave merges, so it
  // can never remove a field, and a real pre-version item simply never had one
  const db = await idb();
  await new Promise((res, rej)=>{
    const t = db.transaction('lib','readwrite'), store = t.objectStore('lib');
    const g = store.get(item.id);
    g.onsuccess = () => { const rec = g.result; rec.tags = ['emu','wheat']; delete rec.tagsV; store.put(rec); };
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
  item.tags = ['emu','wheat']; delete item.tagsV;

  const n = await libRetagAll();
  const after = LIB.find(x=>x.id === item.id);
  return {
    newSaveIsStamped: before.v === TAGS_V,
    newSaveHasPairs: before.tags.some(t=>t.includes(' ')),
    retagged: n,
    oldNowStamped: after.tagsV === TAGS_V,
    oldNowHasPairs: after.tags.some(t=>t.includes(' ')),
    oldNowHasConcepts: after.tags.some(t=>t[0] === '~'),
    idempotent: await libRetagAll()          // running again must do nothing
  };
});

// 5 — the chips stay readable
const chips = await p.evaluate(()=>{
  const t = libTopTags(currentCollection());
  return {noPairs: t.every(([x])=>!x.includes(' ')), noConcepts: t.every(([x])=>x[0] !== '~')};
});

const fail = [];
for(const [k,v] of Object.entries(tags)) if(k !== 'emu' && !v) fail.push('tagging: '+k);
if(bias.wordy > bias.plain) fail.push('the wordier background still beats the plain one on its own scene: '
  +bias.wordy+' vs '+bias.plain);
if(bias.pickedId !== 'plain') fail.push('the picker chose the wordy one: '+bias.pickedId);
if(bias.wordyOff <= bias.plainOff) fail.push('length normalisation went too far — the wordy one no longer wins '
  +'a scene it genuinely matches: '+bias.wordyOff+' vs '+bias.plainOff);
for(const [k,v] of Object.entries(context)) if(!v) fail.push('query context: '+k);
if(!retag.newSaveIsStamped) fail.push('a new save is not version stamped');
if(!retag.newSaveHasPairs) fail.push('a new save has no word pairs');
if(retag.retagged !== 1) fail.push('re-tagging touched '+retag.retagged+' items, expected 1');
if(!retag.oldNowStamped) fail.push('an older item was not re-stamped');
if(!retag.oldNowHasPairs || !retag.oldNowHasConcepts) fail.push('an older item was not given the new vocabulary');
if(retag.idempotent !== 0) fail.push('re-tagging is not idempotent');
for(const [k,v] of Object.entries(chips)) if(!v) fail.push('chips: '+k);

console.log(JSON.stringify({tags, bias, context, retag, chips, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  richer keywords, and no advantage for having them');
await b.close();
process.exit(fail.length ? 1 : 0);
