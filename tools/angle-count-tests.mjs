/* A headline that counts has to deliver its count, on both client pages that run the
   rotation. This was wrong in three separate places at once and each of them alone was
   enough to ship a deck headlined "7 CARDS THAT..." with nine points in it:

     - the guard only ran for angles whose KIND was 'list', and six of the eight
       thrifting angles are stories — a story angle is perfectly capable of being
       headlined with a number;
     - the trim kept the first `want + extra` body slides, which is one point too many
       AND drops the closing slide off the end;
     - the brief never told the writer the number at all for those angles, so trimming
       was doing all the work instead of being the safety net.

   The model is stubbed here and told to over-deliver, because that is what it actually
   does and it is the only way to test the guard rather than the model's mood. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

const r = await p.evaluate(async ()=>{
  const out = {};

  /* Write one deck with the writer over-delivering: `returned` points and a closing
     slide on the end. Returns what actually survived. */
  const write = async (cat, angleKey, hook, returned) => {
    const angle = angleIn(catCfg(cat).angles, angleKey);
    const slides = [{kind:'hook', title:hook, scene:'s'}];
    for(let i = 1; i <= returned; i++) slides.push({kind:'slide', title:'POINT '+i, body:'', scene:'s'});
    slides.push({kind:'slide', title:'CLOSING ASK', body:'', scene:'s'});
    window.callModel = async () => ({text: JSON.stringify(
      {subject:'s', swipe:'w', slides, caption:'a\n\nb\n\nc'}), images:[]});
    const want = hookLeadsWithCount(hook);
    const deck = {id:uid(), cat, angle:angleKey, kind:angle.kind, tone:'colour', hook, subject:'s',
                  n: want ? want + 2 : 6, slides:[]};
    await writeFactDeck(deck);
    const body = deck.slides.filter(s => s.kind !== 'hook');
    return {points: body.length, last: body.length ? body[body.length-1].title : '',
            titles: body.map(s=>s.title)};
  };

  // --- a story angle headlined with a number is still a promise
  const storyCard = await write('Thrifting', 'cards', '7 POKEMON CARDS THAT QUIETLY GOT EXPENSIVE', 9);
  out.storyAngleHonoursCount = storyCard.points === 8;             // 7 points + the closer
  out.storyAngleKeepsCloser  = storyCard.last === 'CLOSING ASK';
  const storyCut = await write('iDisney', 'cut', '7 SCENES THEY CUT FROM ONE FILM', 9);
  out.disneyStoryHonoursCount = storyCut.points === 8 && storyCut.last === 'CLOSING ASK';

  // --- and a list angle keeps its closing slide instead of an eighth point
  const listSpot = await write('Thrifting', 'spotit', '7 WAYS TO SPOT A FAKE JORDAN', 9);
  out.listAngleHonoursCount = listSpot.points === 8;
  out.listAngleKeepsCloser  = listSpot.last === 'CLOSING ASK';
  out.listDropsTheExtraPoint = !listSpot.titles.includes('POINT 8');
  const listVersus = await write('iDisney', 'versus', '7 MARVEL FIGHTS THE INTERNET GETS WRONG', 9);
  out.disneyListHonoursCount = listVersus.points === 8 && listVersus.last === 'CLOSING ASK';

  // --- exact delivery is left alone, and a short one is not padded
  const exact = await write('iDisney', 'versus', '5 FIGHTS THE INTERNET GETS WRONG', 5);
  out.exactCountUntouched = exact.points === 6 && exact.last === 'CLOSING ASK';
  const short = await write('iDisney', 'versus', '7 FIGHTS THE INTERNET GETS WRONG', 4);
  out.shortDeckNotPadded = short.points === 5;

  // --- a story with no count runs to the length the run asked for
  const noCount = await write('Thrifting', 'thriftfind', 'A JACKET BOUGHT FOR FOUR POUNDS', 6);
  out.uncountedStoryUntouched = noCount.points === 7;

  // --- and a figure later in the line is not mistaken for a promise
  /* Position, not vocabulary: "GRAND" is not in the unit list and never will be, so a
     figure buried mid-line can only be told from a promise by where it sits. */
  out.midLineFigureIsNotAPromise = hookLeadsWithCount('THIS TEE SOLD FOR 8 GRAND IN 1994') === 0;
  out.wholeHookStillCountsElsewhere = hookItemCount('THIS TEE SOLD FOR 8 GRAND IN 1994') === 8;
  out.unitAfterALeadingNumber = hookLeadsWithCount('7 DAYS THAT CHANGED THE STUDIO') === 0;
  out.leadingCountIsAPromise = hookLeadsWithCount('7 CARDS THAT QUIETLY GOT EXPENSIVE') === 7;
  out.countAfterAnArticleStillCounts = hookLeadsWithCount('THE 7 SCENES THEY CUT') === 7;
  out.unitsAreNotCounts = hookLeadsWithCount('FOUR POUNDS BOUGHT THIS JACKET') === 0;

  // --- the briefs state the number rather than leaving it to the trim
  const tp = thriftDeckPrompt('Thrifting', {subject:'x', hook:'7 CARDS THAT GOT EXPENSIVE', n:9, angle:'cards'});
  out.thriftBriefStatesTheCount = /THE HEADLINE PROMISES 7\b/.test(tp) &&
                                  /Deliver exactly 7 points/.test(tp) &&
                                  /Slide 9 is ONE closing slide/.test(tp);
  const dp = disneyDeckPrompt('iDisney', {subject:'x', hook:'7 FIGHTS THE INTERNET GETS WRONG', n:9, angle:'versus'});
  out.disneyBriefStatesTheCount = /THE HEADLINE PROMISES 7\b/.test(dp) &&
                                  /Deliver exactly 7 points/.test(dp) &&
                                  /Slide 9 is ONE closing slide/.test(dp);
  out.briefAsksForTheRightTotal = /^Write a 9-slide carousel/.test(dp);
  // an uncounted story brief still reads as a story
  const sp = thriftDeckPrompt('Thrifting', {subject:'x', hook:'A JACKET FOR FOUR POUNDS', n:6, angle:'thriftfind'});
  out.uncountedBriefStaysAStory = !/THE HEADLINE PROMISES/.test(sp) && /Slide 2 sets the scene/.test(sp);
  return out;
});
await b.close();

const want = {
  storyAngleHonoursCount:true, storyAngleKeepsCloser:true, disneyStoryHonoursCount:true,
  listAngleHonoursCount:true, listAngleKeepsCloser:true, listDropsTheExtraPoint:true,
  disneyListHonoursCount:true,
  exactCountUntouched:true, shortDeckNotPadded:true, uncountedStoryUntouched:true,
  midLineFigureIsNotAPromise:true, wholeHookStillCountsElsewhere:true,
  unitAfterALeadingNumber:true, leadingCountIsAPromise:true,
  countAfterAnArticleStillCounts:true, unitsAreNotCounts:true,
  thriftBriefStatesTheCount:true, disneyBriefStatesTheCount:true,
  briefAsksForTheRightTotal:true, uncountedBriefStaysAStory:true
};
let bad = 0;
for(const [k,v] of Object.entries(want)){
  const got = r[k], ok = got === v;
  if(!ok) bad++;
  console.log((ok?'  ok  ':'FAIL  ') + k.padEnd(32) + JSON.stringify(got) + (ok ? '' : '  (wanted ' + JSON.stringify(v) + ')'));
}
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
