/**
 * Жизненный цикл инстанса: сброс и полный пересчёт, отложенная компиляция,
 * @keyframes, произвольные CSS-правила и поведение при ошибке внутри хендлера.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import presetPrefixes from '../presets/prefixes';
import {
  MnParseError, MnStrictError, type MnWarning,
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeMn(options?: any) {
  const mn = minotationProvider(options);
  mn.setPresets([presetStandard]);
  return mn;
}

function cssOf(mn: any): string {
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('mn — сброс и пересчёт', () => {
  test('clear() очищает кеши компиляторов — прежние значения атрибутов забыты', () => {
    const mn: any = makeMn();
    const compile = mn.getCompiler('class');
    compile('p10');
    mn.compile();
    expect(cssOf(mn)).toContain('padding:10px');
    expect(Object.keys(compile.cache)).toContain('p10');

    mn.clear();

    expect(Object.keys(compile.cache)).toEqual([]);
  });

  test('повторный clear() на уже очищенном инстансе безопасен', () => {
    const mn: any = makeMn();
    mn.getCompiler('class')('p10');
    mn.compile();

    mn.clear();
    expect(() => mn.clear()).not.toThrow();

    mn.getCompiler('class')('mt4');
    mn.compile();
    expect(cssOf(mn)).toContain('margin-top:4px');
  });

  test('recompile() пересобирает из кеша компиляторов, сохраняя токены', () => {
    const mn: any = makeMn();
    mn.getCompiler('class')('p10');
    mn.compile();

    mn.recompile();

    expect(cssOf(mn)).toContain('padding:10px');
  });

  test('deferCompile()/deferRecompile() схлопывают несколько вызовов в один проход', async () => {
    const mn: any = makeMn();
    mn.getCompiler('class')('mt4');
    mn.deferCompile();
    mn.deferCompile();
    mn.deferRecompile();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(cssOf(mn)).toContain('margin-top:4px');
  });
});

describe('mn — keyframes и произвольный CSS', () => {
  test('setKeyframes принимает строку и объектную форму', () => {
    const mn: any = makeMn();
    mn.setKeyframes('fadeIn', {
      '0%': {
        opacity: 0, 
      },
      '100%': {
        opacity: 1, 
      }, 
    });
    mn.setKeyframes('spin', 'from{transform:rotate(0)}to{transform:rotate(360deg)}');
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('@keyframes fadeIn');
    expect(css).toContain('@keyframes spin');
  });

  test('с presetPrefixes каждая анимация дублируется под вендорный префикс', () => {
    // Ветка по `prefixes` в `keyframesRender` оставалась непокрытой: по умолчанию
    // карта префиксов пуста, и цикл не делал ни одной итерации.
    const mn: any = minotationProvider({
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard, presetPrefixes]);
    mn.setKeyframes('fadeIn', 'from{opacity:0}to{opacity:1}');
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('@keyframes fadeIn');
    expect(css).toContain('@-webkit-keyframes fadeIn');
  });

  test('ifEmpty не перезаписывает уже заданную анимацию, пустое тело — удаляет', () => {
    const mn: any = makeMn();
    mn.setKeyframes('fadeIn', 'from{opacity:0}to{opacity:1}');
    mn.setKeyframes(
      'fadeIn', 'from{opacity:1}to{opacity:0}', 1,
    );
    mn.compile();
    expect(cssOf(mn)).toContain('opacity:0}to{opacity:1');

    mn.setKeyframes('fadeIn', '');
    mn.compile();
    expect(cssOf(mn)).not.toContain('@keyframes fadeIn');
  });

  test('шаги @keyframes можно задавать строкой внутри объекта', () => {
    const mn: any = makeMn();
    mn.setKeyframes('slide', {
      '0%': 'left:0',
      '100%': 'left:100px', 
    });
    mn.compile();

    const css = cssOf(mn);
    expect(css).toContain('@keyframes slide');
    expect(css).toContain('left:100px');
  });

  // Тест на mn.css убран вместе с самим методом (убрать
  // mn.css из публичного API, использовать только mn.assign).
});

describe('mn — ошибки внутри хендлера', () => {
  test('MnParseError из хендлера превращается в warning, токен не даёт CSS', () => {
    const warnings: MnWarning[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: MnWarning) => warnings.push(w), 
    });
    mn.setPresets([presetStandard, (instance: any) => {
      instance('boom', (p: any) => {
        throw new MnParseError('тестовая ошибка разбора', {
          token: p.name + p.suffix,
          handler: p.name,
          arg: p.suffix,
          utility: 'test',
        });
      });
    }]);

    mn.checkByAttrs('boom1', 'class');
    mn.compile();

    expect(warnings.map((w) => w.type)).toContain('parse-error');
    expect(cssOf(mn)).not.toContain('boom');
  });

  test('обычная ошибка хендлера уходит в error$, компиляция продолжается', () => {
    const mn: any = minotationProvider();
    const errors: unknown[] = [];
    mn.error$.on((e: unknown) => errors.push(e));
    mn.setPresets([presetStandard, (instance: any) => {
      instance('kaboom', () => {
        throw new Error('поломка хендлера'); 
      });
    }]);

    mn.checkByAttrs('kaboom1 p10', 'class');
    mn.compile();

    expect(errors.length).toBeGreaterThan(0);
    expect(cssOf(mn)).toContain('padding:10px');
  });
});

describe('mn — strict', () => {
  test('по умолчанию (strict не задан) битый токен не бросает — только warning', () => {
    const mn: any = makeMn();
    mn.checkByAttrs('p10zz', 'class');

    expect(() => mn.compile()).not.toThrow();
  });

  test('strict: true — битый аргумент роняет compile() через MnStrictError', () => {
    const mn: any = makeMn({
      strict: true,
      onWarning: 'silent',
    });
    mn.checkByAttrs('p10zz', 'class');

    expect(() => mn.compile()).toThrow(MnStrictError);
  });

  test('strict: true — чужие CSS-классы сборку НЕ роняют', () => {
    // Иначе любой проект с собственной семантикой или чужой библиотекой
    // не смог бы включить strict вообще.
    const mn: any = makeMn({
      strict: true,
      onWarning: 'silent',
    });
    mn.checkByAttrs('container btn card active swiper-slide uChip', 'class');

    expect(() => mn.compile()).not.toThrow();
  });

  test('strict: true — битое CSS-значение от хендлера тоже роняет compile()', () => {
    const mn: any = minotationProvider({
      strict: true,
      onWarning: 'silent',
    });
    mn.setPresets([presetStandard, (instance: any) => {
      instance('badcss', () => ({
        style: {
          color: 'undefined',
        },
      }));
    }]);
    mn.checkByAttrs('badcss1', 'class');

    expect(() => mn.compile()).toThrow(MnStrictError);
  });

  test('strict: true — токены без предупреждений компилируются как обычно, без throw', () => {
    const mn: any = makeMn({
      strict: true,
    });
    mn.getCompiler('class')('p10');

    expect(() => mn.compile()).not.toThrow();
    expect(cssOf(mn)).toContain('padding:10px');
  });

  test('strict: true — onWarning всё равно вызывается перед throw (strict не подменяет его)', () => {
    const warnings: MnWarning[] = [];
    const mn: any = makeMn({
      strict: true,
      onWarning: (w: MnWarning) => warnings.push(w),
    });
    mn.checkByAttrs('p10zz', 'class');

    expect(() => mn.compile()).toThrow(MnStrictError);
    expect(warnings.map((w) => w.type)).toContain('parse-error');
  });
});

/**
 * Битый аргумент хендлера — ошибка автора
 * токена, а не сбой библиотеки, поэтому он обязан попадать в `warnings$`
 * (`parse-error`), а не в `error$`. До этого `throwInvalid` в пресетах бросал
 * обычный `Error`, и такие случаи уходили в поток ошибок, где их никто не ждал.
 */
