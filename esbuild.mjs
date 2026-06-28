import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  external: ['vscode'],
  logLevel: 'info'
};

if (watch) {
  const result = await build({
    ...ctx,
    watch: {
      onRebuild(error) {
        if (error) {
          console.error('rebuild failed', error);
          return;
        }
        console.log('rebuild succeeded');
      }
    }
  });
  console.log('watching for changes');
  await result;
} else {
  await build(ctx);
}