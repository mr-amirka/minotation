/**
 * Класс области в разметке (D-075, D-076): разбором — JS/TS/JSX, текстом — остальное.
 */
import {
  addScopeClassText,
  createScopeClassWriter,
} from '../index';

const ATTR = [
  'class',
  'className',
];
const write = createScopeClassWriter({
  attr: ATTR,
});

describe('JS/TS/JSX — по синтаксическому дереву', () => {
  test.each([
    [
      'строка',
      '<b className="p-4" />',
      '<b className="_l p-4" />',
    ],
    [
      'строка в фигурных',
      '<b className={\'p-4\'} />',
      '<b className={\'_l p-4\'} />',
    ],
    [
      'шаблон',
      '<b className={`p-4 ${x}`} />',
      '<b className={`_l p-4 ${x}`} />',
    ],
    [
      'шаблон без подстановок',
      '<b className={`p-4`} />',
      '<b className={`_l p-4`} />',
    ],
    [
      'выражение',
      '<b className={on ? \'a\' : \'b\'} />',
      '<b className={"_l " + ((on ? \'a\' : \'b\') || "")} />',
    ],
    [
      'вызов',
      '<b className={mne(\'a\', props.className)} />',
      '<b className={"_l " + ((mne(\'a\', props.className)) || "")} />',
    ],
    [
      'свойство объекта',
      'f({ className: \'p-4\' })',
      'f({ className: \'_l p-4\' })',
    ],
    [
      'свойство-выражение',
      'f({ className: cls })',
      'f({ className: "_l " + ((cls) || "") })',
    ],
    [
      'атрибут без значения и чужие атрибуты',
      '<b className id="x" data-class="y" />',
      '<b className id="x" data-class="y" />',
    ],
    [
      'class в Solid/Preact',
      '<b class="p-4" />',
      '<b class="_l p-4" />',
    ],
  ])('%s', (
    _name, source, expected,
  ) => {
    expect(write(
      source, 'Button.tsx', '_l',
    ).code).toBe(expected);
  });

  test('повторный проход ничего не меняет', () => {
    const once = write(
      '<p><b className="p-4" /><i className={`a ${x}`} /><u className="_l" /><s className={x} /></p>', 'a.tsx', '_l',
    ).code;
    expect(once).toBe('<p><b className="_l p-4" /><i className={`_l a ${x}`} /><u className="_l" />'
      + '<s className={"_l " + ((x) || "")} /></p>');
    expect(write(
      once, 'a.tsx', '_l',
    ).code).toBe(once);
  });

  test('битый файл — текстом', () => {
    expect(write(
      '<b className="p-4" ', 'a.tsx', '_l',
    ).code).toBe('<b className="_l p-4" ');
  });

  test('syntax: false — текстом и для .tsx', () => {
    const text = createScopeClassWriter({
      attr: ATTR,
      syntax: false,
    });
    expect(text(
      'f({ className: cls })', 'a.tsx', '_l',
    ).code).toBe('f({ className: cls })');
  });
});

describe('текстом — .html, .vue, .svelte, .astro', () => {
  test.each([
    [
      'двойные кавычки',
      '<div class="p-4">',
      '<div class="_l p-4">',
    ],
    [
      'одинарные кавычки',
      '<div class=\'p-4\'>',
      '<div class=\'_l p-4\'>',
    ],
    [
      'пустой',
      '<div class="">',
      '<div class="_l ">',
    ],
    [
      'выражение Svelte/Astro',
      '<div class={cls}>',
      '<div class={"_l " + ((cls) || "")}>',
    ],
    [
      'выражение со строкой и фигурными',
      '<div class={`a ${b ? \'}\' : \'c\'}`}>',
      '<div class={"_l " + ((`a ${b ? \'}\' : \'c\'}`) || "")}>',
    ],
    [
      'привязка Vue :class — не трогается',
      '<div :class="x" class="p-4">',
      '<div :class="x" class="_l p-4">',
    ],
    [
      'data-class — не атрибут класса',
      '<div data-class="x">',
      '<div data-class="x">',
    ],
    [
      'свойство-объект — не класс',
      'f({ class: { a: 1 } })',
      'f({ class: { a: 1 } })',
    ],
  ])('%s', (
    _name, source, expected,
  ) => {
    expect(write(
      source, 'Card.vue', '_l',
    ).code).toBe(expected);
  });

  test('повторный проход ничего не меняет', () => {
    const once = addScopeClassText(
      '<div class="p-4"><i class=\'_l a\'><s class={x}>', ATTR, '_l',
    );
    expect(addScopeClassText(
      once, ATTR, '_l',
    )).toBe(once);
  });

  test('незакрытое выражение — до конца файла', () => {
    expect(addScopeClassText(
      '<div class={cls', ATTR, '_l',
    )).toBe('<div class={"_l " + ((cls) || "")');
  });
});

