/**
 * `contextWhere` (D-049): всё, кроме стилизуемого элемента, — в `:where()`; специфичность
 * остаётся только у класса. Работает во всех режимах синтаксиса.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnOptions,
} from '../core/types';

function css(token: string, options: MnOptions = {}): string {
  const mn = minotationProvider({
    warningMode: 'silent',
    childSelectorMode: 'silent',
    contextWhere: true,
    ...options,
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  mn.getCompiler('class')(token);
  mn.compile();
  return mn.styles$.getValue().map((s) => s.content).join(' ');
}

describe("contextWhere — 'context-qualified'", () => {
  test.each([
    ['cF00', '.cF00{color:#f00}'],
    ['cF00:h', '@media (hover: hover){.cF00\\:h:hover{color:#f00}}'],
    ['cF00.active', '.cF00\\.active.active{color:#f00}'],
    ['cF00<.card:h', '@media (hover: hover){.cF00\\<\\.card\\:h:is(:where(.card:hover) *){color:#f00}}'],
    ['cF00<.peer:f~', '.cF00\\<\\.peer\\:f\\~:is(:where(.peer:focus)~*){color:#f00}'],
    ['cF00<.a+', '.cF00\\<\\.a\\+:is(:where(.a)+*){color:#f00}'],
    ['cF00<1.box', '.cF00\\<1\\.box:is(:where(.box)>*){color:#f00}'],
    ['cF00<2.box', '.cF00\\<2\\.box:is(:where(.box)>*>*){color:#f00}'],
    ['cF00<.a<.b', '.cF00\\<\\.a\\<\\.b:is(:where(.b .a) *){color:#f00}'],
    ['cF00>.child', ':where(.cF00\\>\\.child) .child{color:#f00}'],
    ['cF00>1', ':where(.cF00\\>1)>*{color:#f00}'],
    ['cF00>.a>.b', ':where(.cF00\\>\\.a\\>\\.b .a) .b{color:#f00}'],
    ['cF00+.b', ':where(.cF00\\+\\.b)+.b{color:#f00}'],
    ['cF00~*', ':where(.cF00\\~\\*)~*{color:#f00}'],
    ['cF00+.b:h', '@media (hover: hover){:where(.cF00\\+\\.b\\:h)+.b:hover{color:#f00}}'],
    ['cF00[x~=a]', '.cF00\\[x\\~\\=a\\][x~=a]{color:#f00}'],
  ])('%s → %s', (token, expected) => {
    expect(css(token)).toBe(expected);
  });

  test('медиа сохраняются', () => {
    expect(css('cF00<.card@md')).toBe('@media md{.cF00\\<\\.card\\@md:is(:where(.card) *){color:#f00}}');
  });

  test('без флага — как раньше', () => {
    expect(css('cF00<.card:h', {
      contextWhere: false,
    })).toBe('@media (hover: hover){.card:hover .cF00\\<\\.card\\:h{color:#f00}}');
  });
});

describe("contextWhere — 'tw4-compatible'", () => {
  test('group-hover и peer-invalid — как в Tailwind v4', () => {
    const mn = minotationProvider({
      warningMode: 'silent',
      contextWhere: true,
      notationMode: 'tw4-compatible',
    });
    mn.setPresets([presetStandard]);
    mn.synonyms({
      hover: ':hover',
      invalid: ':invalid',
    });
    mn.variantPrefixedSynonyms({
      group: '.group',
      peer: '.peer~',
    });
    mn.getCompiler('class')('group-hover:cF00 peer-invalid:c0F0');
    mn.compile();
    const out = mn.styles$.getValue().map((s) => s.content).join(' ');
    expect(out).toContain('.group-hover\\:cF00:is(:where(.group:hover) *){color:#f00}');
    expect(out).toContain('.peer-invalid\\:c0F0:is(:where(.peer:invalid)~*){color:#0f0}');
  });
});

test('contextWhere — не boolean: ошибка проверки опций', () => {
  expect(() => minotationProvider({
    contextWhere: 'yes',
  } as never)).toThrow('option "contextWhere" expects a boolean, got string "yes"');
});
