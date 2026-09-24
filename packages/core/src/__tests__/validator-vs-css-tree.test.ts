/**
 * Сверка нашего валидатора (`cssGrammar`) с официальной грамматикой CSS.
 *
 * ## Зачем
 *
 * `PROPERTY_VALIDATORS` — ручная таблица «CSS-свойство → валидатор», которая
 * живёт отдельно от хендлеров и ничего о них не знает. Хендлер учится отдавать
 * новую форму значения — таблица не в курсе, и КОРРЕКТНЫЙ CSS молча
 * отбраковывается: правила в выводе нет, есть только warning. Так уже было
 * четыре раза: `var()` (до 2026-09-17), многозначные shorthand'ы, градиенты
 * для `background` и `gap:normal` (оба — 2026-09-23). Каждый раз это
 * обнаруживал человек, наткнувшись на неработающий стиль.
 *
 * Этот тест закрывает класс целиком: арбитр — `css-tree` с `mdn-data`, то есть
 * официальная грамматика всех CSS-свойств. Прогоняются ВСЕ пары
 * свойство/значение, которые реально порождает стандартный пресет, и наш
 * вердикт сверяется с эталонным.
 *
 * `css-tree` — только devDependency: в рантайм ядра он не попадает, вес
 * библиотеки остаётся прежним.
 *
 * ## Что проверяется, а что пока нет
 *
 * Направление «мы бракуем то, что по спецификации валидно» — ошибка всегда, и
 * оно проверяется строго (ожидается ноль случаев). Именно это и ломало стили.
 *
 * Обратное направление — «мы пропускаем то, что по спецификации невалидно» —
 * сейчас массовое (около 1100 пар: `border-style:10`, `padding:-5px` и т.п.) и
 * следует из осознанной политики permissive pass-through (см. шапку
 * `cssGrammar.ts`): свойства, которых нет в таблице, не проверяются вообще.
 * Это не ошибка этого теста, а известный объём работ — PLAN.md, п. 18.
 */
import {
  minotationProvider,
} from '../core/index';
import presetStandard from '../presets/standard';
import {
  isValidCssPropertyValue,
} from '../cssGrammar';
import {
  lexer,
} from 'css-tree';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Имена всех эссенций пресета — собираются с него же, а не списком. */
function collectHandlerNames(): string[] {
  const mn: any = minotationProvider();
  const names: string[] = [];
  const spy = new Proxy(mn, {
    apply(
      target, thisArg, args: any[],
    ) {
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

/** Формы аргумента — типовые ветви разбора суффикса. */
const ARG_FORMS = [
  '',
  '10',
  '10px',
  '50%',
  '1.5',
  '-5',
  '10+5',
  '100%-20px',
  'F00',
  'F00.5',
  'A',
  'N',
  'Auto',
  'None',
  'Inherit',
  '_solid',
  '10_20',
  '10_20_30_40',
  'F00-00F',
  '--v',
  '--v;',
  '0.5s',
  '1/2',
];

interface Pair {
  prop: string;
  value: string;
}

/** Все уникальные пары свойство/значение, которые порождает пресет. */
function collectPairs(): Pair[] {
  const names = Array.from(new Set(collectHandlerNames()));
  const seen = new Set<string>();
  const pairs: Pair[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < ARG_FORMS.length; j++) {
      const mn: any = minotationProvider({
        onWarning: 'silent',
      });
      mn.setPresets([presetStandard]);
      mn.getCompiler('class')(names[i] + ARG_FORMS[j]);
      mn.compile();
      const css = mn.styles$.getValue().map((s: {
        content: string;
      }) => s.content).join('');
      const bodies = css.match(/\{[^}]*\}/g) || [];
      for (let b = 0; b < bodies.length; b++) {
        const decls = bodies[b].slice(1, -1).split(';');
        for (let d = 0; d < decls.length; d++) {
          const at = decls[d].indexOf(':');
          if (at < 0) {
            continue;
          }
          const prop = decls[d].slice(0, at).trim();
          const value = decls[d].slice(at + 1).trim();
          if (!prop || !value || seen.has(prop + '|' + value)) {
            continue;
          }
          seen.add(prop + '|' + value);
          pairs.push({
            prop,
            value,
          });
        }
      }
    }
  }
  return pairs;
}

/** Значение с подстановкой — `var(…)` / `env(…)` в любом месте. */
const REGEXP_HAS_VAR = /\b(?:var|env)\(/i;

/**
 * Вердикт официальной грамматики. `null` — сверять нечего, пара пропускается:
 * либо свойство грамматике неизвестно (вендорные префиксы, legacy-алиасы вроде
 * `grid-gap`), либо в значении есть подстановка.
 *
 * Подстановку `css-tree` разбирать не умеет и честно бракует `width:var(--v)`,
 * хотя по спецификации значение с `var()` валидно в ЛЮБОМ свойстве —
 * грамматика к нему не применяется, проверку делает браузер уже после
 * подстановки. Наш валидатор поступает так же (`REGEXP_VAR_FUNCTION` в
 * `cssGrammar.ts`), поэтому арбитром здесь он быть не может.
 */
function referenceVerdict(pair: Pair): boolean | null {
  if (REGEXP_HAS_VAR.test(pair.value)) {
    return null;
  }
  let match;
  try {
    match = lexer.matchProperty(pair.prop, pair.value);
  } catch {
    return null;
  }
  if (match.error && (match.error as Error).name === 'SyntaxReferenceError') {
    return null;
  }
  return !!match.matched;
}

const PAIRS = collectPairs();

describe('валидатор против официальной грамматики CSS (css-tree + mdn-data)', () => {
  test('пары собраны (страховка: пустой набор молча «проходил» бы всё)', () => {
    expect(PAIRS.length).toBeGreaterThan(500);
  });

  test('НЕ бракуем то, что по спецификации валидно', () => {
    // Единственное направление, которое ломает стили пользователя: правило
    // просто не попадает в вывод. Здесь ожидается строгий ноль.
    const wrong: string[] = [];
    for (let i = 0; i < PAIRS.length; i++) {
      const pair = PAIRS[i];
      if (referenceVerdict(pair) !== true) {
        continue;
      }
      if (!isValidCssPropertyValue(pair.prop, pair.value)) {
        wrong.push(pair.prop + ': ' + pair.value);
      }
    }
    expect(wrong).toEqual([]);
  });

  test('известные формы, на которых валидатор ломался раньше', () => {
    // Точечные сторожа: каждая строка — реальный баг, найденный пользователем.
    const cases: Pair[] = [
      {
        prop: 'background',
        value: 'linear-gradient(180deg,#f00 0%,#00f 100%)',
      },
      {
        prop: 'column-gap',
        value: 'normal',
      },
      {
        prop: 'padding',
        value: '10px 20px',
      },
      {
        prop: 'width',
        value: 'calc(100% - 20px)',
      },
    ];
    for (let i = 0; i < cases.length; i++) {
      expect(referenceVerdict(cases[i])).toBe(true);
      expect(isValidCssPropertyValue(cases[i].prop, cases[i].value)).toBe(true);
    }
  });

  test('значение с подстановкой валидно у любого свойства', () => {
    // Арбитр тут неприменим (см. referenceVerdict), поэтому проверяем только
    // наш валидатор — на нём этот класс уже ломался 2026-09-17.
    expect(isValidCssPropertyValue('width', 'var(--v)')).toBe(true);
    expect(isValidCssPropertyValue('background', 'var(--bg)')).toBe(true);
    expect(isValidCssPropertyValue('padding-top', 'env(--safe-top)')).toBe(true);
  });
});
