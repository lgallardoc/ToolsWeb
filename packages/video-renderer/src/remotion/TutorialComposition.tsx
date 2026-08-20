import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { lerpCamera, type CameraTransform } from './camera';
import { FRAME_PAD_X, FRAME_PAD_Y } from './renderConstants';
import type { RemotionSceneProps, TutorialVideoProps } from './types';

export type { RemotionSceneProps, TutorialVideoProps } from './types';

const easeSoft = Easing.bezier(0.4, 0.0, 0.2, 1);

const StepBumper: React.FC<{
  groupIndex: number;
  moduleTitle: string;
  durationInFrames: number;
  audioSrc?: string;
}> = ({ groupIndex, moduleTitle, durationInFrames, audioSrc }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 8, Math.max(9, durationInFrames - 8), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeSoft }
  );
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#020617',
        backgroundImage:
          'radial-gradient(ellipse at 50% 40%, rgba(56,189,248,0.18), transparent 60%)',
        opacity,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ textAlign: 'center', color: 'white', padding: 48 }}>
        <div
          style={{
            fontSize: 22,
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'rgba(125,211,252,0.95)',
            marginBottom: 18,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Paso {groupIndex}
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 600,
            lineHeight: 1.25,
            maxWidth: 1400,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          {moduleTitle}
        </div>
      </div>
      {audioSrc ? <Audio src={audioSrc} /> : null}
    </AbsoluteFill>
  );
};

const ScreenshotScene: React.FC<
  RemotionSceneProps & {
    backgroundColor: string;
    showSubtitles: boolean;
    localDurationInFrames: number;
  }
