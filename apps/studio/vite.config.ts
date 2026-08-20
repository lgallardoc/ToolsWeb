import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../.env') });
loadEnv({ path: path.resolve(__dirname, '.env'), override: true });

const STUDIO_HOST = process.env.STUDIO_HOST ?? '127.0.0.1';
const STUDIO_PORT = Number(process.env.STUDIO_PORT ?? 5174);

export default defineConfig({
  plugins: [react()],
  server: {
    host: STUDIO_HOST,
    port: STUDIO_PORT,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