describe('битый аргумент хендлера → warnings$, а не error$', () => {
  function compile(token: string) {
    const warnings: MnWarning[] = [];
    const errors: unknown[] = [];
    const mn: any = minotationProvider({
      onWarning: (w: MnWarning) => warnings.push(w),
    });
    mn.error$.on((e: unknown) => errors.push(e));
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')(token);
    mn.compile();
    return {
      css: cssOf(mn),
      warnings,
      errors,
    };
  }

  test.each([
    // Непарсящийся суффикс в разных семействах хендлеров.
    'p10zz',
    'bcF00_0F0',
    'w1/-2',
  ])('%s — parse-error с именем токена, error$ пуст', (token) => {
    const {
      css, warnings, errors,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings.map((w) => w.type)).toContain('parse-error');
    expect(warnings[0].token).toBe(token);
    expect(errors).toEqual([]);
  });

  test('валидный токен не даёт ни предупреждений, ни ошибок', () => {
    const {
      css, warnings, errors,
    } = compile('p10');
    expect(css).toContain('padding:10px');
    expect(warnings).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('настоящий сбой хендлера по-прежнему уходит в error$', () => {
    // Сторож: перевод throwInvalid на MnParseError не должен прятать
    // реальные исключения (TypeError и т.п.) из пользовательских пресетов.
    const errors: unknown[] = [];
    const mn: any = minotationProvider({
      onWarning: 'silent',
    });
    mn.error$.on((e: unknown) => errors.push(e));
    mn.setPresets([presetStandard, (instance: any) => {
      instance('kaboom', () => {
        throw new TypeError('сбой пресета');
      });
    }]);
    mn.checkByAttrs('kaboom1', 'class');
    mn.compile();

    expect(errors.length).toBeGreaterThan(0);
  });
});

/**
 * Граница между двумя каналами на УРОВНЕ РАЗБОРА ИМЕНИ токена.
 *
 * `withCatchParseComboNameDecorate` делит исключения: `MnParseError` — ошибка
 * автора токена, уходит в `warnings$`; всё остальное — сбой библиотеки, уходит
 * в `error$`. Второй путь долго считался недостижимым: вся начинка разбора
 * (`getCombinator`, `getEssence`, раскрытие состояний) бросает именно
 * `MnParseError`. Он достижим через `mn.states` — ПУБЛИЧНУЮ точку расширения
 * (дважды за
 * сессию «мёртвым» объявлялось то, что внешний код вправе переприсвоить).
 */
describe('разбор имени токена: не-MnParseError уходит в error$', () => {
  test('сбой в mn.states не превращается в warning', () => {
    const errors: Error[] = [];
    const warnings: MnWarning[] = [];
    const mn: any = minotationProvider({
      onError: (e: Error) => errors.push(e),
      onWarning: (w: MnWarning) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.states = new Proxy({}, {
      get() {
        throw new TypeError('boom from states');
      },
    });

    mn.getCompiler('class')('p10:hover');
    mn.compile();

    expect(errors.map((e) => e.message)).toContain('boom from states');
    expect(warnings).toHaveLength(0);
  });
});
