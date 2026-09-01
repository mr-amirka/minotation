/**
 * minotation-webpack
 *
 * Webpack loader + plugin для Minimalist Notation.
 *
 * Использование:
 *   // webpack.config.js
 *   const { MnWebpackPlugin } = require('minotation-webpack');
 *
 *   module.exports = {
 *     module: {
 *       rules: [{ test: /\.(html|php)$/, use: 'minotation-webpack/loader' }],
 *     },
 *     plugins: [new MnWebpackPlugin({ output: 'dist/app.css' })],
 *   };
 */

export { MnWebpackPlugin } from './plugin';
export type { MnWebpackPluginOptions } from './plugin';
export { default as loader } from './loader';
export { default as presetLoader } from './preset-loader';
