/**
 * Поиск вызовов `extractMergeCallTokens` — `indexOf` имени, а не регулярка. Эталон — прежняя регулярка: на тех же
 * исходниках обе дают те же токены в том же порядке. Исходники собираются из кусков, где ошибиться легче всего:
 * границы имени (`myMne`, `obj.mne`, `mne2`), шаблон без начала (`Class(`), вложенные вызовы, пробелы до скобки,
 * строки и шаблоны в аргументах.
 */
import {
  extractMergeCallTokens,
  pushLiteralTokens,
} from '../extractTokens';

/** Прежний поиск: одна регулярка на все имена; разбор аргументов — тот же, что у сканера. */
function referenceTokens(source: string, names: string[]): string[] {
  const out: string[] = [];
  if (!names.length) {
    return out;
  }
  const re = new RegExp('(?<![\\w$.])(?:' + names.map((n) => (n[0] === '*'
    ? '[\\w$]+' + n.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('|') + ')(?![\\w$])\\s*\\(', 'g');
  const l = source.length;
  let i = 0;
  while (re.exec(source) !== null) {
    i = re.lastIndex - 1;
    let depth = 0;
    for (; i < l; i++) {
      const ch = source[i];
      if (ch === '(' || ch === '[' || ch === '{') {
        depth++;
        continue;
      }
      if (ch === ')' || ch === ']' || ch === '}') {
        if (!--depth) {
          break;
        }
        continue;
      }
      if (ch !== '\'' && ch !== '"') {
        continue;
      }
      const from = ++i;
      for (; i < l; i++) {
        if (source[i] === '\\') {
          i++;
          continue;
        }
        if (source[i] === ch) {
          break;
        }
      }
      pushLiteralTokens(out, source.slice(from, i));
    }
    re.lastIndex = i;
  }
  return out;
}

/** Куски исходника: имена у границ, вызовы, аргументы. */
const PIECES = [
  'mne(',
  'mne (',
  'myMne(',
  'obj.mne(',
  'mne2(',
  'thClass(',
  'Class(',
  'a.bClass(',
  'mneClass(',
  'xClassy(',
  '$Class(',
  '_mne(',
  ')',
  ', ',
  '\'p10 w5\'',
  '"cF"',
  '\'a\\\'b\'',
  ' ',
  '\n',
  'cond ? ',
  ' : ',
  '[',
  ']',
  '{',
  '}',
  'x',
  '.',
  'mne',
  'Class',
];

/** Повторяемый генератор: один и тот же набор исходников при каждом запуске. */
function sources(count: number, seed: number): string[] {
  let state = seed;
  const next = () => (state = (state * 1103515245 + 12345) % 2147483648) / 2147483648;
  const out: string[] = [];
  let i = 0;
  let j: number;
  let text: string;
  for (; i < count; i++) {
    text = '';
    for (j = Math.floor(next() * 24); j--;) {
      text += PIECES[Math.floor(next() * PIECES.length)];
    }
    out.push(text);
  }
  return out;
}

describe('extractMergeCallTokens — the same calls as the regular expression', () => {
  test.each([
    [
      [
        'mne',
        '*Class',
      ],
    ],
    [['mne']],
    [['*Class']],
    [
      [
        '*Class',
        'mne',
      ],
    ],
    [
      [
        'mneClass',
        'mne',
      ],
    ],
  ])('names %j, 4000 sources', (names) => {
    const misses: string[] = [];
    for (const source of sources(4000, names.length * 7 + names[0].length)) {
      const got = extractMergeCallTokens(source, names);
      const want = referenceTokens(source, names);
      if (got.join('\u0001') !== want.join('\u0001')) {
        misses.push(source);
      }
    }
    expect(misses.slice(0, 5)).toEqual([]);
  });
});
