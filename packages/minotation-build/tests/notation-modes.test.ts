/**
 * Режим синтаксиса файла разметки, `requires` и конфликты режимов (D-045 этап 3, SPEC 14 §4–§5).
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
  clearPackageDirectiveCache, createBuildCollector, createTokenCollector, readNotationDirective,
  readPackageDirective,
} from '../src/index';
import type {
  MnPreset,
} from '../src/index';
import {
  presetStandard,
} from 'minotation';

/** Пресет-клон в миниатюре: синонимы в записи Tailwind. */
const presetTailwindish = {
  name: 'presetTailwindish',
  setup(mn: { synonyms: (map: Record<string, string>) => void }) {
    mn.synonyms({
      hover: ':hover',
    });
  },
} as unknown as MnPreset;

const PRESETS: MnPreset[] = [presetStandard, presetTailwindish];

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-modes-'));
  clearPackageDirectiveCache();
});
afterEach(() => {
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

describe('readNotationDirective — комментарий @minotation в начале файла', () => {
  test.each([
    ['/* @minotation notationMode: variant-prefixed */', {
      notationMode: 'variant-prefixed',
    }],
    ['// @minotation notationMode: variant-prefixed; requires: presetA, presetB', {
      notationMode: 'variant-prefixed',
      requires: ['presetA', 'presetB'],
    }],
    ['/* @minotation notationMode: variant-prefixed; */', {
      notationMode: 'variant-prefixed',
    }],
    ['<!-- @minotation requires: presetTailwind -->\n<div>', {
      requires: ['presetTailwind'],
    }],
    ['/**\n * Кнопка.\n * @minotation notationMode: context-qualified\n */', {
      notationMode: 'context-qualified',
    }],
  ])('%s', (source, expected) => {
    expect(readNotationDirective(source, 'a.tsx')).toEqual(expected);
  });

  test('нет директивы — undefined; директива далеко от начала — не читается', () => {
    expect(readNotationDirective('<div class="p10">', 'a.html')).toBeUndefined();
    expect(readNotationDirective('x'.repeat(3000) + '/* @minotation notationMode: variant-prefixed */', 'a.tsx'))
      .toBeUndefined();
  });

  test('ошибки: опечатка в ключе, неверный режим, нет двоеточия', () => {
    expect(() => readNotationDirective('/* @minotation notationMod: variant-prefixed */', 'Button.tsx'))
      .toThrow('[minotation] Button.tsx @minotation: unknown option "notationMod". Did you mean "notationMode"?');
    expect(() => readNotationDirective('/* @minotation notationMode: tailwind */', 'Button.tsx'))
      .toThrow('option "notationMode" expects "context-qualified" or "variant-prefixed", got string "tailwind"');
    expect(() => readNotationDirective('/* @minotation variant-prefixed */', 'Button.tsx'))
      .toThrow('[minotation] Button.tsx: "@minotation variant-prefixed" expects "key: value"');
  });
});

describe('readPackageDirective — поле "minotation" ближайшего package.json', () => {
  test('ближайший пакет; кеш по каталогам; пакет без поля — undefined', () => {
    mkdirSync(join(
      dir, 'lib', 'src',
    ), {
      recursive: true,
    });
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'app',
    }));
    writeFileSync(join(
      dir, 'lib', 'package.json',
    ), JSON.stringify({
      name: 'lib',
      minotation: {
        notationMode: 'variant-prefixed',
        requires: ['presetTailwindish'],
      },
    }));
    expect(readPackageDirective(join(
      dir, 'lib', 'src', 'a.tsx',
    ))).toEqual({
      notationMode: 'variant-prefixed',
      requires: ['presetTailwindish'],
    });
    expect(readPackageDirective(join(
      dir, 'lib', 'src', 'b.tsx',
    ))).toEqual({
      notationMode: 'variant-prefixed',
      requires: ['presetTailwindish'],
    });
    expect(readPackageDirective(join(dir, 'app.tsx'))).toBeUndefined();
  });

  test('виртуальный модуль — undefined; битый package.json — undefined; неверное поле — ошибка', () => {
    expect(readPackageDirective('virtual:mn.css')).toBeUndefined();
    writeFileSync(join(dir, 'package.json'), '{ broken');
    expect(readPackageDirective(join(dir, 'a.tsx'))).toBeUndefined();
    clearPackageDirectiveCache();
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      minotation: {
        mode: 'x',
      },
    }));
    expect(() => readPackageDirective(join(dir, 'a.tsx')))
      .toThrow('package.json "minotation": unknown option "mode". Known options: notationMode, requires');
  });

  test('нет ни одного package.json до корня — undefined', () => {
    expect(readPackageDirective('/mn-no-such-dir-anywhere/a/b.tsx')).toBeUndefined();
  });
});

