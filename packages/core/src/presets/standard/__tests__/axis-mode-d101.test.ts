/**
 * Осевые формы `x`/`y` (D-101): по умолчанию логические свойства (`padding-inline`), опция ядра
 * `axisMode: 'physical'` возвращает физическую пару; остальные стороны — физические всегда.
 */
import minotationProvider from '../../../core/index';
import presetStandard from '../index';
import type {
  MnOptions,
} from '../../../core/types';

function createMn(options: MnOptions = {}) {
  return minotationProvider({
    warningMode: 'silent',
    specificityMode: 'silent',
    presets: [presetStandard],
    ...options,
  });
}

function cssOf(mn: ReturnType<typeof createMn>): string {
  return mn.styles$.getValue().filter((s) => s.priority > -3000).map((s) => s.content).join('');
}

function compile(tokens: string, options?: MnOptions): string {
  const mn = createMn(options);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return cssOf(mn);
}

const PHYSICAL: MnOptions = {
  axisMode: 'physical',
};

describe('axisMode (D-101)', () => {
  test.each([
    [
      'px16',
      '.px16{padding-inline:16px}',
      '.px16{padding-left:16px;padding-right:16px}',
    ],
    [
      'py8',
      '.py8{padding-block:8px}',
      '.py8{padding-top:8px;padding-bottom:8px}',
    ],
    [
      'mxA',
      '.mxA{margin-inline:auto}',
      '.mxA{margin-left:auto;margin-right:auto}',
    ],
    [
      'my-4',
      '.my-4{margin-block:-4px}',
      '.my-4{margin-top:-4px;margin-bottom:-4px}',
    ],
    [
      'sx0',
      '.sx0{inset-inline:0}',
      '.sx0{left:0;right:0}',
    ],
    [
      'sy10',
      '.sy10{inset-block:10px}',
      '.sy10{top:10px;bottom:10px}',
    ],
    [
      'bx1',
      '.bx1{border-inline-width:1px}',
      '.bx1{border-left-width:1px;border-right-width:1px}',
    ],
    [
      'by2',
      '.by2{border-block-width:2px}',
      '.by2{border-top-width:2px;border-bottom-width:2px}',
    ],
    [
      'bcxF00',
      '.bcxF00{border-inline-color:#f00}',
      '.bcxF00{border-left-color:#f00;border-right-color:#f00}',
    ],
    [
      'bcy0',
      '.bcy0{border-block-color:#000}',
      '.bcy0{border-top-color:#000;border-bottom-color:#000}',
    ],
    [
      'bsxS',
      '.bsxS{border-inline-style:solid}',
      '.bsxS{border-left-style:solid;border-right-style:solid}',
    ],
    [
      'bsyDS',
      '.bsyDS{border-block-style:dashed}',
      '.bsyDS{border-top-style:dashed;border-bottom-style:dashed}',
    ],
    [
      'smx8',
      '.smx8{scroll-margin-inline:8px}',
      '.smx8{scroll-margin-left:8px;scroll-margin-right:8px}',
    ],
    [
      'spy16',
      '.spy16{scroll-padding-block:16px}',
      '.spy16{scroll-padding-top:16px;scroll-padding-bottom:16px}',
    ],
    [
      'px--gap',
      '.px--gap{padding-inline:var(--gap)}',
      '.px--gap{padding-left:var(--gap);padding-right:var(--gap)}',
    ],
  ])('%s — logical by default, the physical pair with axisMode: \'physical\'', (
    token, logical, physical,
  ) => {
    expect(compile(token)).toBe(logical);
    expect(compile(token, {
      axisMode: 'logical',
    })).toBe(logical);
    expect(compile(token, PHYSICAL)).toBe(physical);
  });

  test.each([
    [
      'pl4',
      '.pl4{padding-left:4px}',
    ],
    [
      'pxt4',
      '.pxt4{padding-left:4px;padding-right:4px;padding-top:4px}',
    ],
    [
      'myl2',
      '.myl2{margin-top:2px;margin-bottom:2px;margin-left:2px}',
    ],
    [
      'bclF00',
      '.bclF00{border-left-color:#f00}',
    ],
    [
      's0',
      '.s0{top:0;bottom:0;left:0;right:0}',
    ],
  ])('%s — the other sides stay physical in either mode', (token, css) => {
    expect(compile(token)).toBe(css);
    expect(compile(token, PHYSICAL)).toBe(css);
  });

  test('px16 pl0 — the side comes later in the CSS and wins over the axis on its side', () => {
    const css = compile('px16 pl0');
    expect(css.indexOf('padding-inline:16px')).toBeLessThan(css.indexOf('padding-left:0'));
  });

  test('setOptions + recompile switch a live instance', () => {
    const mn = createMn();
    mn.getCompiler('class')('px16');
    mn.compile();
    expect(cssOf(mn)).toBe('.px16{padding-inline:16px}');
    mn.setOptions(PHYSICAL);
    mn.recompile();
    expect(cssOf(mn)).toBe('.px16{padding-left:16px;padding-right:16px}');
    mn.setOptions({
      axisMode: 'logical',
    });
    mn.recompile();
    expect(cssOf(mn)).toBe('.px16{padding-inline:16px}');
  });

  test('the value is validated', () => {
    expect(() => createMn({
      axisMode: 'phisical' as never,
    }))
      .toThrow('option "axisMode" expects "logical" or "physical"');
    expect(() => createMn().setOptions({
      axisMode: 'ltr' as never,
    }))
      .toThrow('option "axisMode" expects "logical" or "physical"');
  });
});
