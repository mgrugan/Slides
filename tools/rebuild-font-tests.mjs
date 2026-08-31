/* The font rebuilder, checked against ground truth. It renders a specimen sheet from a
   face the page already carries, rebuilds a font from that picture alone, and compares
   the result with the original it never saw.

   Three bugs got through before this existed, and each one produced a font file that
   compiled cleanly and looked plausible in a directory listing: the tracer was fed the
   ink rather than its inverse and vectorised the white space; contours came out wound
   at random so counters filled in solid; and one baseline was averaged across both rows
   of the sheet, which left the digits floating half a line above the letters. Only
   rendering the thing and measuring it catches any of that. */
import { chromium } from 'playwright-core';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const ROWS = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', '1234567890'];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fontrebuild-'));
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = []; p.on('pageerror', e=>errs.push(String(e)));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(1800);

// ---- a specimen sheet, exactly as somebody would photograph one
const sheet = await p.evaluate(async ({rows, capPx})=>{
  await fontReady(PRESETS[PRESETS.findIndex(x=>x.name==='Pickuplines')]);
  const size = Math.round(capPx / 0.72);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '900 ' + size + 'px "Bernoru"';
  if('letterSpacing' in probe) probe.letterSpacing = Math.round(size*0.18)+'px';
  const w = Math.max(...rows.map(r=>probe.measureText(r).width)) + size;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w); c.height = Math.ceil(size*3.2);
  const g = c.getContext('2d');
  g.fillStyle='#fff'; g.fillRect(0,0,c.width,c.height);
  g.fillStyle='#000'; g.textBaseline='alphabetic';
  g.font = '900 '+size+'px "Bernoru"';
  if('letterSpacing' in g) g.letterSpacing = Math.round(size*0.18)+'px';
  g.fillText(rows[0], size*0.5, size*1.2);
  g.fillText(rows[1], size*0.5, size*2.6);
  return c.toDataURL('image/png');
}, {rows: ROWS, capPx: 120});
const img = path.join(dir, 'sheet.png');
fs.writeFileSync(img, Buffer.from(sheet.split(',')[1], 'base64'));

// ---- rebuild from the picture alone
const out = path.join(dir, 'Probe-Black');
let log = '';
try{
  log = execFileSync('python3', ['tools/rebuild-font.py', img, ...ROWS,
                                 '--name','Probe','--style','Black','--out',out],
                     {encoding:'utf8'});
}catch(e){
  console.log('FAIL  the rebuild did not run\n' + (e.stdout||'') + (e.stderr||''));
  await b.close(); process.exit(1);
}
const madeTtf = fs.existsSync(out + '.ttf'), madeWoff = fs.existsSync(out + '.woff2');

// ---- and measure it against the face it was copied from
await p.setInputFiles('#fontFile', [out + '.ttf']);
await p.waitForTimeout(2200);
const r = await p.evaluate(async (chars)=>{
  await document.fonts.load('900 120px "Probe"');
  await document.fonts.ready;
  const o = {registered: fontAvailable('Probe')};
  const ink = (fam, ch, size, w, h, bx, by) => {
    const c = document.createElement('canvas'); c.width=w; c.height=h;
    const x = c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,w,h);
    x.fillStyle='#000'; x.font='900 '+size+'px "'+fam+'"';
    x.textAlign='center'; x.textBaseline='alphabetic';
    x.fillText(ch, bx, by);
    return x.getImageData(0,0,w,h).data;
  };
  const overlap = (a, b2) => {
    let all=0, both=0;
    for(let i=0;i<a.length;i+=4){ const A=a[i]<128, B=b2[i]<128; if(A||B) all++; if(A&&B) both++; }
    return all ? both/all : 1;
  };
  // shape, glyph by glyph, each centred so spacing cannot flatter or spoil it
  const per = chars.split('').map(ch =>
    overlap(ink('Bernoru',ch,120,200,200,100,160), ink('Probe',ch,120,200,200,100,160)));
  o.worstGlyph = chars[per.indexOf(Math.min(...per))];
  o.worst = Math.round(Math.min(...per)*1000)/10;
  o.shape = Math.round(per.reduce((a,b)=>a+b,0)/per.length*1000)/10;
  // and the whole word, which only agrees if the metrics agree too
  o.word = Math.round(overlap(ink('Bernoru','ABCDEFGHIJ',90,1800,180,900,130),
                              ink('Probe','ABCDEFGHIJ',90,1800,180,900,130))*1000)/10;
  const w = fam => { const x=document.createElement('canvas').getContext('2d');
    x.font='900 62px "'+fam+'"'; return x.measureText('TOM BRADY LAUNCHES').width; };
  o.widthDrift = Math.round(Math.abs(w('Probe')-w('Bernoru'))/w('Bernoru')*1000)/10;
  // the digits have to sit on the same baseline as the letters, not float above them
  const foot = (fam, ch) => {
    const c=document.createElement('canvas'); c.width=200; c.height=260;
    const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,200,260);
    x.fillStyle='#000'; x.font='900 120px "'+fam+'"'; x.textAlign='center'; x.textBaseline='alphabetic';
    x.fillText(ch,100,180);
    const d=x.getImageData(0,0,200,260).data;
    for(let y=259;y>=0;y--) for(let px=0;px<200;px++) if(d[(y*200+px)*4]<128) return y;
    return -1;
  };
  o.baselineDrift = Math.abs(foot('Probe','1') - foot('Probe','H'));
  return o;
}, ROWS.join(''));
await b.close();
fs.rmSync(dir, {recursive:true, force:true});

const checks = [
  ['a .ttf was written',            madeTtf === true,            madeTtf],
  ['a .woff2 was written',          madeWoff === true,           madeWoff],
  ['it registers as a usable font', r.registered === true,       r.registered],
  ['glyph shapes match >= 80%',     r.shape >= 80,               r.shape + '%'],
  ['worst single glyph >= 60%',     r.worst >= 60,               r.worst + '% (' + r.worstGlyph + ')'],
  ['whole word matches >= 55%',     r.word >= 55,                r.word + '%'],
  ['line width within 8%',          r.widthDrift <= 8,           r.widthDrift + '%'],
  ['digits share the letters\' baseline', r.baselineDrift <= 3,  r.baselineDrift + 'px'],
];
let bad = 0;
for(const [name, ok, got] of checks){
  if(!ok) bad++;
  console.log((ok ? '  ok  ' : 'FAIL  ') + name.padEnd(38) + got);
}
if(/note:/.test(log)) console.log(log.split('\n').filter(l=>/note:|gaps in the sheet/.test(l)).join('\n'));
if(errs.length){ console.log('page errors:'); errs.forEach(e=>console.log('  '+e)); bad++; }
console.log(bad ? bad + ' failing' : 'all good');
process.exit(bad ? 1 : 0);
