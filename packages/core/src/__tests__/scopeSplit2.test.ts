/**
 * `scopeSplit2` — порт v1-утилиты, на форме результата которой построен
 * `getSynonyms` (см. module doc: подмена на `fundamentool.scopeSplit` в своё
 * время дала баг `:hover` → `:(h)`). Разбор скобочных выражений тестируется
 * здесь напрямую, а не только через компиляцию токенов.
 */
import {
  scopeSplit2, 
} from '../selectorsCompileProvider/scopeSplit2';

describe('scopeSplit2', () => {
  test('строка без скобок — один текстовый узел', () => {
    expect(scopeSplit2('.checked')).toEqual([['.checked']]);
  });

  test('вложенные скобки разбираются в дерево пар [текст, дети]', () => {
    expect(scopeSplit2('not(.disabled(.as).lak).checked')).toEqual([['not', [['.disabled', [['.as']]], ['.lak']]], ['.checked']]);
  });

  test('несколько скобок подряд на одном уровне', () => {
    expect(scopeSplit2('a(b)c(d)')).toEqual([['a', [['b']]], ['c', [['d']]]]);
  });

  test('незакрытая скобка закрывается в конце разбора', () => {
    expect(scopeSplit2('a(b')).toEqual([['a', [['b']]]]);
  });

  test('лишняя закрывающая скобка — синтаксическая ошибка', () => {
    expect(() => scopeSplit2('a)b')).toThrow('Scope syntax error: "a)b"');
  });

  test('пустая строка — пустое дерево', () => {
    expect(scopeSplit2('')).toEqual([]);
  });

  test('кастомные открывающая/закрывающая последовательности', () => {
    expect(scopeSplit2(
      'a[[b]]c', '[[', ']]',
    )).toEqual([['a', [['b']]], ['c']]);
  });

  test('экранирующая последовательность: следующий символ не считается скобкой', () => {
    expect(scopeSplit2(
      'a\\(b', '(', ')', '\\',
    )).toEqual([['a\\(b']]);
  });
});
