import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifests/chromium.json';

/**
 * Chromium MV3 build (UC-0006). Firefox packaging remains a follow-up.
 */
export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest: manifest as never,
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
});
