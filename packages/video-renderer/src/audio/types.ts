export type NarrationSynthInput = {
  sceneNumber: number;
  text: string;
  language: string;
  outputPath: string;
};

export type NarrationSynthResult = {
  outputPath: string;
  durationSeconds: number;
};

export interface NarrationAudioProvider {
  readonly id: string;
  synthesize(input: NarrationSynthInput): Promise<NarrationSynthResult>;
}
