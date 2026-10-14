/**
 * Области семейств пресетов в одной сборке (D-076, D-078): пакет со своим семейством —
 * свой экземпляр ядра, свой реестр хендлеров; динамические пресеты — только в своей области.
 */
import {
  mkdirSync, mkdtempSync, rmSync, writeFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  checkBuildOptions, clearPackageDirectiveCache, createBuildCollector, createTokenCollector,
} from '../src/index';
import type {
  MnPreset,
} from '../src/index';
import {
  presetMedias, presetStandard, presetSynonyms, presetTw4,
} from 'minotation';

const APP: MnPreset[] = [
  presetStandard,
  presetSynonyms,
  presetMedias,
];

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-scopes-'));
  clearPackageDirectiveCache();
  mkdirSync(join(dir, 'app'));
  mkdirSync(join(dir, 'ui'));
  writeFileSync(join(
    dir, 'ui', 'package.json',
  ), JSON.stringify({
    minotation: {
      notationMode: 'tw4-compatible',
      requires: ['presetTw4'],
    },
  }));
});
afterEach(() => {
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

function collector(extra: object = {}) {
  const seen: string[] = [];
  const out = createTokenCollector({
    attrs: 'class',
    presets: APP,
    scopePresets: [presetTw4],
    onWarning: (warning) => seen.push(warning.type + ': ' + warning.message),
    ...extra,
  });
  return {
    out,
    seen,
  };
}

describe('пакет со своим семейством — своя область', () => {
  test('приложение и пакет на Tailwind в одной сборке: реестры не смешиваются', () => {
    const {
      out, seen,
    } = collector();
    out.add(join(
      dir, 'app', 'App.html',
    ), '<div class="p10 dF bgE@m">');
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="p-4 flex md:p-2">');
    const css = out.css();
    // До D-078 `presetTw4` забирал `p`/`bg`, и `p10`, `bgE@m` CSS не давали.
    expect(css).toContain('.p10{padding:10px}');
    expect(css).toContain('.bgE\\@m{background:#eee}');
    expect(css).toContain('.p-4{padding:calc(var(--spacing) * 4)}');
    expect(css).toContain('.md\\:p-2{padding:calc(var(--spacing) * 2)}');
    expect(seen.filter((line) => line.startsWith('handler-conflict') || line.includes('produced no CSS'))).toEqual([]);
    // Область приложения — первой.
    expect(css.indexOf('.p10{')).toBeLessThan(css.indexOf('.p-4{'));
  });

  test('требования пакета входят в пресеты приложения — область приложения', () => {
    writeFileSync(join(
      dir, 'ui', 'package.json',
    ), JSON.stringify({
      minotation: {
        requires: ['presetStandard'],
      },
    }));
    const {
      out,
    } = collector({
      scopePresets: [],
    });
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="p10">');
    expect(out.css()).toBe('.p10{padding:10px}');
  });

  test('имени нет ни в presets, ни в scopePresets — ошибка с файлом', () => {
    const {
      out,
    } = collector({
      scopePresets: [],
    });
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="p-4">');
    expect(() => out.css()).toThrow('requires preset "presetTw4", which is not connected.'
      + ' Connected presets: presetStandard, presetSynonyms, presetMedias');
  });

  test('зависимость пресета области берётся из presets приложения', () => {
    // `presetTw4` требует `presetMedias` — он есть у приложения, отдельно его называть не нужно.
    const {
      out,
    } = collector();
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="md:flex">');
    expect(out.css()).toContain('@media (width >= 48rem){.md\\:flex{display:flex}}');
  });

  test('зависимость, названная и в requires, подключается один раз', () => {
    writeFileSync(join(
      dir, 'ui', 'package.json',
    ), JSON.stringify({
      minotation: {
        requires: ['presetTw4', 'presetMedias'],
      },
    }));
    const {
      out,
    } = collector();
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="flex">');
    expect(out.css()).toContain('.flex{display:flex}');
  });

  test('у зависимости пресета области нет пары — сообщает ядро', () => {
    const {
      out,
    } = collector({
      presets: [presetStandard],
    });
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="flex">');
    expect(() => out.css()).toThrow('presetTw4 requires "presetMedias", which is not connected');
  });

  test('повторный вызов без изменений — из кеша; файл ушёл — область исчезла', () => {
    const {
      out,
    } = collector();
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="flex">');
    const first = out.css();
    expect(out.css()).toBe(first);
    out.remove(join(
      dir, 'ui', 'Button.html',
    ));
    expect(out.css()).not.toContain('.flex{');
  });
});

describe('динамические пресеты — только в своей области (D-078)', () => {
  test('пресет пакета не доходит до приложения, пресет приложения — до пакета', () => {
    const appPreset = join(
      dir, 'app', 'theme.mn.ts',
    );
    const uiPreset = join(
      dir, 'ui', 'theme.mn.ts',
    );
    writeFileSync(appPreset, 'export default (mn) => mn(\'appOnly\', \'cF00\');');
    writeFileSync(uiPreset, 'export default (mn) => mn(\'uiOnly\', \'flex\');');
    const {
      out,
    } = collector();
    out.setPreset(appPreset, ((mn: (name: string, value: string) => void) => mn('appOnly', 'cF00')) as unknown as MnPreset);
    out.setPreset(uiPreset, ((mn: (name: string, value: string) => void) => mn('uiOnly', 'flex')) as unknown as MnPreset);
    out.add(join(
      dir, 'app', 'App.html',
    ), '<div class="appOnly uiOnly">');
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="uiOnly appOnly">');
    const css = out.css();
    expect(css).toContain('.appOnly{color:#f00}');
    expect(css).toContain('.uiOnly{display:flex}');
    // Каждое имя — ровно одно правило: из своей области.
    expect(css.match(/\.appOnly\{/g)).toHaveLength(1);
    expect(css.match(/\.uiOnly\{/g)).toHaveLength(1);
  });

  test('директива в самом файле пресета важнее пакета; виртуальный модуль — по пакету', () => {
    const scoped = join(
      dir, 'app', 'tw.mn.ts',
    );
    writeFileSync(scoped, '// @minotation requires: presetTw4\nexport default {};');
    const {
      out,
    } = collector();
    out.setPreset(scoped, ((mn: (name: string, value: string) => void) => mn('twOnly', 'flex')) as unknown as MnPreset);
    out.setPreset('virtual:theme', ((mn: (name: string, value: string) => void) => mn('virtualOnly', 'cF00')) as unknown as MnPreset);
    out.add(join(
      dir, 'app', 'App.html',
    ), '<div class="twOnly virtualOnly">');
    out.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="twOnly">');
    const css = out.css();
    expect(css).toContain('.virtualOnly{color:#f00}');
    expect(css.match(/\.twOnly\{/g)).toHaveLength(1);
    expect(out.removePreset(scoped)).toBe(true);
    expect(out.removePreset(scoped)).toBe(false);
  });
});

describe('scopePresets — опция плагина', () => {
  test('проверка типа; в записи entry — своё значение', () => {
    expect(() => checkBuildOptions({
      scopePresets: 1,
    } as never, 'mnVite')).toThrow('option "scopePresets" expects');
    expect(() => checkBuildOptions({
      entry: {
        ui: {
          scopePresets: [presetTw4],
        },
      },
    }, 'mnVite')).not.toThrow();
    const build = createBuildCollector({
      attrs: 'class',
      presets: APP,
      entry: {
        ui: {
          scopePresets: [presetTw4],
        },
      },
    }, dir);
    build.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="flex">');
    expect(build.outputs()[0].css).toContain('.flex{display:flex}');
  });
});
