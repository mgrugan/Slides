/* The library handed out ocean frames to decks that had nothing to do with the ocean.

   Reuse was "the best available", with no floor. Collection and tone are hard filters,
   so everything that survives them is the right shape and the right tone — and when
   the library holds nothing ABOUT this subject, the least bad unrelated picture wins
   by default. On a page whose own brief says SHOW THE THING, that is the worst
   possible saving: it looks like a bug in the writer rather than in the picker.

   The floor is measured, not guessed. Against the library below, a frame that genuinely
   matches scores 0.34 to 0.56 of the query's weighted tags, and a frame about something
   else scores 0.00 to 0.06. The gap is wide and empty; the threshold sits in it. Both
   ends are asserted here, because a floor set too high quietly stops reuse altogether
   and the only symptom of that is the bill. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1500);

const r = await p.evaluate(()=>{
  const out = {};
  const fi = PRESETS.findIndex(x=>x.name === 'Documentary facts');
  S.profile = JSON.parse(JSON.stringify(PRESETS[fi])); S.styleKey = 'preset:'+fi;

  // a library like one built by the terrifying page: mostly deep sea
  const scenes = [
    'a submarine hull rusting on the seabed in cold green water',
    'divers descending into a dark ocean trench with torches',
    'a coconut octopus carrying a shell across the sea floor',
    'a siphonophore drifting in black water lit by a submersible',
    'a soviet submarine surfacing in grey arctic sea',
    'a wrecked ship lying on the ocean floor covered in silt',
    'waves breaking over a storm-lit sea at night',
    'a diver silhouetted against pale light far above',
    'a wheat field at dawn with emus scattering and dust rising',
    'a 1950s operating theatre with surgeons around a table'
  ];
  LIB.length = 0;
  scenes.forEach((sc,i)=>LIB.push({id:'L'+i, scene:sc, title:'', tags:tagsFrom(sc), tagsV:TAGS_V,
    imagery:S.profile.imagery, aspect:S.profile.aspect_ratio, collection:'Facts',
    tone:'mono', toneChecked:true, used:0, lastUsed:0, stats:null}));

  const slideFor = (scene, subject) => {
    const deck = {id:'d', cat:'Terrifying', subject, hook:subject, slides:[]};
    const s = {id:'s'+Math.random(), kind:'slide', title:'', body:'b', scene, tone:'mono', _deck:deck};
    deck.slides = [s];
    return s;
  };
  const idf = libIDF();

  // --- the measurement the threshold rests on
  const ovOf = (needle, slide) => libOverlap(LIB.find(x=>x.scene.includes(needle)), slide, idf);
  const emu = slideFor('emus scattering across a wheat field as dust rises', 'The Great Emu War');
  out.aMatchingFrameCoversTheQuery = ovOf('wheat field', emu).share > LIB_MIN_SHARE;
  out.anUnrelatedFrameCoversNothing = ovOf('submarine hull', emu).share === 0;
  /* The weighted figure is kept for RANKING and as a second way past the floor, but it
     is not what the floor rests on: in a library full of one kind of picture, the one
     word a good match shares is the common one, and the weighted score of a perfectly
     reasonable reuse comes out at 0.058 against an unrelated frame's 0.000. */
  out.theWeightedFigureAloneWouldNotSeparateThem = (()=>{
    const corridorLib = ['a corridor at night one','a corridor at night two','a corridor at night three',
                         'a deep sea anglerfish in black water'];
    const saved = LIB.splice(0, LIB.length);
    corridorLib.forEach((sc,i)=>LIB.push({id:'C'+i, scene:sc, title:'', tags:tagsFrom(sc), tagsV:TAGS_V,
      imagery:S.profile.imagery, aspect:S.profile.aspect_ratio, collection:'Facts',
      tone:'mono', toneChecked:true, used:0, lastUsed:0, stats:null}));
    const f = libIDF();
    const office = slideFor('an office corridor', 'Operation Seven');
    const good = libOverlap(LIB[0], office, f), bad = libOverlap(LIB[3], office, f);
    out.corridorCase = 'good: share ' + good.share.toFixed(2) + ' weighted ' + good.weighted.toFixed(3) +
                       ' · anglerfish: share ' + bad.share.toFixed(2) + ' weighted ' + bad.weighted.toFixed(3);
    const separated = libFits(LIB[0], office, f) && !libFits(LIB[3], office, f);
    LIB.splice(0, LIB.length, ...saved);
    return separated && good.weighted < LIB_MIN_RELEVANCE;   // the good one fails the weighted test
  })();
  /* A pair of words is a strong signal when it matches and worthless as a denominator:
     a nine-word scene throws off eight pairs that nothing will ever hit. Counting them
     in the denominator refused a gym frame to a gym slide at 2/12. The share is counted
     over single words and concepts; pairs still count when they land, through the
     weighting, and a slide with no scene at all is not measured against anything. */
  out.aPairDoesNotDiluteTheShare = (()=>{
    const gymLib = ['dumbbells and a bench in a dark commercial gym',
                    'a chef chopping vegetables on a wooden kitchen counter'];
    const saved = LIB.splice(0, LIB.length);
    gymLib.forEach((sc,i)=>LIB.push({id:'G'+i, scene:sc, title:'', tags:tagsFrom(sc), tagsV:TAGS_V,
      imagery:S.profile.imagery, aspect:S.profile.aspect_ratio, collection:'Facts',
      tone:'mono', toneChecked:true, used:0, lastUsed:0, stats:null}));
    const f = libIDF();
    const squat = slideFor('a squat rack loaded with plates in a quiet gym', 'Lifting');
    const o = libOverlap(LIB[0], squat, f);
    out.gymCase = 'gym frame for a gym slide: share ' + o.share.toFixed(2) +
                  ' · pairs in the query ' + [...queryTags(squat)].filter(t=>t.includes(' ')).length;
    const ok = libFits(LIB[0], squat, f) && !libFits(LIB[1], squat, f);
    LIB.splice(0, LIB.length, ...saved);
    return ok;
  })();
  out.aSceneLessSlideIsNotMeasuredAtAll = libFits(LIB[0], {kind:'slide', scene:'', title:''}, idf);
  /* And the clause that lets a kindred scene through must not let the original complaint
     back in: a lighthouse and an anglerfish are both ~ocean, share no words, and that is
     exactly the reuse that was being handed out. */
  out.aSharedConceptAloneIsNotEnough = (()=>{
    const saved = LIB.splice(0, LIB.length);
    ['a deep sea anglerfish in black water', 'a trawler at anchor in a calm harbour']
      .forEach((sc,i)=>LIB.push({id:'O'+i, scene:sc, title:'', tags:tagsFrom(sc), tagsV:TAGS_V,
        imagery:S.profile.imagery, aspect:S.profile.aspect_ratio, collection:'Facts',
        tone:'mono', toneChecked:true, used:0, lastUsed:0, stats:null}));
    const f = libIDF();
    const light = slideFor('a lighthouse keeper on the coastal stairs in a gale', 'The Flannan Isles');
    const o = libOverlap(LIB[0], light, f);
    out.oceanCase = 'anglerfish for a lighthouse slide: concept ' + !!o.concept +
                    ' · share ' + o.share.toFixed(2) + ' → ' + (libFits(LIB[0], light, f) ? 'REUSED' : 'refused');
    const refused = !libFits(LIB[0], light, f);
    LIB.splice(0, LIB.length, ...saved);
    return refused && o.concept;          // same concept, still refused
  })();
  out.measured = 'emu match share ' + ovOf('wheat field', emu).share.toFixed(2) +
                 ' · unrelated ' + ovOf('submarine hull', emu).share.toFixed(2) +
                 ' · floor ' + LIB_MIN_SHARE;

  // --- THE BUG: a subject the library knows nothing about gets nothing
  out.anOceanlessStoryGetsNoOcean = (()=>{
    const s = slideFor('a lighthouse keeper\'s stone cottage on a bare hillside',
                       'Flannan Isles lighthouse keepers');
    return libPick(new Set(), S.profile, s, new Map()) === null;
  })();
  out.andNorDoesADesertOne = (()=>{
    const s = slideFor('a desert highway shimmering at noon', 'Nevada highway disappearance');
    return libPick(new Set(), S.profile, s, new Map()) === null;
  })();
  out.soThoseSlidesAreGenerated = (()=>{
    const d = {id:'dd', cat:'Terrifying', subject:'Flannan Isles lighthouse keepers', slides:[]};
    d.slides = [
      {id:'h', kind:'hook', title:'t', scene:'a lighthouse on a cliff', tone:'mono', _deck:d},
      {id:'a', kind:'slide', title:'t', scene:'a stone cottage on a bare hillside', tone:'mono', _deck:d},
      {id:'b', kind:'slide', title:'t', scene:'an oil lamp burning in an empty room', tone:'mono', _deck:d}
    ];
    const {fresh, reused} = planImages(d.slides.slice(), 'all');
    return reused.length === 0 && fresh.length === 3;
  })();
  out.andItSaysSoRatherThanJustCostingMore = LIB_SKIPPED > 0 && /nothing relevant in the library/.test(libSkipNote());

  // --- and reuse still happens when the library DOES hold the subject
  out.aMatchingSubjectIsStillReused = (()=>{
    const s = slideFor('emus running across a wheat field, dust behind them', 'The Great Emu War');
    const got = libPick(new Set(), S.profile, s, new Map());
    return !!got && got.scene.includes('wheat field');
  })();
  out.theRightOneOfSeveralOceansIsStillPicked = (()=>{
    const s = slideFor('a coconut octopus carrying a shell across the sand', 'Coconut octopus');
    const got = libPick(new Set(), S.profile, s, new Map());
    return !!got && got.scene.includes('coconut octopus');
  })();
  out.reuseIsNotBrokenWholesale = (()=>{
    // five slides that the library genuinely covers, all reused
    const d = {id:'d3', cat:'Terrifying', subject:'Deep sea creatures', slides:[]};
    d.slides = ['divers descending into a dark trench with torches',
                'a siphonophore drifting in black water',
                'a wrecked ship on the ocean floor covered in silt',
                'a submarine hull rusting on the seabed'].map((sc,i)=>
      ({id:'r'+i, kind:'slide', title:'t', scene:sc, tone:'mono', _deck:d}));
    const {fresh, reused} = planImages(d.slides.slice(), 'all');
    return reused.length === 4 && fresh.length === 0;
  })();

  // --- the hard filters still come first
  out.toneIsStillAHardFilter = (()=>{
    const s = slideFor('emus scattering across a wheat field', 'The Great Emu War');
    s.tone = 'colour';                     // the library is entirely monochrome
    const prof = Object.assign({}, S.profile);
    return libPick(new Set(), prof, s, new Map()) === null;
  })();
  out.anotherCollectionIsStillOutOfReach = (()=>{
    LIB.forEach(x=>{ x.collection = 'Golf'; });
    const s = slideFor('emus scattering across a wheat field', 'The Great Emu War');
    const got = libPick(new Set(), S.profile, s, new Map());
    LIB.forEach(x=>{ x.collection = 'Facts'; });
    return got === null;
  })();
  out.anUntaggedFrameIsNotHandedOut = (()=>{
    LIB.forEach(x=>{ x.tags = []; });
    const s = slideFor('emus scattering across a wheat field', 'The Great Emu War');
    const got = libPick(new Set(), S.profile, s, new Map());
    scenes.forEach((sc,i)=>{ LIB[i].tags = tagsFrom(sc); });
    return got === null;                   // cannot be judged, so it is not risked
  })();
  LIB.length = 0;
  return out;
});
await b.close();

const want = {
  aMatchingFrameCoversTheQuery:true, anUnrelatedFrameCoversNothing:true,
  theWeightedFigureAloneWouldNotSeparateThem:true,
  aPairDoesNotDiluteTheShare:true, aSceneLessSlideIsNotMeasuredAtAll:true,
  aSharedConceptAloneIsNotEnough:true,
  anOceanlessStoryGetsNoOcean:true, andNorDoesADesertOne:true, soThoseSlidesAreGenerated:true,
  andItSaysSoRatherThanJustCostingMore:true,
  aMatchingSubjectIsStillReused:true, theRightOneOfSeveralOceansIsStillPicked:true,
  reuseIsNotBrokenWholesale:true,
  toneIsStillAHardFilter:true, anotherCollectionIsStillOutOfReach:true,
  anUntaggedFrameIsNotHandedOut:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(36) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
console.log('  ·   ' + r.measured + '\n  ·   ' + r.corridorCase);
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log('  ·   ' + r.gymCase);
console.log('  ·   ' + r.oceanCase);
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
