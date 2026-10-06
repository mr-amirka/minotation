/**
 * Webpack loader: передаёт исходник модуля накопителям плагинов.
 *
 * Плагин сам сканирует проект перед сборкой; лоадер добирает модули вне корня
 * скана — общие пакеты монорепо, сгенерированные файлы. Опций у лоадера нет:
 * что и как сканировать, задаётся у {@link MnWebpackPlugin} (эталонный набор
 * `minotation-build`, D-026), и лоадер обязан следовать тем же настройкам.
 */
import type { LoaderDefinitionFunction } from 'webpack';
import { getState } from './state';

/**
 * Webpack-лоадер Minimalist Notation: исходник уходит каждому плагину сборки,
 * чей отбор файлов его принимает; сам модуль возвращается без изменений.
 * Набор токенов файла ЗАМЕНЯЕТСЯ целиком — токен, убранный при правке, из CSS
 * уходит.
 */
const loader: LoaderDefinitionFunction = function (source) {
  for (const plugin of getState().plugins.values()) {
    plugin.files.accepts(this.resourcePath) && plugin.build.add(this.resourcePath, source as string);
  }
  return source;
};

export default loader;
