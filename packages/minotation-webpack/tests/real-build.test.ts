/**
 * Плагин проверяется реальной webpack-сборкой (не моком `compilation`) — см.
 * MEMORY `feedback_bundler_plugins_need_real_builds.md`. Лоадеры вызываются
 * напрямую, с настоящим loader-контекстом: подключить их к реальной сборке
 * как `.ts` нельзя (webpack грузит лоадеры через `require`, без TS-трансформа),
 * а транспилированная копия получила бы ОТДЕЛЬНЫЙ инстанс синглтона `state.ts`
 * и разошлась бы с плагином. Связка «лоадер наполнил стейт → плагин собрал CSS»
 * при этом сохраняется: обе стороны работают через один и тот же `getState()`.
 */
import webpack from 'webpack';
import { join } from 'path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { MnWebpackPlugin, loader, presetLoader } from '../src/index';
import { getState, collectTokens } from '../src/state';

jest.setTimeout(60_000);

/** Создаёт временный проект: ключ — относительный путь файла, значение — содержимое. */
function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'mn-webpack-test-'));
  for (const rel of Object.keys(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, files[rel]);
  }
  return root;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Прогоняет исходник через MN-лоадер с настоящим loader-контекстом.
 *
 * Файл создаётся НА ДИСКЕ: стейт хранит токены по файлам, а `collectTokens`
 * отсеивает записи несуществующих файлов (так снимаются с учёта удалённые).
 * Без реального файла токены не дошли бы до сборки.
 */
function runLoader(
  source: string, options: Record<string, unknown> = {}, resourcePath?: string,
): string {
  const file = resourcePath || join(mkdtempSync(join(tmpdir(), 'mn-loader-')), 'page.html');
  writeFileSync(file, source);
  return (loader as any).call({
    getOptions: () => options,
    resourcePath: file, 
  }, source);
}

/** Плоский отсортированный набор токенов, что сейчас на учёте. */
function tokensNow(): string[] {
  return Array.from(collectTokens(getState())).sort();
}

/** Прогоняет пресет-файл через preset-loader; возвращает warnings, которые он эмитировал. */
function runPresetLoader(source: string, resourcePath: string): { result: string; warnings: string[] } {
  const warnings: string[] = [];
  const result = (presetLoader as any).call({
    resourcePath,
    emitWarning: (w: Error) => warnings.push(w.message),
  }, source);
  return { result, warnings };
}

/**
 * Реальная webpack-сборка; возвращает содержимое эмитированных assets.
 * Читается с диска, а не из `compilation.assets`: после записи webpack держит
 * там `SizeOnlySource`, чей `source()` бросает.
 */
function runBuild(root: string, plugin: MnWebpackPlugin): Promise<Record<string, string>> {
  const outDir = join(root, 'dist');
  const compiler = webpack({
    mode: 'development',
    devtool: false,
    entry: join(root, 'src/main.js'),
    output: { path: outDir, filename: 'bundle.js' },
    plugins: [plugin],
  });

  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) { reject(err); return; }
      const names = Object.keys(stats!.compilation.assets);
      compiler.close(() => {
        try {
          const assets: Record<string, string> = {};
          for (const name of names) assets[name] = readFileSync(join(outDir, name), 'utf-8');
          resolve(assets);
        } catch (e) { reject(e); }
      });
    });
  });
}

/** Минимальный проект-заглушка: плагину важен только сам факт сборки. */
function makeStubProject(): string {
  return makeProject({ 'src/main.js': 'export const x = 1;\n' });
}

describe('minotation-webpack — лоадеры', () => {
  beforeEach(() => {
    // стейт — синглтон на процесс (см. state.ts), между тестами его надо чистить
    const state = getState();
    state.tokensByFile.clear();
    state.dynamicPresets.clear();
  });

  test('лоадер собирает токены из атрибута class по умолчанию и возвращает исходник как есть', () => {
    const source = '<div class="p10 mt4"></div><span className="mb4"></span>';

    expect(runLoader(source)).toBe(source);
    expect(tokensNow()).toEqual(['mt4', 'p10']);
  });

  test('лоадер с несколькими атрибутами собирает токены из каждого', () => {
    runLoader('<div class="p10"></div><span className="mb4"></span>', { attrs: ['class', 'className'] });

    expect(tokensNow()).toEqual(['mb4', 'p10']);
  });

  test('preset-loader выполняет пресет, отдаёт в бандл пустой модуль', () => {
    const id = join(tmpdir(), 'theme.mn.ts');
    const { result, warnings } = runPresetLoader("export default (mn) => { mn('wpToken', 'cF00'); };\n", id);

    expect(result).toBe('module.exports = {};');
    expect(warnings).toEqual([]);
    expect(getState().dynamicPresets.has(id)).toBe(true);
  });

  test('preset-loader понимает .tsx и named-экспорт, игнорирует файл без функции', () => {
    const tsxId = join(tmpdir(), 'widget.mn.tsx');
    runPresetLoader("export const preset = (mn) => { mn('tsxToken', 'cF00'); };\n", tsxId);
    const emptyId = join(tmpdir(), 'empty.mn.js');
    runPresetLoader('export const config = { notAFunction: true };\n', emptyId);

    expect(getState().dynamicPresets.has(tsxId)).toBe(true);
    expect(getState().dynamicPresets.has(emptyId)).toBe(false);
  });

  test('битый пресет-файл: warning, пресет не регистрируется, сборка не ломается', () => {
    const id = join(tmpdir(), 'broken.mn.js');
    const { result, warnings } = runPresetLoader('this is ( not ) valid javascript !!!\n', id);

    expect(result).toBe('module.exports = {};');
    expect(warnings.join('\n')).toContain('[minotation] Failed to evaluate preset file');
    expect(getState().dynamicPresets.has(id)).toBe(false);
  });
});

