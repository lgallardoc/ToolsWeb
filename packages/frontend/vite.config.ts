import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../.env') });
loadEnv({ path: path.resolve(__dirname, '.env'), override: true });

const FRONTEND_HOST = process.env.FRONTEND_HOST ?? '127.0.0.1';
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 5173);
const BACKEND_HOST = process.env.BACKEND_HOST ?? '127.0.0.1';
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 4410);
const BACKEND_URL =
  process.env.VITE_BACKEND_URL ?? `http://${BACKEND_HOST}:${BACKEND_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: FRONTEND_HOST,
    port: FRONTEND_PORT,
    strictPort: true,
    proxy: {
      '/api': BACKEND_URL,
      '/health': BACKEND_URL,
    },
  },
});
