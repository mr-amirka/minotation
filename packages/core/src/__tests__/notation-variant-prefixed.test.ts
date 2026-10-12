/**
 * Режим синтаксиса `'variant-prefixed'` (Tailwind) — D-045, D-046, D-047.
 *
 * Приставки ищутся среди синонимов и `mn.states`, затем среди имён медиа; шаблон
 * `{имя}-{синоним|медиа}` — метка-предок или, через `mn.variantPrefixedSynonyms`, сосед.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetMedias from '../presets/medias';
import type {
  MnOptions, MnPresetObject, MnWarning,
} from '../core/types';
import type {
  MnInstance,
} from '../types';
import {
  selectorsCompileProvider,
} from '../selectorsCompileProvider';

/** Пресет-клон в миниатюре: синонимы и медиа в записи Tailwind, хендлеры — стандартные. */
const presetTailwindish: MnPresetObject = {
  name: 'presetTailwindish',
  notationMode: 'variant-prefixed',
  setup(mn: MnInstance) {
    mn.synonyms({
      hover: ':hover',
      focus: ':focus',
      invalid: ':invalid',
      'focus-visible': ':focus-visible',
    });
    mn.media.md = {
      query: '(min-width: 768px)',
      priority: 1,
    };
    mn.variantPrefixedSynonyms({
      group: '.group',
      peer: '.peer~',
    });
    mn.assign('.btn', 'hover:c0F0');
  },
};

function compile(tokens: string, options: MnOptions = {}) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    notationMode: 'variant-prefixed',
    onWarning: (w) => warnings.push(w),
    ...options,
  });
  mn.setPresets([
    presetStandard,
    presetMedias,
    presetTailwindish,
  ]);
  mn.getCompiler('class')(tokens);
  let error: unknown;
  try {
    mn.compile();
  } catch (ex) {
    error = ex;
  }
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(' '),
    warnings,
    error,
  };
}

describe("notationMode: 'variant-prefixed'", () => {
  test('состояние из синонимов', () => {
    expect(compile('hover:cF00').css).toContain('.hover\\:cF00:hover{color:#f00}');
  });

  test('медиа из mn.media', () => {
    expect(compile('md:cF00').css).toContain('@media (min-width: 768px){.md\\:cF00{color:#f00}}');
  });

  test('имя и в синонимах, и в медиа — берётся синоним', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      notationMode: 'variant-prefixed',
    });
    mn.setPresets([presetStandard, presetTailwindish]);
    mn.media.hover = {
      query: '(hover: hover)',
    };
    mn.getCompiler('class')('hover:cF00');
    mn.compile();
    const css = mn.styles$.getValue().map((s) => s.content).join(' ');
    expect(css).toContain('.hover\\:cF00:hover{color:#f00}');
    expect(css).not.toContain('(hover: hover)');
  });

  test('несколько состояний и медиа складываются', () => {
    const {
      css, 
    } = compile('md:hover:focus:cF00');
    expect(css).toContain('@media (min-width: 768px){.md\\:hover\\:focus\\:cF00:hover:focus{color:#f00}}');
  });

  test('{имя}-{состояние} — предок-метка: group-hover', () => {
    expect(compile('group-hover:cF00').css).toContain('.group:hover .group-hover\\:cF00{color:#f00}');
  });

  test('незарегистрированная метка — неизвестный вариант, как в Tailwind (D-048)', () => {
    const {
      css, warnings, 
    } = compile('vasya-hover:cF00 grop-hover:cF00');
    expect(css).not.toContain('vasya');
    expect(css).not.toContain('grop');
    expect(warnings.map((w) => w.token)).toEqual(['vasya-hover:cF00', 'grop-hover:cF00']);
  });

  test('{метка}-{медиа} — предок внутри медиа', () => {
    expect(compile('group-md:cF00').css).toContain('@media (min-width: 768px){.group .group-md\\:cF00{color:#f00}}');
  });

  test('именованная метка: group-hover/item, peer-invalid/email (D-048)', () => {
    const {
      css, 
    } = compile('group-hover/item:cF00 peer-invalid/email:c0F0');
    expect(css).toContain('.group\\/item:hover .group-hover\\/item\\:cF00{color:#f00}');
    expect(css).toContain('.peer\\/email:invalid~.peer-invalid\\/email\\:c0F0{color:#0f0}');
  });

  test('peer через variantPrefixedSynonyms — сосед', () => {
    expect(compile('peer-invalid:cF00').css).toContain('.peer:invalid~.peer-invalid\\:cF00{color:#f00}');
  });

  test('состояние с дефисом: peer-focus-visible', () => {
    expect(compile('peer-focus-visible:cF00').css)
      .toContain('.peer:focus-visible~.peer-focus-visible\\:cF00{color:#f00}');
  });

  test('! — !important (importantMode: warn по умолчанию — предупреждение)', () => {
    const {
      css, warnings, 
    } = compile('!p10');
    expect(css).toContain('.\\!p10{padding:10px!important}');
    expect(warnings.map((w) => w.type)).toEqual(['important']);
  });

  test('!important в strict — CSS нет', () => {
    const {
      css, error,
    } = compile('!p10 m10', {
      importantMode: 'strict',
    });
    expect((error as Error).name).toBe('MnForbiddenTokenError');
    expect(css).not.toContain('padding');
    expect(css).toContain('margin:10px');
  });

  test('неизвестная приставка — предупреждение, CSS нет', () => {
    const {
      css, warnings, 
    } = compile('wat:cF00');
    expect(css).not.toContain('wat');
    expect(warnings).toEqual([expect.objectContaining({
      type: 'parse-error',
      token: 'wat:cF00',
      message: 'Variant "wat:" is unknown — it is neither a synonym nor a media name, and'
        + ' "{label}-{synonym|media}" does not match a label registered with'
        + ' mn.variantPrefixedSynonyms. The class gives no CSS.',
    })]);
  });

  test('класс без приставок — как есть', () => {
    expect(compile('p10').css).toContain('.p10{padding:10px}');
  });

  test('строки пресета — в режиме пресета, разметка — в режиме проекта', () => {
    // Проект — по умолчанию 'context-qualified'; .btn у пресета задан как 'hover:c0F0'.
    const {
      css, 
    } = compile('p10:hover', {
      notationMode: 'context-qualified',
    });
    expect(css).toContain('.btn:hover{color:#0f0}');
    expect(css).toContain('.p10\\:hover:hover{padding:10px}');
  });

  test('в режиме проекта context-qualified запись Tailwind — чужой класс', () => {
    const {
      css, 
    } = compile('hover:cF00', {
      notationMode: 'context-qualified',
    });
    expect(css).not.toContain('hover\\:cF00');
  });
});

