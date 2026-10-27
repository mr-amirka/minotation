const { withMn } = require('minotation-next');
const { presetStandard, presetSynonyms, presetMedias } = require('minotation');

module.exports = withMn({
  // minotation-next работает только с webpack-бандлером Next.js. Turbopack
  // (opt-in через --turbopack) его не поддерживает — по умолчанию (без флага)
  // next build/next dev используют webpack, так что дополнительных флагов
  // не требуется, только не включайте --turbopack.
}, {
  // Пресеты — явно: по умолчанию не подключается ни один (D-110).
  presets: [presetStandard, presetSynonyms, presetMedias],
});
