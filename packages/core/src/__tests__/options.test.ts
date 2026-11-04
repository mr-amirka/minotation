/**
 * Опции ядра на `fundamentool/schema` (D-141): неизвестный ключ и некорректное значение — ошибка с
 * подсказкой, в разработке; в продакшене ядро не проверяет. Сама схема (пути, «did you mean», сообщения)
 * проверена в fundamentool — здесь опции ядра и его точки входа.
 */
import type {
  TInfer,
} from 'fundamentool/schema';
import minotationProvider from '../core/index';
import type {
  MnOptions,
} from '../core/types';
import {
  CORE_OPTIONS,
  MN_WHERE,
  SCANNER_OPTIONS,
} from '../options';
import presetHints from '../presets/hints';
import {
  defineScale,
} from '../presets/shared/scale';
import {
  createScanner,
} from '../scanner';
import type {
  ScannerOptions,
} from '../scanner';

const WHERE = 'test';

/** Сообщение проверки или `null`, если значение подходит. */
function messageOf(check: () => unknown): string | null {
  try {
    check();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

/** Типы равны в обе стороны. */
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false;

describe('CORE_OPTIONS — опции ядра', () => {
  test('тип MnOptions описывает ровно эту схему', () => {
    const same: Same<Required<MnOptions>, Required<TInfer<ReturnType<typeof CORE_OPTIONS>>>> = true;
    const scanner: Same<Required<ScannerOptions>, Required<TInfer<ReturnType<typeof SCANNER_OPTIONS>>>> = true;
    expect([
      same,
      scanner,
    ]).toEqual([
      true,
      true,
    ]);
  });

  test.each([
    [
      'warningMode',
      'strict',
      '"warningMode" expects one of log, silent, error, got string "strict"',
    ],
    // Прежний 'block' — теперь 'strict' (D-039)
    [
      'maxDepthMode',
      'block',
      '"maxDepthMode" expects one of warn, silent, strict, got string "block"',
    ],
    [
      'bareMathMode',
      'strickt',
      '"bareMathMode" expects one of warn, silent, strict, got string "strickt". Did you mean "strict"?',
    ],
    [
      'maxDepth',
      -1,
      '"maxDepth" expects a whole number ≥ 0, got number -1',
    ],
    [
      'maxDepth',
      1.5,
      '"maxDepth" expects a whole number ≥ 0, got number 1.5',
    ],
    [
      'maxSpecificity',
      17,
      '"maxSpecificity" expects a whole number from 1 to 16, got number 17',
    ],
    [
      'maxSpecificity',
      0,
      '"maxSpecificity" expects a whole number from 1 to 16, got number 0',
    ],
    [
      'maxSpecificityMode',
      'silent',
      '"maxSpecificityMode" expects one of warn, strict, got string "silent"',
    ],
    [
      'altColor',
      'off',
      '"altColor" expects true or false, got string "off"',
    ],
    [
      'onError',
      'log',
      '"onError" expects a function, got string "log"',
    ],
    [
      'media',
      [],
      '"media" expects an object, got array',
    ],
    [
      'presets',
      [5],
      '"presets"[0] expects a preset (a function or a preset object), got number 5',
    ],
    [
      'isolateClass',
      '.l',
      '"isolateClass" expects a class name without a dot (e.g. "_l"), got string ".l"',
    ],
    [
      'notationMode',
      'tw4',
      '"notationMode" expects one of context-qualified, tw4-compatible, breakpoint-prefixed, property-value, got string "tw4"',
    ],
    [
      'overflowWrapMode',
      'new',
      '"overflowWrapMode" expects one of standard, legacy, both, got string "new"',
    ],
  ])('%s: %p', (
    key, value, message,
  ) => {
    expect(messageOf(() => CORE_OPTIONS().parse({
      [key]: value,
    }, WHERE))).toBe(WHERE + ': ' + message);
  });

  test('подходят: все поля, пресет-функция и пресет-объект, `undefined` — как отсутствие', () => {
    expect(messageOf(() => CORE_OPTIONS().parse({
      presets: [
        () => undefined,
        {
          name: 'p',
          setup: () => undefined,
        },
      ],
      media: {},
      maxDepth: 0,
      maxSpecificity: 16,
      isolateClass: '_l',
      contextWhere: undefined,
    }, WHERE))).toBeNull();
  });
});

describe('точки входа ядра', () => {
  test('minotationProvider', () => {
    expect(messageOf(() => minotationProvider({
      strict: true,
    } as never))).toMatch(/^\[minotation\] minotationProvider: unknown option "strict"\. Known options: presets, /);
    expect(messageOf(() => minotationProvider({
      warningMode: 'strict',
    } as never))).toBe(MN_WHERE + 'minotationProvider: "warningMode" expects one of log, silent, error, got string "strict"');
    expect(messageOf(() => minotationProvider(5 as never)))
      .toBe('[minotation] minotationProvider: expects an options object, got number 5');
    expect(messageOf(() => minotationProvider({
      maxDepthMode: 'strict',
      maxDepth: 3,
    }))).toBeNull();
    expect(messageOf(() => minotationProvider())).toBeNull();
  });

  test('mn.setOptions', () => {
    const mn = minotationProvider();
    expect(messageOf(() => mn.setOptions({
      isolateMod: 'class',
    } as never))).toBe('[minotation] mn.setOptions: unknown option "isolateMod". Did you mean "isolateMode"?');
  });

  test('mn.variantPrefixedSynonyms: имя → непустой селектор', () => {
    const mn = minotationProvider();
    expect(messageOf(() => mn.variantPrefixedSynonyms({
      peer: 1,
    } as never))).toBe('[minotation] mn.variantPrefixedSynonyms: "peer" expects a selector string, got number 1');
    expect(messageOf(() => mn.variantPrefixedSynonyms({
      peer: '',
    }))).toBe('[minotation] mn.variantPrefixedSynonyms: "peer" expects a selector string, got string ""');
    expect(messageOf(() => mn.variantPrefixedSynonyms('peer' as never)))
      .toBe('[minotation] mn.variantPrefixedSynonyms: expects an object, got string "peer"');
  });

  test('createScanner', () => {
    expect(messageOf(() => createScanner({
      attr: ['class'],
    } as never))).toBe('[minotation] createScanner: unknown option "attr". Did you mean "attrs"?');
    expect(messageOf(() => createScanner({
      classVarSuffixes: ['Class'],
    } as never))).toMatch('[minotation] createScanner: unknown option "classVarSuffixes".');
    expect(messageOf(() => createScanner({
      attrs: 1,
    } as never))).toBe('[minotation] createScanner: "attrs" expects a list — a string "a, b:c", an array ["a", '
      + '"b:c"] or an object { b: "c" }, got number 1');
    expect(messageOf(() => createScanner({
      attrs: [
        'class',
        'className:class',
        '*ClassName:class',
      ],
      varNames: '*Class:class',
      fnNames: {
        mne: 'class',
        '*Class': 'class',
      },
      replaceDefaults: false,
      syntax: false,
    }))).toBeNull();
  });

  test.each([
    [
      '*:class',
      ': a pattern needs its ending, as "*Class"',
    ],
    [
      'class*',
      ': "*" stands only at the start of a name, as "*Class"',
    ],
    [
      '**Name:class',
      ': "*" stands only at the start of a name, as "*Class"',
    ],
    [
      'class name',
      ' holds a separator: write each entry apart',
    ],
    [
      'class, className',
      ' holds a separator: write each entry apart',
    ],
    [
      '*ClassName',
      ' has no value: write "*ClassName:…"',
    ],
    [
      'className:*class',
      ': a pattern is not a target',
    ],
    [
      'className:a:b',
      ': a target has no ":"',
    ],
    [
      'className:',
      ' has no value after ":"',
    ],
    [
      ':class',
      ' has no name',
    ],
  ])('attrs — запись "имя" или "имя:цель", шаблон только с целью: %p нельзя', (entry, problem) => {
    expect(messageOf(() => createScanner({
      attrs: [
        'className:class',
        entry,
      ],
    }))).toBe('[minotation] createScanner: "attrs" entry "' + entry + '"' + problem);
  });

  test.each([
    [
      'varNames',
      '*Class',
      ' has no value: write "*Class:…"',
    ],
    [
      'varNames',
      'rowStyles',
      ' has no value: write "rowStyles:…"',
    ],
    [
      'fnNames',
      'mne',
      ' has no value: write "mne:…"',
    ],
    [
      'fnNames',
      '*Class:*x',
      ': a pattern is not a target',
    ],
  ])('%s — цель пишется всегда: %p нельзя', (
    option, entry, problem,
  ) => {
    expect(messageOf(() => createScanner({
      [option]: entry,
    }))).toBe('[minotation] createScanner: "' + option + '" entry "' + entry + '"' + problem);
  });
});

describe('в продакшене ядро не проверяет опции (lab D-023)', () => {
  const mode = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = mode;
  });

  test.each([
    [
      'minotationProvider',
      () => minotationProvider({
        altColor: 'off',
      } as never),
    ],
    [
      'mn.setOptions',
      () => minotationProvider().setOptions({
        isolateMod: 'class',
      } as never),
    ],
    [
      'mn.variantPrefixedSynonyms',
      () => minotationProvider().variantPrefixedSynonyms({
        peer: 1,
      } as never),
    ],
    [
      'mn.setPresets — пресет-объект',
      () => minotationProvider().setPresets([
        {
          name: 'p',
          setup: () => undefined,
          extra: 1,
        } as never,
      ]),
    ],
    [
      'createScanner',
      () => createScanner({
        attrs: ['class*'],
      }),
    ],
    [
      'defineScale',
      () => defineScale(minotationProvider(), {
        properties: {
          m: 'margin',
        },
        scale: (step: number) => step + 'px',
        negative: 'yes',
      } as never),
    ],
    [
      'presetHints',
      () => presetHints({
        excludeGroups: ['bootsrap'],
      } as never),
    ],
  ])('%s', (name, call) => {
    expect(messageOf(call)).toMatch(/^\[minotation\] /);
    process.env.NODE_ENV = 'production';
    expect(messageOf(call)).toBeNull();
  });
});
