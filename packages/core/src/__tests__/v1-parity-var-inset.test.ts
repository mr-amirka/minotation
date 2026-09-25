/**
 * Паритет с v1 (2026-09-17). Эталон — запуск v1 (`old/minimalist-notation`) на
 * тех же токенах. Каждый блок — регрессия порта, найденная сверкой:
 * - `var`/`env`-подстановки и shorthand с 2–4 значениями браковал валидатор
 *   `cssGrammar.ts` (разбор в `getVal` был на месте);
 * - дочерние эссенции `x.y` (`tbl.cell`) терялись: путь регистрации писал строковый
 *   ключ `childs` на кортеж, а компилятор читал индекс `MN_ESSENCE_CHILDS`;
 * - синоним `h` потерял `@mouse`;
 * - `bxsh10in` (inset) работал — неточна была документация.
 */
import {
  minotationProvider, 
} from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnWarning, 
} from '../core/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function compile(tokens: string[]): { css: string;
  warnings: MnWarning[] } {
  const warnings: MnWarning[] = [];
  const mn: any = minotationProvider({
    onWarning: (w: MnWarning) => warnings.push(w), 
  });
  mn.setPresets([presetStandard]);
  const c = mn.getCompiler('class');
  for (const t of tokens) {
    c(t);
  }
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n'),
    warnings, 
  };
}

describe('паритет с v1: custom properties', () => {
  test.each([
    ['--v=10px', '.--v\\=10px{--v:10px}'],
    ['w--v', '.w--v{width:var(--v)}'],
    ['w---width', '.w---width{width:env(--width)}'],
    ['w--v,10px', '.w--v\\,10px{width:var(--v,10px)}'],
    ['h--v+5', '.h--v\\+5{height:var(--v+5)}'],
  ])('%s → %s', (token, expected) => {
    const {
      css, warnings, 
    } = compile([token]);
    expect(css).toContain(expected);
    expect(warnings).toEqual([]);
  });

  test('объявление и подстановки в одном атрибуте', () => {
    const {
      css, 
    } = compile([
      'bxsh10in',
      'w--v',
      'w---width',
      '--v=10px',
    ]);

    expect(css).toContain('.bxsh10in{box-shadow:inset 0px 0px 10px 0px #000}');
    expect(css).toContain('.--v\\=10px{--v:10px}');
    expect(css).toContain('.w--v{width:var(--v)}');
    expect(css).toContain('.w---width{width:env(--width)}');
  });
});

describe('паритет с v1: box-shadow inset', () => {
  test('строчный модификатор `in` даёт inset', () => {
    expect(compile(['bxsh10in']).css).toContain('box-shadow:inset 0px 0px 10px 0px #000');
  });

  test('заглавный `In` бракуется — ОТХОД от v1, сознательный', () => {
    // В v1 (и в v2 до 2026-09-25) `In` молча отбрасывался: автор писал `In`,
    // имея в виду inset, и получал правило БЕЗ inset — то есть не то, что
    // хотел, и без единого предупреждения. Теперь неразобранный хвост суффикса
    // теней бракует токен целиком.
    // Рабочая форма — строчный `in`, проверена тестом выше.
    const {
      css, warnings, 
    } = compile(['bxsh10In']);

    expect(css).not.toContain('box-shadow');
    expect(warnings.map((w) => w.type)).toContain('parse-error');
  });
});

describe('паритет с v1: shorthand с несколькими значениями', () => {
  test.each([
    ['p10_20', 'padding:10px 20px'],
    ['p10_20_30', 'padding:10px 20px 30px'],
    ['p1_2_3_4', 'padding:1px 2px 3px 4px'],
    ['p1_2_3_4-i', 'padding:1px 2px 3px 4px!important'],
    ['m0_auto', 'margin:0 auto'],
    ['m-10_20', 'margin:-10px 20px'],
    ['p10%_20', 'padding:10% 20px'],
    ['p10_20-5', 'padding:10px calc(20px - 5px)'],
    ['b1_2', 'border-width:1px 2px'],
    ['r4_8', 'border-radius:4px 8px'],
    ['r4_8_12_16', 'border-radius:4px 8px 12px 16px'],
    ['r10-5', 'border-radius:calc(10px - 5px)'],
    ['r-5', 'border-radius:-5px'],
  ])('%s → %s', (token, expected) => {
    const {
      css, warnings, 
    } = compile([token]);
    expect(css).toContain(expected);
    expect(warnings).toEqual([]);
  });

  test('пять значений — отбраковка, как и в v1', () => {
    expect(compile(['p1_2_3_4_5']).css).toBe('');
  });
});

