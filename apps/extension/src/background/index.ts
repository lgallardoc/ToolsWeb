/**
 * Background service worker — session store + Zod-validated messaging.
 */
import browser from 'webextension-polyfill';
import type { ExtensionMessage } from '@toolsweb/shared';
import { handleExtensionMessage, SessionStore } from './sessionStore.js';

const store = new SessionStore();

async function broadcastToTabs(msg: ExtensionMessage): Promise<void> {
  const tabs = await browser.tabs.query({});
  await Promise.all(
    tabs.map(async (tab) => {
      if (tab.id == null) return;
      try {
        await browser.tabs.sendMessage(tab.id, msg);
      } catch {
        /* no content script on this tab */
      }
    })
  );
}

browser.runtime.onInstalled.addListener(() => {
  console.info('[toolsweb-extension] installed');
});

browser.runtime.onMessage.addListener((raw: unknown) => {
  return handleExtensionMessage(store, raw, broadcastToTabs);
});
