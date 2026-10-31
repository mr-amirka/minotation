import type {
  MnPresetObject,
} from '../../core/types';
import type {
  MnInstance,
} from '../../types';
import {
  createContext,
} from './context';
import {
  registerSpacing,
} from './spacing';
import {
  registerLayout,
} from './layout';
import {
  registerFlexGrid,
} from './flex-grid';
import {
  registerTypography,
} from './typography';
import {
  registerPaint,
} from './paint';
import {
  registerBorders,
} from './borders';
import {
  registerMotion,
} from './motion';
import {
  registerInteraction,
} from './interaction';
import {
  MIX_BLEND_MODE_SYNONYMS,
  TIMING_FUNCTION_SYNONYMS,
  VALUE_ABBREVIATIONS,
} from './words';

export default {
  name: 'presetStandard',
  ecosystems: ['minotation'],
  setup: (instance: MnInstance) => {
    const ctx = createContext(instance);
    registerSpacing(ctx);
    registerLayout(ctx);
    registerFlexGrid(ctx);
    registerTypography(ctx);
    registerPaint(ctx);
    registerBorders(ctx);
    registerMotion(ctx);
    registerInteraction(ctx);
  },
} as MnPresetObject;

/** Для тестов: краткие записи слов по свойствам (D-094). */
export const STANDARD_VALUE_ABBREVIATIONS = VALUE_ABBREVIATIONS;
/**
 * Для тестов: буквы хендлеров на `synonymProvider` с закрытым списком (D-106) — значения в CamelCase, как в картах.
 */
export const STANDARD_SYNONYMS_BY_PROPERTY: Record<string, Record<string, string>> = {
  transitionTimingFunction: TIMING_FUNCTION_SYNONYMS,
  mixBlendMode: MIX_BLEND_MODE_SYNONYMS,
};
