import type { Page } from 'playwright';

export type CaptureReadyOptions = {
  /** Max time waiting for load + visual settle. */
  timeoutMs?: number;
  /**
   * Interaction shots (click/input): skip networkidle/load waits so the frame
   * stays on the pre-navigation screen. Only a brief paint settle.
   */
  instant?: boolean;
};

/**
 * Wait until the page is safe to screenshot: load progressed, network quiet (best-effort),
 * running CSS/WAAPI animations quieted, and DOM fingerprint stable for a short window.
 */
export async function waitForCaptureReady(
  page: Page,
  options: CaptureReadyOptions = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 3500;
  if (page.isClosed()) return;

  if (options.instant) {
    await settleInstant(page);
    return;
  }

  const deadline = Date.now() + timeoutMs;

  try {
    await page.waitForLoadState('domcontentloaded', {
      timeout: Math.min(2000, timeoutMs),
    });
  } catch {
    /* ignore */
  }

  const remainingForNetwork = Math.max(0, deadline - Date.now());
  if (remainingForNetwork > 200) {
    try {
      await page.waitForLoadState('networkidle', {
        timeout: Math.min(2500, remainingForNetwork),
      });
    } catch {
      /* many SPAs never idle — continue */
    }
  }

  await settleVisual(page, Math.max(0, deadline - Date.now()));
}

/** Double-rAF + tiny delay — keep the current view for click/input captures. */
async function settleInstant(page: Page): Promise<void> {
  try {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        })
    );
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 40));
}

async function settleVisual(page: Page, budgetMs: number): Promise<void> {
  if (budgetMs < 80 || page.isClosed()) return;

  const started = Date.now();
  let lastSig = '';
  let stableHits = 0;

  while (Date.now() - started < budgetMs) {
    let sig = '';
    try {
      sig = await page.evaluate(() => {
        const body = document.body;
        const running =
          typeof document.getAnimations === 'function'
            ? document.getAnimations().filter((a) => a.playState === 'running').length
            : 0;
        const busy = document.querySelectorAll(
          '[aria-busy="true"], .loading, .spinner, [class*="skeleton"], [class*="Skeleton"]'
        ).length;
        return [
          document.readyState,
          body ? body.scrollHeight : 0,
          body ? (body.innerText || '').length : 0,
          running,
          busy,
        ].join('|');
      });
    } catch {
      return;
    }

    if (sig === lastSig) {
      stableHits += 1;
      if (stableHits >= 2) {
        try {
          await page.evaluate(
            () =>
              new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
              })
          );
        } catch {
          /* ignore */
        }
        return;
      }
    } else {
      stableHits = 0;
      lastSig = sig;
    }

    await new Promise((r) => setTimeout(r, 90));
  }
}
