/**
 * `minotation.config.*` — общий файл настроек всех плагинов и CLI (D-081).
 */
import {
  mkdtempSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  tmpdir,
} from 'node:os';
import {
  BUILD_OPTIONS_SCHEMA, CONFIG_FILE_NAMES, TOOL_OPTION_KEYS, checkBuildOptions, clearConfigFileCache, loadConfigFile, withBuildConfig,
  withConfigFile,
} from '../src/index';
import {
  oneOf,
} from 'minotation';

let dir: string;
const cwd = process.cwd();
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mn-config-'));
  clearConfigFileCache();
});
afterEach(() => {
  process.chdir(cwd);
  rmSync(dir, {
    recursive: true,
    force: true,
  });
});

function write(name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, body);
  return path;
}

describe('loadConfigFile', () => {
  test('нет файла — undefined; имена — по порядку', () => {
    expect(loadConfigFile(BUILD_OPTIONS_SCHEMA, dir)).toBeUndefined();
    expect(CONFIG_FILE_NAMES[0]).toBe('minotation.config.js');
    expect(TOOL_OPTION_KEYS.cli).toEqual([
      'input',
      'output',
      'ignore',
    ]);
  });

  test.each([
    ['minotation.config.js', 'module.exports = { metrics: false };'],
    ['minotation.config.cjs', 'exports.default = { metrics: false };'],
    ['minotation.config.json', '{ "metrics": false }'],
  ])('%s', (name, body) => {
    write(name, body);
    expect(loadConfigFile(BUILD_OPTIONS_SCHEMA, dir)?.options).toEqual({
      metrics: false,
    });
  });

  test('опечатка — подсказка; битый файл и явный путь без файла — ошибка', () => {
    write('minotation.config.js', 'module.exports = { metric: false };');
    expect(() => loadConfigFile(BUILD_OPTIONS_SCHEMA, dir)).toThrow('Did you mean "metrics"?');
    const broken = write('broken.config.js', 'module.exports = { : };');
    expect(() => loadConfigFile(
      BUILD_OPTIONS_SCHEMA, dir, broken,
    )).toThrow('Failed to read config');
    expect(() => loadConfigFile(
      BUILD_OPTIONS_SCHEMA, dir, join(dir, 'no.js'),
    )).toThrow('Config not found');
  });

  test('файл правят — он перечитывается', () => {
    // JSON — читается напрямую; модули JS — `require` без кеша (у Jest свой реестр модулей,
    // поэтому перечитывание JS проверено вне Jest).
    const path = write('minotation.config.json', '{ "metrics": false }');
    expect(loadConfigFile(BUILD_OPTIONS_SCHEMA, dir)?.options.metrics).toBe(false);
    expect(loadConfigFile(BUILD_OPTIONS_SCHEMA, dir)?.options.metrics).toBe(false);
    writeFileSync(path, '{ "metrics": true }');
    utimesSync(
      path, new Date(), new Date(Date.now() + 5000),
    );
    expect(loadConfigFile(BUILD_OPTIONS_SCHEMA, dir)?.options.metrics).toBe(true);
  });
});

describe('withConfigFile / withBuildConfig', () => {
  test('общие опции и свои — из файла; чужие пропускаются; код — поверх', () => {
    write('minotation.config.js', 'module.exports = { attrs: "className:class", metrics: false, inject: "link", input: "./src" };');
    const own = {
      inject: oneOf(
        'inline', 'link', false,
      ),
    };
    expect(withConfigFile(
      {
        metrics: true,
      }, 'mnVite', BUILD_OPTIONS_SCHEMA, {
        ...BUILD_OPTIONS_SCHEMA,
        ...own,
      }, dir,
    )).toEqual({
      attrs: 'className:class',
      metrics: true,
      inject: 'link',
    });
    // rollup: `inject` — опция Vite, `input` — CLI.
    expect(withConfigFile(
      {}, 'mnRollup', BUILD_OPTIONS_SCHEMA, BUILD_OPTIONS_SCHEMA, dir,
    )).toEqual({
      attrs: 'className:class',
      metrics: false,
    });
  });

  test('значение чужой опции проверяет сам инструмент', () => {
    write('minotation.config.js', 'module.exports = { inject: "nope" };');
    process.chdir(dir);
    const own = {
      inject: oneOf(
        'inline', 'link', false,
      ),
    };
    const options = withBuildConfig(
      {}, 'mnVite', own,
    );
    expect(() => checkBuildOptions(
      options, 'mnVite', own,
    )).toThrow('option "inject" expects');
    expect(withBuildConfig({}, 'mnRollup')).toEqual({});
  });

  test('нет файла — опции как есть', () => {
    const options = {
      metrics: false,
    };
    process.chdir(dir);
    expect(withBuildConfig(options, 'mnRollup')).toBe(options);
  });
});