describe('mn.variantPrefixedSynonyms — проверка', () => {
  test('не объект и не строка в значении — ошибка', () => {
    const mn = minotationProvider();
    expect(() => mn.variantPrefixedSynonyms('peer' as never))
      .toThrow('[minotation] mn.variantPrefixedSynonyms: option "map" expects an object, got string "peer"');
    expect(() => mn.variantPrefixedSynonyms({
      peer: 1 as never,
    })).toThrow('[minotation] mn.variantPrefixedSynonyms: "peer" expects a selector string, got number 1');
  });

  test('отношения +, >, предок без комбинатора', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      notationMode: 'variant-prefixed',
    });
    mn.setPresets([presetStandard, presetTailwindish]);
    mn.variantPrefixedSynonyms({
      next: '.n+',
      box: '.box>',
      card: '.card',
    });
    mn.getCompiler('class')('next-hover:cF00 box-hover:cF00 card-hover:cF00');
    mn.compile();
    const css = mn.styles$.getValue().map((s) => s.content).join(' ');
    // Одинаковые объявления ядро сводит в одно правило — проверяем селекторы.
    expect(css).toContain('.n:hover+.next-hover\\:cF00');
    expect(css).toContain('.box:hover>.box-hover\\:cF00');
    expect(css).toContain('.card:hover .card-hover\\:cF00');
  });
});

describe("'variant-prefixed' без меток и без ядра", () => {
  test('без variantPrefixedSynonyms меток нет: peer-hover — неизвестный вариант', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      notationMode: 'variant-prefixed',
    });
    mn.setPresets([presetStandard]);
    mn.synonyms({
      hover: ':hover',
    });
    mn.getCompiler('class')('peer-hover:cF00');
    mn.compile();
    expect(mn.styles$.getValue().map((s) => s.content).join('')).not.toContain('peer-hover');
    expect(mn.warnings$.getValue().map((w) => w.type)).toEqual(['parse-error']);
  });

  test('selectorsCompileProvider отдельно: медиа нет — приставка неизвестна', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- экземпляр провайдера нетипизирован снаружи
    const instance: any = Object.assign(() => undefined, {
      options: {
        notationMode: 'variant-prefixed',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- то же
    const scp: any = selectorsCompileProvider(instance);
    expect(() => scp.parseClass('md:p10')).toThrow('Variant "md:" is unknown');
  });
});
