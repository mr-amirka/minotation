/**
 * Отклонённый вариант сканера: один проход автоматом вместо трёх нативных.
 *
 * Хранится не как мёртвый код, а как замер: идея «всё в один проход» здесь проигрывает,
 * и без цифр к ней возвращались бы снова. Рабочая реализация — три прохода
 * в `src/extractTokens.ts`.
 *
 * ## Результаты 2026-09-25 (Darwin, node 24, 300 файлов × 20 прогонов)
 *
 * | Вариант | Время | К трём проходам |
 * |---|---|---|
 * | три прохода: regex + indexOf (рабочий) | 38,0 мс | — |
 * | один проход, автомат на `source[i]` | 137,2 мс | −221 % |
 * | один проход, автомат на `charCodeAt` | 55,7 мс | −44 % |
 * | от кавычки назад (`quote-driven.bench.ts`) | 45,1 мс | −19 % |
 *
 * ## Почему так
 *
 * Регулярка и `indexOf` исполняются нативно, а любой ручной обход — это JS-цикл на каждый
 * символ файла. Трёх нативных проходов по строке дешевле, чем одного интерпретируемого.
 * Первая версия была втрое хуже ещё и потому, что `source[i]` аллоцирует односимвольную
 * строку на каждый доступ; переход на `charCodeAt` снял большую часть разрыва, но не весь.
 *
 * Вывод для похожих задач: «один проход» стоит мерить, а не принимать за улучшение.
 * Выигрывает он тогда, когда проходы делают дорогую работу на КАЖДОМ элементе, а не когда
 * сама работа уходит в нативный код.
 *
 * Запуск: npx tsx src/__benchmarks__/onepass.bench.ts
 */
import {
  scanTokens, 
} from '../extractTokens';
import {
  pushLiteralTokensForBench as pushLiteralTokens, 
} from '../extractTokens';

const FILES = 300;
const ROUNDS = 20;
const SAMPLE = `
import { mne } from 'minotation/mne';
const chipClass = 'py7 px12 r b1 bsS bc--line bg--panel c--ink f14 fw5 cr';
const thClass = 'taL py12 px14 b bb1 bsS bc--line f12 lts0.06em ttU fw6 c--ink-3 bg--bg';
export default function Row({ active }) {
  return (
    <tr class="dF fxdC gap8 p16 b1 bsS bc--line r12 bg--panel">
      <td class={mne(thClass, 'fvTN')}>1</td>
      <td class={active ? mne(chipClass, 'bg--ink c--bg') : chipClass}>x</td>
      <div class="dG gtcAF240 gap12 wmaxN@760 m(b10|t20)>h(2|3)" />
    </tr>
  );
}
`.repeat(3);

const sources: string[] = [];
for (let i = 0; i < FILES; i++) {
  sources.push(SAMPLE.replace('Row', 'Row' + i));
}

function bench(name: string, fn: () => void): number {
  for (let i = 0; i < 3; i++) {
    fn();
  }
  const start = performance.now();
  for (let i = 0; i < ROUNDS; i++) {
    fn();
  }
  const elapsed = performance.now() - start;
  console.log(`${name}: ${elapsed.toFixed(2)}ms`);
  return elapsed;
}

/** Коды символов: посимвольный доступ `source[i]` аллоцирует строку, `charCodeAt` — нет. */
const CH_TAB = 9;
const CH_LF = 10;
const CH_CR = 13;
const CH_SPACE = 32;
const CH_DQUOTE = 34;
const CH_DOLLAR = 36;
const CH_SQUOTE = 39;
const CH_LPAREN = 40;
const CH_RPAREN = 41;
const CH_DOT = 46;
const CH_0 = 48;
const CH_9 = 57;
const CH_COLON = 58;
const CH_SEMICOLON = 59;
const CH_EQ = 61;
const CH_A_UP = 65;
const CH_Z_UP = 90;
const CH_LBRACKET = 91;
const CH_BACKSLASH = 92;
const CH_RBRACKET = 93;
const CH_UNDERSCORE = 95;
const CH_BACKTICK = 96;
const CH_A_LOW = 97;
const CH_Z_LOW = 122;
const CH_LBRACE = 123;
const CH_RBRACE = 125;

/** Идентификаторный символ по коду. */
function isIdentCode(c: number): boolean {
  return c === CH_UNDERSCORE || c === CH_DOLLAR
    || (c >= CH_A_LOW && c <= CH_Z_LOW)
    || (c >= CH_A_UP && c <= CH_Z_UP)
    || (c >= CH_0 && c <= CH_9);
}

