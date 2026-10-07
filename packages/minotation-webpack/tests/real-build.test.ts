/**
 * Плагин проверяется реальной webpack-сборкой (не моком `compilation`) — см.
 * MEMORY `feedback_bundler_plugins_need_real_builds.md`.
 *
 * С 2026-10-06 (D-031) плагин сам сканирует проект перед сборкой, а CSS отдаёт
 * либо модулем `minotation-webpack/mn.css` (конвейер проекта даёт имя с хешем),
 * либо ассетом с привязкой к чанкам точек входа.
 */
import webpack from 'webpack';
import type { Configuration, Stats } from 'webpack';
import { join, resolve } from 'path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { MnWebpackPlugin, loader, presetLoader } from '../src/index';
import { getState } from '../src/state';

jest.setTimeout(60_000);

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Заглушка `mn.css` этого пакета — её подменяет CSS-лоадер плагина. */
const MN_CSS = resolve(__dirname, '../mn.css');

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

/** Конфиг сборки проекта; `extra` дополняет его. */
function configOf(root: string, plugin: MnWebpackPlugin, extra: Configuration = {}): Configuration {
  return {
    mode: 'development',
    devtool: false,
    context: root,
    entry: join(root, 'src/main.js'),
    output: { path: join(root, 'dist'), filename: 'bundle.js' },
    // Проект во временном каталоге не видит пакет — заглушку отдаём алиасом.
    resolve: { alias: { 'minotation-webpack/mn.css': MN_CSS } },
    plugins: [plugin],
    ...extra,
  };
}

/** Результат сборки: ассеты с диска, предупреждения, файлы точки входа. */
interface BuildResult {
  assets: Record<string, string>;
  warnings: string[];
  entryFiles: string[];
}

function readResult(root: string, stats: Stats): BuildResult {
  const names = Object.keys(stats.compilation.assets);
  const assets: Record<string, string> = {};
  for (const name of names) assets[name] = readFileSync(join(root, 'dist', name), 'utf-8');
  const entryFiles: string[] = [];
  for (const entrypoint of stats.compilation.entrypoints.values()) {
    entryFiles.push(...entrypoint.getFiles());
  }
  return {
    assets,
    warnings: stats.compilation.warnings.map((w) => w.message),
    entryFiles,
  };
}

/**
 * Реальная webpack-сборка. Ассеты читаются с диска, а не из
 * `compilation.assets`: после записи webpack держит там `SizeOnlySource`.
 */
function runBuild(root: string, plugin: MnWebpackPlugin, extra: Configuration = {}): Promise<BuildResult> {
  const compiler = webpack(configOf(root, plugin, extra));
  return new Promise((done, fail) => {
    compiler.run((err, stats) => {
      if (err) { fail(err); return; }
      if (stats!.hasErrors()) { fail(new Error(stats!.compilation.errors.map((e) => e.message).join('\n'))); return; }
      const result = readResult(root, stats!);
      compiler.close(() => done(result));
    });
  });
}

beforeEach(() => {
  // Реестр — на процесс (см. state.ts): плагины прошлых тестов в нём не нужны.
  getState().plugins.clear();
});

