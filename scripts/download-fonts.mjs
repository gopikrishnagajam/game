/** Vendor the open-license fonts so ordinary play has no network dependency. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory=fileURLToPath(new URL('../public/assets/fonts/',import.meta.url));
await mkdir(directory,{recursive:true});
const families=[
  {name:'Barlow Condensed',folder:'barlowcondensed',query:'Barlow+Condensed:wght@500;600;700;800;900'},
  {name:'DM Sans',folder:'dmsans',query:'DM+Sans:wght@400;500;600;700;800'},
  {name:'IBM Plex Mono',folder:'ibmplexmono',query:'IBM+Plex+Mono:wght@400;500;600'},
];
let stylesheet='/* Local open-license typography. Rebuild: node scripts/download-fonts.mjs */\n';
const downloaded=new Map();
for(const family of families){
  const response=await fetch(`https://fonts.googleapis.com/css2?family=${family.query}&display=swap`,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36'}});
  if(!response.ok)throw new Error(`Font stylesheet failed: ${response.status}`);
  const css=await response.text();
  // Retain Latin subset only; UI is English. Each static weight has its own file.
  const faces=[...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map(m=>m[1]);
  if(!faces.length)throw new Error(`Latin font missing: ${family.name}`);
  let count=0;
  for(let face of faces){
    const match=face.match(/url\((https:[^)]+)\)/);if(!match)throw new Error('Font URL missing');
    let filename=downloaded.get(match[1]);
    if(!filename){
      filename=`${family.folder}-${count++}.woff2`;
      const font=await fetch(match[1]);if(!font.ok)throw new Error('Font download failed');
      await writeFile(directory+filename,Buffer.from(await font.arrayBuffer()));
      downloaded.set(match[1],filename);
    }
    face=face.replace(match[1],`./${filename}`);stylesheet+=face+'\n';
  }
  const license=await fetch(`https://raw.githubusercontent.com/google/fonts/main/ofl/${family.folder}/OFL.txt`);
  if(!license.ok)throw new Error(`Font license missing: ${family.name}`);
  await writeFile(directory+`${family.folder}-OFL.txt`,await license.text());
}
await writeFile(directory+'fonts.css',stylesheet);
console.log('Downloaded local Latin fonts and SIL Open Font License notices.');
