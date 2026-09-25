/**
 * Публичный API инстанса (`updateAttrByMap`, `recompileFrom`, `check*ByAttrs`,
 * `setStyle`) и система предупреждений (`warnings$`, `onWarning`, `maxDepth`).
 * DOM-узлы здесь — минимальные структурные заглушки: тестовое окружение ядра —
 * node, а компилятору от узла нужны только `getAttribute`/`childNodes`.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import {
  MnParseError,
  MnStrictError,
} from '../index';
import {
  MnParseError as MnParseErrorType,
  MnStrictError as MnStrictErrorType,
} from '../core/types';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnWarning, 
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeMn(options?: any) {
  const mn = minotationProvider(options);
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  return mn;
}

function cssOf(mn: any): string {
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

/** Структурная заглушка DOM-узла: компилятору нужны только эти два свойства. */
function node(attrs: Record<string, string>, children: any[] = []): any {
  return {
    nodeType: 1,
    getAttribute: (name: string) => attrs[name] ?? null,
    childNodes: children,
  };
}

describe('mn — обход значений атрибутов', () => {
  test('updateAttrByMap принимает карту комбо-имён', () => {
    const mn: any = makeMn();
    mn.updateAttrByMap({
      p10: 1,
      mt4: 1,
      cF00: 1, 
    }, 'class');
    mn.compile();

    expect(cssOf(mn)).toContain('.p10{padding:10px}');
    expect(cssOf(mn)).toContain('.mt4{margin-top:4px}');
  });

  test('recompileFrom пересобирает CSS с нуля по снимку атрибутов', () => {
    const mn: any = makeMn();
    mn.updateAttrByMap({
      'p10': 1, 
    }, 'class');
    mn.compile();
    expect(cssOf(mn)).toContain('padding:10px');

    mn.recompileFrom({
      class: {
        'mt4': 1, 
      }, 
    });

    const css = cssOf(mn);
    expect(css).toContain('margin-top:4px');
    expect(css).not.toContain('padding:10px');
  });

  test('checkByAttrs принимает готовое значение атрибута — строкой и списком атрибутов', () => {
    const mn: any = makeMn();
    mn.checkByAttrs('p10', 'class');
    mn.checkByAttrs('mt4', ['class', 'id']);
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });

  test('recursiveCheckByAttrs обходит поддерево, checkOneNodeByAttrs — только сам узел', () => {
    const tree = node({
      class: 'p10', 
    }, [node({
      class: 'mt4', 
    })]);

    const deep: any = makeMn();
    deep.recursiveCheckByAttrs(tree, 'class');
    deep.compile();
    expect(cssOf(deep)).toContain('margin-top:4px');

    const shallow: any = makeMn();
    shallow.checkOneNodeByAttrs(tree, ['class']);
    shallow.compile();
    const css = cssOf(shallow);
    expect(css).toContain('padding:10px');
    expect(css).not.toContain('margin-top:4px');
  });

  test('setStyle добавляет произвольный CSS-блок в вывод', () => {
    const mn: any = makeMn();
    mn.setStyle('reset', '*{box-sizing:border-box}');
    mn.compile();

    expect(cssOf(mn)).toContain('*{box-sizing:border-box}');
  });
});

describe('mn — предупреждения и maxDepth', () => {
  test('maxDepth в режиме warn: предупреждение есть, CSS всё равно генерируется', () => {
    const warnings: MnWarning[] = [];
    const mn: any = makeMn({
      maxDepth: 2,
      maxDepthMode: 'warn',
      onWarning: (w: MnWarning) => warnings.push(w), 
    });
    mn.checkByAttrs('p10<5.parent', 'class');
    mn.compile();

    expect(warnings.map((w) => w.type)).toContain('max-depth-exceeded');
    expect(cssOf(mn)).toContain('padding:10px');
  });

  test('maxDepth в режиме block: токен не даёт CSS, предупреждение уходит в warnings$', () => {
    const mn: any = makeMn({
      maxDepth: 2,
      maxDepthMode: 'block',
      onWarning: 'silent', 
    });
    mn.checkByAttrs('p10<5.parent', 'class');
    mn.compile();

    expect(cssOf(mn)).not.toContain('padding:10px');
    const types = mn.warnings$.getValue().map((w: MnWarning) => w.type);
    expect(types).toContain('max-depth-exceeded');
  });

  test('незнакомое имя — чужой CSS-класс, молчим (Q-12, 2026-09-24)', () => {
    // Раньше это давало предупреждение `unknown-handler` на КАЖДЫЙ класс,
    // которого нет в пресетах, — то есть на `container`, `btn`, `active` и
    // любую чужую семантику. Нотация рассчитана на соседство с другими
    // классами, поэтому незнакомое имя ошибкой не считается.
    const mn: any = makeMn({
      onWarning: 'silent',
    });
    mn.checkByAttrs('noSuchHandlerXyz container btn active swiper-slide', 'class');
    mn.compile();

    expect(mn.warnings$.getValue()).toEqual([]);
  });

  test('битый аргумент ЗАРЕГИСТРИРОВАННОГО хендлера предупреждение даёт', () => {
    // Граница: тут автор явно писал MN-токен (`p` — реальный хендлер) и
    // ошибся в аргументе, это уже его ошибка, а не чужой класс.
    const mn: any = makeMn({
      onWarning: 'silent',
    });
    mn.checkByAttrs('p10zz', 'class');
    mn.compile();

    const types = mn.warnings$.getValue().map((w: MnWarning) => w.type);
    expect(types).toContain('parse-error');
  });

  test("onWarning: 'console' пишет предупреждение в консоль", () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    let calls: unknown[][];
    try {
      const mn: any = makeMn({
        onWarning: 'console', 
      });
      mn.checkByAttrs('p10zz', 'class');
      mn.compile();
    } finally {
      // снимок до mockRestore(): он сбрасывает накопленные вызовы
      calls = warnSpy.mock.calls.slice();
      warnSpy.mockRestore();
    }

    expect(calls.length).toBeGreaterThan(0);
  });
});

describe('mn — медиа-выражения', () => {
  test('приоритет медиа через ^N', () => {
    const mn: any = makeMn();
    mn.checkByAttrs('p10@sm^2', 'class');
    mn.compile();

    expect(cssOf(mn)).toContain('padding:10px');
  });

  test('универсальное медиа @x компилируется без query', () => {
    const mn: any = makeMn();
    mn.checkByAttrs('p10@x', 'class');
    mn.compile();

    expect(cssOf(mn)).toContain('padding:10px');
  });
});

/**
 * Публичная точка входа отдаёт классы ошибок в форме, которую видит
 * cjs-module-lexer (`export const`, а не `export { X } from`).
 *
 * Шапка `src/index.ts` предупреждает об этом с 2026-09-03: второй формой
 * `import { X } from 'minotation'` из чужого ESM-кода падал с «does not provide
 * an export named X», хотя `require()` видел символ нормально. `MnParseError`
 * и `MnStrictError` оставались последними в старой форме.
 */
describe('публичные экспорты точки входа', () => {
  test('классы ошибок доступны из index и это те же самые классы', () => {
    expect(MnParseError).toBe(MnParseErrorType);
    expect(MnStrictError).toBe(MnStrictErrorType);
    expect(new MnParseError('x', {
      token: 't',
      handler: '',
      arg: '',
    })).toBeInstanceOf(Error);
  });
});
