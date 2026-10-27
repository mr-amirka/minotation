/**
 * Реальная сборка esbuild (не мок хуков) — см. MEMORY
 * `feedback_bundler_plugins_need_real_builds.md`: мок регистрации hook'ов
 * не может поймать баг вида "side-effect импорт `*.mn.ts` не перехвачен,
 * реальный код пресета попал в клиентский бандл".
 */
import { build } from 'esbuild';
import { join } from 'path';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { mnEsbuild } from '../src/index';
import { scopeClassName } from 'minotation-build';
import { presetHints, presetStandard, presetSynonyms, presetMedias, presetMain, presetTw4 } from 'minotation';

/** Набор, который раньше подключался по умолчанию; теперь пресеты — только явно (D-110). */
const PRESETS = [presetHints, presetStandard, presetSynonyms, presetMedias, presetMain];

const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('minotation-esbuild — реальная сборка', () => {
  test('несколько корней (монорепо): токены и пресеты из всех корней, чужой пресет не попадает', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'mn-esbuild-roots-'));
    const files: Record<string, string> = {
      'src/app.tsx': 'export const app = <div class="p10 cardToken" />;\n',
      'shared/card.tsx': 'export const card = <div class="m10" />;\n',
      'shared/card.mn.ts': "export default (mn) => { mn('cardToken', 'cF00'); };\n",
      'other/leak.mn.ts': "export default (mn) => { mn('leak', 'c0F0'); };\n",
      'other/leak.tsx': 'export const leak = <div class="leak w20" />;\n',
    };
    for (const rel of Object.keys(files)) {
      mkdirSync(join(repo, rel, '..'), { recursive: true });
      writeFileSync(join(repo, rel), files[rel]);
    }
    const outDir = join(repo, 'out');

    await build({
      entryPoints: [join(repo, 'src/app.tsx')],
      bundle: true,
      outdir: outDir,
      jsx: 'preserve',
      plugins: [mnEsbuild({ presets: PRESETS, attrs: 'class', root: [join(repo, 'src'), join(repo, 'shared')] })],
    });

    const css = readFileSync(join(outDir, 'mn.css'), 'utf-8');
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.m10{margin:10px}');
    expect(css).toContain('.cardToken{color:#f00}');
    expect(css).not.toContain('.leak');
  });

  test('перехватывает side-effect импорт *.mn.ts: заглушка в JS-бандле, пресет реально применён к CSS', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'mn-esbuild-test-'));

    await build({
      entryPoints: [join(FIXTURES_DIR, 'app.tsx')],
      bundle: true,
      outdir: outDir,
      plugins: [mnEsbuild({ presets: PRESETS, attrs: 'class', root: FIXTURES_DIR })],
    });

    const js = readFileSync(join(outDir, 'app.js'), 'utf-8');
    expect(js).not.toContain('mn-esbuild-fixture-marker-9f3c1a');

    const css = readFileSync(join(outDir, 'mn.css'), 'utf-8');
    expect(css).toContain('.mnEsbuildFixtureToken{color:#f00}');
    expect(css).toContain('padding:10px');
  });
});

describe('mnEsbuild — изоляция областей пакетов (D-075, D-076)', () => {
  test('модуль пакета — с классом области в бандле; правила области — с ним', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mn-esbuild-iso-'));
    const put = (rel: string, text: string) => {
      mkdirSync(join(root, rel, '..'), { recursive: true });
      writeFileSync(join(root, rel), text);
    };
    put('src/main.js', "import { card } from '../ui/card.jsx';\nexport const x = card;\n");
    put('ui/package.json', JSON.stringify({ name: '@acme/ui', minotation: { requires: ['presetTw4'], notationMode: 'tw4-compatible' } }));
    put('ui/card.jsx', 'export const card = <b className="p-4" />;\n');
    const outdir = join(root, 'out');
    const result = await build({
      entryPoints: [join(root, 'src/main.js')],
      bundle: true,
      write: true,
      outdir,
      jsx: 'preserve',
      plugins: [mnEsbuild({
        presets: PRESETS,
        root: [join(root, 'src'), join(root, 'ui')],
        attrs: 'class, className:class',
        scopePresets: [presetTw4],
        isolateMode: 'class',
        fileName: 'mn.css',
      })],
    });
    const cls = scopeClassName('presetTw4');
    expect(readFileSync(join(outdir, 'main.js'), 'utf8')).toContain('className="' + cls + ' p-4"');
    expect(readFileSync(join(outdir, 'mn.css'), 'utf8')).toContain('.p-4.' + cls + '{');
    expect(result.warnings).toEqual([]);
  });
});