/** Пробельный символ по коду. */
function isSpaceCode(c: number): boolean {
  return c === CH_SPACE || c === CH_LF || c === CH_TAB || c === CH_CR;
}

/** Кавычка по коду. */
function isQuoteCode(c: number): boolean {
  return c === CH_SQUOTE || c === CH_DQUOTE || c === CH_BACKTICK;
}

/**
 * Однопроходный сканер: все три конструкции за один обход строки.
 *
 * ## Замер, из-за которого он такой
 *
 * Идея «один проход вместо трёх» сначала оказалась ВДВОЕ ХУЖЕ трёх проходов: автомат
 * на `source[i]` дал 137 мс против 43 мс. Причина в том, что посимвольный доступ
 * к строке аллоцирует односимвольную строку на каждый символ файла, тогда как регулярки
 * и `indexOf` исполняются нативно. Версия на `charCodeAt` работает с числами и аллокаций
 * не делает — цифры в шапке `__benchmarks__/scanTokens.bench.ts`.
 *
 * Здесь `charCodeAt` уместен именно по этой причине (см. `coding.md` §3: применять,
 * когда есть необходимость, а не по умолчанию).
 *
 * ## Как работает
 *
 * Автомат запоминает границы текущего идентификатора. Когда идентификатор кончился,
 * он сравнивается — посимвольно по кодам, без создания подстроки — с именем атрибута,
 * с именами функций слияния и с суффиксами переменных. Совпадение переводит автомат
 * в ожидание значения (`=`/`:` и литерал) или в разбор вызова со счётчиком скобок.
 * Строки создаются только для самих токенов.
 *
 * ## Отличие от трёх отдельных проходов
 *
 * Имя атрибута сопоставляется как ЦЕЛЫЙ идентификатор, а не как подстрока: `myclass="x"`
 * больше не считается атрибутом `class` (регулярка искала подстроку и давала здесь ложное
 * совпадение). Для `data-class="x"` поведение то же — дефис не входит в идентификатор.
 *
 * @param tokens — аккумулятор
 * @param source — полный текст файла
 * @param attrName — имя атрибута (`'class'`, `'className'`)
 * @param suffixes — суффиксы имён переменных; пустой массив отключает механизм
 * @param mergeNames — имена функций слияния; пустой массив отключает механизм
 */
