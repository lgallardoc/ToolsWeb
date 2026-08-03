import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetEnvCache } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Must be imported before any module that calls getEnv() at load time. */
loadEnv({ path: path.resolve(__dirname, '../../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../../.env'), override: true });
resetEnvCache();
