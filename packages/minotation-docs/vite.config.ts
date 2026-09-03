import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mnVite } from 'minotation-vite';
import { presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain } from 'minotation';

export default defineConfig({
  plugins: [
    react(),
    mnVite({
      attr: 'className',
      extensions: ['.tsx', '.jsx'],
      presets: [presetStandard, presetSynonyms, presetMedias, presetNormalize, presetMain],
    }),
  ],
  // 'minotation' резолвится как symlink npm-воркспейса (file:../core) — Vite's
  // optimizeDeps по умолчанию пропускает такие linked-пакеты (считает их "своим"
  // исходником), из-за чего они не проходят esbuild-прероллинг и попадают в
  // Rollup напрямую в сыром CJS. Судя по всему, именно поэтому @rollup/plugin-
  // commonjs не видел minotationProvider, хотя cjs-module-lexer/esbuild/require()
  // видели его нормально (см. CHANGELOG.md 2026-09-03).
  optimizeDeps: {
    include: ['minotation'],
  },
  build: {
    commonjsOptions: {
      include: [/core\/dist/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
});
