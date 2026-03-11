import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  // outDir: 'dist',
  // clean: true,
  // target: 'node20',
  deps: {
    // Bundle everything into the action artifact.
    alwaysBundle: [/^.*/],
  },
  outputOptions: { minify: false },
  format: 'esm',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
