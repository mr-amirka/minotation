/**
 * Пользовательские синонимы состояний (`mn.synonyms`), статические эссенции
 * (`mn.assign` + повторные пересчёты) и переконфигурация опций уже созданного
 * инстанса (`mn.setOptions`, `onError`, `onWarning`).
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeMn(options?: any): any {
  const mn: any = minotationProvider(options);
  mn.setPresets([presetStandard]);
  return mn;
}

function cssOf(mn: any): string {
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

function compile(mn: any, ...tokens: string[]): string {
  const c = mn.getCompiler('class');
  for (const t of tokens) {
    c(t);
  }
  mn.compile();
  return cssOf(mn);
}

describe('mn.synonyms', () => {
  test('строковая форма задаёт один синоним состояния', () => {
    const mn = makeMn();
    mn.synonyms('hov', ':hover');

    expect(compile(mn, 'p10:hov')).toContain(':hover{padding:10px}');
  });

  test('объектная форма задаёт несколько синонимов разом', () => {
    const mn = makeMn();
    mn.synonyms({
      hov: ':hover',
      foc: ':focus', 
    });

    const css = compile(
      mn, 'p10:hov', 'mt4:foc',
    );
    expect(css).toContain(':hover');
    expect(css).toContain(':focus');
  });
});

describe('статические эссенции при повторных пересчётах', () => {
  test('привязка переживает несколько полных пересчётов подряд', () => {
    const mn = makeMn();
    mn.assign('.btn', 'p10');
    mn.compile();
    mn.recompile();
    mn.recompile();

    const css = cssOf(mn);
    expect(css).toContain('.btn');
    expect(css).toContain('padding:10px');
  });

  test('привязка и обычные токены живут вместе после пересчёта', () => {
    const mn = makeMn();
    mn.assign('.btn', 'p10');
    compile(mn, 'mt4');
    mn.recompile();

    const css = cssOf(mn);
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin-top:4px');
  });
});

describe('опции инстанса', () => {
  test('onError получает ошибку хендлера', () => {
    const errors: unknown[] = [];
    const mn: any = minotationProvider({
      onError: (e: unknown) => errors.push(e), 
    });
    mn.setPresets([presetStandard, (instance: any) => {
      instance('kaboomer', () => {
        throw new Error('поломка'); 
      });
    }]);

    compile(mn, 'kaboomer');

    expect(errors.length).toBeGreaterThan(0);
  });

  /**
   * ПЕРЕСМОТРЕНО 2026-09-23 (по вопросу владельца): раньше опции читались
   * заново из `mn.options` на каждом `compile()` — прямая мутация поля
   * подхватывалась. Проверка показала, что этим нигде в монорепе не
   * пользуются (только этот тест) — переключились на явный `mn.setOptions()`,
   * `mn.options` теперь только снимок для чтения/отладки. См.
   * `MEMORY/feedback_dead_code_public_surface.md`.
   */
  test('mn.setOptions() переконфигурирует уже созданный инстанс', () => {
    const mn = makeMn();
    compile(mn, 'p10');
    expect(cssOf(mn)).not.toContain('.app');

    mn.setOptions({
      selectorPrefix: '.app', 
    });
    mn.recompile();

    expect(cssOf(mn)).toContain('.app');
  });

  test('mn.setOptions() сливается с текущими опциями, а не заменяет их целиком', () => {
    const mn: any = minotationProvider({
      selectorPrefix: '.app',
      altColor: true,
    });
    mn.setPresets([presetStandard]);

    mn.setOptions({
      selectorPrefix: '.app2', 
    });

    expect(mn.options.selectorPrefix).toBe('.app2');
    expect(mn.options.altColor).toBe(true); // не задан в partial — сохранился
  });

  test('прямая мутация mn.options эффекта на компиляцию не имеет — только mn.setOptions()', () => {
    const mn = makeMn();
    compile(mn, 'p10');
    expect(cssOf(mn)).not.toContain('.app');

    (mn as any).options.selectorPrefix = '.app';
    mn.recompile();

    expect(cssOf(mn)).not.toContain('.app');
  });

  test('mn.options целиком заменён на undefined извне — не падает, компиляция не затронута', () => {
    const mn = makeMn();
    (mn as any).options = undefined;

    expect(() => compile(mn, 'p10')).not.toThrow();
    expect(cssOf(mn)).toContain('padding:10px');
  });

  test('mn.states целиком заменён на undefined извне — не падает на состояниях', () => {
    const mn = makeMn();
    (mn as any).states = undefined;

    // :hover тут — литеральный псевдокласс (без синонимов, presetSynonyms не
    // подключён в этом файле) — как раз путь, где парсер сначала проверяет
    // instance.states на именованную группу, прежде чем взять :state как есть
    expect(() => compile(mn, 'p10:hover')).not.toThrow();
    expect(cssOf(mn)).toContain(':hover');
  });
});
