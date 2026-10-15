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
import type { MnPluginHandle } from './state';

/**
 * Webpack-лоадер Minimalist Notation: исходник уходит каждому плагину сборки,
 * чей отбор файлов его принимает. Модуль возвращается без изменений — кроме файлов
 * изолированной области пакета: в их разметку дописывается класс области (D-075, D-076).
 * Набор токенов файла ЗАМЕНЯЕТСЯ целиком — токен, убранный при правке, из CSS
 * уходит.
 */
const loader: LoaderDefinitionFunction = function (source) {
  let code = source as string;
  let scoped: ReturnType<MnPluginHandle['rewrite']>;
  for (const plugin of getState().plugins.values()) {
    if (!plugin.files.accepts(this.resourcePath)) continue;
    plugin.build.add(this.resourcePath, code);
    scoped = plugin.rewrite(this.resourcePath, code);
    if (!scoped) continue;
    for (const message of scoped.warnings) this.emitWarning(new Error(message));
    code = scoped.code === undefined ? code : scoped.code;
  }
  return code;
};

export default loader;
