/**
 * Тесты extractTokens — извлечение MN-токенов из значений атрибута в тексте файла.
 */

import {
  extractTokens,
} from '../extractTokens';

describe('extractTokens', () => {
  test('литеральная строка в двойных кавычках', () => {
    expect(extractTokens('<div class="p10 w50">', 'class')).toEqual(['p10', 'w50']);
  });

  test('литеральная строка в одинарных кавычках', () => {
    expect(extractTokens("<div class='p10 w50'>", 'class')).toEqual(['p10', 'w50']);
  });

  test('JSX-выражение со строкой в одинарных кавычках', () => {
    expect(extractTokens("<div className={'m5'}>", 'className')).toEqual(['m5']);
  });

  test('JSX-выражение со строкой в двойных кавычках', () => {
    expect(extractTokens('<div className={"m5 p10"}>', 'className')).toEqual(['m5', 'p10']);
  });

  test('template literal без интерполяции', () => {
    expect(extractTokens('<div className={`fx1 h100`}>', 'className')).toEqual(['fx1', 'h100']);
  });

  test('template literal с интерполяцией — динамическая часть отбрасывается', () => {
    expect(extractTokens('<div className={`fx1 ${cond ? "a" : "b"} h100`}>', 'className'))
      .toEqual(['fx1', 'h100']);
  });

  test('несколько атрибутов в одном файле', () => {
    const source = '<div class="p10"></div>\n<span class="w50 m5"></span>';
    expect(extractTokens(source, 'class')).toEqual([
      'p10',
      'w50',
      'm5',
    ]);
  });

  test('кастомное имя атрибута (className) не матчит class и наоборот', () => {
    const source = '<div class="p10" data-x="ignored">';
    expect(extractTokens(source, 'className')).toEqual([]);
  });

  test('нет совпадений — пустой массив', () => {
    expect(extractTokens('<div id="app"></div>', 'class')).toEqual([]);
  });

  test('лишние пробелы внутри значения схлопываются, пустые токены отфильтрованы', () => {
    expect(extractTokens('<div class="  p10   w50  ">', 'class')).toEqual(['p10', 'w50']);
  });

  test('пустая строка-значение — пустой массив', () => {
    expect(extractTokens('<div class="">', 'class')).toEqual([]);
  });
});
