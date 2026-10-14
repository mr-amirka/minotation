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
      plugins: [mnEsbuild({ attrs: 'class', root: [join(repo, 'src'), join(repo, 'shared')] })],
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
      plugins: [mnEsbuild({ attrs: 'class', root: FIXTURES_DIR })],
    });

    const js = readFileSync(join(outDir, 'app.js'), 'utf-8');
    expect(js).not.toContain('mn-esbuild-fixture-marker-9f3c1a');

    const css = readFileSync(join(outDir, 'mn.css'), 'utf-8');
    expect(css).toContain('.mnEsbuildFixtureToken{color:#f00}');
    expect(css).toContain('padding:10px');
  });
});