describe('minotation-webpack — скан проекта и ассет без импорта', () => {
  test('токены из src/ находятся сами; ассет привязан к точке входа; манифест рядом', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/page.html': '<div class="p10 mt4"></div>',
    });

    const result = await runBuild(root, new MnWebpackPlugin());

    expect(result.assets['mn.css']).toContain('.p10{padding:10px}');
    expect(result.assets['mn.css']).toContain('margin-top:4px');
    // В файлах точки входа — `HtmlWebpackPlugin` подключит CSS сам.
    expect(result.entryFiles).toContain('mn.css');
    expect(JSON.parse(result.assets['mn-manifest.json'])).toEqual({ 'mn.css': 'mn.css' });
  });

  test('хеш в output.filename проекта — хеш и в имени CSS', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/page.html': '<div class="p10"></div>',
    });

    const result = await runBuild(root, new MnWebpackPlugin(), {
      output: { path: join(root, 'dist'), filename: '[name].[contenthash].js' },
    });

    const manifest = JSON.parse(result.assets['mn-manifest.json']);
    expect(manifest['mn.css']).toMatch(/^mn\.[0-9a-f]{8}\.css$/);
    expect(result.assets[manifest['mn.css']]).toContain('padding:10px');
  });

  test('fileName, entry и manifest: false', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/site/a.html': '<div class="p10"></div>',
      'src/admin/b.html': '<div class="m20"></div>',
    });

    const result = await runBuild(root, new MnWebpackPlugin({
      fileName: 'css/[name].css',
      manifest: false,
      entry: { site: { include: /site/ }, admin: { include: /admin/, fileName: 'admin.css' } },
    }));

    expect(result.assets['css/site.css']).toContain('padding:10px');
    expect(result.assets['admin.css']).toContain('margin:20px');
    expect(result.assets['admin.css']).not.toContain('padding:10px');
    expect(Object.keys(result.assets).filter((name) => name.endsWith('.json'))).toEqual([]);
  });

  test('root задаёт корень скана; без src/ — корень проекта', async () => {
    const root = makeProject({
      'main.html': '<div class="w30"></div>',
      'src/main.js': 'export const x = 1;\n',
      'templates/a.html': '<div class="h40"></div>',
    });

    const custom = await runBuild(root, new MnWebpackPlugin({ root: join(root, 'templates') }));
    expect(custom.assets['mn.css']).toContain('height:40px');
    expect(custom.assets['mn.css']).not.toContain('width:30px');

    rmSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'main.js'), 'export const x = 1;\n');
    const whole = await runBuild(root, new MnWebpackPlugin(), { entry: join(root, 'main.js') });
    expect(whole.assets['mn.css']).toContain('width:30px');
    expect(whole.assets['mn.css']).toContain('height:40px');
  });

  test('нет токенов — нет ни ассета, ни манифеста', async () => {
    const root = makeProject({ 'src/main.js': 'export const x = 1;\n' });

    const result = await runBuild(root, new MnWebpackPlugin({ presets: [] }));

    expect(Object.keys(result.assets)).toEqual(['bundle.js']);
  });
});

describe('minotation-webpack — импорт minotation-webpack/mn.css (D-031)', () => {
  test('CSS идёт конвейером проекта: имя с хешем, отдельного ассета нет', async () => {
    const root = makeProject({
      'src/main.js': "import 'minotation-webpack/mn.css';\nexport const x = 1;\n",
      'src/page.html': '<div class="p10"></div>',
    });

    const result = await runBuild(root, new MnWebpackPlugin(), {
      experiments: { css: true },
      output: { path: join(root, 'dist'), filename: '[name].js', cssFilename: '[name].[contenthash].css' },
    });

    const css = Object.keys(result.assets).filter((name) => name.endsWith('.css'));
    expect(css).toHaveLength(1);
    expect(css[0]).toMatch(/^main\.[0-9a-f]+\.css$/);
    expect(result.assets[css[0]]).toContain('padding:10px');
    expect(result.assets['mn-manifest.json']).toBeUndefined();
  });

  test('?entry=<имя> — CSS одной записи; неизвестная запись — ошибка сборки', async () => {
    const root = makeProject({
      'src/main.js': "import 'minotation-webpack/mn.css?entry=admin';\nexport const x = 1;\n",
      'src/site/a.html': '<div class="p10"></div>',
      'src/admin/b.html': '<div class="m20 w10zz"></div>',
    });
    const entry = { site: { include: /site/ }, admin: { include: /admin/ } };
    const extra: Configuration = { experiments: { css: true } };

    const result = await runBuild(root, new MnWebpackPlugin({ entry }), extra);
    const css = Object.entries(result.assets).filter(([name]) => name.endsWith('.css')).map(([, v]) => v).join('');
    expect(css).toContain('margin:20px');
    expect(css).not.toContain('padding:10px');
    expect(result.warnings.join('\n')).toContain('[minotation] w10zz');

    writeFileSync(join(root, 'src/main.js'), "import 'minotation-webpack/mn.css?entry=nope';\n");
    await expect(runBuild(root, new MnWebpackPlugin({ entry }), extra)).rejects.toThrow('no such entry; declared: site, admin');
  });
});

