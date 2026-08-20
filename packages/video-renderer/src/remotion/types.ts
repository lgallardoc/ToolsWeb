import type { VideoHighlight } from '@toolsweb/shared';
import type { CameraTransform } from './camera.js';

export type RemotionSceneProps = {
  sceneNumber: number;
  stepNumber: number;
  imageSrc: string;
  audioSrc?: string;
  narration: string;
  durationInFrames: number;
  /** Frames while narration plays at full volume (after bumper, before pad + xfade). */
  audioDurationInFrames?: number;
  bumperEnabled?: boolean;
  bumperText?: string;
  /** Interstitial group index (Paso N on bumper); falls back to stepNumber. */
  bumperGroupIndex?: number;
  /** Module title shown under “Paso N”. */
  bumperModuleTitle?: string;
  bumperAudioSrc?: string;
  bumperAudioDurationInFrames?: number;
  bumperPauseInFrames?: number;
  backgroundColor: string;
  showSubtitles: boolean;
  transitionInFrames?: number;
  transitionOutFrames?: number;
  transitionOverlapFrames?: number;
  sourceWidth: number;
  sourceHeight: number;
  highlight?: VideoHighlight;
  camera: CameraTransform;
  prevCamera?: CameraTransform;
  nextCamera?: CameraTransform;
};

export type TutorialVideoProps = {
  scenes: RemotionSceneProps[];
  backgroundColor: string;
  showSubtitles: boolean;
};
