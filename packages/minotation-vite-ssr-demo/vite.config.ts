import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mnVite } from 'minotation-vite';
import { presetStandard, presetSynonyms, presetMedias } from 'minotation';

export default defineConfig({
  plugins: [
    react(),
    // Пресеты — явно: по умолчанию не подключается ни один (D-110).
    mnVite({ attrs: 'className:class', presets: [presetStandard, presetSynonyms, presetMedias] }),
  ],
});
