import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mnVite } from 'minotation-vite';

export default defineConfig({
  plugins: [
    react(),
    mnVite({ attr: 'className' }),
  ],
});
