/**
 * Content script stub — EventRecorder will attach here (Prompt Maestro §5).
 * Must not depend on chrome.* directly; use webextension-polyfill.
 */
import browser from 'webextension-polyfill';

const ATTR = 'data-tutorial-recorder-ui';

export function isRecorderUi(el: Element | null): boolean {
  return !!(el && el.closest && el.closest(`[${ATTR}="true"]`));
}

console.info('[toolsweb-extension] content stub ready', {
  href: location.href,
  id: browser.runtime?.id,
});
