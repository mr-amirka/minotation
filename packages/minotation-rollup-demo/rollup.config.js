const { mnRollup } = require('minotation-rollup');
const { presetStandard, presetSynonyms, presetMedias } = require('minotation');

module.exports = {
  input: 'src/main.jsx',
  output: { file: 'dist/bundle.js', format: 'es' },
  // Пресеты — явно: по умолчанию не подключается ни один (D-110).
  plugins: [mnRollup({ attrs: 'class', presets: [presetStandard, presetSynonyms, presetMedias] })],
};