describe('minotation-webpack — реальная сборка', () => {
  beforeEach(() => {
    const state = getState();
    state.tokensByFile.clear();
    state.dynamicPresets.clear();
  });

  test('токены лоадера и пресет из *.mn.ts дают CSS-asset', async () => {
    runLoader('<div class="p10 wpToken"></div>');
    runPresetLoader("export default (mn) => { mn('wpToken', 'cF00'); };\n", join(tmpdir(), 'theme.mn.ts'));

    const assets = await runBuild(makeStubProject(), new MnWebpackPlugin({ output: 'mn.css' }));

    expect(assets['mn.css']).toContain('.p10{padding:10px}');
    expect(assets['mn.css']).toContain('.wpToken{color:#f00}');
  });

  test('дефолтные опции: asset называется app.css', async () => {
    runLoader('<div class="mt4"></div>');

    const assets = await runBuild(makeStubProject(), new MnWebpackPlugin());

    expect(assets['app.css']).toContain('margin-top:4px');
  });

  test('selectorPrefix, media и кастомный набор пресетов доходят до компиляции', async () => {
    runLoader('<div class="p10 fw5@wide"></div>');

    const assets = await runBuild(makeStubProject(), new MnWebpackPlugin({
      output: 'mn.css',
      selectorPrefix: '.app ',
      media: { wide: { query: '(min-width: 1200px)' } },
      presets: [require('minotation').presetStandard],
    }));

    expect(assets['mn.css']).toContain('.app .p10{padding:10px}');
    expect(assets['mn.css']).toContain('@media (min-width: 1200px)');
    // normalize/main в кастомный набор не входят
    expect(assets['mn.css']).not.toContain('box-sizing:border-box');
  });

  test('повторная сборка с тем же набором токенов берёт CSS из кеша', async () => {
    runLoader('<div class="p10"></div>');
    const plugin = new MnWebpackPlugin({ output: 'mn.css' });

    const first = await runBuild(makeStubProject(), plugin);
    const second = await runBuild(makeStubProject(), plugin);

    expect(second['mn.css']).toBe(first['mn.css']);
    expect(second['mn.css']).toContain('padding:10px');
  });

  test('нет ни токенов, ни пресетов: CSS-asset не эмитится', async () => {
    const assets = await runBuild(makeStubProject(), new MnWebpackPlugin({ output: 'mn.css', presets: [] }));

    expect(assets['mn.css']).toBeUndefined();
  });
});

/**
 * Q-09: удаление файла должно убирать его стили из вывода.
 *
 * Раньше стейт был плоским `Set<string>`, который не очищался никогда —
 * токен, однажды попавший в набор, оставался в CSS до перезапуска сборки.
 */
describe('minotation-webpack — снятие токенов с учёта', () => {
  beforeEach(() => {
    const state = getState();
    state.tokensByFile.clear();
    state.dynamicPresets.clear();
  });

  test('удалённый файл больше не даёт своих правил', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mn-unlink-'));
    const gone = join(dir, 'gone.html');
    const stays = join(dir, 'stays.html');

    runLoader('<div class="p10"></div>', {}, gone);
    runLoader('<div class="mt4"></div>', {}, stays);
    expect(tokensNow()).toEqual(['mt4', 'p10']);

    rmSync(gone);

    expect(tokensNow()).toEqual(['mt4']);
    const assets = await runBuild(makeStubProject(), new MnWebpackPlugin({ output: 'mn.css' }));
    expect(assets['mn.css']).toContain('margin-top:4px');
    expect(assets['mn.css']).not.toContain('padding:10px');
  });

  test('токен, убранный при редактировании файла, уходит из вывода', async () => {
    // Лоадер ЗАМЕНЯЕТ набор своего файла, а не дополняет: иначе `p10` остался
    // бы навсегда, хотя из разметки его убрали.
    const file = join(mkdtempSync(join(tmpdir(), 'mn-edit-')), 'page.html');

    runLoader('<div class="p10 mt4"></div>', {}, file);
    expect(tokensNow()).toEqual(['mt4', 'p10']);

    runLoader('<div class="mt4"></div>', {}, file);
    expect(tokensNow()).toEqual(['mt4']);

    const assets = await runBuild(makeStubProject(), new MnWebpackPlugin({ output: 'mn.css' }));
    expect(assets['mn.css']).not.toContain('padding:10px');
  });

  test('файл, где токенов не осталось вовсе, снимается с учёта', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'mn-empty-')), 'page.html');

    runLoader('<div class="p10"></div>', {}, file);
    expect(getState().tokensByFile.has(file)).toBe(true);

    runLoader('<div></div>', {}, file);
    expect(getState().tokensByFile.has(file)).toBe(false);
  });
});
