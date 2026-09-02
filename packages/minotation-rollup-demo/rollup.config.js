const { mnRollup } = require('minotation-rollup');

module.exports = {
  input: 'src/main.jsx',
  output: { file: 'dist/bundle.js', format: 'es' },
  plugins: [mnRollup({ attr: 'class' })],
};
