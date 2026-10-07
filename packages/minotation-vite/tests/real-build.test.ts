/**
 * Реальная vite-сборка (не моки хуков) — см. MEMORY
 * `feedback_bundler_plugins_need_real_builds.md`: мок хуков не поймал бы баг
 * вида «side-effect импорт `*.mn.ts` не перехвачен» или «<style data-mn> не
 * попал в index.html».
 */
import { join } from 'path';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'fs';
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

/** CSS из `<style data-mn>` собранного `index.html` (`inject: 'inline'` по умолчанию). */
function builtCss(root: string): string {
  const html = readFileSync(join(root, 'dist/index.html'), 'utf-8');
  const at = html.indexOf('<style data-mn');
  return at < 0 ? '' : html.slice(html.indexOf('>', at) + 1, html.indexOf('</style>', at));
}

describe('minotation-vite — реальная сборка', () => {
  test('токены из index.html и модулей + пресет *.mn.ts: <style data-mn> в HTML, отдельного файла нет', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.tsx"></script></body></html>',
      'src/main.tsx': "import './theme.mn.ts';\nexport const ui = <div class=\"viteToken\" />;\n",
      'src/theme.mn.ts': "export default (mn) => { mn('viteToken', 'cF00'); };\nexport const MARKER = 'mn-vite-fixture-marker-6c1f';\n",
    });

    await runBuild(root, { attrs: 'class' });

    const html = readFileSync(join(root, 'dist/index.html'), 'utf-8');
    expect(html).toContain('<style data-mn');
    expect(html).toContain('.p10{padding:10px}');
    // токен из .tsx подхвачен blanket-сканом src/, пресет из *.mn.ts — применён
    expect(html).toContain('.viteToken{color:#f00}');
    // Лишнего файла рядом нет: CSS уже в HTML (D-031).
    expect(existsSync(join(root, 'dist/mn.css'))).toBe(false);

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
      attrs: 'data-cls:class',
      extensions: ['.vue'],
      presetExtensions: ['.mnjs'],
      selectorPrefix: '.app ',
    });

    const css = builtCss(root);
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

    const css = builtCss(root);
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
    expect(builtCss(root)).toContain('padding:10px');
  });

  test('пресет-файл без экспортируемой функции игнорируется', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': "import './empty.mn.js';\nexport const x = 1;\n",
      'src/empty.mn.js': 'export const config = { notAFunction: true };\n',
    });

    await runBuild(root);

    expect(builtCss(root)).toContain('padding:10px');
  });

  test('warningMode: error — битый аргумент токена роняет реальную vite-сборку', async () => {
    // Был `totally-unknown-xyz` — после Q-12 (D-014) имя без хендлера считается
    // чужим CSS-классом и молча игнорируется, поэтому strict на нём больше не
    // срабатывает. Берём настоящий MN-тег с битым аргументом.
    //
    // Был и `p8-12` — он перестал быть битым 2026-09-27: `calc(8px - 12px)` это
    // валидный CSS, браузер сам зажимает отрицательный результат. Нужен аргумент,
    // который не проходит уже у самого хендлера, — выдуманная единица.
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10 w10zz"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await expect(runBuild(root, { warningMode: 'error' })).rejects.toThrow(/warningMode: 'error'/);
    } finally {
      warnSpy.mockRestore();
    }
  });

  test('warningMode: error — сборка без предупреждений проходит как обычно', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });

    await runBuild(root, { warningMode: 'error' });

    expect(builtCss(root)).toContain('padding:10px');
  });
});

/**
 * Предупреждения ядра идут в лог сборщика, а не в console: иначе они либо
 * теряются в потоке сборки, либо дублируются. Перехват стоит в плагине всегда,
 * поэтому проверяется на реальной сборке.
 */
