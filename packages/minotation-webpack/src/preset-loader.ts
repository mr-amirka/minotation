/**
 * Webpack preset-loader: перехватывает *.mn.ts / *.mn.js файлы,
 * выполняет экспортированную пресет-функцию на внутреннем mn-инстансе,
 * возвращает в бандл пустой модуль.
 *
 * Использование в webpack.config.js:
 *   { test: /\.mn\.(ts|js|tsx)$/, use: 'minotation-webpack/preset-loader' }
 *
 * Пресет-файл (src/mn/app.mn.ts):
 *   import type { MnInstance } from 'minotation';
 *   export function presetApp(mn: MnInstance): void {
 *     mn('card', () => ({ style: { borderRadius: '8px' } }));
 *   }
 *
 * В коде приложения подключается как side-effect (аналог `import 'style.scss'`):
 *   import './mn/app.mn';
 */
import type { LoaderDefinitionFunction } from 'webpack';
import type { MnInstance } from 'minotation';
import { transformSync } from 'esbuild';
import { createRequire } from 'module';
import { dirname } from 'path';
import { getState } from './state';

/**
 * Выполняет пресет-файл: транспилирует esbuild-ом и исполняет в Node.
 *
 * @param id — путь к файлу
 * @param source — его текст
 * @returns пресет-функция или `undefined`, если файл ничего такого не экспортирует
 * @throws если файл не транспилируется или падает при исполнении
 */
export function evalPreset(id: string, source: string): ((mn: MnInstance) => void) | undefined {
  const loaderName = id.endsWith('.tsx') ? 'tsx' : id.endsWith('.ts') ? 'ts' : 'js';
  const { code } = transformSync(source, {
    loader: loaderName,
    format: 'cjs',
    target: 'node18',
  });
  const mod: { exports: Record<string, unknown> } = { exports: {} };
  const req = createRequire(id);
  // eslint-disable-next-line no-new-func
  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', code);
  fn(req, mod, mod.exports, dirname(id), id);
  const preset = mod.exports['default'] ?? Object.values(mod.exports).find(v => typeof v === 'function');
  return typeof preset === 'function' ? preset as (mn: MnInstance) => void : undefined;
}

const presetLoader: LoaderDefinitionFunction = function (source) {
  const id = this.resourcePath;
  try {
    const preset = evalPreset(id, source as string);
    if (preset) {
      for (const plugin of getState().plugins.values()) {
        plugin.build.setPreset(id, preset);
      }
    }
  } catch (e) {
    this.emitWarning(new Error(`[minotation] Failed to evaluate preset file: ${id}\n${e}`));
  }

  return 'module.exports = {};';
};

export default presetLoader;
