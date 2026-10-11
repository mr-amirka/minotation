/**
 * Пресет-объекты и порядок подключения по зависимостям (D-045, SPEC 14 §1–§2).
 */
import minotationProvider from '../core/index';
import {
  orderPresets,
} from '../core/presetOrder';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
import presetNormalize from '../presets/normalize';
import presetMain from '../presets/main';
import presetHints from '../presets/hints';
import type {
  MnPreset, MnPresetObject,
} from '../core/types';

/** Пресет-объект, который записывает свой запуск в журнал. */
function track(
  log: string[], name: string, requires?: string[],
): MnPresetObject {
  return {
    name,
    requires,
    setup: () => {
      log.push(name);
    },
  };
}

describe('orderPresets — устойчивая топологическая сортировка', () => {
  test('зависимость поднимается ровно перед зависящим, остальной порядок — как в списке', () => {
    const log: string[] = [];
    const a = track(
      log, 'a', ['c'],
    );
    const b = track(log, 'b');
    const c = track(log, 'c');
    const fn = () => {
      log.push('fn');
    };
    const ordered = orderPresets([
      fn,
      a,
      b,
      c,
    ], {});
    expect(ordered).toEqual([
      fn,
      c,
      a,
      b,
    ]);
  });

  test('цепочка зависимостей', () => {
    const log: string[] = [];
    const a = track(
      log, 'a', ['b'],
    );
    const b = track(
      log, 'b', ['c'],
    );
    const c = track(log, 'c');
    expect(orderPresets([
      a,
      b,
      c,
    ], {}).map((p) => (p as MnPresetObject).name)).toEqual([
      'c',
      'b',
      'a',
    ]);
  });

  test('тот же объект дважды — один раз', () => {
    const log: string[] = [];
    const a = track(log, 'a');
    const fn = () => undefined;
    expect(orderPresets([
      a,
      fn,
      a,
      fn,
    ], {})).toEqual([a, fn]);
  });

  test('зависимость, подключённая прошлым вызовом, засчитывается; сам он не повторяется', () => {
    const log: string[] = [];
    const a = track(
      log, 'a', ['base'],
    );
    const base = track(log, 'base');
    expect(orderPresets([a, base], {
      base,
    })).toEqual([a]);
  });

  test('нет зависимости — ошибка с перечнем подключённых', () => {
    const a = track(
      [], 'presetTailwind', ['presetTailwindColors'],
    );
    expect(() => orderPresets([a], {
      presetHints: track([], 'presetHints'),
    })).toThrow('[minotation] presetTailwind requires "presetTailwindColors", which is not connected.'
      + ' Connected presets: presetHints, presetTailwind');
  });

  test('взаимная зависимость — ошибка с циклом', () => {
    const a = track(
      [], 'presetA', ['presetB'],
    );
    const b = track(
      [], 'presetB', ['presetA'],
    );
    expect(() => orderPresets([a, b], {}))
      .toThrow('[minotation] presets require each other: presetA → presetB → presetA');
  });

  test('два разных пресета с одним именем — ошибка (и с уже подключённым тоже)', () => {
    expect(() => orderPresets([track([], 'x'), track([], 'x')], {}))
      .toThrow('[minotation] two different presets are named "x"');
    expect(() => orderPresets([track([], 'x')], {
      x: track([], 'x'),
    })).toThrow('two different presets are named "x"');
  });

  test('проверка пресет-объекта: опечатка в ключе, нет имени, нет setup, чужой режим', () => {
    expect(() => orderPresets([{
      name: 'a',
      setup: () => undefined,
      require: ['b'],
    } as never], {})).toThrow('[minotation] preset "a": unknown option "require". Did you mean "requires"?');
    expect(() => orderPresets([{
      setup: () => undefined,
    } as never], {})).toThrow('[minotation] preset object: a preset object needs a "name"');
    expect(() => orderPresets([{
      name: '',
      setup: () => undefined,
    } as never], {})).toThrow('a preset object needs a "name"');
    expect(() => orderPresets([{
      name: 'a',
    } as never], {})).toThrow('[minotation] preset "a": a preset object needs a "setup(mn)" function');
    expect(() => orderPresets([{
      name: 'a',
      setup: () => undefined,
      notationMode: 'variant-prefixed',
    } as never], {})).toThrow('option "notationMode" expects "context-qualified"');
  });
});

describe('mn.setPresets с пресет-объектами', () => {
  test('порядок списка не важен: normalize/main после standard и medias', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
    });
    const presets: MnPreset[] = [
      presetMain,
      presetNormalize,
      presetHints,
      presetMedias,
      presetStandard,
    ];
    mn.setPresets(presets);
    mn.compile();
    const css = mn.styles$.getValue().map((s) => s.content).join('');
    expect(css).toContain('-webkit-tap-highlight-color:#000');
    expect(css).toContain('a{cursor:pointer}');
  });

  test('зависимость из прошлого вызова setPresets', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
    });
    mn.setPresets([presetStandard]);
    expect(() => mn.setPresets([presetNormalize])).not.toThrow();
  });

  test('ошибка зависимости — до выполнения любого пресета', () => {
    const log: string[] = [];
    const mn = minotationProvider();
    expect(() => mn.setPresets([track(log, 'ok'), track(
      log, 'broken', ['missing'],
    )]))
      .toThrow('broken requires "missing"');
    expect(log).toEqual([]);
  });

  test('presetHints-фабрика — пресет-объект с именем', () => {
    const preset = presetHints({});
    expect(preset.name).toBe('presetHints');
    const mn = minotationProvider({
      warningMode: 'silent',
    });
    mn.setPresets([
      preset,
      presetStandard,
      track(
        [], 'mine', ['presetHints'],
      ),
    ]);
  });

  test('опции провайдера: presets — функции и объекты', () => {
    expect(() => minotationProvider({
      presets: [presetStandard, () => undefined],
    })).not.toThrow();
    expect(() => minotationProvider({
      presets: ['presetStandard'] as never,
    })).toThrow('option "presets" expects an array of presets (functions or preset objects)');
  });
});
