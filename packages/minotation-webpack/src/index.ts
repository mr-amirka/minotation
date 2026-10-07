/**
 * minotation-webpack
 *
 * Webpack plugin + loaders для Minimalist Notation.
 *
 * Использование:
 *   // webpack.config.js
 *   const { MnWebpackPlugin } = require('minotation-webpack');
 *   module.exports = {
 *     plugins: [new MnWebpackPlugin({ attrs: 'class, className:class' })],
 *   };
 *
 *   // src/index.js — CSS через конвейер проекта (имя с хешем, ссылка в HTML)
 *   import 'minotation-webpack/mn.css';
 */

export { MnWebpackPlugin, MN_CSS_REQUEST } from './plugin';
export type { MnWebpackPluginOptions } from './plugin';
export type { MnAttrs } from 'minotation-build';
import { checkBuildOptions as checkBuildOptionsImpl } from 'minotation-build';
/**
 * Проверка опций плагина (D-038) — для обёрток над ним (next): неизвестный
 * ключ и некорректное значение — ошибка с подсказкой.
 */
export const checkBuildOptions = checkBuildOptionsImpl;
export { default as loader } from './loader';
export { default as presetLoader } from './preset-loader';
