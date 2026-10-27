/**
 * @overview Пресеты normalize (D-108): у каждого эталона — свой пресет, версия эталона — в имени. Пресет воспроизводит
 * эталон из npm один в один; приложение берёт тот, что подходит его браузерам. В наборы по умолчанию сброс не входит.
 *
 * - normalize.css (github.com/necolas/normalize.css, MIT): 3.0.3 — IE 8+, Safari 6+; 4.2.0–7.0.0 — последние две
 *   версии браузеров и IE 8+; 8.0.1 — IE 10+, Safari 8+, Firefox ESR+.
 * - modern-normalize (github.com/sindresorhus/modern-normalize, MIT): 1.1.0, 2.0.0, 3.0.1 — последние Chrome,
 *   Firefox, Safari.
 *
 * @example
 * import { presetStandard, presetNormalize8_0_1 } from 'minotation';
 * mnVite({ presets: [presetStandard, presetNormalize8_0_1] });
 */
export {
  presetNormalize3_0_3,
} from './presetNormalize3_0_3';
export {
  presetNormalize4_2_0,
} from './presetNormalize4_2_0';
export {
  presetNormalize5_0_0,
} from './presetNormalize5_0_0';
export {
  presetNormalize6_0_0,
} from './presetNormalize6_0_0';
export {
  presetNormalize7_0_0,
} from './presetNormalize7_0_0';
export {
  presetNormalize8_0_1,
} from './presetNormalize8_0_1';
export {
  presetModernNormalize1_1_0,
} from './presetModernNormalize1_1_0';
export {
  presetModernNormalize2_0_0,
} from './presetModernNormalize2_0_0';
export {
  presetModernNormalize3_0_1,
} from './presetModernNormalize3_0_1';
