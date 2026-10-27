const { withMn } = require('minotation-next');
const { presetStandard, presetSynonyms, presetMedias } = require('minotation');

// Пресеты — явно: по умолчанию не подключается ни один (D-110).
module.exports = withMn({}, { presets: [presetStandard, presetSynonyms, presetMedias] });
