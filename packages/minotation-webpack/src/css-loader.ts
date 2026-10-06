/**
 * CSS-лоадер: отдаёт содержимое модуля `minotation-webpack/mn.css`.
 *
 * Сам файл в пакете — заглушка. Правило с этим лоадером (`enforce: 'pre'`)
 * добавляет {@link MnWebpackPlugin}, и дальше CSS ведёт штатный конвейер
 * проекта (Next.js, `css-loader` + `mini-css-extract-plugin`, нативный CSS
 * webpack): имя с хешем, ссылка в HTML, минификация (D-031).
 *
 * Запись `entry` — query: `minotation-webpack/mn.css?entry=admin`.
 *
 * Модуль зависит от всего корня скана (`addContextDependency`): правка любого
 * файла пересобирает CSS, а свежие токены к этому моменту уже учтены —
 * плагин пересканирует изменённые файлы в `watchRun`, до компиляции.
 */
import type { LoaderDefinitionFunction } from 'webpack';
import type { MnPluginHandle } from './state';

/**
 * Опции правила: сам плагин. Webpack передаёт объект опций лоадеру как есть,
 * поэтому связь не зависит от общего реестра — и от того, из какой копии кода
 * (`src` или `dist`) лоадер загружен.
 */
export interface MnCssLoaderOptions {
  handle: MnPluginHandle;
}

const cssLoader: LoaderDefinitionFunction<MnCssLoaderOptions> = function () {
  const handle = this.getOptions().handle;
  handle.imported = true;
  this.addContextDependency(handle.root);
  const entry = new URLSearchParams(this.resourceQuery.slice(1)).get('entry') || '';
  const outputs = handle.build.outputs();
  const picked = entry ? outputs.filter((output) => output.name === entry) : outputs;
  if (entry && !picked.length) {
    throw new Error('[minotation] mn.css?entry=' + entry + ': no such entry; declared: '
      + handle.build.names.join(', '));
  }
  for (const warning of handle.build.takeWarnings()) {
    this.emitWarning(new Error('[minotation] ' + warning.token + ': ' + warning.message));
  }
  return picked.map((output) => output.css).filter(Boolean).join('\n');
};

export default cssLoader;
