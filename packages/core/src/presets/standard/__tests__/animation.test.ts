/**
 * `an` — анимация, слоты в фиксированном порядке, как у `tn` (запрос трека web-games, 2026-10-14).
 */
import minotationProvider from '../../../core';
import presetStandard from '..';

function compile(tokens: string, setup?: (mn: ReturnType<typeof minotationProvider>) => void) {
  const warnings: string[] = [];
  const mn = minotationProvider({
    warningMode: 'silent',
    onWarning: (w) => warnings.push(w.message),
  });
  mn.setPresets([presetStandard]);
  setup && setup(mn);
  mn.getCompiler('class')(tokens);
  mn.compile();
  return {
    css: mn.styles$.getValue().map((s) => s.content).join(''),
    warnings,
  };
}

test.each([
  ['an_wg-appear_0.2s_ease-out_0.3s_both', 'animation:wg-appear 0.2s ease-out 0.3s both'],
  ['an_spin_1s_linear_infinite', 'animation:spin 1s linear infinite'],
  ['an_fade_200', 'animation:fade 200ms'],
  ['an_fade_200_300_2_alternate_forwards_paused', 'animation:fade 200ms 300ms 2 alternate forwards paused'],
  ['an_none', 'animation:none'],
  ['an_x_1s_none', 'animation:x 1s none'],
  ['an_a_1s,b_2s', 'animation:a 1s,b 2s'],
  ['an_--anim', 'animation:var(--anim)'],
  ['an_fade_1s_cubic-bezier\\(0.4,0,0.2,1\\)', 'animation:fade 1s cubic-bezier(0.4,0,0.2,1)'],
  ['an_fade_1s_steps\\(4\\)_infinite', 'animation:fade 1s steps(4) infinite'],
])('%s → %s', (token, declaration) => {
  const result = compile(token);
  expect(result.css).toContain('{' + declaration + '}');
  expect(result.warnings).toEqual([]);
});

test.each([
  ['an_1s_fade', '"_1s_fade" is invalid for "an": the order is name, duration, easing, delay, iteration count,'
    + ' direction, fill mode, play state — "fade" is out of place'],
  ['an_fade_1s_9x', 'fits none of them'],
  ['an', '"an" produced no CSS: handler "an" needs a value here'],
])('%s — предупреждение', (token, message) => {
  const result = compile(token);
  expect(result.css).toBe('');
  expect(result.warnings[0]).toContain(message);
});

test('ключевые кадры — из пресета, анимация — токеном', () => {
  expect(compile('an_wg-appear_0.2s_ease-out_0.3s_both', (mn) => {
    mn.setKeyframes('wg-appear', {
      from: {
        opacity: '0',
      },
      to: {
        opacity: '1',
      },
    });
  }).css).toBe('@keyframes wg-appear{from{opacity:0}to{opacity:1}}'
    + '.an_wg-appear_0\\.2s_ease-out_0\\.3s_both{animation:wg-appear 0.2s ease-out 0.3s both}');
});
