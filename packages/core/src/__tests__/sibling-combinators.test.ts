/**
 * Соседние комбинаторы `+` и `~` в нотации (D-046).
 *
 * `+` (следующий сосед) и `~` (любой следующий сосед) — не разделители MN, а обычные
 * CSS-комбинаторы внутри сегментов `<`/`>` (SPEC 04-grammar-strategy, примечание о `+` и `~`).
 * Два направления:
 * - **сосед перед элементом** — комбинатор в конце сегмента предка: `cF00<.peer~` →
 *   `.peer~ .cF00…` («элемент после `.peer`»), аналог `peer-*` из Tailwind;
 * - **сосед после элемента** — комбинатор после класса: `c0F0+.peer` → `.c0F0…+.peer`
 *   («`.peer` сразу после элемента»).
 *
 * Первое направление с 2026-09-24 ошибочно отбраковывалось проверкой висячих сепараторов
 * (в v1 работало) — исправлено 2026-10-12; эталон вывода — v1.
 */
import minotationProvider from '../core/index';
import presetStandard from '../presets/standard';
import presetSynonyms from '../presets/synonyms';
import presetMedias from '../presets/medias';
import type {
  MnWarning,
} from '../core/types';

/** Компилирует один токен со стандартными пресетами. */
function compile(token: string) {
  const warnings: MnWarning[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    childSelectorMode: 'silent',
    onWarning: (w) => warnings.push(w),
  });
  mn.setPresets([
    presetStandard,
    presetSynonyms,
    presetMedias,
  ]);
  mn.getCompiler('class')(token);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(' '),
    warnings,
  };
}

describe('сосед перед элементом: комбинатор в конце сегмента предка', () => {
  // Эталон — вывод v1 (minimalist-notation), сверено 2026-10-12.
  test.each([
    [
      'cF00<.peer+',
      '.peer+ .cF00\\<\\.peer\\+{color:#f00}',
    ],
    [
      'c00F<.peer~',
      '.peer~ .c00F\\<\\.peer\\~{color:#00f}',
    ],
    [
      'cF00<.peer:f~',
      '.peer:focus~ .cF00\\<\\.peer\\:f\\~{color:#f00}',
    ],
    [
      'cF00<.x~.y+',
      '.x~.y+ .cF00\\<\\.x\\~\\.y\\+{color:#f00}',
    ],
  ])('%s → %s', (token, css) => {
    const {
      css: out, warnings,
    } = compile(token);
    expect(out).toBe(css);
    expect(warnings).toEqual([]);
  });

  test('состояние самого элемента и сосед: cF00:h<.peer~', () => {
    expect(compile('cF00:h<.peer~').css).toBe('@media (hover: hover){.peer~ .cF00\\:h\\<\\.peer\\~:hover{color:#f00}}');
  });

  test('медиа: cF00<.peer~@md', () => {
    expect(compile('cF00<.peer~@md').css).toBe('@media (width < 48rem){.peer~ .cF00\\<\\.peer\\~\\@md{color:#f00}}');
  });

  test('группа вариантов: (cF00|p10)<.peer~', () => {
    const {
      css,
    } = compile('(cF00|p10)<.peer~');
    expect(css).toContain('.peer~ .\\(cF00\\|p10\\)\\<\\.peer\\~{color:#f00}');
    expect(css).toContain('.peer~ .\\(cF00\\|p10\\)\\<\\.peer\\~{padding:10px}');
  });

  test('цепочка предков: p10<.a~<.b — сосед .a внутри .b', () => {
    expect(compile('p10<.a~<.b').css).toBe('.b .a~ .p10\\<\\.a\\~\\<\\.b{padding:10px}');
  });

  test('экранированный комбинатор — часть имени класса предка, не комбинатор', () => {
    expect(compile('cF00<.peer\\~').css).toBe('.peer\\~ .cF00\\<\\.peer\\\\\\~{color:#f00}');
  });
});

describe('сосед после элемента: комбинатор после класса', () => {
  test.each([
    [
      'c0F0+.peer',
      '.c0F0\\+\\.peer+.peer{color:#0f0}',
    ],
    [
      'cF00~.peer',
      '.cF00\\~\\.peer~.peer{color:#f00}',
    ],
    [
      'cF00+*',
      '.cF00\\+\\*+*{color:#f00}',
    ],
    [
      'cF00~*',
      '.cF00\\~\\*~*{color:#f00}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });

  test('медиа: cF00~.b@md', () => {
    expect(compile('cF00~.b@md').css).toBe('@media (width < 48rem){.cF00\\~\\.b\\@md~.b{color:#f00}}');
  });

  test('сосед — не дочерний селектор: childSelectorMode его не касается', () => {
    const warnings: MnWarning[] = [];
    const mn = minotationProvider({
      onWarning: (w) => warnings.push(w),
    });
    mn.setPresets([presetStandard]);
    mn.getCompiler('class')('cF00+.peer');
    mn.compile();
    expect(warnings).toEqual([]);
  });
});

describe('сосед после ребёнка: >N+…', () => {
  // Было `>+.b` — битый CSS (и в v1); цель перед комбинатором — «любой прямой ребёнок».
  test.each([
    [
      'cF00>1+.b',
      '.cF00\\>1\\+\\.b>*+.b{color:#f00}',
    ],
    [
      'cF00>1~*',
      '.cF00\\>1\\~\\*>*~*{color:#f00}',
    ],
    [
      'cF00>2+.b',
      '.cF00\\>2\\+\\.b>*>*+.b{color:#f00}',
    ],
  ])('%s → %s', (token, css) => {
    expect(compile(token).css).toBe(css);
  });
});

describe('висячий комбинатор без предка — по-прежнему брак', () => {
  test.each([
    'p10~',
    'p10+',
    'p10>1~',
    'p10>1+',
  ])('%s — parse-error, CSS нет', (token) => {
    const {
      css, warnings,
    } = compile(token);
    expect(css).toBe('');
    expect(warnings.map((w) => w.type)).toEqual(['parse-error']);
    expect(warnings[0].message).toContain('with nothing after it');
  });
});

describe('экранированный < — не предок', () => {
  test('p10\\<.a~ — висячий ~ без настоящего предка остаётся браком', () => {
    const {
      css, warnings,
    } = compile('p10\\<.a~');
    expect(css).toBe('');
    expect(warnings.map((w) => w.type)).toEqual(['parse-error']);
  });
});
