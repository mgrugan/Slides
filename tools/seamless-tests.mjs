/* Seamless carousels, for @obsession.

   What the client liked about the draft was that the picture ran across the swipe
   instead of cutting — so several slides share ONE wide photograph and each draws its
   own vertical panel of it. That is the only way the join is genuinely invisible;
   generating each frame separately and asking nicely for continuity does not work.

   Three things here are worth pinning:

     - the join itself. It is a pixel measurement and it is the whole feature: if the
       panels drift, every one of these posts has a visible seam in it and nobody will
       be able to say why it looks wrong.
     - the run length, and the reason for it. The source has to be NARROWER than the
       strip of slides it fills, because cover-fit crops the sides of a too-wide source
       and the sides of a panel are exactly where the seams are. That is a one-character
       mistake to make and it silently breaks every join.
     - the blast radius. One image now serves three slides, which touches planning, the
       library, the failure path and the sibling accounts, none of which should change. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {}, W = 1080, H = 1350;
  const oi = PRESETS.findIndex(x=>x.name === 'Obsession');
  S.profile = JSON.parse(JSON.stringify(PRESETS[oi])); S.styleKey = 'preset:'+oi;
  await fontReady(S.profile);

  // --- switched on, and only here
  out.obsessionIsSeamless = S.profile.seamless === true && S.profile.seam_span === 3;
  out.siblingsAreNot = ['Thrifting','Fun','Trendpop','iDisney']
    .every(n => !PRESETS[PRESETS.findIndex(x=>x.name === n)].seamless);
  out.versionBumped = PRESETS[oi].v >= 2 && LOOK_KEYS.includes('seamless') && LOOK_KEYS.includes('seam_span');

  // --- the runs
  const runOf = n => seamRuns(Array.from({length:n}, (_,i)=>({i})), 3).map(x=>x.length).join(',');
  out.runsOfThree = runOf(6) === '3,3' && runOf(3) === '3';
  out.aTrailingPairIsItsOwnRun = runOf(5) === '3,2';
  out.aTrailingSingleJoinsTheRunBefore = runOf(7) === '3,4' && runOf(4) === '4';
  out.oneSlideIsStillOneRun = runOf(1) === '1';

  const mkDeck = (n, prof) => {
    const deck = {id:'d', cat:'Obsession', kind:'story', tone:'colour', slides:[]};
    deck.slides = Array.from({length:n}, (_,i)=>({id:'s'+i, kind:i?'slide':'hook',
      title:'Slide '+(i+1), body:i?'A paragraph.':'', scene:'a room, '+(i+1), tone:'colour', _deck:deck}));
    markSeams(deck, prof || S.profile);
    return deck;
  };
  const deck = mkDeck(6);
  out.everySlideIsStamped = deck.slides.every(s => s.seam && s.seam.n === 3) &&
                            deck.slides.map(s=>s.seam.run + ':' + s.seam.i).join(' ') ===
                            '0:0 0:1 0:2 1:0 1:1 1:2';
  out.aPlainStyleGetsNoSeams = (()=>{
    const fi = PRESETS.findIndex(x=>x.name === 'Fun');
    return mkDeck(6, PRESETS[fi]).slides.every(s => !s.seam);
  })();
  out.turningItOffClearsOldSeams = (()=>{
    const d = mkDeck(6);
    markSeams(d, Object.assign({}, S.profile, {seamless:false}));
    return d.slides.every(s => !s.seam);
  })();
  out.runIsFoundFromAnySlideInIt = seamRunOf(deck.slides[4]).map(s=>s.id).join(',') === 's3,s4,s5';

  // --- the shape to generate at. Narrower than the strip, never wider.
  out.threeSlidesAsk21by9 = seamAspect(3, S.profile) === '21:9';
  out.twoSlidesAsk3by2    = seamAspect(2, S.profile) === '3:2';
  out.neverWiderThanTheStrip = (()=>{
    /* The rule the whole feature rests on: cover-fit crops the LONG axis, so a source
       wider than n slides is trimmed at the left and right of every panel — which is
       where the joins are. Narrower is trimmed top and bottom, which costs height and
       keeps the joins exact. */
    const [w, h] = ASPECTS[S.profile.aspect_ratio];
    const num = a => { const [x, y] = a.split(':').map(Number); return x/y; };
    return [2,3,4].every(n => num(seamAspect(n, S.profile)) <= n * w / h + 1e-9);
  })();

  // --- the window each panel draws
  out.panelsSplitTheImageEvenly = (()=>{
    const img = {naturalWidth:3000, naturalHeight:1000, _crop:null};
    const rects = [0,1,2].map(i => imgRect(Object.assign({}, img, {_seam:{run:0, i, n:3}})));
    return rects.map(x=>x.sx + '/' + x.sw).join(' ') === '0/1000 1000/1000 2000/1000';
  })();
  out.panelsRespectADetectedBorder = (()=>{
    const img = {naturalWidth:3000, naturalHeight:1000, _crop:{sx:100, sy:10, sw:2400, sh:900}, _seam:{run:0,i:2,n:3}};
    const x = imgRect(img);
    return x.sx === 1700 && x.sw === 800 && x.sy === 10 && x.sh === 900;
  })();
  out.noSeamIsTheWholeImage = (()=>{
    const x = imgRect({naturalWidth:800, naturalHeight:1000, _crop:null, _seam:null});
    return x.sx === 0 && x.sw === 800 && x.sh === 1000;
  })();

  // --- THE JOIN. A wide gradient cut into panels: the right edge of one panel and the
  //     left edge of the next are the same place in the source and must match.
  const wide = (()=>{
    const c = document.createElement('canvas'); c.width = 2688; c.height = 1152;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 2688, 0);
    g.addColorStop(0, '#2b1d4a'); g.addColorStop(0.5, '#a5442a'); g.addColorStop(1, '#0d3b2e');
    x.fillStyle = g; x.fillRect(0, 0, 2688, 1152);
    return c.toDataURL('image/png');
  })();
  const three = mkDeck(3);
  await Promise.all(three.slides.map(s=>new Promise(res=>{
    const im = new Image(); im._seam = s.seam;
    im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); };
    im.src = wide;
  })));
  const canvases = three.slides.map(s=>{ const c = document.createElement('canvas');
                                         renderSlide(s, c, S.profile, 1); return c; });
  const col = (c, x) => { const d = c.getContext('2d').getImageData(x, Math.round(H*0.42), 1, 1).data;
                          return [d[0], d[1], d[2]]; };
  const gap = i => { const a = col(canvases[i], W-1), b2 = col(canvases[i+1], 0);
                     return Math.max(Math.abs(a[0]-b2[0]), Math.abs(a[1]-b2[1]), Math.abs(a[2]-b2[2])); };
  out.theJoinsAreInvisible = gap(0) <= 4 && gap(1) <= 4;
  out.theJoinsAreMeasured = [gap(0), gap(1)].join(',');
  out.thePanelsAreNotAllTheSame = (()=>{
    /* Three identical frames would pass a join test trivially — this is what stops the
       feature quietly becoming a no-op. Measured on two BODY panels: the cover carries
       a much deeper scrim, so comparing it with a body slide measures the scrim. */
    const mid = c => col(c, Math.round(W*0.5));
    const a = mid(canvases[1]), c2 = mid(canvases[2]);
    return Math.abs(a[0]-c2[0]) + Math.abs(a[1]-c2[1]) + Math.abs(a[2]-c2[2]) > 60;
  })();

  // --- planning: one request per run, and never the library
  out.onlyTheLeadIsAskedFor = (()=>{
    const d = mkDeck(6);
    const {fresh, reused} = planImages(d.slides.slice(), 'all');
    return fresh.length === 2 && fresh[0].id === 's0' && fresh[1].id === 's3' && reused.length === 0;
  })();
  out.aPlainDeckStillPlansPerSlide = (()=>{
    const fi = PRESETS.findIndex(x=>x.name === 'Fun');
    const d = mkDeck(6, PRESETS[fi]);
    const {fresh, reused} = planImages(d.slides.slice(), 'off');
    return fresh.length === 6 && reused.length === 0;
  })();

  // --- one generation fills the whole run
  out.oneImageFillsTheRun = await (async ()=>{
    const d = mkDeck(3);
    const keep = window.callModel;
    let asked = 0, sentAspect = '', sentSize = '', sentText = '';
    window.callModel = async o => { asked++; sentAspect = o.aspect; sentSize = o.imageSize || '';
                                    sentText = o.parts[0].text;
                                    return {text:'', images:[wide]}; };
    await genImage(d.slides[1]);            // asked from the MIDDLE slide, on purpose
    window.callModel = keep;
    out.askedOnce = asked === 1;
    out.panoramaAspectWasSent = sentAspect === '21:9';
    out.panoramaAsksForMorePixels = sentSize === '2K';
    out.thePromptWasThePanorama = /ONE SINGLE CONTINUOUS PHOTOGRAPH/.test(sentText);
    return d.slides.every(s => s.img === wide && s.status === 'done');
  })();
  out.aPlainSlideStillAsksForItself = await (async ()=>{
    const fi = PRESETS.findIndex(x=>x.name === 'Fun');
    const keep2 = S.profile; S.profile = JSON.parse(JSON.stringify(PRESETS[fi]));
    const d = mkDeck(3, S.profile);
    const keep = window.callModel;
    let sentSize = 'unset', sentText = '';
    window.callModel = async o => { sentSize = o.imageSize || ''; sentText = o.parts[0].text;
                                    return {text:'', images:[wide]}; };
    await genImage(d.slides[1]);
    window.callModel = keep; S.profile = keep2;
    return sentSize === '' && !/ONE SINGLE CONTINUOUS PHOTOGRAPH/.test(sentText);
  })();

  // --- the brief for the one wide frame
  const pano = panoramaPrompt(three.slides, false, true);
  out.panoInsistsOnOneFrame = /ONE SINGLE CONTINUOUS PHOTOGRAPH/.test(pano) &&
                              /one place, one light and one moment/.test(pano);
  out.panoBansTheCollage = /NOT a collage/.test(pano) && /NOT panels with edges or gutters/.test(pano);
  out.panoPlacesEveryBeat = /THE LEFT THIRD: a room, 1\./.test(pano) &&
                            /THE MIDDLE THIRD: a room, 2\./.test(pano) &&
                            /THE RIGHT THIRD: a room, 3\./.test(pano);
  out.panoKeepsTheCutLinesClear = /Nothing important sits directly on a cut line at 33% across or at 67% across/.test(pano);
  out.panoKeepsTheCaptionBandDark = /lower quarter of the whole width simple, dark/.test(pano);
  out.panoCarriesTheAspect = /Aspect ratio 21:9/.test(pano);
  out.panoStillBansText = pano.includes(NO_TEXT_CLAUSE) && pano.includes(FULL_BLEED_CLAUSE);
  out.panoCarriesEveryonePresent = (()=>{
    /* castBlock matches a person against the SLIDE's scene text. Handed one slide it
       would carry only whoever is in that panel and the other two would come back as
       strangers — so the stand-in it is given is the whole run's scenes at once. */
    const d = mkDeck(3);
    d.cast = [{name:'Tini', real:'Valentina Rossi', known:'a chef', look:'a woman, 34'},
              {name:'Rob',  real:'Robert Vance',   known:'a critic', look:'a man, 60'}];
    d.slides[0].scene = 'Tini in a kitchen'; d.slides[2].scene = 'Rob at a table';
    const t = panoramaPrompt(d.slides, false, true);
    return /IDENTICAL LOOKALIKE of Valentina Rossi/.test(t) && /IDENTICAL LOOKALIKE of Robert Vance/.test(t);
  })();

  // --- and the writer is told what a good scene now is
  const dp = obsessionDeckPrompt('Obsession', {subject:'x', hook:'y', n:7, angle:'', person:'A B'});
  out.briefExplainsTheOneFrame = /CUT FROM ONE WIDE PHOTOGRAPH, 3 SLIDES AT A TIME/.test(dp) &&
                                 /same place, the same light, the same hour/.test(dp);
  out.briefMovesTheCameraNotTheCity = /Move the subject through that place rather than moving them to another one/.test(dp);
  out.plainPagesGetNoSuchRider = !/CUT FROM ONE WIDE PHOTOGRAPH/.test(
    funDeckPrompt('fun', {subject:'x', hook:'y', n:6, angle:'blewup'}));
  return out;
});
await b.close();