describe('minotation-vite — предупреждения ядра', () => {
  /**
   * Собирает проект с битым токеном; возвращает всё, что ушло в лог сборки.
   *
   * Логгер подменяется через `customLogger`, а не перехватом `console`: плагин
   * пишет именно в логгер конфигурации — он один и тот же в dev и в build.
   */
  async function warningsOf(options: MnViteOptions = {}): Promise<string> {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10 w10zz"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });
    const said: string[] = [];
    const { build, createLogger } = await import('vite');
    const logger = createLogger('silent');
    logger.warn = (message: string) => { said.push(message); };
    const prevCwd = process.cwd();
    process.chdir(root);
    try {
      await build({
        root,
        configFile: false,
        customLogger: logger,
        plugins: [mnVite(options)],
        build: { outDir: 'dist', emptyOutDir: true },
      });
    } finally {
      process.chdir(prevCwd);
    }
    // Сборка при этом не отменяется — остальное компилируется.
    expect(builtCss(root)).toContain('padding:10px');
    return said.join('\n');
  }

  test('битый токен доходит до лога сборки', async () => {
    expect(await warningsOf()).toContain('[minotation] w10zz');
  });

  test("warningMode: 'silent' — в лог сборки ничего не уходит", async () => {
    expect(await warningsOf({ warningMode: 'silent' })).not.toContain('[minotation]');
  });

  test('onWarning-функция вызывается и лог сборки не отменяет', async () => {
    const seen: string[] = [];
    const said = await warningsOf({ onWarning: (w) => { seen.push(w.token); } });

    // Компиляция за сборку происходит не один раз (модули и index.html —
    // разные хуки), поэтому пользовательская функция видит токен столько же раз.
    expect(seen).toContain('w10zz');
    expect(said).toContain('[minotation] w10zz');
  });
});

describe('minotation-vite — CSS через граф ассетов Vite (D-031)', () => {
  /** Файлы CSS в `dist/assets`. */
  function assetsCss(root: string): Record<string, string> {
    const dir = join(root, 'dist/assets');
    const out: Record<string, string> = {};
    if (!existsSync(dir)) return out;
    for (const name of readdirSync(dir)) {
      name.endsWith('.css') && (out[name] = readFileSync(join(dir, name), 'utf-8'));
    }
    return out;
  }

  test("inject: 'link' — файл с хешем в имени и ссылка на него ставит сам Vite", async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><div class="p10"></div><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
    });

    await runBuild(root, { inject: 'link' });

    const assets = assetsCss(root);
    const names = Object.keys(assets);
    expect(names).toHaveLength(1);
    // Имя назначает Vite по своим правилам (`assets/[name]-[hash].css`) — нам
    // важно лишь, что в нём есть хеш.
    expect(names[0]).toMatch(/^[\w-]+-[\w-]{8}\.css$/);
    expect(assets[names[0]]).toContain('padding:10px');
    const html = readFileSync(join(root, 'dist/index.html'), 'utf-8');
    expect(html).toContain('/assets/' + names[0]);
    expect(html).not.toContain('<style data-mn');
    expect(html).not.toContain('__mn');
  });

  test("inject: false + import 'virtual:mn.css' в коде — как у UnoCSS", async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': "import 'virtual:mn.css';\nexport const ui = '<div class=\"m20\"></div>';\n",
    });

    await runBuild(root, { inject: false, extensions: ['.js'] });

    const assets = assetsCss(root);
    const css = Object.values(assets).join('');
    expect(css).toContain('margin:20px');
    const html = readFileSync(join(root, 'dist/index.html'), 'utf-8');
    expect(html).toContain('/assets/' + Object.keys(assets)[0]);
    expect(html).not.toContain('<style data-mn');
  });

  test('entry: virtual:mn/<имя>.css — CSS одной записи', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': "import 'virtual:mn/admin.css';\nexport const x = 1;\n",
      'src/site/a.html': '<div class="p10"></div>',
      'src/admin/b.html': '<div class="m20"></div>',
    });

    await runBuild(root, {
      inject: false,
      entry: {
        site: { include: /site/ },
        admin: { include: /admin/ },
      },
    });

    const css = Object.values(assetsCss(root)).join('');
    expect(css).toContain('margin:20px');
    expect(css).not.toContain('padding:10px');
  });
});

describe('minotation-vite — статистика употребления токенов (D-032)', () => {
  test('по умолчанию mn-metrics.json в сборке; metrics: false — нет', async () => {
    const root = makeProject({
      'index.html': '<html><head></head><body><script type="module" src="/src/main.js"></script></body></html>',
      'src/main.js': 'export const x = 1;\n',
      'src/a.html': '<div class="p10 p10 m20"></div>',
    });

    await runBuild(root, {});
    const metrics = JSON.parse(readFileSync(join(root, 'dist/mn-metrics.json'), 'utf-8'));
    expect(metrics.tokens).toEqual([{ name: 'p10', count: 2 }, { name: 'm20', count: 1 }]);
    // Пути — от корня проекта Vite.
    expect(Object.keys(metrics.files)).toEqual(['src/a.html']);

    await runBuild(root, { metrics: false });
    expect(existsSync(join(root, 'dist/mn-metrics.json'))).toBe(false);
  });
});
