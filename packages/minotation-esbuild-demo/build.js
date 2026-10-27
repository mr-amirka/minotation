const esbuild = require('esbuild');
const { mnEsbuild } = require('minotation-esbuild');
const { presetStandard, presetSynonyms, presetMedias } = require('minotation');

esbuild.build({
  entryPoints: ['src/main.jsx'],
  outdir: 'dist',
  bundle: true,
  // Пресеты — явно: по умолчанию не подключается ни один (D-110).
  plugins: [mnEsbuild({ attrs: 'class', presets: [presetStandard, presetSynonyms, presetMedias] })],
}).catch(() => process.exit(1));
