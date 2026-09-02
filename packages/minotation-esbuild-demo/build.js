const esbuild = require('esbuild');
const { mnEsbuild } = require('minotation-esbuild');

esbuild.build({
  entryPoints: ['src/main.jsx'],
  outdir: 'dist',
  bundle: true,
  plugins: [mnEsbuild({ attr: 'class' })],
}).catch(() => process.exit(1));
