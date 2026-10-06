/**
 * Webpack loader: извлекает MN-токены из исходников.
 */
import type { LoaderDefinitionFunction } from 'webpack';
import { createAttrsScanner, createFileFilter } from 'minotation-build';
import type { MnBuildOptions } from 'minotation-build';
import { getState } from './state';

/**
 * Опции webpack-лоадера MN — сканирующая часть эталонного набора
 * `minotation-build` (D-026): `attrs`, `include`, `exclude`, `skipPartials`,
 * `classVarSuffixes`, `mergeFnNames`, `syntax`. Описание каждой — в README
 * `minotation-build`. Компилирующая часть (`presets`, `safelist`, `mn`) — у
 * {@link MnWebpackPlugin}.
 *
 * Какие файлы попадают в лоадер, решает `test` правила webpack, поэтому
 * `extensions` здесь ничего не ограничивает; `include`/`exclude`/`skipPartials`
 * отсекают файлы внутри правила.
 */
export type MnLoaderOptions = Pick<MnBuildOptions,
  'attrs' | 'include' | 'exclude' | 'skipPartials' | 'classVarSuffixes' | 'mergeFnNames' | 'syntax'>;

/**
 * Webpack-лоадер Minimalist Notation.
 *
 * Проходит по исходнику, ищет значения указанных атрибутов,
 * добавляет найденные токены в shared-стейт и возвращает исходник без изменений.
 * CSS не генерируется здесь — это делает {@link MnWebpackPlugin}.
 *
 * Использует {@link createScanner} из ядра minotation — одну реализацию сканера на все
 * сборщики: литеральные строки, JSX-выражения, template literals (интерполяции
 * `${...}` отбрасываются), объектные литералы (MUI `slotProps`), переменные
 * с суффиксом `Class` и строковые аргументы `mne`/`mnClass`.
 */
const loader: LoaderDefinitionFunction<MnLoaderOptions> = function (source) {
  const options = this.getOptions() as MnLoaderOptions;
  const state = getState();

  // Тот же сканер с разворачиванием атрибутов, что у остальных плагинов
  // (`minotation-build`): запись помечена целевым атрибутом, плагин
  // компилирует её в `class` или `[attr~=…]`.
  const scan = createAttrsScanner(options);
  // Пустое расширение пропускает любой файл: что сканировать, выбрал `test` правила.
  const accepted = createFileFilter({
    ...options,
    extensions: [''],
  }, this.rootContext || process.cwd()).accepts(this.resourcePath);
  const tokens = new Set<string>(accepted ? scan(source as string, this.resourcePath) : []);

  // Набор ЗАМЕНЯЕТСЯ целиком, а не дополняется: иначе токен, убранный из
  // разметки при редактировании, оставался бы в CSS до перезапуска сборки.
  // Файл без токенов снимается с учёта, чтобы не копить пустые записи.
  if (tokens.size > 0) {
    state.tokensByFile.set(this.resourcePath, tokens);
  } else {
    state.tokensByFile.delete(this.resourcePath);
  }

  return source;
};

export default loader;
