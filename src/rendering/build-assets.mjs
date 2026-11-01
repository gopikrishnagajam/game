/** Reproducible original GLB authoring; run `node src/rendering/build-assets.mjs`. */
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot=fileURLToPath(new URL('../..',import.meta.url));
// GLTFExporter only needs the binary Blob reader for these texture-free assets.
globalThis.FileReader=class {
  result=null;
  onloadend=null;
  onerror=null;
  readAsArrayBuffer(blob) {blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
  readAsDataURL(blob) {blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();}).catch(error=>this.onerror?.(error));}
};
const bundle=await build({entryPoints:[join(projectRoot,'src/rendering/export.ts')],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const module=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const binary=await module.exportOriginalCricketPlayer();
const assetPath=join(projectRoot,'public/assets/fun-cricket-batter.glb');
await mkdir(dirname(assetPath),{recursive:true});await writeFile(assetPath,Buffer.from(binary));
const view=new DataView(binary);const jsonSize=view.getUint32(12,true);const gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(binary,20,jsonSize)));
await writeFile(join(projectRoot,'public/assets/fun-cricket-batter.asset.json'),JSON.stringify({
  name:'Fun Cricket original articulated batter',bytes:binary.byteLength,format:'GLB 2.0',
  geometrySource:'src/rendering/player.ts',animationSource:'src/animation/pose.ts',
  animationSources:['src/animation/pose.ts','src/animation/stroke.ts','src/animation/rigid.ts'],
  exporter:'src/rendering/export.ts',rebuild:'node src/rendering/build-assets.mjs',
  license:'Original project asset; no third-party character, animation, or likeness.',
  runtime:'The game builds this original geometry from source and samples the original animation curves for exact physical contact. This GLB is a portable baked export, not a separate runtime simulation.',
  clips:gltf.animations.map(animation=>animation.name),
},null,2)+'\n');
console.log(`Exported ${assetPath} (${binary.byteLength} bytes; ${gltf.animations.length} animation clips).`);
