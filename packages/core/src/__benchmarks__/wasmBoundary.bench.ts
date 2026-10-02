/**
 * Цена границы JS↔WASM и доля разбора в общем времени.
 *
 * Трек `tooling-gaps`, задача 3: эксперимент с переносом горячих кусков в
 * WebAssembly. Эксперимент проведён 2026-10-02, результат отрицательный — ни
 * один из трёх кандидатов не дал требуемых 2× (разбор в отчёте
 * `AGENT_DRAFT/RESEARCH/08_wasm-experiment-2026-10-02.md`).
 *
 * Этот бенчмарк оставлен в репозитории, потому что он показывает ПРИЧИНУ
 * отказа и не требует WASM-тулчейна: цена переноски данных через границу и
 * доля, которую разбор занимает в целом. Если движок, профиль нагрузки или
 * критерий изменятся, вывод перепроверяется одной командой, а не воссозданием
 * прототипа.
 *
 * Запуск: npx tsx src/__benchmarks__/wasmBoundary.bench.ts
 *
 * ## Результаты 2026-10-02 (Darwin, node 24)
 *
 * | Что | Время |
 * |---|---|
 * | `scanTokens` — все три механизма | 77,2 мс |
 * | `extractTokens` — только атрибут | 17,3 мс |
 * | граница: копирование в память WASM | 13,4 мс |
 * | граница: нарезка подстрок по позициям | 4,0 мс |
 * | граница: чтение токенов через `TextDecoder` | 63,6 мс |
 *
 * Отсюда и вывод: при возврате строк граница равна всему времени сканера
 * (потолок 1,0×), при возврате позиций — 23 % (потолок 4,4× при нулевом
 * разборе). Измеренный на AssemblyScript разбор был быстрее JS лишь в 1,4×,
 * что даёт итоговые 1,06× — ниже порога.
 */
import {
  extractTokens, scanTokens,
} from '../extractTokens';

const FILES = 300;
const ROUNDS = 20;

/** Тот же фрагмент, что в `scanTokens.bench.ts` — иначе цифры несравнимы. */
const SAMPLE = `
import { mne } from 'minotation/mne';
// Комментарий с образцом разметки: class="p10 w50" — вырезается сканером,
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
const kb = sources.reduce((sum, s) => sum + s.length, 0) / 1024;

function bench(name: string, fn: () => void): number {
  for (let i = 0; i < 3; i++) {
    fn();
  }
  const start = performance.now();
  for (let i = 0; i < ROUNDS; i++) {
    fn();
  }
  const elapsed = performance.now() - start;
  console.log(name + ': ' + elapsed.toFixed(2) + 'ms');
  return elapsed;
}

console.log('образец: ' + kb.toFixed(0) + ' КБ × ' + ROUNDS + ' прогонов\n');

const options = {
  attr: 'class',
};

const full = bench('scanTokens — все три механизма      ', () => {
  for (let i = 0; i < FILES; i++) {
    scanTokens(sources[i], options);
  }
});

bench('extractTokens — только атрибут      ', () => {
  for (let i = 0; i < FILES; i++) {
    extractTokens(sources[i], 'class');
  }
});

// Линейная память модуля: 16 МБ хватает на любой разумный файл.
const memory = new WebAssembly.Memory({
  initial: 256,
});
const view = new Uint8Array(memory.buffer);
const encoder = new TextEncoder();

const copyIn = bench('граница: копирование в память WASM  ', () => {
  for (let i = 0; i < FILES; i++) {
    encoder.encodeInto(sources[i], view);
  }
});

// Обратный путь, вариант 1: токены приходят строками из линейной памяти.
const decoder = new TextDecoder();
const found = extractTokens(sources[0], 'class');
const encoded = found.map((token) => encoder.encode(token));
let offset = 0;
for (let i = 0; i < encoded.length; i++) {
  view.set(encoded[i], offset);
  offset += encoded[i].length;
}

const decodeOut = bench('граница: чтение через TextDecoder   ', () => {
  for (let i = 0; i < FILES; i++) {
    let at = 0;
    for (let j = 0; j < encoded.length; j++) {
      decoder.decode(view.subarray(at, at + encoded[j].length));
      at += encoded[j].length;
    }
  }
});

// Обратный путь, вариант 2: WASM отдаёт позиции, подстроки режет JS.
// Дешевле втрое, но требует, чтобы WASM вёл счётчик единиц UTF-16: байтовые
// смещения UTF-8 с индексами JS-строки не совпадают, и первая реализация
// из-за этого выдавала мусор вместо токенов (см. отчёт).
const positions = new Int32Array(
  memory.buffer, 1 << 20, 4096,
);
for (let i = 0; i < found.length; i++) {
  positions[i * 2] = i * 10;
  positions[i * 2 + 1] = found[i].length;
}

const sliceOut = bench('граница: нарезка подстрок (slice)   ', () => {
  for (let i = 0; i < FILES; i++) {
    const source = sources[i];
    const out: string[] = new Array(found.length);
    for (let j = 0; j < found.length; j++) {
      const at = positions[j * 2];
      out[j] = source.slice(at, at + positions[j * 2 + 1]);
    }
  }
});

console.log('');
console.log('граница со строками:  ' + (copyIn + decodeOut).toFixed(1) + ' мс — '
  + ((copyIn + decodeOut) / full * 100).toFixed(0) + ' % времени сканера, потолок '
  + (full / (copyIn + decodeOut)).toFixed(1) + '×');
console.log('граница с позициями:  ' + (copyIn + sliceOut).toFixed(1) + ' мс — '
  + ((copyIn + sliceOut) / full * 100).toFixed(0) + ' % времени сканера, потолок '
  + (full / (copyIn + sliceOut)).toFixed(1) + '×');
console.log('');
console.log('потолок — это выигрыш при МГНОВЕННОМ разборе внутри WASM.');
console.log('измеренный на AssemblyScript разбор был быстрее JS в 1,4× (он');
console.log('соревнуется с нативными регулярками, а не с JS-циклом), что дало');
console.log('итоговые 1,06× — ниже порога 2× из README трека.');
