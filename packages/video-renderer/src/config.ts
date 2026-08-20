export type VideoRendererConfig = {
  fps: number;
  width: number;
  height: number;
  maxGapSeconds: number;
  scenePaddingSeconds: number;
  imageFit: 'contain' | 'cover';
  maxZoom: number;
  backgroundColor: string;
  ttsProvider: 'macos' | 'existing' | 'silent';
  ttsVoice: string;
  ttsRate: number;
  /** Pre-scene card + optional TTS (UC-0009 / UC-0011). */
  stepBumperEnabled: boolean;
  /** Silence after bumper speech (or card-only hold when silent TTS). */
  stepBumperSeconds: number;
  /**
   * `module` (default, UC-0011): bumper only when menuModule changes.
   * `step`: bumper on every scene (legacy).
   */
  stepBumperMode: 'module' | 'step';
  /**
   * TTS template. In module mode `{n}` = group index (not capture step), `{module}` = label.
   * Default: `Paso {n}. {module}.`
   */
  stepBumperText: string;
};

function envFlag(env: NodeJS.ProcessEnv, key: string, defaultValue: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw === '') return defaultValue;
  return !['0', 'false', 'no', 'off'].includes(raw.trim().toLowerCase());
}

export function loadVideoRendererConfig(
  env: NodeJS.ProcessEnv = process.env
): VideoRendererConfig {
  const fit = env.VIDEO_IMAGE_FIT === 'cover' ? 'cover' : 'contain';
  const tts =
    env.VIDEO_TTS_PROVIDER === 'macos' ||
    env.VIDEO_TTS_PROVIDER === 'existing' ||
    env.VIDEO_TTS_PROVIDER === 'silent'
      ? env.VIDEO_TTS_PROVIDER
      : process.platform === 'darwin'
        ? 'macos'
        : 'silent';
  const bumperMode = env.VIDEO_STEP_BUMPER_MODE === 'step' ? 'step' : 'module';

  return {
    fps: Number(env.VIDEO_DEFAULT_FPS ?? 30) || 30,
    width: 1920,
    height: 1080,
    maxGapSeconds: Number(env.VIDEO_MAX_GAP_SECONDS ?? 1) || 1,
    scenePaddingSeconds: Number(env.VIDEO_SCENE_PADDING_SECONDS ?? 0.65) || 0.65,
    imageFit: fit,
    maxZoom: Number(env.VIDEO_MAX_ZOOM ?? 1.15) || 1.15,
    backgroundColor: env.VIDEO_BACKGROUND_COLOR ?? '#0f172a',
    ttsProvider: tts,
    ttsVoice: env.VIDEO_TTS_VOICE ?? 'Paulina (Enhanced)',
    ttsRate: Number(env.VIDEO_TTS_RATE ?? 160) || 160,
    stepBumperEnabled: envFlag(env, 'VIDEO_STEP_BUMPER', true),
    stepBumperSeconds: Number(env.VIDEO_STEP_BUMPER_SECONDS ?? 1.2) || 1.2,
    stepBumperMode: bumperMode,
    stepBumperText:
      env.VIDEO_STEP_BUMPER_TEXT?.trim() ||
      (bumperMode === 'module' ? 'Paso {n}. {module}.' : 'Iniciaremos el paso {n}.'),
  };
}

export function formatStepBumperText(
  template: string,
  vars: { stepNumber: number; groupIndex?: number; menuModule?: string }
): string {
  const n = vars.groupIndex ?? vars.stepNumber;
  return template
    .replace(/\{n\}/gi, String(n))
    .replace(/\{module\}/gi, vars.menuModule?.trim() || `paso ${n}`)
    .trim();
}
