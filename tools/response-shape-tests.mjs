import { chromium } from 'playwright-core';

const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
await p.goto('file:///home/user/Slides/index.html');
await p.waitForTimeout(800);

const B64 = 'A'.repeat(800);
const JPEG = '/9j/4AAQSkZJRgABAQEBLAEsAAD' + 'A'.repeat(900);   // real JPEG magic prefix
const PNG  = 'iVBORw0KGgo' + 'B'.repeat(900);
const SHAPES = {
  // what the app already handled
  generateContent: {candidates:[{content:{parts:[{text:'HELLO'}]}}]},
  // plausible Interactions shapes
  outputMessage:   {id:'x', output:[{type:'message', content:[{type:'output_text', text:'HELLO'}]}]},
  outputTextPart:  {output:[{type:'text', text:'HELLO'}]},
  outputsArray:    {outputs:[{content:[{type:'text', text:'HELLO'}]}]},
  contentArray:    {content:[{type:'text', text:'HELLO'}]},
  messageObject:   {message:{content:[{type:'text', text:'HELLO'}]}},
  choicesOpenAI:   {choices:[{message:{role:'assistant', content:'HELLO'}}]},
  responseNested:  {response:{output:[{content:[{text:'HELLO'}]}]}},
  flatText:        {text:'HELLO'},
  outputTextFlat:  {output_text:'HELLO'},
  deepUnknown:     {result:{turns:[{answer:{body:'HELLO'}}]}},
  // must NOT read our own prompt back
  echoedInput:     {input:[{type:'text', text:'MY PROMPT'}], output:[{content:[{type:'output_text', text:'HELLO'}]}]},
  // images
  imgInline:       {candidates:[{content:{parts:[{inline_data:{mime_type:'image/jpeg', data:B64}}]}}]},
  imgTypedPart:    {output:[{type:'image', mime_type:'image/png', data:B64}]},
  imgNestedImage:  {output:[{content:[{image:{mime_type:'image/webp', data:B64}}]}]},
  imgB64Json:      {data:[{b64_json:B64, mime_type:'image/png'}]},
  // what interactions actually did: image bytes delivered in a text-ish field
  imgAsText:       {output:[{content:[{type:'text', text:JPEG}]}]},
  imgAsContentStr: {output:[{type:'image', content:JPEG}]},
  imgAsImageStr:   {output:[{image:JPEG}]},
  imgOddKey:       {result:{media:[{blob:PNG}]}},
  imgDataUrl:      {output:[{content:[{text:'data:image/jpeg;base64,'+JPEG}]}]},
};

const res = await p.evaluate(shapes => {
  const o = {};
  for(const [k,v] of Object.entries(shapes)){
    const r = parseResponse(v);
    o[k] = {text:r.text, imgs:r.images.length, imgOk: r.images.every(i=>i.startsWith('data:image'))};
  }
  return o;
}, SHAPES);

let pass = 0, fail = [];
for(const [k,v] of Object.entries(res)){
  const wantImg = k.startsWith('img');
  const ok = wantImg ? (v.imgs >= 1 && v.imgOk && !v.text)
           : k === 'echoedInput' ? (v.text === 'HELLO')
           : (v.text === 'HELLO');
  ok ? pass++ : fail.push([k, JSON.stringify(v)]);
}
console.log('pass', pass + '/' + Object.keys(res).length);
if(fail.length) console.log('FAIL:\n' + fail.map(f=>' '+f[0]+' -> '+f[1]).join('\n'));
if(errs.length) console.log(errs.join('\n'));
await b.close();
