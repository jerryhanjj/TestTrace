import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

const options = {
  entryPoints: {
    index: 'src/index.ts'
  },
  bundle: true,
  outdir: 'dist',
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info'
};

if (watch) {
  const result = await build({
    ...options,
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
  await build(options);
}