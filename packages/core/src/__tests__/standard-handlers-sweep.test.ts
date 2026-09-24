/**
 * Регрессия на устойчивость реестра стандартного пресета: каждый
 * зарегистрированный хендлер прогоняется через реальную компиляцию в типовых
 * формах аргумента (без аргумента, число, число с юнитом, ключевое слово,
 * цвет, snake_case, calc-сдвиг, проценты). Ни одна форма не должна ронять
 * компиляцию — битые значения отбраковываются как warning, а не исключением.
 *
 * Имена хендлеров не перечисляются вручную: они собираются с самого пресета
 * через Proxy, поэтому новый хендлер автоматически попадает под проверку.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';

/** Собирает имена всех эссенций, регистрируемых пресетом, попутно применяя его. */
function collectHandlerNames(): string[] {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const mn: any = minotationProvider();
  const names: string[] = [];
  const spy = new Proxy(mn, {
    apply(
      target, thisArg, args: any[],
    ) {
      // пресет регистрирует эссенции обеими формами: mn('name', handler)
      // и mn({ name: handler, … }) — собираем имена из обеих
      if (typeof args[0] === 'string') {
        names.push(args[0]);
      } else if (args[0] && typeof args[0] === 'object') {
        for (const key of Object.keys(args[0])) {
          names.push(key);
        }
      }
      return Reflect.apply(
        target as any, thisArg, args,
      );
    },
  });
  presetStandard(spy as any);
  return names;
}

/** Типовые формы аргумента — покрывают основные ветви разбора суффикса. */
const ARG_FORMS = [
  '',        // без аргумента — ветка значения по умолчанию
  '0',
  '10',
  '10px',
  '50%',
  '1.5',
  '+5',      // calc-сдвиг
  '-5',
  'a',       // однобуквенный синоним/ключевое слово
  'auto',
  'F00',     // цвет
  '_left',   // snake_case → kebab-case
  'Inherit',
  'A',       // односимвольные синонимы (Auto/None и родственные таблицы)
  'N',
  '_',       // одиночное подчёркивание — особый случай у cnt и родственных
  'Zzz',     // camelCase-значение, которого нет ни в одной таблице синонимов
  '10-5',    // calc-вычитание
  '100%-20px', // calc с разными единицами
  '1/2',     // дробь → проценты
  '10.5',    // дробное значение
];

function compileAll(tokens: string[]): string {
  const mn = minotationProvider();
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  const compile = mn.getCompiler('class');
  for (let i = 0; i < tokens.length; i++) {
    compile(tokens[i]);
  }
  mn.compile();
  return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
}

describe('presetStandard — прогон всех хендлеров по формам аргумента', () => {
  const names = collectHandlerNames();

  test('реестр непустой и не содержит дублей', () => {
    expect(names.length).toBeGreaterThan(200);
    expect(new Set(names).size).toBe(names.length);
  });

  test.each(ARG_FORMS)('форма аргумента %p не роняет компиляцию ни для одного хендлера', (arg) => {
    const tokens = names.map((name) => name + arg);
    expect(() => compileAll(tokens)).not.toThrow();
  });

  test('хотя бы базовые формы реально дают CSS', () => {
    const css = compileAll(names.map((name) => name + '10'));
    expect(css).toContain('padding:10px');
    expect(css).toContain('margin:10px');
  });

  test('состояния, медиа и контекстные селекторы поверх тех же хендлеров', () => {
    const tokens: string[] = [];
    for (const name of names) {
      tokens.push(
        name + '10:h', name + '10@sm', '.parent<' + name + '10', name + '10>1',
      );
    }
    expect(() => compileAll(tokens)).not.toThrow();
  });
});