function scanTokensInto(
  tokens: string[],
  source: string,
  attrName: string,
  suffixes: string[],
  mergeNames: string[],
): void {
  const l = source.length;
  const attrLength = attrName.length;
  const suffixesLength = suffixes.length;
  const mergeNamesLength = mergeNames.length;
  let i = 0;
  let identStart = -1;
  let identLength: number;
  let code: number;
  let j: number;
  let k: number;
  let matched: number;
  let quote: number;
  let valueFrom: number;
  let depth: number;
  let name: string;
  let nameLength: number;
  let offset: number;

  while (i <= l) {
    code = i < l ? source.charCodeAt(i) : CH_SPACE;
    if (isIdentCode(code)) {
      if (identStart < 0) {
        identStart = i;
      }
      i++;
      continue;
    }
    if (identStart < 0) {
      // Литерал вне идентификатора: сквозь него надо пройти, иначе кавычка внутри
      // строки сбила бы разбор идентификаторов дальше.
      if (isQuoteCode(code)) {
        quote = code;
        for (i++; i < l; i++) {
          code = source.charCodeAt(i);
          if (code === CH_BACKSLASH) {
            i++;
            continue;
          }
          if (code === quote) {
            break;
          }
        }
      }
      i++;
      continue;
    }

    identLength = i - identStart;
    // 0 — не наш идентификатор, 1 — атрибут или переменная с суффиксом,
    // 2 — функция слияния.
    matched = 0;

    if (identLength === attrLength) {
      for (j = 0; j < attrLength
        && source.charCodeAt(identStart + j) === attrName.charCodeAt(j); j++){
        ;
      }
      if (j === attrLength) {
        matched = 1;
      }
    }
    // Имена функций — раньше суффиксов: `mnClass` оканчивается на `Class`, и проверка
    // суффикса приняла бы его за переменную, ожидая `=` вместо `(`.
    if (!matched && mergeNamesLength) {
      for (k = 0; k < mergeNamesLength; k++) {
        name = mergeNames[k];
        if (name.length !== identLength) {
          continue;
        }
        for (j = 0; j < identLength
          && source.charCodeAt(identStart + j) === name.charCodeAt(j); j++){
          ;
        }
        if (j === identLength) {
          // `obj.mne(...)` — обращение к свойству, а не наша функция.
          matched = identStart > 0 && source.charCodeAt(identStart - 1) === CH_DOT ? 0 : 2;
          break;
        }
      }
    }
    if (!matched && suffixesLength) {
      for (k = 0; k < suffixesLength; k++) {
        name = suffixes[k];
        nameLength = name.length;
        if (nameLength > identLength) {
          continue;
        }
        offset = i - nameLength;
        for (j = 0; j < nameLength
          && source.charCodeAt(offset + j) === name.charCodeAt(j); j++){
          ;
        }
        if (j === nameLength) {
          matched = 1;
          break;
        }
      }
    }
    identStart = -1;

    if (!matched) {
      continue;
    }

    while (i < l && isSpaceCode(source.charCodeAt(i))) {
      i++;
    }

    if (matched === 2) {
      if (source.charCodeAt(i) !== CH_LPAREN) {
        continue;
      }
      depth = 0;
      for (; i < l; i++) {
        code = source.charCodeAt(i);
        if (code === CH_LPAREN || code === CH_LBRACKET || code === CH_LBRACE) {
          depth++;
          continue;
        }
        if (code === CH_RPAREN || code === CH_RBRACKET || code === CH_RBRACE) {
          if (!--depth) {
            break;
          }
          continue;
        }
        if (!isQuoteCode(code)) {
          continue;
        }
        quote = code;
        valueFrom = ++i;
        for (; i < l; i++) {
          code = source.charCodeAt(i);
          if (code === CH_BACKSLASH) {
            i++;
            continue;
          }
          if (code === quote) {
            break;
          }
        }
        pushLiteralTokens(tokens, source.slice(valueFrom, i));
      }
      continue;
    }

    code = source.charCodeAt(i);
    if (code === CH_COLON) {
      i++;
      while (i < l && isSpaceCode(source.charCodeAt(i))) {
        i++;
      }
      code = source.charCodeAt(i);
      if (!isQuoteCode(code) && code !== CH_LBRACE) {
        // Аннотация типа: до `=`, обрываясь на `;` и переводе строки.
        while (i < l) {
          code = source.charCodeAt(i);
          if (code === CH_EQ || code === CH_SEMICOLON || code === CH_LF) {
            break;
          }
          i++;
        }
        if (source.charCodeAt(i) !== CH_EQ) {
          continue;
        }
        i++;
        while (i < l && isSpaceCode(source.charCodeAt(i))) {
          i++;
        }
      }
    } else if (code === CH_EQ) {
      i++;
      while (i < l && isSpaceCode(source.charCodeAt(i))) {
        i++;
      }
    } else {
      continue;
    }

    // JSX-обёртка `{'…'}` / `{"…"}` / `` {`…`} ``.
    if (source.charCodeAt(i) === CH_LBRACE) {
      i++;
      while (i < l && isSpaceCode(source.charCodeAt(i))) {
        i++;
      }
    }
    quote = source.charCodeAt(i);
    if (!isQuoteCode(quote)) {
      continue;
    }
    valueFrom = ++i;
    for (; i < l; i++) {
      code = source.charCodeAt(i);
      if (code === CH_BACKSLASH) {
        i++;
        continue;
      }
      if (code === quote) {
        break;
      }
    }
    pushLiteralTokens(tokens, source.slice(valueFrom, i));
    i++;
  }
}


const three = bench('три прохода (рабочая реализация)', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokens(sources[i], {
      attr: 'class', 
    });
  }
});
const one = bench('один проход, charCodeAt        ', () => {
  for (let i = 0; i < FILES; i++) {
    const out: string[] = [];
    scanTokensInto(
      out, sources[i], 'class', ['Class'], ['mne', 'mnClass'],
    );
  }
});
console.log(`один проход против трёх: ${((1 - one / three) * 100).toFixed(1)}%`);

const a = scanTokens(sources[0], {
  attr: 'class', 
}).slice().sort().join(' ');
const outB: string[] = [];
scanTokensInto(
  outB, sources[0], 'class', ['Class'], ['mne', 'mnClass'],
);
console.log(a === outB.slice().sort().join(' ')
  ? 'результаты совпадают'
  : 'РАСХОЖДЕНИЕ');
