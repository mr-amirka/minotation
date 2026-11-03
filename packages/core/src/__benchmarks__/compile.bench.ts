/**
 * Бенчмарк компиляции: токены → CSS на свежем экземпляре со стандартными пресетами.
 *
 * Почему важно: это вся работа сборки после сканирования — разбор каждого токена, его
 * контекста (состояния, медиа, предки, группы), значения и вывод CSS. Проверки записи
 * токена идут здесь же, поэтому их цена видна только в этом замере.
 *
 * Набор: детерминированный, из префиксов × значений × контекстов — так покрыты все пути
 * разбора, которые встречаются в проектах, а размер (несколько тысяч токенов) — как у
 * среднего приложения. Каждый прогон — новый экземпляр: кеш разбора не переносится.
 *
 * Фазы:
 * - `presets` — `setPresets` (регистрация хендлеров и `mn.assign` пресетов);
 * - `tokens` — `getCompiler('class')` на каждый токен и `compile()`.
 *
 * Запуск: npx tsx src/__benchmarks__/compile.bench.ts
 */
import {
  minotationProvider,
} from '../index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';

const ROUNDS = 30;
const WARMUP = 5;

/** Токены без контекста: длины, проценты, цвета, перечисления, градиенты — все дают CSS без предупреждений. */
const BASES: string[] = [];
const LENGTH_PREFIXES = [
  'p',
  'px',
  'py',
  'pt',
  'm',
  'mx',
  'mt',
  'mb',
  'w',
  'h',
  'wmax',
  'hmin',
  'gap',
  'r',
  'f',
  'st',
  'sl',
];
const LENGTHS = [
  '0',
  '4',
  '10',
  '16',
  '24',
  '50%',
  '100%',
  '1.5em',
];
const COLOR_PREFIXES = [
  'c',
  'bg',
  'bc',
];
const COLORS = [
  'F00',
  '0',
  'F.5',
  '369',
  '$ink',
];
const WORDS = [
  'dF',
  'dB',
  'dN',
  'aiC',
  'jcSB',
  'fxdC',
  'abs',
  'rlv',
  'fw6',
  'crP',
  'ovH',
  'taC',
  'b1',
  'bgF00-00F',
  'bg0-F.5',
];

let i = 0;
for (const prefix of LENGTH_PREFIXES) {
  for (const length of LENGTHS) {
    BASES.push(prefix + length);
  }
}
for (const prefix of COLOR_PREFIXES) {
  for (const color of COLORS) {
    BASES.push(prefix + color);
  }
}
BASES.push(...WORDS);

/** Контексты: без контекста, состояния, медиа, предки, ребёнок, группы вариантов. */
const CONTEXTS = [
  '',
  '',
  '',
  ':h',
  ':f',
  '@m',
  '@m2',
  '@dark',
  '<.dark',
  '.active',
  ':h<.card',
  '>1',
  '@(m|m2)',
  ':(h|f)',
];

const TOKENS: string[] = [];
for (const base of BASES) {
  for (const context of CONTEXTS) {
    TOKENS.push(base + context);
  }
}

/** Предупреждения не печатаются: замеряется разбор, не вывод в консоль. */
function noop(): void {
  // ничего
}

function round(): [presets: number, tokens: number, css: number] {
  const mn = minotationProvider({
    warningMode: 'silent',
    childSelectorMode: 'silent',
    onWarning: noop,
    onError: noop,
  });
  const start = performance.now();
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  const presetsEnd = performance.now();
  const compile = mn.getCompiler('class');
  const l = TOKENS.length;
  let k = 0;
  for (; k < l; k++) {
    compile(TOKENS[k]);
  }
  mn.compile();
  const end = performance.now();
  let css = 0;
  for (const style of mn.styles$.getState()) {
    css += style.content.length;
  }
  return [
    presetsEnd - start,
    end - presetsEnd,
    css,
  ];
}

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1];
}

for (i = 0; i < WARMUP; i++) {
  round();
}
const presets: number[] = [];
const tokens: number[] = [];
let css = 0;
let result: [number, number, number];
for (i = 0; i < ROUNDS; i++) {
  result = round();
  presets.push(result[0]);
  tokens.push(result[1]);
  css = result[2];
}
console.log('tokens: ' + TOKENS.length + ', css: ' + css + ' chars');
console.log('presets: median ' + median(presets).toFixed(2) + ' ms, min ' + Math.min(...presets).toFixed(2) + ' ms');
console.log('tokens:  median ' + median(tokens).toFixed(2) + ' ms, min ' + Math.min(...tokens).toFixed(2) + ' ms');
