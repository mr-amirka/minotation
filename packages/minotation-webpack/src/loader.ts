/**
 * Webpack loader: извлекает MN-токены из исходников.
 */
import type { LoaderDefinitionFunction } from 'webpack';
import { extractTokens } from 'minotation';
import { getState } from './state';

/** Опции webpack-лоадера MN. */
interface MnLoaderOptions {
  /**
   * Список HTML/JSX атрибутов, в значениях которых ищутся MN-токены.
   * @default ['class']
   */
  attrs?: string[];
}

/**
 * Webpack-лоадер Minimalist Notation.
 *
 * Проходит по исходнику, ищет значения указанных атрибутов,
 * добавляет найденные токены в shared-стейт и возвращает исходник без изменений.
 * CSS не генерируется здесь — это делает {@link MnWebpackPlugin}.
 *
 * Использует {@link extractTokens} из ядра minotation — поддерживает
 * литеральные строки, JSX-выражения со строкой и template literals
 * (интерполяции `${...}` отбрасываются). Объектные литералы (MUI `slotProps`
 * и т.п.) — пока не поддерживаются, см. `PLAN.md` minotation.
 */
const loader: LoaderDefinitionFunction<MnLoaderOptions> = function (source) {
  const options = this.getOptions() as MnLoaderOptions;
  const attrNames = options.attrs || ['class'];
  const state = getState();

  const tokens = new Set<string>();
  for (const attr of attrNames) {
    for (const t of extractTokens(source as string, attr)) {
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
