/**
 * Реальная vite-сборка (не моки хуков) — см. MEMORY
 * `feedback_bundler_plugins_need_real_builds.md`: мок хуков не поймал бы баг
 * вида «side-effect импорт `*.mn.ts` не перехвачен» или «<style data-mn> не
 * попал в index.html».
 */
import { join } from 'path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { mnVite, type MnViteOptions } from '../src/index';

jest.setTimeout(120_000);

/** Создаёт временный проект: ключ — относительный путь файла, значение — содержимое. */
function makeProject(files: Record<string, string>): string {
  // realpath: на macOS /var — симлинк на /private/var, а vite резолвит файлы
  // по реальному пути — без этого index.html считается лежащим вне root
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'mn-vite-test-')));
  for (const rel of Object.keys(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, files[rel]);
  }
  return root;
}

async function runBuild(root: string, options: MnViteOptions = {}): Promise<void> {
  const { build } = await import('vite');
  // vite/rollup считают путь index.html относительно cwd процесса: без chdir
  // временный проект в /var/folders даёт «../../..»-путь и падение сборки
  const prevCwd = process.cwd();
  process.chdir(root);
  try {
    await build({
      root,
      // configFile: false — не подхватывать чужой vite.config из дерева лаборатории
      configFile: false,
      logLevel: 'silent',
      plugins: [mnVite(options)],
      build: { outDir: 'dist', emptyOutDir: true },
    });
  } finally {
    process.chdir(prevCwd);
  }
}

describe('minotation-vite — реальная сборка', () => {
  test('токены из index.html и модулей + пресет *.mn.ts: <style data-mn> в HTML, mn.css в бандле', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      'src/main.tsx': "import './theme.mn.ts';\nexport const ui = <div class=\"viteToken\" />;\n",
      'src/theme.mn.ts': "export default (mn) => { mn('viteToken', 'cF00'); };\nexport const MARKER = 'mn-vite-fixture-marker-6c1f';\n",
    });

    await runBuild(root, { attr: 'class' });

    const html = readFileSync(join(root, 'dist/index.html'), 'utf-8');
    expect(html).toContain('<style data-mn');
    expect(html).toContain('.p10{padding:10px}');
    // токен из .tsx подхвачен blanket-сканом src/, пресет из *.mn.ts — применён
    expect(html).toContain('.viteToken{color:#f00}');
    expect(existsSync(join(root, 'dist/mn.css'))).toBe(true);

    // реальный код пресета не попал в клиентский бандл
    const bundled = readFileSync(join(root, 'dist/index.html'), 'utf-8');
    expect(bundled).not.toContain('mn-vite-fixture-marker-6c1f');
  });

  test('без токенов и пресетов: ни <style data-mn>, ни mn.css', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });

    await runBuild(root, { presets: [] });

    expect(readFileSync(join(root, 'dist/index.html'), 'utf-8')).not.toContain('data-mn');
    expect(existsSync(join(root, 'dist/mn.css'))).toBe(false);
  });

  test('кастомные attr/extensions/presetExtensions/mn + вложенные директории + named-экспорт пресета', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': "import './presets/theme.mnjs';\nexport const x = 1;\n",
      'src/ui/deep/widget.vue': '<template><div data-cls="edgeToken p10"></div></template>',
      'src/presets/theme.mnjs': "export const preset = (mn) => { mn('edgeToken', 'cF00'); };\n",
    });

    await runBuild(root, {
      attr: 'data-cls',
      extensions: ['.vue'],
      presetExtensions: ['.mnjs'],
      mn: { selectorPrefix: '.app ' },
    });

    const css = readFileSync(join(root, 'dist/mn.css'), 'utf-8');
    expect(css).toContain('.app .edgeToken{color:#f00}');
    expect(css).toContain('padding:10px');
  });

  test('скрытые директории и node_modules пропускаются, .mn.tsx-пресет применяется', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10 tsxToken"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
      'src/theme.mn.tsx': "export default (mn) => { mn('tsxToken', 'cF00'); };\n",
      'src/.hidden/secret.html': '<div class="mt99"></div>',
      'src/node_modules/pkg/dist.html': '<div class="mb99"></div>',
    });

    await runBuild(root);

    const css = readFileSync(join(root, 'dist/mn.css'), 'utf-8');
    expect(css).toContain('.tsxToken{color:#f00}');
    expect(css).not.toContain('margin-top:99px');
    expect(css).not.toContain('margin-bottom:99px');
  });

  test('битый пресет-файл: ошибка логируется, сборка проходит', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
      'src/broken.mn.js': 'this is ( not ) valid javascript !!!\n',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls: unknown[][];

    try {
      await runBuild(root);
    } finally {
      // снимок до mockRestore(): он сбрасывает накопленные вызовы
      calls = errorSpy.mock.calls.slice();
      errorSpy.mockRestore();
    }

    expect(calls).toContainEqual([
      '[mnVite] Failed to evaluate preset file:',
      join(root, 'src/broken.mn.js'),
      expect.anything(),
    ]);
    expect(readFileSync(join(root, 'dist/mn.css'), 'utf-8')).toContain('padding:10px');
  });

  test('пресет-файл без экспортируемой функции игнорируется', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': "import './empty.mn.js';\nexport const x = 1;\n",
      'src/empty.mn.js': 'export const config = { notAFunction: true };\n',
    });

    await runBuild(root);

    expect(readFileSync(join(root, 'dist/mn.css'), 'utf-8')).toContain('padding:10px');
  });

  test('mn.strict: true — неизвестный токен в классе роняет реальную vite-сборку', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10 totally-unknown-xyz"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(runBuild(root, { mn: { strict: true } })).rejects.toThrow(/MN strict/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('mn.strict: true — сборка без предупреждений проходит как обычно', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });

    await runBuild(root, { mn: { strict: true } });

    expect(readFileSync(join(root, 'dist/mn.css'), 'utf-8')).toContain('padding:10px');
  });
});
