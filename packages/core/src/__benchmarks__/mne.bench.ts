/**
 * Бенчмарк `mne`: слияние наборов токенов.
 *
 * Почему важно: `mne` зовётся на КАЖДЫЙ рендер каждого компонента, в отличие от сканера,
 * который работает только на сборке. Здесь дорого всё, что аллоцирует.
 *
 * Итераций: 200 000 вызовов на каждый сценарий
 * Образцы: из реальных компонентов проекта affiliate
 *
 * ## Результаты 2026-09-25 (Darwin, node 24)
 *
 * | Сценарий | До | После |
 * |---|---|---|
 * | `mne(base, override)` | 325,0 мс | 207,5 мс |
 * | `mne(base, '')` | 270,6 мс | 184,2 мс |
 * | `mne(base)` | 283,2 мс | 174,8 мс |
 * | `mne(длинная база, override)` | 402,6 мс | 242,7 мс |
 * | `mnClass(base)(override)` | 134,5 мс | 104,2 мс |
 *
 * Что изменено: (1) обход строки с конца вместо `split` — массив подстрок был аллокацией
 * на каждый вызов; (2) кеш `токен → ключ` в `mnKey`, который зовётся на каждый токен
 * каждой строки. Первое дало около 5 %, второе — остальное: разбор одного и того же
 * набора классов повторяется на каждом рендере.
 *
 * Запуск: npx tsx src/__benchmarks__/mne.bench.ts
 */
import {
  mne, mnClass, 
} from '../mne';

const ITERATIONS = 200_000;

/** Типичная база компонента и типичное переопределение. */
const BASE = 'py7 px12 r b1 bsS bc--line bg--panel c--ink f14 fw5 cr';
const OVERRIDE = 'bg--ink c--bg';
const LONG_BASE = 'taL py12 px14 b bb1 bsS bc--line f12 lts0.06em ttU fw6 c--ink-3 bg--bg';

function bench(name: string, fn: () => void): void {
  for (let i = 0; i < 1000; i++) {
    fn();
  }
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    fn();
  }
  console.log(`${name}: ${(performance.now() - start).toFixed(2)}ms`);
}

bench('mne(base, override)          ', () => mne(BASE, OVERRIDE));
bench('mne(base, пустой)            ', () => mne(BASE, ''));
bench('mne(base) без переопределений', () => mne(BASE));
bench('mne(длинная база, override)  ', () => mne(LONG_BASE, OVERRIDE));
bench('mne(три аргумента)           ', () => mne(
  BASE, OVERRIDE, 'p20',
));

const fixed = mnClass(BASE);
bench('mnClass(base)(override)      ', () => fixed(OVERRIDE));

// Сторож корректности: сравнение с эталонным результатом.
const expected = 'py7 px12 r b1 bsS bc--line f14 fw5 cr bg--ink c--bg';
const actual = mne(BASE, OVERRIDE);
console.log(actual === expected
  ? '\nкорректность: результат совпадает с эталоном'
  : `\nКОРРЕКТНОСТЬ НАРУШЕНА:\n  ожидалось: ${expected}\n  получено:  ${actual}`);
