import { z } from 'zod';
import {
  ActionSessionSchema,
  ActionSessionStatusSchema,
  SemanticTargetSchema,
  TutorialActionSourceSchema,
  TutorialActionTypeSchema,
  ViewportStateSchema,
} from './action.js';

/**
 * Extension messaging contracts (Prompt Maestro §12 / ADR-0006).
 * Always validate with Zod before handling.
 */

export const StartRecordingPayloadSchema = z.object({
  name: z.string().min(1).optional(),
  initialUrl: z.string().url().optional(),
  sessionId: z.string().uuid().optional(),
});
export type StartRecordingPayload = z.infer<typeof StartRecordingPayloadSchema>;

export const RecordingStatePayloadSchema = z.object({
  status: ActionSessionStatusSchema,
  sessionId: z.string().uuid().nullable(),
});
export type RecordingStatePayload = z.infer<typeof RecordingStatePayloadSchema>;

/** Action payload from content script before background stamps ids. */
export const ContentActionPayloadSchema = z.object({
  type: TutorialActionTypeSchema,
  timestamp: z.number().int().nonnegative(),
  url: z.string().url(),
  pageTitle: z.string(),
  target: SemanticTargetSchema.optional(),
  value: z.string().optional(),
  previousValue: z.string().optional(),
  sensitive: z.boolean(),
  viewport: ViewportStateSchema,
  metadata: z.object({
    browser: z.string().optional(),
    frameId: z.string().optional(),
    navigatedTo: z.string().url().optional(),
    source: TutorialActionSourceSchema,
  }),
  narrative: z.string().optional(),
});
export type ContentActionPayload = z.infer<typeof ContentActionPayloadSchema>;

export const ExtensionMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('START_RECORDING'),
    payload: StartRecordingPayloadSchema.optional(),
  }),
  z.object({ type: z.literal('PAUSE_RECORDING') }),
  z.object({ type: z.literal('RESUME_RECORDING') }),
  z.object({ type: z.literal('STOP_RECORDING') }),
  z.object({
    type: z.literal('RECORDED_ACTION'),
    payload: ContentActionPayloadSchema,
  }),
  z.object({ type: z.literal('GET_SESSION') }),
  z.object({
    type: z.literal('SESSION_UPDATED'),
    payload: ActionSessionSchema,
  }),
  z.object({ type: z.literal('EXPORT_SESSION') }),
  z.object({
    type: z.literal('RECORDING_STATE'),
    payload: RecordingStatePayloadSchema,
  }),
]);
export type ExtensionMessage = z.infer<typeof ExtensionMessageSchema>;

export const ExtensionResponseSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  session: ActionSessionSchema.optional(),
  state: RecordingStatePayloadSchema.optional(),
  exportJson: z.string().optional(),
});
export type ExtensionResponse = z.infer<typeof ExtensionResponseSchema>;

export function parseExtensionMessage(raw: unknown): ExtensionMessage {
  return ExtensionMessageSchema.parse(raw);
}
