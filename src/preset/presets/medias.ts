import type {
  MnFn, 
} from '../MnInstance';

/**
 * Пресет медиа-запросов (из 1.x presets/medias.js).
 */
export function presetMedias(mn: MnFn): void {
  // Mobile
  mn.media.m = {
    query: '(max-width: 991.98px)',
    priority: 0, 
  };
  mn.media.m2 = {
    query: '(max-width: 767.98px)',
    priority: 1, 
  };
  mn.media.m3 = {
    query: '(max-width: 639.98px)',
    priority: 2, 
  };
  mn.media.m4 = {
    query: '(max-width: 479.98px)',
    priority: 3, 
  };
  mn.media.m5 = {
    query: '(max-width: 359.98px)',
    priority: 4, 
  };

  // Desktop
  mn.media.d = {
    query: '(min-width: 992px)',
    priority: 10, 
  };
  mn.media.d2 = {
    query: '(min-width: 1200px)',
    priority: 11, 
  };
  mn.media.d3 = {
    query: '(min-width: 1600px)',
    priority: 12, 
  };
  mn.media.d4 = {
    query: '(min-width: 1920px)',
    priority: 13, 
  };

  // Special
  mn.media.mouse = {
    query: '(pointer: fine) and (hover: hover)',
    priority: 20, 
  };
  mn.media.dark = {
    query: '(prefers-color-scheme: dark)',
    priority: 30, 
  };

  // User-agent (селекторные)
  mn.media.safari = {
    selector: '.safari', 
  };
  mn.media.chrome = {
    selector: '.chrome', 
  };
  mn.media.mobile = {
    selector: '.mobile', 
  };
}