> = ({
  imageSrc,
  audioSrc,
  narration,
  backgroundColor,
  showSubtitles,
  localDurationInFrames,
  audioDurationInFrames = 0,
  transitionInFrames = 14,
  transitionOutFrames = 14,
  sourceWidth,
  sourceHeight,
  camera,
  prevCamera,
  nextCamera,
}) => {
  const frame = useCurrentFrame();
  const { width: vw, height: vh } = useVideoConfig();
  const fadeIn = Math.max(1, transitionInFrames);
  const fadeOut = Math.max(1, transitionOutFrames);
  const holdEnd = Math.max(localDurationInFrames - fadeOut, fadeIn + 1);

  const opacity = interpolate(
    frame,
    [0, fadeIn, holdEnd, localDurationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeSoft }
  );

  let cam: CameraTransform = camera;
  if (frame < fadeIn && prevCamera) {
    const t = interpolate(frame, [0, fadeIn], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: easeSoft,
    });
    cam = lerpCamera(prevCamera, camera, t);
  } else if (frame > holdEnd && nextCamera) {
    const t = interpolate(frame, [holdEnd, localDurationInFrames], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: easeSoft,
    });
    cam = lerpCamera(camera, nextCamera, t);
  }

  const audioEnd = Math.max(
    1,
    Math.min(audioDurationInFrames || localDurationInFrames - fadeOut, localDurationInFrames)
  );
  const audioEdge = Math.min(4, Math.max(1, Math.floor(audioEnd * 0.02)));
  const audioVolume = (f: number) => {
    if (audioEnd <= audioEdge * 2) return 1;
    return interpolate(
      f,
      [0, audioEdge, Math.max(audioEnd - audioEdge, audioEdge + 1), audioEnd],
      [0, 1, 1, 0],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  };

  const frameW = vw * (1 - FRAME_PAD_X * 2);
  const frameH = vh * (1 - FRAME_PAD_Y * 2);

  return (
    <AbsoluteFill
      style={{
        backgroundColor,
        backgroundImage:
          'radial-gradient(ellipse at 50% 20%, rgba(56,189,248,0.12), transparent 55%), radial-gradient(ellipse at 80% 90%, rgba(15,23,42,0.9), #020617)',
      }}
    >
      <AbsoluteFill
        style={{
          opacity,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: frameW,
            height: frameH,
            borderRadius: 18,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: '#020617',
            boxShadow:
              '0 28px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: sourceWidth,
              height: sourceHeight,
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`,
              transformOrigin: '0 0',
              willChange: 'transform',
            }}
          >
            <Img
              src={imageSrc}
              style={{
                width: sourceWidth,
                height: sourceHeight,
                maxWidth: 'none',
                maxHeight: 'none',
                display: 'block',
              }}
            />
          </div>
        </div>
      </AbsoluteFill>
      {showSubtitles && narration.trim() ? (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: 48,
            opacity: interpolate(
              frame,
              [
                0,
                fadeIn,
                Math.min(audioEnd, holdEnd),
                Math.min(audioEnd + fadeOut, localDurationInFrames),
              ],
              [0, 1, 1, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: easeSoft }
            ),
          }}
        >
          <div
            style={{
              maxWidth: '90%',
              backgroundColor: 'rgba(0,0,0,0.75)',
              color: 'white',
              padding: '14px 22px',
              borderRadius: 8,
              fontSize: 32,
              lineHeight: 1.3,
              textAlign: 'center',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {narration}
          </div>
        </AbsoluteFill>
      ) : null}
      {audioSrc ? <Audio src={audioSrc} volume={audioVolume} /> : null}
    </AbsoluteFill>
  );
};

const SceneBlock: React.FC<
  RemotionSceneProps & { backgroundColor: string; showSubtitles: boolean }
> = (props) => {
  const bumperFrames = props.bumperEnabled
    ? Math.max(
        0,
        (props.bumperAudioDurationInFrames ?? 0) + (props.bumperPauseInFrames ?? 0)
      )
    : 0;
  const contentFrames = Math.max(1, props.durationInFrames - bumperFrames);

  return (
    <AbsoluteFill>
      {bumperFrames > 0 ? (
        <Sequence from={0} durationInFrames={bumperFrames} layout="none">
          <StepBumper
            groupIndex={props.bumperGroupIndex ?? props.stepNumber}
            moduleTitle={
              props.bumperModuleTitle ??
              props.bumperText ??
              `Paso ${props.bumperGroupIndex ?? props.stepNumber}`
            }
            durationInFrames={bumperFrames}
            {...(props.bumperAudioSrc ? { audioSrc: props.bumperAudioSrc } : {})}
          />
        </Sequence>
      ) : null}
      <Sequence from={bumperFrames} durationInFrames={contentFrames} layout="none">
        <ScreenshotScene
          {...props}
          localDurationInFrames={contentFrames}
          // Camera morph only on content segment (not during bumper).
          prevCamera={bumperFrames > 0 ? undefined : props.prevCamera}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

export const ToolswebTutorialVideo: React.FC<TutorialVideoProps> = ({
  scenes,
  backgroundColor,
  showSubtitles,
}) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {scenes.map((scene, index) => {
        const overlap = scene.transitionOverlapFrames ?? 0;
        if (index > 0) {
          from = Math.max(0, from - overlap);
        }
        const start = from;
        from += scene.durationInFrames;
        const bumperFrames = scene.bumperEnabled
          ? (scene.bumperAudioDurationInFrames ?? 0) + (scene.bumperPauseInFrames ?? 0)
          : 0;
        const contentFrames = Math.max(1, scene.durationInFrames - bumperFrames);
        const audioFrames = scene.audioDurationInFrames ?? 0;
        const postAudioFrames = Math.max(0, contentFrames - audioFrames);
        const transitionFrames = Math.max(
          10,
          Math.min(overlap || 14, Math.floor(postAudioFrames || contentFrames / 4))
        );
        return (
          <Sequence
            key={scene.sceneNumber}
            from={start}
            durationInFrames={scene.durationInFrames}
            layout="none"
          >
            <SceneBlock
              {...scene}
              transitionInFrames={index === 0 || bumperFrames > 0 ? 12 : transitionFrames}
              transitionOutFrames={transitionFrames}
              backgroundColor={backgroundColor}
              showSubtitles={showSubtitles}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
