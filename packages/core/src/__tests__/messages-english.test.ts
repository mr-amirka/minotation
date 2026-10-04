/**
 * D-022: все сообщения библиотеки — на английском.
 *
 * Владелец: «приведи всё к одному языку, и больше такого не допускай». Сторож
 * разбирает исходники каждого пакета парсером TypeScript и ищет строковые
 * литералы с кириллицей. Комментарии парсер в литералы не включает, поэтому
 * они не задеты — решение касается только текстов, которые видит пользователь.
 *
 * Исключения:
 * - `minotation-docs` — содержимое сайта документации, а не сообщения библиотеки;
 * - тесты (`__tests__`, `*.test.*`, `*.spec.*`) — в них русские названия кейсов.
 */
import fs from 'fs';
import path from 'path';
import ts from 'typescript';

const PACKAGES = path.resolve(__dirname, '../../..');
const SKIP_PACKAGES: Record<string, 1> = {
  'minotation-docs': 1,
};
const SKIP_DIRS: Record<string, 1> = {
  node_modules: 1,
  dist: 1,
  coverage: 1,
  __tests__: 1,
  __benchmarks__: 1,
};
const REGEXP_SOURCE = /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/;
const REGEXP_SKIP_FILE = /\.(?:test|spec)\.|\.d\.ts$/;
const REGEXP_CYRILLIC = /[а-яё]/i;

function sourceFiles(dir: string, out: string[]): string[] {
  for (const entry of fs.readdirSync(dir, {
    withFileTypes: true,
  })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      SKIP_DIRS[entry.name] || sourceFiles(full, out);
    } else if (REGEXP_SOURCE.test(entry.name) && !REGEXP_SKIP_FILE.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function cyrillicLiterals(file: string): string[] {
  const source = ts.createSourceFile(
    file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    /x$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  function visit(node: ts.Node): void {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
      || ts.isJsxText(node))
      && REGEXP_CYRILLIC.test(node.text)) {
      const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      found.push(path.relative(PACKAGES, file) + ':' + line + ' ' + JSON.stringify(node.text));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return found;
}

describe('сообщения библиотеки — только на английском (D-022)', () => {
  const packages = fs.readdirSync(PACKAGES).filter((name) => !SKIP_PACKAGES[name]
    && fs.existsSync(path.join(
      PACKAGES, name, 'package.json',
    )));

  test('пакеты найдены — сторож не пустой', () => {
    expect(packages).toContain('core');
    expect(packages).toContain('minotation-cli');
  });

  test.each(packages)('%s', (name) => {
    const found: string[] = [];
    for (const dir of ['src', 'scripts']) {
      const full = path.join(
        PACKAGES, name, dir,
      );
      if (fs.existsSync(full)) {
        for (const file of sourceFiles(full, [])) {
          found.push(...cyrillicLiterals(file));
        }
      }
    }
    expect(found).toEqual([]);
  });
});