describe('шаблон `*ClassName` в attr (D-131)', () => {
  const writePattern = createScopeClassWriter({
    attr: [
      'className',
      '*ClassName',
    ],
  });

  test('разбором — JSX и свойство объекта', () => {
    expect(writePattern(
      '<b className="p-4" fillClassName="m-2" fillclassname="w-1" />;\nf({ rootClassName: \'h-2\' });',
      'Bar.tsx', '_l',
    ).code)
      .toBe('<b className="_l p-4" fillClassName="_l m-2" fillclassname="w-1" />;\nf({ rootClassName: \'_l h-2\' });');
  });

  test('текстом — атрибуты в разметке', () => {
    expect(addScopeClassText(
      '<x-bar fillClassName="m-2" data-ClassName="p-1" Name="w-1">', ['*ClassName'], '_l',
    ))
      .toBe('<x-bar fillClassName="_l m-2" data-ClassName="_l p-1" Name="w-1">');
  });
});

describe('классы, заданные из JS, — недостижимы', () => {
  test('строка и фрагмент; комментарии и сравнения не в счёт', () => {
    const source = [
      'el.className = \'p-4\';',
      '// el.classList.add(\'x\')',
      'el.classList.add(\'a\'); el.classList . toggle(\'b\');',
      'el.setAttribute(\'class\', \'c\');',
      'if (el.className === \'d\') {}',
    ].join('\n');
    expect(write(
      source, 'a.ts', '_l',
    ).unreachable).toEqual([
      [
        1,
        '.className=',
      ],
      [
        3,
        '.classList.add(',
      ],
      [
        3,
        '.classList.toggle(',
      ],
      [
        4,
        'setAttribute(\'class\'',
      ],
    ]);
  });
});

describe('край: повтор, похожие классы, нет парсера', () => {
  test.each([
    [
      'класс целиком в двойных кавычках',
      '<i class="_l">',
      '<i class="_l">',
    ],
    [
      'класс в шаблоне',
      'f({ className: `_l x` })',
      'f({ className: `_l x` })',
    ],
    [
      'класс-префикс другого имени — не тот же класс',
      '<i class="_lx">',
      '<i class="_l _lx">',
    ],
    [
      'строка в двойных кавычках внутри выражения',
      '<i class={x ? "}" : "y"}>',
      '<i class={"_l " + ((x ? "}" : "y") || "")}>',
    ],
    [
      'экранированная кавычка в строке выражения',
      '<i class={x ? "a\\"}" : "y"}>',
      '<i class={"_l " + ((x ? "a\\"}" : "y") || "")}>',
    ],
  ])('%s', (
    _name, source, expected,
  ) => {
    expect(addScopeClassText(
      source, ATTR, '_l',
    )).toBe(expected);
  });

  test('typescript недоступен — текстом и для .tsx', () => {
    jest.resetModules();
    jest.doMock('../syntaxScan', () => {
      throw new Error('Cannot find module \'typescript\'');
    });
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../scopeClass') as typeof import('../scopeClass');
      const text = fresh.createScopeClassWriter({
        attr: ATTR,
      });
      expect(text(
        'f({ className: cls })', 'a.tsx', '_l',
      ).code).toBe('f({ className: cls })');
      expect(text(
        '<b className="p-4" />', 'b.tsx', '_l',
      ).code).toBe('<b className="_l p-4" />');
    } finally {
      jest.dontMock('../syntaxScan');
      jest.resetModules();
    }
  });
});
