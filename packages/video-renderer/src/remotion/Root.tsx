import React from 'react';
import { Composition } from 'remotion';
import {
  ToolswebTutorialVideo,
  type TutorialVideoProps,
} from './TutorialComposition';

export const RemotionRoot: React.FC = () => {
  const defaultProps: TutorialVideoProps = {
    scenes: [],
    backgroundColor: '#0f172a',
    showSubtitles: true,
  };

  return (
    <Composition
      id="ToolswebTutorialVideo"
      component={ToolswebTutorialVideo}
      durationInFrames={30}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={async ({ props }) => {
        let total = 0;
        props.scenes.forEach((s, i) => {
          const overlap = s.transitionOverlapFrames ?? 0;
          if (i === 0) total += s.durationInFrames;
          else total += Math.max(1, s.durationInFrames - overlap);
        });
        return {
          durationInFrames: Math.max(30, total || 30),
          fps: 30,
          width: 1920,
          height: 1080,
        };
      }}
    />
  );
};
