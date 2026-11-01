import { defineConfig } from 'vitest/config';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  plugins: [{name:'typecheck-production',apply:'build',buildStart(){
    execFileSync(process.execPath,[fileURLToPath(new URL('./node_modules/typescript/bin/tsc',import.meta.url)),'--noEmit'],{stdio:'inherit'});
  }}],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  build: { target: 'es2022',rollupOptions:{output:{manualChunks:{three:['three']}}} },
});
