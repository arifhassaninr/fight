// Static checks only; run with: node tests/smoke-check.js
// Browser/WebGL gameplay checks must still be performed manually.
const fs=require('node:fs');
const cp=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const files=['index.html','styles.css','game.js','vercel.json','README.md'];
for(const name of files){if(!fs.existsSync(path.join(root,name)))throw Error('Missing file: '+name);}
JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
cp.execFileSync(process.execPath,['--check',path.join(root,'game.js')]);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'game.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
const ids=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
const used=new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]));
for(const id of used){if(!ids.has(id)&&!['manual-back','records-back','save-settings'].includes(id))throw Error('Missing element id: '+id);}
for(const id of ['menu','hud','pause','results','dialog','loading','mobile-controls'])if(!ids.has(id))throw Error('Missing screen: '+id);
for(const i of ['three','three/addons/'])if(!html.includes('"'+i+'"'))throw Error('Import map missing '+i);
if(!html.includes('type="module" src="./game.js"'))throw Error('Game module path missing');
if(!css.includes('@media(pointer:coarse)'))throw Error('Touch responsive CSS missing');
console.log('PASS: JS syntax, JSON, HTML selectors, import map, required screens, mobile styles.');
console.log('NOTE: This does not verify WebGL runtime, combat balance or touch gameplay.');
