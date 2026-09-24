/**
 * Реальные rollup-сборки (не моки хуков) — см. MEMORY
 * `feedback_bundler_plugins_need_real_builds.md`: мок хуков не поймал бы баг
 * вида «side-effect импорт `*.mn.ts` не перехвачен, реальный код пресета попал
 * в бандл» или «asset не эмитится».
 */
import { rollup, type OutputAsset, type OutputChunk } from 'rollup';
import { join } from 'path';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { mnRollup, type MnRollupOptions } from '../src/index';

/** Создаёт временный проект: ключ — относительный путь файла, значение — содержимое. */
function makeProject(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'mn-rollup-test-'));
  for (const rel of Object.keys(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, files[rel]);
  }
  return root;
}

interface RunResult { assets: Record<string, string>; code: string }

/** Гоняет реальную rollup-сборку в памяти и возвращает эмитированные assets + код бандла. */
async function runBuild(root: string, options: MnRollupOptions): Promise<RunResult> {
  const bundle = await rollup({
    input: join(root, 'src/main.js'),
    plugins: [mnRollup({ root, ...options })],
    onwarn: () => undefined,
  });
  const { output } = await bundle.generate({ format: 'es' });
  await bundle.close();

  const assets: Record<string, string> = {};
  let code = '';
  for (const item of output) {
    if (item.type === 'asset') {
      assets[item.fileName] = String((item as OutputAsset).source);
    } else {
      code += (item as OutputChunk).code;
    }
  }
  return { assets, code };
}

describe('minotation-rollup — реальная сборка', () => {
  test('перехватывает side-effect импорт *.mn.ts: заглушка в бандле, пресет применён к CSS', async () => {
    const root = makeProject({
      'src/main.js': "import './theme.mn.ts';\nexport const x = 1;\n",
      'src/app.html': '<div class="p10 rollupToken"></div>',
      'src/theme.mn.ts': "export default (mn) => { mn('rollupToken', 'cF00'); };\nexport const MARKER = 'mn-rollup-fixture-marker-4a8e';\n",
    });

    const { assets, code } = await runBuild(root, {});

    expect(assets['mn.css']).toContain('.p10{padding:10px}');
    expect(assets['mn.css']).toContain('.rollupToken{color:#f00}');
    expect(code).not.toContain('mn-rollup-fixture-marker-4a8e');
  });

  test('кастомные attr/extensions/presetExtensions/fileName/mn + вложенные директории + named-экспорт пресета', async () => {
    const root = makeProject({
      'src/main.js': "import './presets/theme.mnjs';\nexport const x = 1;\n",
      'src/ui/deep/widget.vue': '<template><div data-cls="edgeToken p10"></div></template>',
      'src/presets/theme.mnjs': "export const preset = (mn) => { mn('edgeToken', 'cF00'); };\n",
    });

    const { assets } = await runBuild(root, {
      attr: 'data-cls',
      extensions: ['.vue'],
      presetExtensions: ['.mnjs'],
      fileName: 'styles.css',
      mn: { selectorPrefix: '.app ' },
    });

    expect(assets['styles.css']).toContain('.app .edgeToken{color:#f00}');
    expect(assets['styles.css']).toContain('padding:10px');
  });

  test('transform-хук добирает токены из реально обрабатываемых модулей', async () => {
    const root = makeProject({
      'src/main.js': "import './widget.js';\nexport const x = 1;\n",
      // файл создаётся ПОСЛЕ blanket-скана недоступен, поэтому проверяем иначе:
      // расширение .js входит в extensions, значит токен приходит и через transform
      'src/widget.js': "export const ui = '<div class=\"transformToken p10\"></div>';\n",
    });

    const { assets } = await runBuild(root, { extensions: ['.js'] });

    expect(assets['mn.css']).toContain('padding:10px');
  });

  test('битый пресет-файл: ошибка логируется, сборка продолжается', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="p10"></div>',
      'src/broken.mn.js': 'this is ( not ) valid javascript !!!\n',
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    let calls: unknown[][];

    try {
      const { assets } = await runBuild(root, {});
      expect(assets['mn.css']).toContain('padding:10px');
    } finally {
      // снимок до mockRestore(): он сбрасывает накопленные вызовы
      calls = errorSpy.mock.calls.slice();
      errorSpy.mockRestore();
    }

    expect(calls).toContainEqual([
      '[mnRollup] Failed to evaluate preset file:',
      join(root, 'src/broken.mn.js'),
      expect.anything(),
    ]);
  });

  test('пресет-файл без экспортируемой функции игнорируется', async () => {
    const root = makeProject({
      'src/main.js': "import './empty.mn.js';\nexport const x = 1;\n",
      'src/app.html': '<div class="p10"></div>',
      'src/empty.mn.js': 'export const config = { notAFunction: true };\n',
    });

    const { assets } = await runBuild(root, {});
    expect(assets['mn.css']).toContain('padding:10px');
  });

  test('скрытые директории и node_modules пропускаются, .mn.tsx-пресет применяется', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="p10 tsxToken"></div>',
      'src/theme.mn.tsx': "export default (mn) => { mn('tsxToken', 'cF00'); };\n",
      '.hidden/secret.html': '<div class="mt99"></div>',
      'node_modules/pkg/dist.html': '<div class="mb99"></div>',
    });

    const { assets } = await runBuild(root, {});

    expect(assets['mn.css']).toContain('.tsxToken{color:#f00}');
    expect(assets['mn.css']).not.toContain('margin-top:99px');
    expect(assets['mn.css']).not.toContain('margin-bottom:99px');
  });

  test('нечитаемые пути не ломают обход: битый симлинк и несуществующий root', async () => {
    const root = makeProject({
      'src/main.js': 'export const x = 1;\n',
      'src/app.html': '<div class="fw7"></div>',
    });
    symlinkSync(join(root, 'no-such-target.html'), join(root, 'src', 'dangling.html'));

    const { assets } = await runBuild(root, {});
    expect(assets['mn.css']).toContain('font-weight:700');

    // несуществующий root: readdirSync бросает, плагин не падает
    const bundle = await rollup({
      input: join(root, 'src/main.js'),
      plugins: [mnRollup({ root: join(root, 'no-such-dir'), presets: [] })],
      onwarn: () => undefined,
    });
    const { output } = await bundle.generate({ format: 'es' });
    await bundle.close();
    expect(output.filter((o) => o.type === 'asset')).toHaveLength(0);
  });

  test('load для несуществующего пресет-файла: заглушка возвращается, ошибки нет', () => {
    const plugin = mnRollup();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const load = plugin.load as any;
    const result = load.call({} as any, join(tmpdir(), 'no-such-dir-4a8e', 'ghost.mn.ts'));

    expect(result).toEqual({ code: 'export default {};', map: null });
  });
});
/**
 * Q-07 (решение владельца 2026-09-24): предупреждения компиляции должны
 * доходить до канала вывода сборщика, а не теряться в `console` ядра.
 * До этого ни один плагин с `warnings$` не работал вообще — плагин брал из
 * инстанса только CSS, и битый токен молча исчезал из вывода.
 */
