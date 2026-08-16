/* Getting the pictures back out. "Export" only ever wrote a JSON backup, so there was
   no way to download the images themselves — per collection or one at a time. */
import { chromium } from 'playwright-core';

/* JSZip comes from a CDN at runtime. Stubbing it keeps this test off the network and,
   more usefully, records exactly what the app puts into the archive — names, order,
   payloads — which is what actually needs checking. */
const zipStub = () => {
  window.__zips = [];
  window.JSZip = function(){
    const files = {};
    this.file = (name, data) => { files[name] = data; };
    this.folder = () => this;
    this.generateAsync = async () => { window.__zips.push(files); return new Blob(['zip:'+Object.keys(files).length]); };
  };
};

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.addInitScript(zipStub);
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1300);

// stock two collections with real images
await p.evaluate(async ()=>{
  await libClear();
  const frame = (hue) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 500;
    const x = c.getContext('2d');
    x.fillStyle = 'hsl('+hue+',40%,45%)'; x.fillRect(0,0,400,500);
    return c.toDataURL('image/jpeg', 0.9);
  };
  const di = PRESETS.findIndex(x=>x.caption_treatment === 'documentary');
  S.profile = JSON.parse(JSON.stringify(PRESETS[di])); S.styleKey = 'preset:'+di;
  for(let i=0;i<3;i++) await keepInLibrary({id:'f'+i, kind:'slide', title:'T', scene:'a harbour at dawn '+i, tone:'mono'}, frame(20*i));
  S.profile = JSON.parse(JSON.stringify(PRESETS[0])); S.styleKey = 'preset:0';
  for(let i=0;i<2;i++) await keepInLibrary({id:'g'+i, kind:'slide', title:'T', scene:'a fairway '+i}, frame(120+20*i));
  await new Promise(r=>setTimeout(r, 900));
});

// capture downloads instead of writing them to disk
const grabbed = [];
await p.exposeFunction('__grab', (name, bytes) => { grabbed.push({name, bytes}); });
await p.evaluate(()=>{
  const realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function(){
    if(this.download){
      if(/^blob:/.test(this.href)){
        fetch(this.href).then(r=>r.blob()).then(bl=>window.__grab(this.download, bl.size));
      } else {
        window.__grab(this.download, Math.round((this.href.split(',')[1]||'').length * 0.75));
      }
      return;
    }
    return realClick.apply(this, arguments);
  };
});

// 1 — the whole Facts collection as a ZIP
const facts = await p.evaluate(async ()=>{
  LIB_COLL = 'Facts'; renderLibrary();
  await downloadLibraryImages();
  await new Promise(r=>setTimeout(r, 1200));
  return {coll: LIB_COLL, inColl: LIB.filter(x=>collectionOf(x) === 'Facts').length,
          entries: Object.keys(window.__zips[window.__zips.length-1] || {}),
          index: (window.__zips[window.__zips.length-1]||{})['index.txt'] || '',
          allBase64: Object.entries(window.__zips[window.__zips.length-1]||{})
            .filter(([k])=>k !== 'index.txt').every(([,v])=>typeof v === 'string' && v.length > 200),
          logged: [...document.querySelectorAll('#log div')].some(d=>/downloaded 3 images from Facts/.test(d.textContent))};
});

// 2 — General is a separate ZIP, not the same one
const general = await p.evaluate(async ()=>{
  LIB_COLL = 'General'; renderLibrary();
  await downloadLibraryImages();
  await new Promise(r=>setTimeout(r, 1200));
  return {inColl: LIB.filter(x=>collectionOf(x) === 'General').length,
          entries: Object.keys(window.__zips[window.__zips.length-1] || {}),
          zipsMade: window.__zips.length};
});

// 3 — one image on its own, from the grid
const single = await p.evaluate(async ()=>{
  LIB_COLL = 'Facts'; renderLibrary();
  const btn = document.querySelector('#libGrid .libItem .dl');
  const had = !!btn;
  if(btn) btn.click();
  await new Promise(r=>setTimeout(r, 700));
  return {hasPerItemButton: had};
});

// 4 — an empty collection says so instead of producing a broken file
const empty = await p.evaluate(async ()=>{
  const before = window.__zips.length;
  LIB_COLL = 'Nothing Here'; renderLibrary();
  await downloadLibraryImages();
  await new Promise(r=>setTimeout(r, 400));
  LIB_COLL = null;
  return {warned: [...document.querySelectorAll('#log div')].some(d=>/nothing in the Nothing Here/.test(d.textContent)),
          noZipMade: window.__zips.length === before};
});

await p.waitForTimeout(600);
const zips = grabbed.filter(g=>/\.zip$/.test(g.name));
const jpgs = grabbed.filter(g=>/\.jpg$/.test(g.name));

const fail = [];
if(zips.length !== 2) fail.push('expected 2 zips, got '+zips.length+': '+zips.map(z=>z.name).join());
if(!zips.some(z=>/^facts-backgrounds-3\.zip$/.test(z.name))) fail.push('Facts zip wrong: '+zips.map(z=>z.name).join());
if(!zips.some(z=>/^general-backgrounds-2\.zip$/.test(z.name))) fail.push('General zip wrong: '+zips.map(z=>z.name).join());
if(facts.entries.length !== 4) fail.push('Facts zip entries: '+facts.entries.join());
if(!facts.entries.includes('index.txt')) fail.push('no index.txt in the zip');
// named from the scene and numbered in the order shown (newest first), not by id
if(!facts.entries.filter(e=>e !== 'index.txt')
     .every((e,i)=>e.startsWith(String(i+1).padStart(3,'0')+'_a-harbour-at-dawn-') && e.endsWith('.jpg')))
  fail.push('images not named from the scene: '+facts.entries.join());
if(facts.index.split('\n').length !== 3) fail.push('index.txt does not list every image');
if(!facts.allBase64) fail.push('zip entries are not real image payloads');
if(!facts.logged) fail.push('no confirmation logged');
if(general.entries.length !== 3) fail.push('General zip entries: '+general.entries.join());
if(general.zipsMade !== 2) fail.push('collections were not zipped separately');
if(!empty.noZipMade) fail.push('an empty collection still produced a zip');
if(!single.hasPerItemButton) fail.push('no per-image download button');
if(jpgs.length !== 1) fail.push('expected 1 single-image download, got '+jpgs.length);
if(jpgs.length && jpgs[0].bytes < 500) fail.push('single image is empty');
if(facts.inColl !== 3 || general.inColl !== 2) fail.push('collections not stocked as expected');
if(!empty.warned) fail.push('an empty collection did not warn');

console.log(JSON.stringify({zips, jpgs, facts, general, single, empty, errs}, null, 1));
console.log(fail.length ? 'FAIL\n' + fail.map(f=>' - '+f).join('\n')
                        : 'PASS  images come out, per collection and one at a time');
await b.close();
process.exit(fail.length ? 1 : 0);
