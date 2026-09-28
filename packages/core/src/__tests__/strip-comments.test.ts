/**
 * Сканер не извлекает токены из комментариев.
 *
 * Живой случай: в `RatingTableIsland.tsx` проекта `affiliate` стоял
 * комментарий, ОБЪЯСНЯВШИЙ работу сканера, — из образца `class="..."` в нём
 * извлёкся токен `...`, ядро его забраковало, а `strict: true` уронил сборку
 * сайта. Обходом был переписанный комментарий (трек `scanner-robustness`,
 * задача 2).
 *
 * Тихий случай хуже громкого: пример разметки в комментарии или JSDoc
 * добавляет свои токены в CSS — правила есть, применить их не к чему.
 */
import {
  scanTokens,
  stripComments,
} from '../extractTokens';

describe('комментарии не дают токенов', () => {
  test.each([
    ['// пример: class="p10 w50"\n<div class="m5">', 'строчный'],
    ['/* class="p10 w50" */<div class="m5">', 'блочный'],
    ['{/* class="p10 w50" */}<div class="m5"/>', 'JSX'],
    ['<!-- class="p10 w50" --><div class="m5">', 'HTML и Astro'],
    ['/* многострочный\n   class="p10 w50"\n*/<div class="m5">', 'многострочный'],
    ['/** JSDoc с примером class="p10 w50" */\n<div class="m5">', 'JSDoc'],
  ])('%s — %s', (source) => {
    expect(scanTokens(source, {})).toEqual(['m5']);
  });

  test.each([["const u = 'https://example.com/x'; <div class=\"m5\">", 'URL внутри строки'], ['const s = "// class=\\"p10\\""; <div class="m5">', 'комментарий внутри строки']])('%s — %s не считается комментарием', (source) => {
    // Иначе `//` в URL съел бы остаток строки вместе с разметкой.
    expect(scanTokens(source, {})).toEqual(['m5']);
  });

  test('шаблонная строка — не комментарий, и токены из неё нужны', () => {
    // `<div class="p10">` внутри шаблона это настоящая разметка, а не пример
    // в комментарии: вырезать её нечего.
    const source = 'const s = `// class="p10"`; <div class="m5">';
    expect(stripComments(source)).toBe(source);
    expect(scanTokens(source, {})).toEqual(['p10', 'm5']);
  });

  test('токены из настоящей разметки не задеты', () => {
    const source = `
      // комментарий
      const aClass = 'p10 w50';
      <div class="m5 dF">{mne(aClass, 'c--ink')}</div>
    `;
    const tokens = scanTokens(source, {});
    expect(tokens).toContain('p10');
    expect(tokens).toContain('m5');
    expect(tokens).toContain('dF');
    expect(tokens).toContain('c--ink');
  });

  test('переводы строк сохраняются — соседние строки не склеиваются', () => {
    // Иначе `class=` со следующей строки попал бы в хвост комментария.
    const out = stripComments('// a\n<div class="m5">');
    expect(out).toContain('\n');
    expect(out.indexOf('class=')).toBeGreaterThan(out.indexOf('\n'));
  });

  test('файл без комментариев возвращается как есть', () => {
    // Быстрый путь: ни одной склейки, сам объект строки тот же.
    const source = '<div class="m5">';
    expect(stripComments(source)).toBe(source);
  });

  test('вырезание отключается опцией', () => {
    const source = '// class="p10"\n<div class="m5">';
    expect(scanTokens(source, {
      comments: false,
    })).toEqual(['p10', 'm5']);
  });

  test('незакрытый комментарий съедает остаток файла', () => {
    // Так же ведёт себя и компилятор языка: незакрытый `/*` — ошибка в самом
    // файле, и притворяться, что дальше код, смысла нет.
    expect(scanTokens('/* class="p10"\n<div class="m5">', {})).toEqual([]);
  });
});
