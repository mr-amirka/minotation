/**
 * Третий вариант сканера: ведущий поиск — нативный, разбор — локальный.
 *
 * Идея: не обходить каждый символ в JS, а найти регуляркой все кавычки (нативный проход),
 * и для каждой посмотреть НАЗАД — что перед ней: `attr=`, `…Class =` или аргумент вызова.
 * Кавычек в файле на порядки меньше, чем символов.
 */
import {
  scanTokens, 
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

const QUOTES = /['"`]/g;
const SPACE = 32, TAB = 9, LF = 10, CR = 13, EQ = 61, COLON = 58, LBRACE = 123;
const COMMA = 44, LPAREN = 40;

function isSpace(c: number): boolean {
  return c === SPACE || c === TAB || c === LF || c === CR;
}
function isIdent(c: number): boolean {
  return c === 95 || c === 36 || (c >= 97 && c <= 122) || (c >= 65 && c <= 90)
    || (c >= 48 && c <= 57);
}

/** Разбор «от кавычки назад». */
function scanByQuotes(
  source: string, attr: string, suffix: string, fnNames: string[],
): string[] {
  const out: string[] = [];
  QUOTES.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = QUOTES.exec(source))) {
    const quote = source.charCodeAt(m.index);
    // Тело литерала.
    let end = m.index + 1;
    for (; end < source.length; end++) {
      const c = source.charCodeAt(end);
      if (c === 92) {
        end++;
        continue;
      }
      if (c === quote) {
        break;
      }
    }
    // Что перед кавычкой.
    let p = m.index - 1;
    while (p >= 0 && isSpace(source.charCodeAt(p))) {
      p--;
    }
    if (source.charCodeAt(p) === LBRACE) {
      p--;
      while (p >= 0 && isSpace(source.charCodeAt(p))) {
        p--;
      }
    }
    const before = source.charCodeAt(p);
    let take = false;
    if (before === EQ || before === COLON) {
      p--;
      while (p >= 0 && isSpace(source.charCodeAt(p))) {
        p--;
      }
      const identEnd = p + 1;
      while (p >= 0 && isIdent(source.charCodeAt(p))) {
        p--;
      }
      const ident = source.slice(p + 1, identEnd);
      take = ident === attr || (ident.length > suffix.length && ident.endsWith(suffix));
    } else if (before === COMMA || before === LPAREN) {
      // Аргумент вызова: ищем имя функции перед открывающей скобкой.
      let q = p;
      let depth = 0;
      for (; q >= 0; q--) {
        const c = source.charCodeAt(q);
        if (c === 41) {
          depth++;
        } else if (c === LPAREN) {
          if (!depth) {
            break;
          }
          depth--;
        }
      }
      q--;
      while (q >= 0 && isSpace(source.charCodeAt(q))) {
        q--;
      }
      const identEnd = q + 1;
      while (q >= 0 && isIdent(source.charCodeAt(q))) {
        q--;
      }
      take = fnNames.indexOf(source.slice(q + 1, identEnd)) >= 0;
    }
    if (take) {
      for (const t of source.slice(m.index + 1, end).split(/\s+/)) {
        if (t && t.indexOf('${') < 0) {
          out.push(t);
        }
      }
    }
    QUOTES.lastIndex = end + 1;
  }
  return out;
}

const three = bench('три прохода (текущая реализация)', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokens(sources[i], {
      attr: 'class', 
    });
  }
});
const quotes = bench('от кавычки назад                ', () => {
  for (let i = 0; i < FILES; i++) {
    scanByQuotes(
      sources[i], 'class', 'Class', ['mne', 'mnClass'],
    );
  }
});
console.log(`разница: ${((1 - quotes / three) * 100).toFixed(1)}%`);

const a = scanTokens(sources[0], {
  attr: 'class', 
}).slice().sort().join(' ');
const b = scanByQuotes(
  sources[0], 'class', 'Class', ['mne', 'mnClass'],
).slice().sort().join(' ');
console.log(a === b ? 'результаты совпадают' : `РАСХОЖДЕНИЕ:\n  три: ${a}\n  кав: ${b}`);