describe('minotation-webpack — пресеты, лоадеры и предупреждения', () => {
  test('*.mn.ts в корне скана выполняется сам; битый — печатается, сборка идёт', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/page.html': '<div class="wpToken brokenToken"></div>',
      'src/theme.mn.ts': "export default (mn) => { mn('wpToken', 'cF00'); };\n",
      'src/broken.mn.ts': 'this is ( not ) valid javascript !!!\n',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const result = await runBuild(root, new MnWebpackPlugin());
      expect(result.assets['mn.css']).toContain('.wpToken{color:#f00}');
      // До `mockRestore`: он заодно стирает записанные вызовы.
      expect(errorSpy).toHaveBeenCalledWith('[minotation] Failed to evaluate preset file:', expect.stringContaining('broken.mn.ts'), expect.anything());
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('токен-лоадер и preset-лоадер отдают файл всем плагинам процесса', () => {
    const root = makeProject({ 'src/main.js': 'export const x = 1;\n' });
    // Стандартный набор нужен: пресет ниже раскрывается через хендлер `c`.
    const plugin = new MnWebpackPlugin();
    plugin.apply(webpack(configOf(root, plugin)) as any);
    const handle = getState().plugins.values().next().value!;

    const source = '<div class="qqLoaderToken qqTsxToken"></div>';
    expect((loader as any).call({ resourcePath: join(root, 'shared/a.html') }, source)).toBe(source);
    expect((loader as any).call({ resourcePath: join(root, 'shared/a.css') }, '')).toBe('');
    expect(handle.build.has(join(root, 'shared/a.html'))).toBe(true);
    expect(handle.build.has(join(root, 'shared/a.css'))).toBe(false);

    const warnings: string[] = [];
    const call = (code: string, file: string) => (presetLoader as any).call({
      resourcePath: join(root, file),
      emitWarning: (w: Error) => warnings.push(w.message),
    }, code);
    expect(call("export default (mn) => { mn('qqLoaderToken', 'cF00'); };\n", 'p.mn.ts')).toBe('module.exports = {};');
    expect(handle.build.outputs()[0].css).toContain('.qqLoaderToken{color:#f00}');
    call('export const notAPreset = 1;\n', 'q.mn.js');
    call("export function named(mn) { mn('qqTsxToken', 'c0F0'); }\n", 'n.mn.tsx');
    expect(handle.build.outputs()[0].css).toContain('.qqTsxToken{color:#0f0}');
    call('this is ( not ) valid javascript !!!\n', 'bad.mn.tsx');
    expect(warnings).toEqual([expect.stringContaining('Failed to evaluate preset file')]);
  });

  test('битый токен — в отчёт сборки; onWarning и поля верхнего уровня доходят до ядра', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/page.html': '<div class="p10 w10zz"></div>',
    });
    const seen: string[] = [];

    const loud = await runBuild(root, new MnWebpackPlugin({
      selectorPrefix: '.app ',
      media: { wide: { query: '(min-width: 1200px)' } },
      onWarning: (w) => seen.push(w.token),
    }));
    expect(loud.warnings.join('\n')).toContain('[minotation] w10zz');
    expect(loud.assets['mn.css']).toContain('.app .p10{padding:10px}');
    expect(seen).toEqual(['w10zz']);

    const quiet = await runBuild(root, new MnWebpackPlugin({ onWarning: 'silent' }));
    expect(quiet.warnings.join('\n')).not.toContain('[minotation]');
  });

  test('устаревший output — ошибка с подсказкой', () => {
    expect(() => new MnWebpackPlugin({ output: 'app.css' } as never))
      .toThrow('option "output" was replaced by "fileName"');
  });
});

