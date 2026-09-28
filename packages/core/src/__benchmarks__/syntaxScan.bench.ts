/**
 * Цена синтаксического сканера против текстового.
 *
 * Вопрос 2 из README трека `scanner-robustness`: «разбор AST заведомо дороже;
 * насколько — мерить на том же образце, иначе цифры несравнимы». Поэтому
 * образец, число файлов и число прогонов здесь те же, что в
 * `scanTokens.bench.ts`: 300 файлов × 20 прогонов.
 *
 * Запуск: npx tsx src/__benchmarks__/syntaxScan.bench.ts
 *
 * ## Результаты 2026-09-28 (Darwin, node 24)
 *
 * Заполняются запуском — см. таблицу в PROGRESS трека.
 */
import {
  scanTokens,
} from '../extractTokens';
import {
  scanTokensSfc, scanTokensSyntax,
} from '../syntaxScan';

const FILES = 300;
const ROUNDS = 20;

/** Тот же фрагмент, что в `scanTokens.bench.ts` — иначе цифры несравнимы. */
const SAMPLE = `
import { mne } from 'minotation/mne';
// Комментарий с образцом разметки: class="p10 w50" — вырезается сканером,
// см. stripComments. Здесь он нужен, чтобы замер шёл на реальном входе.
/* блочный комментарий с примером <div class="p10 w50"> */
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

const options = {
  attr: 'class',
};

const text = bench('scanTokens — текстовый          ', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokens(sources[i], options);
  }
});

const syntax = bench('scanTokensSyntax — разбор AST   ', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokensSyntax(sources[i], {
      attr: 'class',
      fileName: 'file' + i + '.tsx',
    });
  }
});

/** Тот же компонент в форме однофайлового: шаблон плюс скрипт. */
const SFC_SAMPLE = '<template>\n'
  + '  <div class="dF fxdC gap8 p16 b1 bsS bc--line r12 bg--panel">\n'
  + '    <span class="taL py12 px14 f12 ttU fw6" />\n'
  + '  </div>\n'
  + '</template>\n'
  + '<script setup lang="ts">\n'
  + SAMPLE.replace(/<[^>]*>/g, '')
  + '</script>\n';

const sfcSources: string[] = [];
for (let i = 0; i < FILES; i++) {
  sfcSources.push(SFC_SAMPLE.replace('Row', 'Row' + i));
}

const sfcText = bench('SFC — текстовый                 ', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokens(sfcSources[i], options);
  }
});

const sfc = bench('SFC — скрипт разбором           ', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokensSfc(sfcSources[i], {
      attr: 'class',
      fileName: 'file' + i + '.vue',
    });
  }
});

console.log(`SFC: во сколько раз дороже: ${(sfc / sfcText).toFixed(1)}×`);
console.log(`во сколько раз дороже: ${(syntax / text).toFixed(1)}×`);
console.log(`на файл: текстовый ${(text / ROUNDS / FILES * 1000).toFixed(1)} мкс, `
  + `синтаксический ${(syntax / ROUNDS / FILES * 1000).toFixed(1)} мкс\n`);

/**
 * Сторож паритета: на корректном файле наборы обязаны совпадать.
 *
 * В образце есть комментарии с разметкой — текстовый сканер их вырезает сам,
 * поэтому расхождения быть не должно и здесь.
 */
function setOf(tokens: string[]): string[] {
  return Array.from(new Set(tokens)).sort();
}

const a = setOf(scanTokens(sources[0], options));
const b = setOf(scanTokensSyntax(sources[0], options));
console.log(a.join(' ') === b.join(' ')
  ? 'корректность: наборы совпадают (' + a.length + ' токенов)'
  : 'КОРРЕКТНОСТЬ НАРУШЕНА:\n  текст: ' + a.join(' ') + '\n  разбор: ' + b.join(' '));
