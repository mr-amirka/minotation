/**
 * Smoke-тесты для minotation-vite.
 */

import { mnVite } from '../src/index';

describe('minotation-vite — smoke', () => {
  test('mnVite — функция', () => {
    expect(typeof mnVite).toBe('function');
  });

  test('mnVite() — возвращает объект с name=minotation', () => {
    const plugin: any = mnVite();
    expect(plugin.name).toBe('minotation');
  });

  test('mnVite() — имеет хук transform', () => {
    const plugin: any = mnVite();
    expect(typeof plugin.transform).toBe('function');
  });

  test('mnVite() — имеет хук handleHotUpdate', () => {
    const plugin: any = mnVite();
    expect(typeof plugin.handleHotUpdate).toBe('function');
  });

  test('mnVite() — имеет хук buildStart (подстраховка для сборщиков без transformIndexHtml, напр. Astro)', () => {
    const plugin: any = mnVite();
    expect(typeof plugin.buildStart).toBe('function');
  });

  test('mnVite({ attr: "className" }) — принимает опции', () => {
    const plugin: any = mnVite({ attr: 'className' });
    expect(plugin.name).toBe('minotation');
  });
});

describe('minotation-vite — safelist (регрессия 2026-09-22)', () => {
  /**
   * Плагин извлекает токены только из литеральных `class="…"`. Токены, собранные
   * в переменных (`const th = 'py12 px14'`, частый приём в .astro/JSX), терялись —
   * опция `safelist` добавляет их в компиляцию принудительно.
   */
  function bundleCss(plugin: any): string {
    let css = '';
    plugin.generateBundle.call({
      emitFile: (file: { source: string }) => { css = file.source; },
    });
    return css;
  }

  test('токены из safelist попадают в CSS без единого class="…" в проекте', () => {
    const css = bundleCss(mnVite({ safelist: ['py12', 'crP'] }));
    expect(css).toContain('padding-top:12px');
    expect(css).toContain('cursor:pointer');
  });

  test('несколько токенов в одной строке разбиваются по пробелам', () => {
    const css = bundleCss(mnVite({ safelist: ['taL  vaT'] }));
    expect(css).toContain('text-align:left');
    expect(css).toContain('vertical-align:top');
  });

  test('без safelist этих правил нет', () => {
    // `cursor:pointer` брать нельзя — его даёт presetMain (a{cursor:pointer} в @media),
    // поэтому проверяем заведомо уникальное значение.
    expect(bundleCss(mnVite({ safelist: ['w777'] }))).toContain('width:777px');
    expect(bundleCss(mnVite())).not.toContain('width:777px');
  });

  test('пустые строки и лишние пробелы игнорируются', () => {
    expect(() => bundleCss(mnVite({ safelist: ['', '   '] }))).not.toThrow();
  });
});

describe('minotation-vite — classVarSuffixes (2026-09-22)', () => {
  /**
   * Классы, собранные в переменной, статическое извлечение из `class="…"` не видит.
   * Кроме ручного `safelist` есть конвенция имени: переменная с суффиксом (по умолчанию
   * `Class`) трактуется как список MN-токенов.
   */
  function cssOf(source: string, options?: any): string {
    const plugin: any = mnVite(options);
    plugin.transform(source, '/proj/src/App.tsx');
    let css = '';
    plugin.generateBundle.call({ emitFile: (f: { source: string }) => { css = f.source; } });
    return css;
  }

  test('const thClass = … — токены попадают в CSS', () => {
    const css = cssOf("const thClass = 'py12 w777';");
    expect(css).toContain('padding-top:12px');
    expect(css).toContain('width:777px');
  });

  test('без суффикса — не извлекается', () => {
    expect(cssOf("const th = 'w777';")).not.toContain('width:777px');
  });

  test('суффикс должен быть в конце имени: thClassy не считается', () => {
    expect(cssOf("const thClassy = 'w777';")).not.toContain('width:777px');
  });

  test('аннотация типа не мешает', () => {
    expect(cssOf("const btnClass: string = 'w777';")).toContain('width:777px');
  });

  test('свойство объекта тоже распознаётся', () => {
    expect(cssOf("const styles = { rowClass: 'w777' };")).toContain('width:777px');
  });

  test('шаблонная строка: статические части берутся, ${…} пропускается', () => {
    const css = cssOf('const rowClass = `w777 ${active ? "bgF" : ""} py12`;');
    expect(css).toContain('width:777px');
    expect(css).toContain('padding-top:12px');
  });

  test('двойные кавычки и несколько переменных в файле', () => {
    const css = cssOf('const aClass = "w777";\nconst bClass = "py12";');
    expect(css).toContain('width:777px');
    expect(css).toContain('padding-top:12px');
  });

  test('свои суффиксы через опцию', () => {
    const css = cssOf("const rowCls = 'w777';", { classVarSuffixes: ['Cls'] });
    expect(css).toContain('width:777px');
    // дефолтный `Class` заменён, а не дополнен
    expect(cssOf("const rowClass = 'w777';", { classVarSuffixes: ['Cls'] })).not.toContain('width:777px');
  });

  test('пустой массив отключает механизм', () => {
    expect(cssOf("const thClass = 'w777';", { classVarSuffixes: [] })).not.toContain('width:777px');
  });

  test('спецсимволы в суффиксе экранируются и не ломают регексп', () => {
    expect(() => cssOf("const a$Class = 'w777';", { classVarSuffixes: ['$Class'] })).not.toThrow();
  });
});