const want = {
  obsessionIsSeamless:true, siblingsAreNot:true, versionBumped:true,
  runsOfThree:true, aTrailingPairIsItsOwnRun:true, aTrailingSingleJoinsTheRunBefore:true,
  oneSlideIsStillOneRun:true,
  everySlideIsStamped:true, aPlainStyleGetsNoSeams:true, turningItOffClearsOldSeams:true,
  runIsFoundFromAnySlideInIt:true,
  threeSlidesAsk21by9:true, twoSlidesAsk3by2:true, neverWiderThanTheStrip:true,
  panelsSplitTheImageEvenly:true, panelsRespectADetectedBorder:true, noSeamIsTheWholeImage:true,
  theJoinsAreInvisible:true, theJoinsAreMeasured:'0,0', thePanelsAreNotAllTheSame:true,
  onlyTheLeadIsAskedFor:true, aPlainDeckStillPlansPerSlide:true,
  oneImageFillsTheRun:true, askedOnce:true, panoramaAspectWasSent:true,
  panoramaAsksForMorePixels:true, thePromptWasThePanorama:true, aPlainSlideStillAsksForItself:true,
  panoInsistsOnOneFrame:true, panoBansTheCollage:true, panoPlacesEveryBeat:true,
  panoKeepsTheCutLinesClear:true, panoKeepsTheCaptionBandDark:true, panoCarriesTheAspect:true,
  panoStillBansText:true, panoCarriesEveryonePresent:true,
  briefExplainsTheOneFrame:true, briefMovesTheCameraNotTheCity:true, plainPagesGetNoSuchRider:true
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