describe('накопитель: классы в режиме своего файла', () => {
  test('файл с директивой variant-prefixed в проекте context-qualified', () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
      warningMode: 'silent',
    });
    collector.add(join(dir, 'App.html'), '<div class="p10:hover"></div>');
    collector.add(join(dir, 'Button.tsx'), '// @minotation notationMode: variant-prefixed\n<button class="hover:cF00">');
    const css = collector.css();
    expect(css).toContain('.p10\\:hover:hover{padding:10px}');
    expect(css).toContain('.hover\\:cF00:hover{color:#f00}');
  });

  test('режим из package.json пакета', () => {
    mkdirSync(join(dir, 'ui'));
    writeFileSync(join(
      dir, 'ui', 'package.json',
    ), JSON.stringify({
      minotation: {
        notationMode: 'variant-prefixed',
      },
    }));
    const collector = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
      warningMode: 'silent',
    });
    collector.add(join(
      dir, 'ui', 'Button.html',
    ), '<button class="hover:cF00">');
    expect(collector.css()).toContain('.hover\\:cF00:hover{color:#f00}');
  });

  test('директива с режимом проекта — без отдельного компилятора; смена режима сбрасывает кеш', () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
      warningMode: 'silent',
    });
    const file = join(dir, 'a.html');
    expect(collector.add(file, '<!-- @minotation notationMode: context-qualified --><b class="p10">')).toBe(true);
    expect(collector.css()).toContain('.p10{padding:10px}');
    expect(collector.add(file, '<!-- @minotation notationMode: variant-prefixed --><b class="p10">')).toBe(true);
    expect(collector.add(file, '<!-- @minotation notationMode: variant-prefixed --><b class="p10">')).toBe(false);
    collector.remove(file);
    collector.clear();
  });
});

describe('requires — нужный пресет подключён', () => {
  test('нет — ошибка с файлом и перечнем подключённых', () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: [presetStandard],
    });
    collector.add(join(dir, 'Button.tsx'), '// @minotation requires: presetTailwindish\n<b class="p10">');
    expect(() => collector.css()).toThrow('requires preset "presetTailwindish", which is not connected.'
      + ' Connected presets: presetStandard');
  });

  test('есть — сборка идёт; без пресетов — «none»', () => {
    const ok = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
    });
    ok.add(join(dir, 'a.tsx'), '// @minotation requires: presetTailwindish\n<b class="p10">');
    expect(ok.css()).toContain('padding:10px');
    const none = createTokenCollector({
      attrs: 'class',
    });
    none.add(join(dir, 'a.tsx'), '// @minotation requires: presetX\n<b class="p10">');
    expect(() => none.css()).toThrow('Connected presets: none');
  });
});

describe('notationConflictMode — один класс в разных режимах значит разное', () => {
  const tailwindFile = '// @minotation notationMode: variant-prefixed\n<b class="hover:cF00">';
  const projectFile = '<b class="hover:cF00">';

  test("'warn' (по умолчанию): предупреждение, в CSS — разбор, который даёт CSS", () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
    });
    collector.add(join(dir, 'a.html'), projectFile);
    collector.add(join(dir, 'b.tsx'), tailwindFile);
    expect(collector.css()).toContain('.hover\\:cF00:hover{color:#f00}');
    expect(collector.takeWarnings()).toEqual([{
      type: 'notation-conflict',
      token: 'hover:cF00',
      message: 'Class "hover:cF00" means different things in different notation modes:'
        + ' context-qualified (no CSS), variant-prefixed. Kept: variant-prefixed.'
        + ' To fail the build instead: notationConflictMode: \'strict\'.',
    }]);
  });

  test("'strict': ошибка", () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
      notationConflictMode: 'strict',
    });
    collector.add(join(dir, 'a.html'), projectFile);
    collector.add(join(dir, 'b.tsx'), tailwindFile);
    expect(() => collector.css()).toThrow('Class "hover:cF00" means different things in different notation modes');
  });

  test('одинаковый CSS в обоих режимах — не конфликт', () => {
    const collector = createTokenCollector({
      attrs: 'class',
      presets: PRESETS,
    });
    collector.add(join(dir, 'a.html'), '<b class="p10">');
    collector.add(join(dir, 'b.tsx'), '// @minotation notationMode: variant-prefixed\n<b class="p10">');
    expect(collector.css()).toContain('.p10{padding:10px}');
    expect(collector.takeWarnings()).toEqual([]);
  });
});

describe('createBuildCollector — директива доходит до записей entry', () => {
  test('add читает директиву файла; set принимает её явно', () => {
    const build = createBuildCollector({
      attrs: 'class',
      presets: PRESETS,
      warningMode: 'silent',
    }, dir);
    build.add(join(dir, 'a.tsx'), '// @minotation notationMode: variant-prefixed\n<b class="hover:cF00">');
    build.set(
      join(dir, 'b.tsx'), ['class hover:c0F0'], {
        notationMode: 'variant-prefixed',
      },
    );
    const css = build.outputs().map((output) => output.css).join('');
    expect(css).toContain('.hover\\:cF00:hover{color:#f00}');
    expect(css).toContain('.hover\\:c0F0:hover{color:#0f0}');
  });
});