describe('minotation-webpack — watch: изменения учитываются до компиляции', () => {
  test('правка, удаление файла и пресета — в следующей сборке', async () => {
    jest.setTimeout(30_000);
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/a.html': '<div class="p10"></div>',
      'src/gone.html': '<div class="m20"></div>',
      'src/theme.mn.ts': "export default (mn) => { mn('wToken', 'cF00'); };\n",
      'src/keep.html': '<div class="wToken"></div>',
    });
    const compiler = webpack(configOf(root, new MnWebpackPlugin()));
    let first = '';
    let edited = false;

    const after = await new Promise<string>((done, fail) => {
      const watching = compiler.watch({ aggregateTimeout: 50 }, (err, stats) => {
        if (err) { fail(err); return; }
        const css = readResult(root, stats!).assets['mn.css'] || '';
        if (!first) {
          first = css;
          // Даём watcher-у запомнить время первой сборки, иначе правка не заметна.
          setTimeout(() => {
            writeFileSync(join(root, 'src/a.html'), '<div class="p10 h40"></div>');
            rmSync(join(root, 'src/gone.html'));
            rmSync(join(root, 'src/theme.mn.ts'));
            edited = true;
          }, 300);
          return;
        }
        // Вотчер может пересобрать и до правки (файлы проекта только что созданы) —
        // ждём сборку, в которой правка уже есть.
        edited && css.indexOf('height:40px') > -1 && watching!.close(() => done(css));
      });
    });

    expect(first).toContain('margin:20px');
    expect(first).toContain('.wToken{color:#f00}');
    expect(after).toContain('height:40px');
    expect(after).not.toContain('margin:20px');
    expect(after).not.toContain('.wToken{');
  });
});

describe('minotation-webpack — watchRun: точечное пересканирование', () => {
  /** Вызывает `watchRun` так, как это делает webpack в watch-режиме. */
  function watchRun(compiler: webpack.Compiler, modified: string[], removed: string[]): Promise<void> {
    (compiler as any).modifiedFiles = new Set(modified);
    (compiler as any).removedFiles = new Set(removed);
    return new Promise((done) => compiler.hooks.watchRun.callAsync(compiler, () => done()));
  }

  test('файлы графа — поимённо: правка, пресет, нечитаемый и удалённый', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/a.html': '<div class="p10"></div>',
      'src/b.html': '<div class="m20"></div>',
      'src/theme.mn.ts': "export default (mn) => { mn('wrToken', 'cF00'); };\n",
      'src/c.html': '<div class="wrToken"></div>',
    });
    const plugin = new MnWebpackPlugin();
    const compiler = webpack(configOf(root, plugin));
    const handle = getState().plugins.values().next().value!;
    const css = (): string => handle.build.outputs()[0].css;

    // Первый вызов — полный скан.
    await watchRun(compiler, [], []);
    expect(css()).toContain('margin:20px');

    writeFileSync(join(root, 'src/a.html'), '<div class="h40"></div>');
    writeFileSync(join(root, 'src/theme.mn.ts'), "export default (mn) => { mn('wrToken', 'c0F0'); };\n");
    rmSync(join(root, 'src/b.html'));
    await watchRun(compiler, [
      join(root, 'src/a.html'),
      join(root, 'src/theme.mn.ts'),
      join(root, 'src/b.html'),
      join(root, 'src/style.css'),
    ], [join(root, 'src/old.html')]);

    expect(css()).toContain('height:40px');
    expect(css()).not.toContain('padding:10px');
    // Нечитаемый (удалённый, но пришедший как изменённый) файл снят с учёта.
    expect(css()).not.toContain('margin:20px');
    expect(css()).toContain('.wrToken{color:#0f0}');

    // Webpack может не сообщить списков вовсе — это не ошибка.
    (compiler as any).modifiedFiles = undefined;
    (compiler as any).removedFiles = undefined;
    await new Promise<void>((done) => compiler.hooks.watchRun.callAsync(compiler, () => done()));
    expect(css()).toContain('height:40px');
  });

  test('include — скан по матчеру, а не по расширениям', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/page.tpl': '<div class="w30"></div>',
      'src/page.html': '<div class="h40"></div>',
    });

    const result = await runBuild(root, new MnWebpackPlugin({ include: /\.tpl$/ }));

    expect(result.assets['mn.css']).toContain('width:30px');
    expect(result.assets['mn.css']).not.toContain('height:40px');
  });
});
