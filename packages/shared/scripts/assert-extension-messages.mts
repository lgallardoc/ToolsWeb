/**
 * Extension message + session store fixtures.
 * Run: npx tsx packages/shared/scripts/assert-extension-messages.mts
 */
import { randomUUID } from 'node:crypto';
import {
  ContentActionPayloadSchema,
  ExtensionMessageSchema,
  ViewportStateSchema,
  parseExtensionMessage,
} from '../src/index.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const viewport = ViewportStateSchema.parse({
  width: 800,
  height: 600,
  devicePixelRatio: 1,
  scrollX: 0,
  scrollY: 0,
});

const start = parseExtensionMessage({
  type: 'START_RECORDING',
  payload: { name: 'Demo' },
});
assert(start.type === 'START_RECORDING', 'start');

const startBare = parseExtensionMessage({ type: 'START_RECORDING' });
assert(startBare.type === 'START_RECORDING', 'start without payload');

const actionPayload = ContentActionPayloadSchema.parse({
  type: 'click',
  timestamp: Date.now(),
  url: 'https://example.com/',
  pageTitle: 'Example',
  sensitive: false,
  viewport,
  metadata: { source: 'content-script' },
  target: {
    tagName: 'button',
    accessibleName: 'Go',
    locatorCandidates: [{ strategy: 'text', value: 'Go', score: 50 }],
  },
});

const recorded = ExtensionMessageSchema.parse({
  type: 'RECORDED_ACTION',
  payload: actionPayload,
});
assert(recorded.type === 'RECORDED_ACTION', 'recorded');

assert.throws = undefined;
let failed = false;
try {
  parseExtensionMessage({ type: 'NOPE' });
} catch {
  failed = true;
}
assert(failed, 'invalid message rejected');

console.log('assert-extension-messages: OK', {
  sessionHint: randomUUID(),
  actionType: actionPayload.type,
});
