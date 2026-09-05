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
  // См. minotation-docs/vite.config.ts — тот же обходной путь для linked-пакетов
  // npm workspaces (Rollup CJS-интероп, CHANGELOG.md 2026-09-03).
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
