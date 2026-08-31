/* The dating account's template: the account signs every frame — mark, name, tick,
   handle, over its own gradient — the cover swaps that for the swipe promise on a
   rule and keeps the circle, and no caption ever runs into any of it. Then the
   rotation: a run is dealt across the angles rather than repeating one of them. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1600);

const r = await p.evaluate(async ()=>{
  const out = {};
  const mark = () => {                       // a flat magenta disc, as a category logo would be
    const c = document.createElement('canvas'); c.width = c.height = 240;
    const x = c.getContext('2d');
    x.fillStyle = '#d020a0'; x.beginPath(); x.arc(120,120,116,0,7); x.fill();
    return c.toDataURL('image/png');
  };
  const pi = PRESETS.findIndex(x=>x.name === 'Pickuplines');
  out.presetExists = pi >= 0;
  S.profile = JSON.parse(JSON.stringify(PRESETS[pi])); S.styleKey = 'preset:'+pi;
  await fontReady(S.profile);

  CAT_LOGOS = {Pickuplines: mark()};
  await cacheCatLogos();

  const photo = () => {                      // a bright picture, so a footer with no gradient would vanish
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const x = c.getContext('2d'); x.fillStyle = '#f2efe6'; x.fillRect(0,0,1080,1350);
    return c.toDataURL('image/jpeg');
  };
  const deck = {id:'d1', cat:'Pickuplines', subject:'A test post', hook:'H', angle:'saga', kind:'story',
                tone:'colour', swipe:'The last one is why they split.', slides:[]};
  deck.slides = [
    {id:'s1', kind:'hook', title:'THEY MET TWICE, FORTY YEARS APART', scene:'x', tone:'colour',
     swipe:'The last one is why they split.', _deck:deck},
    {id:'s2', kind:'slide', title:'NO ONE KNEW', body:'She kept the letter in a drawer for nine years.',
     scene:'x', tone:'colour', _deck:deck},
    {id:'s3', kind:'slide', title:'THE TURN', body:'He answered it on a Tuesday.', scene:'x', tone:'colour', _deck:deck}
  ];
  await Promise.all(deck.slides.map(s=>new Promise(res=>{
    const im = new Image(); im.onload = ()=>{ measureCrop(im); IMG_CACHE[s.id] = im; s.img = im.src; res(); }; im.src = photo();
  })));

  const draw = s => { const c = document.createElement('canvas'); renderSlide(s, c, S.profile, 1); return c; };
  const px = (c,x,y) => { const d = c.getContext('2d').getImageData(Math.round(x), Math.round(y), 1, 1).data; return [d[0],d[1],d[2]]; };
  const magenta = q => q[0] > 120 && q[2] > 80 && q[1] < q[0]*0.7;
  const bluish  = q => q[2] > 120 && q[2] > q[0] + 40 && q[2] > q[1] + 20;
  const W = 1080, H = 1350;

  const cover = draw(deck.slides[0]), body = draw(deck.slides[1]);
  out.size = [cover.width, cover.height];

  // --- the circle, top right, cut from another of the deck's own frames
  const cm = {d: W*0.40};
  out.coverCircleRing = (()=>{                       // the white ring at the circle's left edge
    const cx = W - cm.d/2 - W*0.06, cy = cm.d/2 + H*0.045;
    const q = px(cover, cx - cm.d/2 + 2, cy);
    return q[0] > 200 && q[1] > 200 && q[2] > 200;
  })();

  // --- the cover's footer: the mark on the left, and a rule under it
  const cfm = coverFooterMetrics(W, H, S.profile);
  const ruleY = H - cfm.pad;
  const markCy = ruleY;                              // the mark straddles the rule, centred on it
  out.coverMark = magenta(px(cover, W*0.055 + cfm.d/2, markCy));
  out.markStraddlesRule = magenta(px(cover, W*0.055 + cfm.d/2, ruleY + cfm.d*0.3)) &&
                          magenta(px(cover, W*0.055 + cfm.d/2, ruleY - cfm.d*0.3));
  const ruleInk = x => { let best = 0; for(const dy of [-2,-1,0,1,2]) best = Math.max(best, px(cover, x, ruleY + dy)[0]); return best; };
  out.coverRule = ruleInk(W*0.5) > 120;
  // it fades out to the right rather than stopping dead at the margin
  out.coverRuleFades = ruleInk(W*0.30) > ruleInk(W*0.70) + 40 && ruleInk(W*0.93) < 60;
  // and starts under the line of type, not at the frame edge — sampled in the clear
  // gap between the mark's right edge and where the type begins
  out.coverRuleFromText = ruleInk(W*0.055 + cfm.d*1.15) < 40;
  out.thinRing = S.profile.brand_ring_pct < 0.06;
  out.swipeIsFuturaItalic = S.profile.swipe_font_family === 'Futura' && S.profile.swipe_italic === true;
  out.swipeIsFixed = S.profile.swipe_fixed === true &&
    swipeLine(deck.slides[0], S.profile) === 'Comment your thoughts on this below?!';
  out.brandFontIsBernoru = S.profile.font_family === 'Bernoru' && S.profile.body_font_family === 'Bernoru';
  // the two faces the page carries itself, and the one it stands in for
  out.futuraDraws = fontAvailable('Futura');                // italics only, so upright probes must not decide it
  out.noStandInNeeded = S.profile.swipe_font_family === 'Futura' && !S.profile.swipe_font_fallback;
  out.builtinsNotFetched = BUILTIN_FONTS.has('Archivo') && BUILTIN_FONTS.has('Futura') &&
    (()=>{ const before = document.querySelectorAll('link[href*="fonts.googleapis"]').length;
           ensureFont('Archivo'); ensureFont('Futura');
           return document.querySelectorAll('link[href*="fonts.googleapis"]').length === before; })();
  /* Bernoru Medium is a paid cut and is deliberately NOT shipped — the only free file
     is Black Ultra Expanded, and faking Medium out of it means changing weight and
     width at once, which came out mangled. The style names Bernoru first anyway, so a
     bought file takes over on upload; until then Archivo draws and must be present. */
  out.bernoruNotFaked = !fontAvailable('Bernoru');
  out.archivoDraws = fontAvailable('Archivo');
  out.bernoruIsTheFace = S.profile.font_family === 'Bernoru' && S.profile.font_fallback === 'Archivo';
  /* The size, anchored to the client's own reference line rather than to a number.
     Whichever face is in use, that line has to fit the column on one line and very
     nearly fill it — which is what a headline does on their artboard. Stated as a
     number instead, this check passes happily while the headline is a quarter too
     large, which is exactly what happened. */
  out.titleFillsColumn = (()=>{
    const g = document.createElement('canvas').getContext('2d');
    g.font = fontStr(S.profile, S.profile.title_size_pct * H);
    // it has to fit the text column on ONE line, the way it does on their artboard,
    // and still fill most of it — too small is as wrong as too large
    const lines = wrap(g, 'TOM BRADY LAUNCHES', W * S.profile.max_width_pct);
    const frac = g.measureText('TOM BRADY LAUNCHES').width / (W * S.profile.max_width_pct);
    return lines.length === 1 && frac > 0.92;
  })();
  /* And the sizes, against the client's own artboard: a headline line fills about 91%
     of the frame there and the swipe line about 40%. Measured, not eyeballed. */
  const widthOf = (font, text) => {
    const g = document.createElement('canvas').getContext('2d');
    g.font = font; return g.measureText(text).width / W;
  };
  out.headlineMatchesRef = (()=>{
    const w = widthOf(fontStr(S.profile, S.profile.title_size_pct * H), 'TOM BRADY LAUNCHES');
    return w > 0.84 && w < 0.94;
  })();
  out.swipeMatchesRef = (()=>{
    const w = widthOf('italic ' + S.profile.swipe_weight + ' ' +
      Math.round(S.profile.swipe_size_pct * H) + 'px "' + S.profile.swipe_font_family + '"',
      'Comment your thoughts on this below?!');
    return w > 0.38 && w < 0.48;
  })();
  out.swipeIsGreyAndLight = /^#/.test(S.profile.swipe_color || '') && S.profile.swipe_size_pct < 0.02;
  out.swipeDrawsGrey = (()=>{                               // and grey on the canvas, not white
    const g = cover.getContext('2d');
    for(let y = Math.round(ruleY - cfm.lift - cfm.line); y < ruleY - cfm.lift; y++)
      for(let x = Math.round(W*0.055 + cfm.d*1.3); x < W*0.9; x++){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[0] > 150 && d[0] < 235 && Math.abs(d[0]-d[1]) < 12 && Math.abs(d[1]-d[2]) < 12) return true;
      }
    return false;
  })();
  out.headlineFits = (()=>{                                 // nine words, and not five lines of them
    const g = document.createElement('canvas').getContext('2d');
    g.font = fontStr(S.profile, S.profile.title_size_pct * H);
    return wrap(g, 'THEY HID THEIR MARRIAGE FOR THIRTY YEARS', W * S.profile.max_width_pct).length <= 4;
  })();
  // the swipe line prints to the right of the mark, in the band just above the rule
  const swipeInkIn = (top, bot) => {
    const x0 = W*0.055 + cfm.d + cfm.d*0.30;
    for(let y = Math.round(top); y < bot; y++)
      for(let x = Math.round(x0); x < W*0.9; x++){
        const q = px(cover, x, y);
        if(q[0] > 190 && q[1] > 190 && q[2] > 190) return true;
      }
    return false;
  };
  out.coverSwipeInk = swipeInkIn(ruleY - cfm.lift - cfm.line, ruleY - cfm.lift + 1);
  /* And it rests on the rule rather than floating a mark-height over it, as it did when
     the mark hung above the line. Measured on a cover with no headline: the caption now
     sits low enough to reach into the band this looks at, so on a normal frame there is
     no way to tell whose ink is whose. */
  out.swipeNotFloating = (()=>{
    const bare = {id:'bare', kind:'hook', title:'', scene:'', tone:'colour', img:deck.slides[0].img, _deck:deck};
    IMG_CACHE[bare.id] = IMG_CACHE[deck.slides[0].id];
    const c = document.createElement('canvas');
    renderSlide(bare, c, S.profile, 1);
    const g = c.getContext('2d');
    for(let y = Math.round(ruleY - cfm.d*1.1); y < ruleY - cfm.d*0.75; y += 2)
      for(let x = Math.round(W*0.055 + cfm.d*1.3); x < W*0.9; x += 2){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[0] > 190 && d[1] > 190 && d[2] > 190) return false;
      }
    return true;
  })();

  // --- every other frame is signed the way the client asked: rule, mark, rule
  const dm = brandDividerMetrics(W, H, S.profile);
  const divCy = H - dm.pad - dm.d/2;
  out.footerIsDivider = dividerFooter(S.profile);
  out.divMarkCentred = magenta(px(body, W/2, divCy));
  out.divRules = (()=>{                              // white rule either side of the mark, on its centre line
    const white = x => { for(const dy of [-1,0,1]){ const q = px(body, x, divCy + dy);
                          if(q[0]>190 && q[1]>190 && q[2]>190) return true; } return false; };
    return white(W*0.12) && white(W*0.88);
  })();
  out.divRuleStopsAtMark = (()=>{                    // and stops clear of it rather than running underneath
    const q = px(body, W/2 - dm.d/2 - dm.d*0.07, divCy);
    return !(q[0]>190 && q[1]>190 && q[2]>190);
  })();
  out.noNameOnBody = (()=>{                          // no type in the footer — only the rule, on its own line
    const g = body.getContext('2d');
    for(let y = Math.round(divCy - dm.d*0.6); y < divCy + dm.d*0.6; y += 2){
      if(Math.abs(y - divCy) <= 4) continue;         // the rule itself is meant to be there
      for(let x = Math.round(W*0.58); x < W*0.90; x += 2){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[0] > 200 && d[1] > 200 && d[2] > 200) return false;
      }
    }
    return true;
  })();
  out.noTickOnBody = (()=>{                          // and no blue tick anywhere on the frame
    for(let y = Math.round(H*0.80); y < H - 2; y += 2)
      for(let x = 4; x < W - 4; x += 3) if(bluish(px(body, x, y))) return false;
    return true;
  })();
  /* No second gradient under the footer. The caption scrim above it still darkens the
     bottom of every frame, so the honest comparison is against the same frame WITH the
     footer scrim switched on — this one has to come out lighter at the edge. */
  out.noFooterGradient = (()=>{
    // isolate it: with the caption scrim off, the only thing that could darken the
    // bottom edge is the footer gradient, and this template no longer has one
    const bare = prof => {
      const c = document.createElement('canvas');
      renderSlide(deck.slides[1], c, Object.assign(JSON.parse(JSON.stringify(S.profile)),
        {scrim_pct:0}, prof), 1);
      return c.getContext('2d').getImageData(Math.round(W*0.02), H - 3, 1, 1).data[0];
    };
    return S.profile.footer_scrim_pct === 0 && bare({}) > bare({footer_scrim_pct:0.22}) + 60;
  })();
  // the account bar is still there for anyone who wants it, just not this preset
  out.barStillAvailable = (()=>{
    const alt = Object.assign(JSON.parse(JSON.stringify(S.profile)), {brand_footer:'account'});
    const c = document.createElement('canvas');
    renderSlide(deck.slides[1], c, alt, 1);
    const bm = brandBarMetrics(W, H, alt), cy = H - bm.pad - bm.blockH/2;
    const g = c.getContext('2d');
    for(let y = Math.round(cy - bm.blockH/2); y <= cy + bm.blockH/2; y += 2)
      for(let x = Math.round(W*0.3); x < W*0.9; x += 2){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[2] > 120 && d[2] > d[0] + 40 && d[2] > d[1] + 20) return true;   // the tick
      }
    return false;
  })();
  out.coverHasNoDivider = !magenta(px(cover, W/2, divCy));

  /* --- the type sits DOWN on the frame, near its footer. Two paddings used to stack —
     the block's own bottom pad and the footer's reserve — and left the last line
     floating clear of the rule on every slide, cover and body alike. */
  const lastInkY = (c, fromX, toX) => {
    const g = c.getContext('2d');
    for(let y = Math.round(H*0.95); y > H*0.4; y--)
      for(let x = Math.round(fromX); x < toX; x += 2){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[0] > 200 && d[1] > 200 && d[2] > 200) return y;
      }
    return 0;
  };
  // measured left of the mark and left of any rule start, so only caption ink counts
  out.coverTypeSitsLow = ruleY - lastInkY(cover, W*0.06, W*0.045 + cfm.d*0.9) < H*0.10;
  out.bodyTypeSitsLow  = (H - dm.pad - dm.d/2) - lastInkY(body, W*0.06, W*0.10) < H*0.13;
  out.bottomPadTight = S.profile.bottom_pad_pct <= 0.02;

  // --- a version bump carries the look into a project saved before it
  out.lookRefreshed = (()=>{
    const preset = PRESETS[pi];
    const stale = JSON.parse(JSON.stringify(preset));
    stale.v = 1;                                    // as an older save would have it
    stale.font_family = 'Archivo';
    stale.swipe_line = 'Swipe through — it gets worse.';
    stale.bottom_pad_pct = 0.045;
    const keep = S.profile, keyKeep = S.styleKey;
    S.profile = stale; S.styleKey = 'preset:' + pi;
    const added = refreshBuiltinProfile();
    const fixed = S.profile.font_family === 'Bernoru' &&
                  S.profile.swipe_line === 'Comment your thoughts on this below?!' &&
                  S.profile.bottom_pad_pct === preset.bottom_pad_pct &&
                  added.includes('font_family');
    S.profile = keep; S.styleKey = keyKeep;
    return fixed;
  })();

  // --- the caption stops above whatever footer the frame carries
  out.reserveCover = footerReserve(deck.slides[0], S.profile, W, H);
  out.reserveBody  = footerReserve(deck.slides[1], S.profile, W, H);
  out.reservesFooter = out.reserveCover > cfm.height && out.reserveBody > dm.height;
  out.textClearsFooter = (()=>{                       // no caption ink inside the footer's own band
    const c = draw(deck.slides[1]);
    const g = c.getContext('2d');
    const bandTop = Math.round(H - dm.pad - dm.blockH - H*0.012);
    // the account row itself is centred, so look out at the margins where only caption could be
    for(let y = bandTop; y < bandTop + 8; y++)
      for(let x = 20; x < W*0.12; x++){
        const d = g.getImageData(x, y, 1, 1).data;
        if(d[0] > 200 && d[1] > 200 && d[2] > 200) return false;
      }
    return true;
  })();

  // --- a style that never asked for any of this is untouched
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary' && x.name !== 'Pickuplines');
  out.docUnchanged = footerReserve({kind:'hook'}, PRESETS[di], W, H) === 0;

  // --- body case is its own setting now
  out.bodyNotShouted = S.profile.uppercase === true && S.profile.body_uppercase === false;

  // --- the category, and the style it brings with it
  const conf = catCfg('Pickuplines');
  out.catMode = conf.mode; out.catStyle = conf.style; out.catTone = conf.tone;
  out.angleCount = angleSet(conf.angles).length;
  out.angleKinds = [...new Set(angleSet(conf.angles).map(a=>a.kind))].sort().join(',');
  out.anglesDocumented = angleSet(conf.angles).every(a => a.brief.length > 120 && a.cover && a.close);

  // --- the rotation: ten posts are dealt across the angles, and the next run moves on
  localStorage.removeItem('cb.angle.pickuplines');
  const runA = dealAngles('pickuplines', 10).map(a=>a.key);
  const runB = dealAngles('pickuplines', 10).map(a=>a.key);
  out.dealtAll = new Set(runA).size === out.angleCount;         // every angle appears in a run of ten
  out.dealtSpread = Math.max(...Object.values(runA.reduce((m,k)=>(m[k]=(m[k]||0)+1,m),{}))) <= 2;
  out.rotationMoves = runA.slice().sort().join() !== runB.slice().sort().join();

  // --- a list carousel keeps its closing slide, a story is left alone
  const ids = n => Array.from({length:n}, (_,i)=>({id:'x'+i, kind: i ? 'slide':'hook'}));
  out.listKeepsCloser = trimToPromise('5 openers that actually work', ids(7), 1).length === 7;
  out.listTrimsExtra  = trimToPromise('5 openers that actually work', ids(9), 1).length === 7;

  // --- the prompt the writer is actually handed
  const listDeck = {subject:'Openers', hook:'5 openers that actually work', angle:'openers', kind:'list', n:7, cat:'Pickuplines'};
  const storyDeck = {subject:'A saga', hook:'They met twice, forty years apart', angle:'saga', kind:'story', n:7, cat:'Pickuplines'};
  const lp = pickupDeckPrompt('Pickuplines', listDeck), sp = pickupDeckPrompt('Pickuplines', storyDeck);
  out.listPromptCounts = /EXACTLY 5|exactly 5/.test(lp) && lp.includes('Slide 7 is one extra CLOSING slide');
  out.promptsAskSwipe = /"swipe"/.test(lp) && /"swipe"/.test(sp);
  out.promptsGuard = ['deceiving', 'demeans a group', 'sexually explicit', 'diagnosing'].every(t=>lp.includes(t) && sp.includes(t));
  out.promptsDiffer = lp !== sp && sp.includes('documented') && lp.includes('double quotation marks');
  out.promptNoText = sp.includes('never asks for words');

  // --- nothing on this template is set in light small type
  out.bodyIsHeavy = S.profile.body_weight >= 800 && S.profile.body_font_family === S.profile.font_family;
  /* Relative, not absolute. The whole template scaled down a quarter when the sizes
     were converted off the client's artboard, and an absolute floor written before
     that just fails without meaning anything. What matters is that the body is set
     large against its own headline, in the same heavy face. */
  out.bodyIsBig = S.profile.body_size_pct > S.profile.title_size_pct * 0.55;
  /* Measured rather than declared — but measured off the type, not off pixels, since
     pixel counts confound size with weight and with whatever the fallback happens to
     be. Text width scales with the size that was actually asked for. */
  const wasThin = Object.assign(JSON.parse(JSON.stringify(S.profile)),
    {body_font_family:'Inter', body_weight:500, body_size_pct:0.024});
  const widthAt = prof => {
    const g = document.createElement('canvas').getContext('2d');
    g.font = fontStr(prof, prof.body_size_pct * H, prof.body_weight, prof.body_font_family);
    return g.measureText('She kept every reply in a biscuit tin').width;
  };
  out.bodyReadsBigger = widthAt(S.profile) > widthAt(wasThin) * 1.25;
  out.bodyAsksForWeight = /800/.test(fontStr(S.profile, 40, S.profile.body_weight, S.profile.body_font_family));

  // --- the cast: the same people, frame to frame, and named figures who look like themselves
  const cast = [{name:'Ada', look:'a woman of about thirty, dark cropped hair, sharp jaw, navy wool coat'},
                {name:'Tom', look:'a broad man of fifty, grey beard, heavy glasses, brown corduroy jacket'}];
  const castDeck = {id:'cd', cat:'Pickuplines', angle:'saga', kind:'story', tone:'colour', cast, slides:[]};
  castDeck.slides = [
    {id:'c1', kind:'slide', title:'T', body:'b', scene:'Ada on the stairs with the letter open', cast:['Ada'], tone:'colour', _deck:castDeck},
    {id:'c2', kind:'slide', title:'T', body:'b', scene:'the two of them across a kitchen table', cast:['Ada','Tom'], tone:'colour', _deck:castDeck},
    {id:'c3', kind:'slide', title:'T', body:'b', scene:'rain on an empty platform at night', cast:[], tone:'colour', _deck:castDeck},
    {id:'c4', kind:'slide', title:'T', body:'b', scene:'Tom locking the shop door', cast:[], tone:'colour', _deck:castDeck}
  ];
  const ip = castDeck.slides.map(x=>imagePrompt(x));
  out.castOnNamed   = ip[0].includes('navy wool coat') && !ip[0].includes('corduroy');
  out.castBothNamed = ip[1].includes('navy wool coat') && ip[1].includes('corduroy');
  out.castNoneWhenEmpty = !/navy wool coat|corduroy/.test(ip[2]);
  // a writer that forgets the list still gets continuity from the name in the scene
  out.castFromScene = ip[3].includes('corduroy');
  out.castInsists   = ip[0].includes('MUST LOOK IDENTICAL IN EVERY FRAME');
  // a deck with no cast is untouched, so no other mode is affected
  out.noCastNoBlock = !/MUST LOOK IDENTICAL/.test(imagePrompt(deck.slides[1]));
  out.castSurvivesSave = (()=>{ const slim = slimSlide(castDeck.slides[1], false); return slim.cast.length === 2; })();

  // --- the brief itself
  const briefDeck = {subject:'A saga', hook:'They met twice', angle:'saga', kind:'story', n:6, cat:'Pickuplines'};
  const bp = pickupDeckPrompt('Pickuplines', briefDeck);
  out.asksForCast = bp.includes('"cast"') && bp.includes('AS THEY ACTUALLY LOOKED');
  out.asksForDrama = bp.includes('SHOOT THE SENTENCE') && bp.includes('DRAMATIC, NOT DECORATIVE');
  out.bansStock = ['rose petals', 'sell a mattress', 'silhouettes at sunset'].every(t=>bp.includes(t));
  out.capsBodyLength = /24 words/.test(bp);
  out.noFacelessRule = !bp.includes('in silhouette, hands only');
  out.livingPersonLine = bp.includes('only alleged of them');

  // --- the review round trip: planned lines go out tagged and come back as decks
  const set = conf.angles;
  const planned = [{angle:'saga', kind:'story', hook:'They met twice, forty years apart'},
                   {angle:'openers', kind:'list', hook:'5 openers that actually get a reply'}];
  const lines = ideaLines(planned);
  out.linesTagged = lines === '[saga] They met twice, forty years apart\n[openers] 5 openers that actually get a reply';
  const back = parseIdeaLines(set, lines);
  out.roundTrip = back.length === 2 && back[0].angle === 'saga' && back[0].kind === 'story'
    && back[1].angle === 'openers' && back[1].kind === 'list'
    && back[0].hook === 'They met twice, forty years apart';
  // an edited headline keeps its tag out of the hook
  out.tagStripped = !back[1].hook.includes('[');
  // a line typed by hand is read by its own shape, and still lands on a real angle
  const hand = parseIdeaLines(set, '7 things nobody tells you about long distance\nShe waited nineteen years for a reply');
  out.untaggedList  = hand[0].kind === 'list'  && !!angleIn(set, hand[0].angle);
  out.untaggedStory = hand[1].kind === 'story' && !!angleIn(set, hand[1].angle);
  // a tag nobody recognises is not trusted to name a shape
  out.badTagSafe = (()=>{ const x = parseIdeaLines(set, '[nonsense] 4 ways people do it')[0];
                          return !!angleIn(set, x.angle) && x.kind === 'list' && x.hook === '4 ways people do it'; })();
  out.blankLinesDropped = parseIdeaLines(set, '\n  \n[saga] One story\n\n').length === 1;

  // --- every angle can fall back to a swipe line of its own
  out.everyAngleHasSwipe = angleSet(set).every(a => a.swipe && a.swipe.length > 12);
  out.swipeFallsBack = swipeLine({kind:'hook'}, S.profile) === S.profile.swipe_line;
  out.swipeFromDeck = (()=>{            // with the fixed line off, the deck's own draws again
    const per = Object.assign(JSON.parse(JSON.stringify(S.profile)), {swipe_fixed:false});
    return swipeLine(deck.slides[0], per) === 'The last one is why they split.';
  })();

  // --- the panel knows which review it is showing
  const modeFor = c => { $('factCat').value = c; $('factCat').onchange(); return {
    run: $('runFacts').textContent, title: $('factHookTitle').textContent, create: $('factHookCreate').textContent }; };
  const pu = modeFor('Pickuplines'), hist = modeFor('History'), pep = modeFor('Peptides (Peptorium)');
  out.panelAngles = pu.run === 'Plan posts' && pu.title === 'Posts for review' && pu.create === 'Write these posts';
  out.panelPlain  = hist.run === 'Generate';
  out.panelHooks  = pep.run === 'Write hooks' && pep.title === 'Hooks for review';

  // --- the spread, so a lopsided rotation is visible rather than guessed at
  LEDGER = [{subject:'a', cat:'Pickuplines', angle:'saga'}, {subject:'b', cat:'Pickuplines', angle:'saga'},
            {subject:'c', cat:'Pickuplines', angle:'takes'}, {subject:'d', cat:'History'}];
  const tally = angleTally('Pickuplines');
  out.tallyCounts = /saga 2/.test(tally) && /takes 1/.test(tally) && /openers 0/.test(tally);
  out.tallyIgnoresOthers = angleTally('History') === '';

  return out;
});
await b.close();