describe('паритет с v1: дочерние эссенции x.y', () => {
  test('tbl тянет tbl.cell на потомков', () => {
    const {
      css, 
    } = compile(['tbl']);
    expect(css).toContain('.tbl{display:table}');
    expect(css).toContain('.tbl>*{display:table-cell;vertical-align:middle}');
  });

  test('важность распространяется на дочернюю часть', () => {
    expect(compile(['tbl-i']).css).toContain('.tbl-i>*{display:table-cell!important;vertical-align:middle!important}');
  });

  test('дочерняя часть живёт в медиа-контексте родителя', () => {
    const mn: any = minotationProvider({
      media: {
        sm: {
          query: '(max-width:640px)', 
        }, 
      }, 
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('tbl@sm');
    mn.compile();
    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain('@media (max-width:640px){.tbl\\@sm{display:table}.tbl\\@sm>*{display:table-cell;vertical-align:middle}}');
  });
});

/**
 * Синоним `:h` — простой `:hover`, ОТХОД от v1-варианта, сознательный.
 *
 * 2026-09-17 сюда был скопирован v1-вариант `:hover@mouse` (hover только на
 * устройствах с указателем, чтобы на тачскринах он не «залипал» после тапа).
 * Владелец указал 2026-09-25, что в v1 это было сделано осознанно ПРОСТО как
 * `hover`, а современные устройства отрабатывают его корректно сами.
 *
 * Привязка к указателю никуда не делась — она просто стала явной: media-контекст
 * `mouse` есть в `presetMedias`, и кому нужно, тот пишет `p10:h@mouse`.
 */
describe(':h — простой :hover, без обёртки в @mouse', () => {
  function compileWithSynonyms(token: string): string {
    const mn: any = minotationProvider();
    mn.setPresets([
      presetStandard,
      presetSynonyms,
      presetMedias,
    ]);
    mn.getCompiler('class')(token);
    mn.compile();
    return mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
  }

  test(':h даёт обычный :hover, без медиа-обёртки', () => {
    expect(compileWithSynonyms('p10:h')).toBe('.p10\\:h:hover{padding:10px}');
  });

  test('привязка к указателю пишется явно и работает', () => {
    expect(compileWithSynonyms('p10:h@mouse'))
      .toBe('@media (pointer: fine) and (hover: hover){.p10\\:h\\@mouse:hover{padding:10px}}');
  });

  test(':h@sm — медиа не задвоено (sm не зарегистрирован — остаётся именем, как в v1)', () => {
    expect(compileWithSynonyms('p10:h@sm')).toBe('@media sm{.p10\\:h\\@sm:hover{padding:10px}}');
  });

  test('группа (h|f): обе ветки в ОДНОМ правиле', () => {
    // Побочный выигрыш от снятия `@mouse`: раньше ветки жили в разных
    // медиа-контекстах и давали два правила, теперь склеиваются в одно.
    const css = compileWithSynonyms('p10:(h|f)');

    expect(css).toBe('.p10\\:\\(h\\|f\\):hover,.p10\\:\\(h\\|f\\):focus{padding:10px}');
    expect(css).not.toContain('@media');
  });
});
describe('паритет с v1: ветки, изначально ошибочно принятые за недостижимые (2026-09-23)', () => {
  test('безымянный уровень в цепочке предков — СОЗНАТЕЛЬНЫЙ отход от v1', () => {
    // p10<.a<1 — второй уровень задан только глубиной, без класса/тега.
    // v1 подставлял '*' и давал `*>.a.p10…` — правило цеплялось к любому
    // предку, что почти никогда не то, что имел в виду автор токена.
    // С 2026-09-24 это вырожденная форма:
    // предупреждение и никакого CSS. Паритет с v1 здесь нарушен намеренно.
    const {
      css,
    } = compile(['p10<.a<1']);
    expect(css).toBe('');
  });

  test('трёхуровневая вложенность скобок в :state — hasTop=0 на третьем уровне', () => {
    // :not(.a(.b(.c))) — третий уровень вложенности разбирается рекурсивным
    // вызовом base(childs, 0); первые два уровня этого не покрывают
    const {
      css, 
    } = compile(['p10:not(.a(.b(.c)))']);
    expect(css).toContain(':not.a.b.c{padding:10px}');
  });

  test('var(--v,10) без явной единицы — подставляется defaultUnit у fallback-значения', () => {
    const {
      css, 
    } = compile(['w--v,10']);
    expect(css).toContain('.w--v\\,10{width:var(--v,10px)}');
  });

  test('include-примесь и сама эссенция делят одноимённый дочерний селектор — сливаются, не перезаписывают', () => {
    // mergeEssenceMap (utils.ts): дочерний ключ ' span' есть и у 'mixinpart'
    // (через include), и у самой 'hostpart' — вторая запись должна слиться
    // с первой через mergeEssenceInto (рекурсивно), а не заменить её целиком
    const mn: any = minotationProvider();
    mn('mixinpart', () => ({
      childs: {
        ' span': {
          style: {
            color: 'red', 
          }, 
        }, 
      }, 
    }));
    mn('hostpart', () => ({
      style: {
        padding: '1px', 
      },
      include: 'mixinpart',
      childs: {
        ' span': {
          style: {
            display: 'block', 
          }, 
        }, 
      },
    }));
    mn.getCompiler('class')('hostpart');
    mn.compile();
    const css = mn.styles$.getValue().map((s: { content: string }) => s.content).join('\n');
    expect(css).toContain('padding:1px');
    // обе childs-записи под одинаковым ключом ' span' — от include-примеси и от
    // самой эссенции — присутствуют вместе (слияние), ни одна не затёрла другую
    expect(css).toContain('color:red');
    expect(css).toContain('display:block');
  });
});

describe('паритет с v1: отрицательный знаменатель дроби бракуется (2026-09-23)', () => {
  test('w1/-2 — v1 отбраковывает, v2 обязан тоже (регрессия найдена при попытке "упростить" floatNormalize)', () => {
    const {
      css, 
    } = compile(['w1/-2']);
    expect(css).toBe('');
  });

  test('w1/2 и w-1/2 (отрицателен только числитель) продолжают работать как раньше', () => {
    expect(compile(['w1/2']).css).toContain('width:50%');
    expect(compile(['w-1/2']).css).toContain('width:-50%');
  });
});