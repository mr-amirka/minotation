/**
 * Gulp-плагин Minimalist Notation: собирает токены из файлов пайпа и отдаёт
 * готовый CSS отдельным файлом в тот же поток.
 *
 * Перенос из v1 (`old/minimalist-notation/gulp3/index.js`) на общий каркас
 * (`minotation-build`), а не копированием логики: учёт токенов, компиляция,
 * кеш и предупреждения — там же, где у плагинов vite, webpack, rollup и
 * esbuild. Копия была бы шестой по счёту.
 *
 * ## Два отличия от v1, оба намеренные
 *
 * 1. **CSS уходит в поток, а не пишется на диск.** v1 звал `writeFile` сам, из
 *    `flush`, и путь назначения был первым аргументом плагина. Для gulp это
 *    чужеродно: там поток трансформируют, а записью занимается `gulp.dest()`.
 *    Своя запись вдобавок игнорировала `gulp.dest`, `gulp-rename` и всё
 *    остальное, что стоит дальше по пайпу.
 * 2. **Файлы, чьё имя начинается с `_`, не пропускаются.** В v1 такие файлы
 *    молча выбрасывались — заимствование из Sass, где `_partial.scss` означает
 *    «не компилировать отдельным файлом». Для сканера токенов аналогия не
 *    работает: партиал включается в страницу, и его классы окажутся в DOM, а
 *    правил для них не будет — молча. Кому нужно прежнее поведение, тот задаёт
 *    `exclude: /(^|[\\/])_/` и получает его явно.
 *
 * @module minotation-gulp
 */
import {
  Transform,
} from 'node:stream';
import type {
  TransformCallback,
} from 'node:stream';
import Vinyl from 'vinyl';
import {
  createTokenCollector,
} from 'minotation-build';
import type {
  TokenCollectorOptions,
} from 'minotation-build';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';

/** Опции {@link mnGulp}. */
export interface MnGulpOptions extends TokenCollectorOptions {
  /** Имя CSS-файла, который уходит в поток. @default 'mn.css' */
  fileName?: string;
  /**
   * Какие файлы пайпа НЕ сканировать — по пути.
   *
   * Отбор файлов у gulp делает `gulp.src`, и дублировать его здесь незачем.
   * Опция нужна для случая, когда в пайпе есть файлы, которые нужны дальше
   * (их пропускают в `gulp.dest`), но токенов из них брать не надо.
   */
  exclude?: RegExp;
}

const DEFAULT_PRESETS = [
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
];

/**
 * Поток-трансформер для gulp.
 *
 * Файлы проходят насквозь без изменений, а в конце пайпа добавляется ещё один
 * — с собранным CSS.
 *
 * @example
 * const gulp = require('gulp');
 * const { mnGulp } = require('minotation-gulp');
 *
 * exports.css = () => gulp.src('src/**\/*.html')
 *   .pipe(mnGulp({ fileName: 'app.css' }))
 *   .pipe(gulp.dest('dist'));
 */
export function mnGulp(options: MnGulpOptions = {}): Transform {
  const fileName = options.fileName || 'mn.css';
  const exclude = options.exclude;
  const collector = createTokenCollector({
    ...options,
    presets: options.presets || DEFAULT_PRESETS,
  });
  // Общая база для CSS-файла: gulp считает относительный путь от `base`, и без
  // него результат лёг бы в `dest` по абсолютному пути исходника.
  let base = process.cwd();
  let seenBase = false;

  return new Transform({
    objectMode: true,

    transform(
      file: Vinyl, _encoding: BufferEncoding, done: TransformCallback,
    ): void {
      // Пустой файл (`isNull`) — это директория или удалённый файл; поток
      // (`isStream`) gulp отдаёт при `buffer: false`, и прочитать его здесь
      // нечем. И то, и другое пропускаем дальше нетронутым.
      if (file.isNull() || file.isStream() || (exclude && exclude.test(file.path))) {
        done(null, file);
        return;
      }
      if (!seenBase) {
        seenBase = true;
        base = file.base;
      }
      collector.add(file.path, (file.contents as Buffer).toString('utf8'));
      done(null, file);
    },

    flush(done: TransformCallback): void {
      const css = collector.css();
      const warnings = collector.takeWarnings();
      const l = warnings.length;
      let i = 0;
      for (; i < l; i++) {
        // У gulp нет своего канала предупреждений — `console.warn` и есть
        // штатный вывод задачи.
        console.warn('[minotation] ' + warnings[i].token + ': ' + warnings[i].message);
      }
      // Пустой CSS в поток не отдаём: `gulp.dest` создал бы пустой файл, и
      // в разметке появилась бы ссылка на него.
      if (!css) {
        done();
        return;
      }
      this.push(new Vinyl({
        cwd: process.cwd(),
        base,
        path: base + '/' + fileName,
        contents: Buffer.from(css, 'utf8'),
      }));
      done();
    },
  });
}

export default mnGulp;
