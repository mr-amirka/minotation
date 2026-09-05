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
  // Нужно только пока 'minotation' резолвится как symlink npm-воркспейса
  // (file:../core, как в этом монорепо) — реальный `npm install minotation`
  // из зарегистрированного пакета этого не требует. См. minotation-docs/
  // vite.config.ts — тот же обходной путь, разбор проблемы в CHANGELOG.md.
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
