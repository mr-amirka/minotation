/**
 * Реальная сборка esbuild (не мок хуков) — см. MEMORY
 * `feedback_bundler_plugins_need_real_builds.md`: мок регистрации hook'ов
 * не может поймать баг вида "side-effect импорт `*.mn.ts` не перехвачен,
 * реальный код пресета попал в клиентский бандл".
 */
import { build } from 'esbuild';
import { join } from 'path';
import { readFileSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { mnEsbuild } from '../src/index';

const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('minotation-esbuild — реальная сборка', () => {
  test('перехватывает side-effect импорт *.mn.ts: заглушка в JS-бандле, пресет реально применён к CSS', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'mn-esbuild-test-'));

    await build({
      entryPoints: [join(FIXTURES_DIR, 'app.tsx')],
      bundle: true,
      outdir: outDir,
      plugins: [mnEsbuild({ attr: 'class', root: FIXTURES_DIR })],
    });

    const js = readFileSync(join(outDir, 'app.js'), 'utf-8');
    expect(js).not.toContain('mn-esbuild-fixture-marker-9f3c1a');

    const css = readFileSync(join(outDir, 'mn.css'), 'utf-8');
    expect(css).toContain('.mnEsbuildFixtureToken{color:#f00}');
    expect(css).toContain('padding:10px');
  });
});
