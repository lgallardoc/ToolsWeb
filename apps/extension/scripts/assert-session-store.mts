/**
 * SessionStore handler fixtures (extension background logic).
 * Run: npx tsx apps/extension/scripts/assert-session-store.mts
 */
import {
  handleExtensionMessage,
  SessionStore,
} from '../src/background/sessionStore.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const store = new SessionStore();
const broadcasts: unknown[] = [];

const broadcast = async (msg: unknown) => {
  broadcasts.push(msg);
};

const started = await handleExtensionMessage(
  store,
  {
    type: 'START_RECORDING',
    payload: { name: 'T', initialUrl: 'https://example.com/' },
  },
  broadcast
);
assert(started.ok && started.session?.status === 'recording', 'start');
assert(broadcasts.some((b) => (b as { type: string }).type === 'RECORDING_STATE'), 'broadcast');

const recorded = await handleExtensionMessage(
  store,
  {
    type: 'RECORDED_ACTION',
    payload: {
      type: 'click',
      timestamp: Date.now(),
      url: 'https://example.com/',
      pageTitle: 'Ex',
      sensitive: false,
      viewport: {
        width: 800,
        height: 600,
        devicePixelRatio: 1,
        scrollX: 0,
        scrollY: 0,
      },
      metadata: { source: 'content-script' },
      target: {
        tagName: 'button',
        locatorCandidates: [{ strategy: 'css', value: 'button', score: 30 }],
      },
    },
  },
  broadcast
);
assert(recorded.ok && (recorded.session?.actions.length ?? 0) === 1, 'action');

const stopped = await handleExtensionMessage(store, { type: 'STOP_RECORDING' }, broadcast);
assert(stopped.session?.status === 'completed', 'stop');

const exported = await handleExtensionMessage(store, { type: 'EXPORT_SESSION' }, broadcast);
assert(!!exported.exportJson && exported.exportJson.includes('click'), 'export');

console.log('assert-session-store: OK', {
  actions: stopped.session?.actions.length,
});
