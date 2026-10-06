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
 * 2. **Файлы, чьё имя начинается с `_`, по умолчанию сканируются.** В v1 они
 *    молча выбрасывались — заимствование из Sass, где `_partial.scss` означает
 *    «не компилировать отдельным файлом». Для сканера токенов аналогия
 *    работает не всегда: партиал включается в страницу, и его классы окажутся
 *    в DOM. Прежнее поведение — флаг `skipPartials: true`, общий для всех
 *    плагинов (D-027).
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
  createFileFilter, createTokenCollector,
} from 'minotation-build';
import type {
  MnBuildOptions,
} from 'minotation-build';
import {
  presetStandard,
  presetSynonyms,
  presetMedias,
  presetNormalize,
  presetMain,
} from 'minotation';

/**
 * Опции {@link mnGulp} — эталонный набор `minotation-build` (D-026); описание
 * каждой — в README `minotation-build`.
 *
 * Отбор файлов у gulp делает `gulp.src`, поэтому `extensions` по умолчанию не
 * ограничивает ничего; `include`, `exclude` и `skipPartials` отсекают файлы
 * пайпа, которые нужны дальше (их пропускают в `gulp.dest`), но токенов из
 * которых брать не надо. `root` не используется.
 */
export interface MnGulpOptions extends MnBuildOptions {
  /** Имя CSS-файла, который уходит в поток. @default 'mn.css' */
  fileName?: string;
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
  // Пустое расширение пропускает любой файл: что сканировать, выбрал `gulp.src`.
  const files = createFileFilter({
    ...options,
    extensions: options.extensions || [''],
  }, process.cwd());
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
      if (file.isNull() || file.isStream() || !files.accepts(file.path)) {
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
