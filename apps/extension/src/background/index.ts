/**
 * Background service worker stub (WebExtensions).
 * Messaging and SessionRepository land in later phases (Prompt Maestro §12–13).
 */
import browser from 'webextension-polyfill';

browser.runtime.onInstalled.addListener(() => {
  console.info('[toolsweb-extension] installed (scaffold)');
});
