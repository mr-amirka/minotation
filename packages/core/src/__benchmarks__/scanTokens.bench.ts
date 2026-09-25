/**
 * Бенчмарк сканера: кеш регулярок по имени атрибута.
 *
 * Мотив: `extractTokens` зовётся на каждый файл сборки, а имён атрибутов в проекте
 * одно-два. До 2026-09-25 регулярка компилировалась заново на каждый вызов.
 *
 * Файлов: 300 (типичный размер проекта среднего размера)
 * Повторов: 20 прогонов по всем файлам
 * Образец: фрагмент реального компонента из проекта affiliate
 *
 * Запуск: npx tsx src/__benchmarks__/scanTokens.bench.ts
 *
 * ## Результаты 2026-09-25 (Darwin, node 22)
 *
 * | Механизм | До | После | Что изменено |
 * |---|---|---|---|
 * | `extractTokens` | 16,2 мс | 13,5 мс | кеш регулярки по имени атрибута |
 * | `extractClassVarTokens` | 104,6 мс | 20,3 мс | убран `[\w$]*` перед суффиксом |
 * | `extractMergeCallTokens` (2 имени) | 14,1 мс | 8,8 мс | один регексп-проход вместо прохода на имя; `slice` вместо посимвольной склейки |
 * | `scanTokens` целиком | 136,9 мс | 38,0 мс | плюс единый аккумулятор вместо трёх массивов и `concat`, разбиение литерала без `split` |
 *
 * Однопроходный автомат и вариант «от кавычки назад» проверены и отклонены — оба медленнее;
 * замеры и объяснение в `onepass.bench.ts` и `quote-driven.bench.ts`.
 *
 * Самая дорогая находка — `[\w$]*` в начале регулярки переменных: имя переменной
 * захватывалось, но нигде не использовалось, а движок перебирал его длины на каждой
 * позиции файла. Пятикратное замедление за счёт кода, который ничего не делал.
 */
import {
  extractTokens, scanTokens,
  extractClassVarTokens, extractMergeCallTokens,
} from '../extractTokens';

const FILES = 300;
const ROUNDS = 20;

/** Фрагмент реального компонента: атрибуты, переменная с суффиксом, вызов mne. */
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
  // Разные имена, чтобы строки не были идентичными ссылками и не льстили кешу движка.
  sources.push(SAMPLE.replace('Row', 'Row' + i));
}

function bench(name: string, fn: () => void): number {
  // Прогрев: JIT должен выйти на стабильный режим до замера.
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

/** Как было: своя регулярка на каждый файл. */
function buildAttrRegexpUncached(attrName: string): RegExp {
  return new RegExp(attrName + '\\s*[:=]\\s*(?:"([^"]*)"'
    + '|\'([^\']*)\''
    + '|\\{\\s*\'([^\']*)\'\\s*\\}'
    + '|\\{\\s*"([^"]*)"\\s*\\}'
    + '|\\{\\s*`([^`]*)`\\s*\\})', 'g');
}

function extractUncached(source: string, attrName: string): string[] {
  const regexp = buildAttrRegexpUncached(attrName);
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regexp.exec(source))) {
    const raw = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5]) as string;
    for (const part of raw.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/)) {
      if (part) {
        tokens.push(part);
      }
    }
  }
  return tokens;
}

const before = bench('extractTokens без кеша регулярки', () => {
  for (let i = 0; i < FILES; i++) {
    extractUncached(sources[i], 'class');
  }
});

const after = bench('extractTokens с кешем регулярки ', () => {
  for (let i = 0; i < FILES; i++) {
    extractTokens(sources[i], 'class');
  }
});

console.log(`выигрыш: ${((1 - after / before) * 100).toFixed(1)}%\n`);

// Полный скан — во что обходятся все три механизма вместе.
bench('scanTokens — три прохода          ', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokens(sources[i], {
      attr: 'class', 
    });
  }
});

// Раздельно по механизмам: где именно уходит время.
bench('  только extractClassVarTokens        ', () => {
  for (let i = 0; i < FILES; i++) {
    extractClassVarTokens(sources[i], ['Class']);
  }
});
bench('  только extractMergeCallTokens       ', () => {
  for (let i = 0; i < FILES; i++) {
    extractMergeCallTokens(sources[i], ['mne', 'mnClass']);
  }
});
bench('  только extractMergeCallTokens (1 имя)', () => {
  for (let i = 0; i < FILES; i++) {
    extractMergeCallTokens(sources[i], ['mne']);
  }
});

// Сторож корректности: оптимизация не должна менять результат.
const a = extractUncached(sources[0], 'class');
const b = extractTokens(sources[0], 'class');
console.log(a.join(' ') === b.join(' ')
  ? 'корректность: результаты совпадают'
  : 'КОРРЕКТНОСТЬ НАРУШЕНА: ' + a.length + ' vs ' + b.length);
