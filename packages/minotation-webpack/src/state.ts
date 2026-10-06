/**
 * Связь лоадеров с плагинами: общий на процесс реестр.
 *
 * Лоадеры webpack не видят экземпляр плагина напрямую. Токен-лоадер и
 * preset-лоадер отдают файл всем плагинам процесса (их правила пишет
 * пользователь или `minotation-next`); CSS-лоадер получает свой плагин прямо
 * в опциях правила, которое добавляет сам плагин.
 *
 * Почему на процесс, а не на `Compiler`: Next.js App Router заводит на один
 * `next build` несколько компиляторов (`server`/`edge-server`/`client`), и
 * Server Component попадает в граф только серверного (найдено 2026-09-02 на
 * `minotation-next-demo`). С 2026-10-06 каждый плагин ещё и сканирует проект
 * сам перед сборкой, так что токены серверных компонентов видит и клиентский
 * проход, где собирается CSS.
 */
import type { BuildCollector, FileFilter } from 'minotation-build';

/** То, что лоадерам нужно от плагина. */
export interface MnPluginHandle {
  /** Накопитель плагина. */
  build: BuildCollector;
  /** Отбор файлов плагина — лоадер учитывает только подходящие. */
  files: FileFilter;
  /** Корень скана — от него CSS-модуль зависит целиком. */
  root: string;
  /** CSS-модуль загружен импортом — отдельный ассет не нужен. */
  imported: boolean;
}

/** Общий стейт процесса. */
export interface MnState {
  /** Плагины процесса по номеру. */
  plugins: Map<number, MnPluginHandle>;
}

const singleton: MnState = { plugins: new Map() };

/** Возвращает общий на процесс стейт. */
export function getState(): MnState {
  return singleton;
}