describe('проброс предупреждений в rollup (Q-07)', () => {
  /** Гоняет сборку, собирая предупреждения через `onwarn` самого rollup. */
  async function runCollectingWarnings(
    root: string, options: MnRollupOptions = {},
  ): Promise<string[]> {
    const warnings: string[] = [];
    const bundle = await rollup({
      input: join(root, 'src/main.js'),
      plugins: [mnRollup({
        root,
        ...options,
      })],
      onwarn: (w) => {
        warnings.push(String(w.message));
      },
    });
    await bundle.generate({
      format: 'es',
    });
    await bundle.close();
    return warnings;
  }

  test('битый токен даёт предупреждение rollup с именем токена', async () => {
    const root = makeProject({
      'src/main.js': '// no tokens here\nexport default 1;\n',
      'src/app.html': '<div class="p10zz"></div>',
    });
    const warnings = await runCollectingWarnings(root);
    const mnWarnings = warnings.filter((w) => w.includes('[minotation]'));

    expect(mnWarnings.length).toBeGreaterThan(0);
    expect(mnWarnings.join('\n')).toContain('p10zz');
  });

  test('неизвестный хендлер тоже доходит', async () => {
    const root = makeProject({
      'src/main.js': 'export default 1;\n',
      'src/app.html': '<div class="totallyunknownxyz1"></div>',
    });
    const warnings = await runCollectingWarnings(root);

    expect(warnings.join('\n')).toContain('totallyunknownxyz1');
  });

  test('валидные токены не дают предупреждений', async () => {
    const root = makeProject({
      'src/main.js': 'export default 1;\n',
      'src/app.html': '<div class="p10 cF00 dF"></div>',
    });
    const warnings = await runCollectingWarnings(root);

    expect(warnings.filter((w) => w.includes('[minotation]'))).toEqual([]);
  });

  test('onWarning: "silent" — в лог сборщика ничего не идёт', async () => {
    const root = makeProject({
      'src/main.js': 'export default 1;\n',
      'src/app.html': '<div class="p10zz"></div>',
    });
    const warnings = await runCollectingWarnings(root, {
      mn: {
        onWarning: 'silent',
      },
    });

    expect(warnings.filter((w) => w.includes('[minotation]'))).toEqual([]);
  });

  test('своя функция onWarning вызывается дополнительно к логу сборщика', async () => {
    const root = makeProject({
      'src/main.js': 'export default 1;\n',
      'src/app.html': '<div class="p10zz"></div>',
    });
    const seen: string[] = [];
    const warnings = await runCollectingWarnings(root, {
      mn: {
        onWarning: (w) => {
          seen.push(w.token);
        },
      },
    });

    expect(seen).toContain('p10zz');
    expect(warnings.filter((w) => w.includes('[minotation]')).length).toBeGreaterThan(0);
  });
});