const want = {
  presetExists:true, coverCircleRing:true, coverMark:true, coverRule:true, coverSwipeInk:true,
  footerIsDivider:true, divMarkCentred:true, divRules:true, divRuleStopsAtMark:true,
  noNameOnBody:true, noTickOnBody:true, noFooterGradient:true, barStillAvailable:true,
  coverHasNoDivider:true, coverRuleFades:true, coverRuleFromText:true, thinRing:true,
  markStraddlesRule:true, swipeNotFloating:true,
  swipeIsFuturaItalic:true, swipeIsFixed:true, brandFontIsBernoru:true,
  futuraDraws:true, noStandInNeeded:true, builtinsNotFetched:true, headlineFits:true,
  bernoruNotFaked:true, archivoDraws:true, bernoruIsTheFace:true, titleFillsColumn:true, headlineMatchesRef:true, swipeMatchesRef:true,
  swipeIsGreyAndLight:true, swipeDrawsGrey:true,
  reservesFooter:true, textClearsFooter:true,
  coverTypeSitsLow:true, bodyTypeSitsLow:true, bottomPadTight:true, lookRefreshed:true, docUnchanged:true, bodyNotShouted:true,
  catMode:'angles', catStyle:'Pickuplines', catTone:'colour', angleCount:8, angleKinds:'list,story',
  anglesDocumented:true, dealtAll:true, dealtSpread:true, rotationMoves:true,
  listKeepsCloser:true, listTrimsExtra:true, listPromptCounts:true, promptsAskSwipe:true,
  promptsGuard:true, promptsDiffer:true, promptNoText:true,
  bodyIsHeavy:true, bodyIsBig:true, bodyReadsBigger:true, bodyAsksForWeight:true,
  castOnNamed:true, castBothNamed:true, castNoneWhenEmpty:true, castFromScene:true, castInsists:true,
  noCastNoBlock:true, castSurvivesSave:true,
  asksForCast:true, asksForDrama:true, bansStock:true, capsBodyLength:true, noFacelessRule:true,
  livingPersonLine:true,
  linesTagged:true, roundTrip:true, tagStripped:true, untaggedList:true, untaggedStory:true,
  badTagSafe:true, blankLinesDropped:true, everyAngleHasSwipe:true, swipeFallsBack:true, swipeFromDeck:true,
  panelAngles:true, panelPlain:true, panelHooks:true, tallyCounts:true, tallyIgnoresOthers:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k];
  const ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k + ' = ' + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
