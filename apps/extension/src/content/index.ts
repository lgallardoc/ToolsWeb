/**
 * Content script — EventRecorder + messaging (Prompt Maestro §5 / §12).
 */
import browser from 'webextension-polyfill';
import type { ExtensionMessage } from '@toolsweb/shared';
import { EventRecorder } from './eventRecorder.js';
import { isRecorderUi } from './semantic.js';

export { isRecorderUi };

let recorder: EventRecorder | null = null;

function ensureRecorder(): EventRecorder {
  if (!recorder) {
    recorder = new EventRecorder({
      onAction: (payload) => {
        void browser.runtime.sendMessage({
          type: 'RECORDED_ACTION',
          payload,
        } satisfies ExtensionMessage);
      },
    });
  }
  return recorder;
}

function applyState(status: string): void {
  const rec = ensureRecorder();
  if (status === 'recording') {
    if (!rec.isActive) rec.start();
    return;
  }
  // paused / completed / idle
  if (rec.isActive) rec.stop();
  if (status !== 'paused') {
    recorder = null;
  }
}

browser.runtime.onMessage.addListener((raw: unknown) => {
  try {
    const msg = raw as ExtensionMessage;
    if (msg.type === 'RECORDING_STATE') {
      applyState(msg.payload.status);
      return;
    }
    if (msg.type === 'START_RECORDING') {
      applyState('recording');
      return;
    }
    if (msg.type === 'PAUSE_RECORDING') {
      applyState('paused');
      return;
    }
    if (
      msg.type === 'STOP_RECORDING' ||
      msg.type === 'RESUME_RECORDING'
    ) {
      // background also broadcasts RECORDING_STATE; handle RESUME here
      if (msg.type === 'RESUME_RECORDING') applyState('recording');
      if (msg.type === 'STOP_RECORDING') applyState('completed');
    }
  } catch (err) {
    console.warn('[toolsweb-extension] content message error', err);
  }
});

void browser.runtime
  .sendMessage({ type: 'GET_SESSION' } satisfies ExtensionMessage)
  .then((res) => {
    const state = (res as { state?: { status: string } } | undefined)?.state;
    if (state?.status) applyState(state.status);
  })
  .catch(() => {
    /* background may not be ready */
  });

console.info('[toolsweb-extension] content EventRecorder ready');
