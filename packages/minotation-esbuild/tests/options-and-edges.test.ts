/**
 * Реальные сборки esbuild на временных проектах — покрывают ветки, которых нет
 * в основном сценарии `real-build.test.ts`: рекурсивный обход поддиректорий,
 * нестандартные опции плагина, выбор выходной директории (outdir/outfile/root),
 * битый и «пустой» пресет-файл.
 */
import { build } from 'esbuild';
import { join } from 'path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { mnEsbuild } from '../src/index';

/** Создаёт временный проект: ключ — относительный путь файла, значение — содержимое. */
function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'mn-esbuild-edge-'));
  for (const rel of Object.keys(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, files[rel]);
  }
  return root;
}

describe('minotation-esbuild — опции и граничные случаи', () => {
  test('рекурсивный обход поддиректорий + кастомные extensions/attr/fileName/presetExtensions/mn', async () => {
    const root = makeProject({
      'src/main.js': "import './presets/theme.mnjs';\nexport const x = 1;\n",
      // глубоко вложенный файл приложения с нестандартным расширением и атрибутом
      'src/ui/deep/widget.vue': '<template><div data-cls="edgeToken p10"></div></template>',
      // пресет с нестандартным расширением и named-экспортом (не default)
      'src/presets/theme.mnjs': "export const preset = (mn) => { mn('edgeToken', 'cF00'); };\n",
    });
    const outDir = join(root, 'out');

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outdir: outDir,
      plugins: [mnEsbuild({
        attr: 'data-cls',
        extensions: ['.vue'],
        presetExtensions: ['.mnjs'],
        fileName: 'styles.css',
        root,
        mn: { selectorPrefix: '.app ' },
      })],
    });

    const css = readFileSync(join(outDir, 'styles.css'), 'utf-8');
    expect(css).toContain('.app .edgeToken{color:#f00}');
    expect(css).toContain('padding:10px');
    // заглушка вместо реального содержимого пресета
    expect(readFileSync(join(outDir, 'main.js'), 'utf-8')).not.toContain("mn('edgeToken'");
  });

  test('битый пресет-файл: ошибка логируется, сборка продолжается', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="p10"></div>',
      'src/broken.mn.js': 'this is ( not ) valid javascript !!!\n',
    });
    const outDir = join(root, 'out');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls: unknown[][];

    try {
      await build({
        entryPoints: [join(root, 'src/main.js')],
        bundle: true,
        outdir: outDir,
        plugins: [mnEsbuild({ root })],
      });
    } finally {
      // снимок до mockRestore(): он сбрасывает накопленные вызовы
      calls = errorSpy.mock.calls.slice();
      errorSpy.mockRestore();
    }

    expect(calls).toContainEqual([
      '[mnEsbuild] Failed to evaluate preset file:',
      join(root, 'src/broken.mn.js'),
      expect.anything(),
    ]);
    expect(readFileSync(join(outDir, 'mn.css'), 'utf-8')).toContain('padding:10px');
  });

  test('пресет-файл без экспортируемой функции игнорируется', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="p10"></div>',
      'src/empty.mn.js': 'export const config = { notAFunction: true };\n',
    });
    const outDir = join(root, 'out');

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outdir: outDir,
      plugins: [mnEsbuild({ root })],
    });

    expect(readFileSync(join(outDir, 'mn.css'), 'utf-8')).toContain('padding:10px');
  });

  test('outfile вместо outdir: CSS пишется рядом с выходным файлом', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="mt4"></div>',
    });
    const outFile = join(root, 'dist', 'bundle.js');

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outfile: outFile,
      plugins: [mnEsbuild({ root })],
    });

    expect(readFileSync(join(root, 'dist', 'mn.css'), 'utf-8')).toContain('margin-top:4px');
  });

  test('без outdir/outfile (write: false): CSS пишется в root плагина', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="fw5"></div>',
    });

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      write: false,
      plugins: [mnEsbuild({ root })],
    });

    expect(readFileSync(join(root, 'mn.css'), 'utf-8')).toContain('font-weight:500');
  });

  test('нет ни токенов, ни пресетов: CSS-файл не создаётся', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div></div>',
    });
    const outDir = join(root, 'out');

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outdir: outDir,
      // пустой набор пресетов: без него normalize/main дают CSS даже без токенов
      plugins: [mnEsbuild({ root, presets: [] })],
    });

    expect(existsSync(join(outDir, 'mn.css'))).toBe(false);
  });

  test('onLoad для несуществующего пресет-файла: заглушка возвращается, ошибки нет', () => {
    const plugin = mnEsbuild({ root: mkdtempSync(join(tmpdir(), 'mn-esbuild-empty-')) });
    const loadCallbacks: Array<(args: { path: string }) => unknown> = [];
    plugin.setup({
      onStart: () => undefined,
      onEnd: () => undefined,
      onLoad: (_filter: unknown, cb: (args: { path: string }) => unknown) => loadCallbacks.push(cb),
      initialOptions: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = loadCallbacks[0]({ path: join(tmpdir(), 'no-such-dir-9f3c', 'ghost.mn.ts') });
    expect(result).toEqual({ contents: 'export default {};', loader: 'js' });
  });

  test('скрытые директории и node_modules пропускаются, .mn.tsx-пресет применяется', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="p10 tsxToken"></div>',
      'src/theme.mn.tsx': "import type { MnInstance } from 'minotation';\nexport default (mn: MnInstance) => { mn('tsxToken', 'cF00'); };\n",
      '.hidden/secret.html': '<div class="mt99"></div>',
      'node_modules/pkg/dist.html': '<div class="mb99"></div>',
    });
    const outDir = join(root, 'out');

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outdir: outDir,
      plugins: [mnEsbuild({ root })],
    });

    const css = readFileSync(join(outDir, 'mn.css'), 'utf-8');
    expect(css).toContain('.tsxToken{color:#f00}');
    expect(css).toContain('padding:10px');
    expect(css).not.toContain('margin-top:99px');
    expect(css).not.toContain('margin-bottom:99px');
  });

  test('нечитаемые пути не ломают обход: битый симлинк и несуществующий root', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="fw7"></div>',
    });
    // symlink в никуда: statSync по нему бросает — обход обязан продолжиться
    symlinkSync(join(root, 'no-such-target.html'), join(root, 'src', 'dangling.html'));
    const outDir = join(root, 'out');

    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outdir: outDir,
      plugins: [mnEsbuild({ root })],
    });
    expect(readFileSync(join(outDir, 'mn.css'), 'utf-8')).toContain('font-weight:700');

    // несуществующий root: readdirSync бросает, плагин не падает
    await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      outdir: join(root, 'out2'),
      plugins: [mnEsbuild({ root: join(root, 'no-such-dir'), presets: [] })],
    });
    expect(existsSync(join(root, 'out2', 'mn.css'))).toBe(false);
  });
});