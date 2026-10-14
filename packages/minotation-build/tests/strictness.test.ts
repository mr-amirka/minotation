/**
 * Строгость по файлу (D-081): каждый файл судится своими настройками — правила приложения не
 * применяются к пакету, который их не придерживается; правило `scopes` потребителя для строгости
 * важнее декларации пакета.
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
  clearPackageDirectiveCache, createTokenCollector,
} from '../src/index';
import type {
  TokenCollectorOptions,
} from '../src/index';
import {
  presetStandard,
} from 'minotation';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-strict-'));
  clearPackageDirectiveCache();
  mkdirSync(join(dir, 'ui'));
});
afterEach(() => {
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

function pkg(minotation: object, name = 'ui'): void {
  writeFileSync(join(
    dir, 'ui', 'package.json',
  ), JSON.stringify({
    name,
    minotation,
  }));
}

function collector(options: Partial<TokenCollectorOptions> = {}) {
  return createTokenCollector({
    attrs: 'class',
    presets: [presetStandard],
    ...options,
  });
}

describe('режимы токенов по файлу', () => {
  test('приложение строгое, пакет мягкий: токен пакета не ругают, токен приложения — ошибка', () => {
    pkg({
      specificityMode: 'silent',
    });
    const quiet = collector({
      specificityMode: 'strict',
    });
    quiet.add(join(
      dir, 'ui', 'Card.html',
    ), '<b class="p10*2">');
    expect(() => quiet.css()).not.toThrow();
    expect(quiet.takeWarnings()).toEqual([]);
    const strict = collector({
      specificityMode: 'strict',
    });
    strict.add(join(
      dir, 'ui', 'Card.html',
    ), '<b class="p10*2">');
    strict.add(join(dir, 'App.html'), '<b class="m10*2">');
    expect(() => strict.css()).toThrow('m10*2: Raising specificity ("*2") is forbidden (specificityMode: \'strict\')');
  });

  test('один токен в строгом приложении и мягком пакете — ошибка за файл приложения', () => {
    pkg({
      specificityMode: 'silent',
    });
    const both = collector({
      specificityMode: 'strict',
    });
    both.add(join(
      dir, 'ui', 'Card.html',
    ), '<b class="p10*2">');
    both.add(join(dir, 'App.html'), '<b class="p10*2">');
    expect(() => both.css()).toThrow('p10*2: Raising specificity');
  });

  test('правило scopes потребителя для строгости важнее package.json пакета', () => {
    pkg({
      childSelectorMode: 'strict',
    });
    const out = collector({
      scopes: [{
        match: 'ui',
        childSelectorMode: 'silent',
      }],
    });
    out.add(join(
      dir, 'ui', 'List.html',
    ), '<ul class="cF00>1">');
    expect(() => out.css()).not.toThrow();
    expect(out.takeWarnings()).toEqual([]);
  });

  test('неизвестное медиа — по файлам классов с этим медиа', () => {
    pkg({
      unknownMediaMode: 'silent',
    });
    const out = collector({
      unknownMediaMode: 'strict',
    });
    out.add(join(
      dir, 'ui', 'a.html',
    ), '<b class="p10@zz">');
    expect(() => out.css()).not.toThrow();
    out.add(join(dir, 'App.html'), '<b class="m5@zz">');
    expect(() => out.css()).toThrow("unknownMediaMode: 'strict'");
  });

  test('токен не из файлов (mn.assign в пресете) — режим проекта', () => {
    const out = collector({
      unknownMediaMode: 'strict',
      presets: [presetStandard, ((mn: { assign: (selector: string, tokens: string) => void }) => {
        mn.assign('.x', 'p10@zz');
      }) as never],
    });
    out.add(join(dir, 'a.html'), '<b class="p10">');
    expect(() => out.css()).toThrow("unknownMediaMode: 'strict'");
  });

  test('не медиа и не из файлов — тоже режим проекта', () => {
    const out = collector({
      importantMode: 'strict',
      presets: [presetStandard, ((mn: { assign: (selector: string, tokens: string) => void }) => {
        mn.assign('.x', 'm10-i');
      }) as never],
    });
    out.add(join(dir, 'a.html'), '<b class="p10">');
    expect(() => out.css()).toThrow("importantMode: 'strict'");
  });

  test('проект молчит, файл просит сообщать', () => {
    const out = collector({
      importantMode: 'silent',
    });
    out.add(join(dir, 'a.html'), '<!-- @minotation importantMode: warn --><b class="m10-i">');
    out.add(join(dir, 'b.html'), '<b class="p10-i">');
    out.css();
    expect(out.takeWarnings().map((w) => w.token)).toEqual(['m10-i']);
  });
});

describe('warningMode по файлу', () => {
  test("проект 'error', пакет 'silent': битый токен пакета сборку не роняет, токен приложения — роняет", () => {
    pkg({
      warningMode: 'silent',
    });
    const out = collector({
      warningMode: 'error',
    });
    out.add(join(
      dir, 'ui', 'a.html',
    ), '<b class="w10zz">');
    expect(() => out.css()).not.toThrow();
    expect(out.takeWarnings()).toEqual([]);
    out.add(join(dir, 'App.html'), '<b class="h10zz">');
    expect(() => out.css()).toThrow(/warningMode: 'error'/);
  });

  test("проект 'silent', файл 'log' — в отчёт только его", () => {
    const out = collector({
      warningMode: 'silent',
    });
    out.add(join(dir, 'a.html'), '<!-- @minotation warningMode: log --><b class="w10zz">');
    out.add(join(dir, 'b.html'), '<b class="h10zz">');
    out.css();
    expect(out.takeWarnings().map((w) => w.token)).toEqual(['w10zz']);
  });

  test('смена строгости файла сбрасывает кеш', () => {
    const out = collector();
    const file = join(dir, 'a.html');
    out.add(file, '<b class="w10zz">');
    out.css();
    expect(out.takeWarnings()).toHaveLength(1);
    expect(out.add(file, '<!-- @minotation warningMode: silent --><b class="w10zz">')).toBe(true);
    out.css();
    expect(out.takeWarnings()).toEqual([]);
  });
});
