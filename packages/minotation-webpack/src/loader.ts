/**
 * Webpack loader: извлекает MN-токены из исходников.
 */
import type { LoaderDefinitionFunction } from 'webpack';
import { scanTokens } from 'minotation';
import { getState } from './state';

/** Опции webpack-лоадера MN. */
interface MnLoaderOptions {
  /**
   * Список HTML/JSX атрибутов, в значениях которых ищутся MN-токены.
   * @default ['class']
   */
  attrs?: string[];
  /**
   * Суффиксы имён переменных, чьё строковое значение считается списком MN-токенов
   * (`const thClass = 'py12 px14'`). Пустой массив отключает механизм.
   * @default ['Class']
   */
  classVarSuffixes?: string[];
  /**
   * Имена функций слияния токенов, чьи строковые аргументы сканируются
   * (`mne('pt26 pb6', props.class)`). Пустой массив отключает механизм.
   * @default ['mne', 'mnClass']
   */
  mergeFnNames?: string[];
}

/**
 * Webpack-лоадер Minimalist Notation.
 *
 * Проходит по исходнику, ищет значения указанных атрибутов,
 * добавляет найденные токены в shared-стейт и возвращает исходник без изменений.
 * CSS не генерируется здесь — это делает {@link MnWebpackPlugin}.
 *
 * Использует {@link scanTokens} из ядра minotation — одну реализацию сканера на все
 * сборщики: литеральные строки, JSX-выражения, template literals (интерполяции
 * `${...}` отбрасываются), объектные литералы (MUI `slotProps`), переменные
 * с суффиксом `Class` и строковые аргументы `mne`/`mnClass`.
 */
const loader: LoaderDefinitionFunction<MnLoaderOptions> = function (source) {
  const options = this.getOptions() as MnLoaderOptions;
  const attrNames = options.attrs || ['class'];
  const state = getState();

  const tokens = new Set<string>();
  for (const attr of attrNames) {
    for (const t of scanTokens(source as string, {
      attr,
      classVarSuffixes: options.classVarSuffixes,
      mergeFnNames: options.mergeFnNames,
    })) {
      tokens.add(t);
    }
  }

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
