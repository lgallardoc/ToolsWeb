import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright';
import type {
  CaptureAction,
  CaptureBrowser,
  CaptureStep,
  CaptureTarget,
  StartSessionRequest,
  TutorialSession,
} from '@toolsweb/shared';
import {
  isSensitiveAuthUrl,
  sanitizeTutorialText,
  sanitizeTutorialUrl,
} from '@toolsweb/shared';
import { buildCaptureInitScript } from './recorder/captureInitScript.js';
import { waitForCaptureReady } from './recorder/captureReady.js';
import { isMostlyBlankPng } from '../lib/blankScreenshot.js';
import {
  encryptAes256Gcm,
  hasEncryptionKey,
  resolveEncryptionKey,
} from '../lib/cryptoAtRest.js';
import { getEnv } from '../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CAPTURES_ROOT = path.resolve(__dirname, '../../captures');
const PROFILES_ROOT = path.resolve(__dirname, '../../data/browser-profiles');

/** Soften automation fingerprints (helps Google OAuth; not a guarantee). */
const STEALTH_INIT = `
(() => {
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  } catch (_) {}
})();
`;

type BrowserCapturePayload = {
  action: Exclude<CaptureAction, 'navigate'> | 'navigate';
  tagName: string;
  selector: string;
  text?: string;
  value?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  clickPoint?: { x: number; y: number };
  url: string;
  description: string;
  /** True when the page script delayed the real click (link/submit) for a clean shot. */
  freezeNavigation?: boolean;
  /** Exact gesture time from the browser (ISO-8601). Prefer over Node wall clock. */
  capturedAt?: string;
  /** Correlate freeze gesture with Node ack (__toolswebFreezeAck). */
  freezeId?: string;
  /** UC-0003 — from MetadataExtractor.extractElementMetadata in the page. */
  ariaLabel?: string;
  closestHeader?: string;
  formContext?: string;
  placeholder?: string;
  /** UC-0011 — primary nav click label; recorder keeps sticky menuModule. */
  menuModuleTrigger?: string;
};

type StepElementMetadata = {
  ariaLabel?: string;
  closestHeader?: string;
  formContext?: string;
  placeholder?: string;
  menuModuleTrigger?: string;
};

function metadataFromPayload(payload: BrowserCapturePayload): StepElementMetadata {
  const meta: StepElementMetadata = {};
  if (payload.ariaLabel) meta.ariaLabel = payload.ariaLabel;
  if (payload.closestHeader) meta.closestHeader = payload.closestHeader;
  if (payload.formContext) meta.formContext = payload.formContext;
  if (payload.placeholder) meta.placeholder = payload.placeholder;
  if (payload.menuModuleTrigger) meta.menuModuleTrigger = payload.menuModuleTrigger;
  return meta;
}

function isValidIsoTimestamp(value: string | undefined): value is string {
  if (!value) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

type ActiveRuntime = {
  browser: Browser | null;
  context: BrowserContext;
  page: Page;
  sessionId: string;
  capturing: boolean;
  /** While true, ignore framenavigated auto-steps (click is freezing navigation). */
  suppressNavigationSteps: boolean;
  lastUrl: string;
  navigationReady: boolean;
  /** UC-0004 — per-session flag (env default or StartSessionRequest override). */
  enableAvatarScript: boolean;
  /** Poll in-page __toolswebQueue when binding is flaky. */
  drainTimer?: ReturnType<typeof setInterval> | undefined;
};

async function openCaptureContext(input: {
  engine: CaptureBrowser;
  headless: boolean;
  persistent: boolean;
}): Promise<{ browser: Browser | null; context: BrowserContext; page: Page }> {
  const { engine, headless, persistent } = input;
  const viewport = { width: 1440, height: 900 } as const;
  const scale = 2;

  const chromiumFamily = engine === 'chromium' || engine === 'chrome';
  const chromiumOpts = chromiumFamily
    ? {
        headless,
        viewport,
        deviceScaleFactor: scale,
        locale: 'es-CL',
        args: ['--disable-blink-features=AutomationControlled'],
        ignoreDefaultArgs: ['--enable-automation'] as string[],
        ...(engine === 'chrome' ? { channel: 'chrome' as const } : {}),
      }
    : null;

  if (persistent) {
    const userDataDir = path.join(PROFILES_ROOT, engine);
    await mkdir(userDataDir, { recursive: true });

    let context: BrowserContext;
    if (chromiumFamily && chromiumOpts) {
      context = await chromium.launchPersistentContext(userDataDir, chromiumOpts);
    } else if (engine === 'firefox') {
      context = await firefox.launchPersistentContext(userDataDir, {
        headless,
        viewport,
        deviceScaleFactor: scale,
        locale: 'es-CL',
      });
    } else {
      context = await webkit.launchPersistentContext(userDataDir, {
        headless,
        viewport,
        deviceScaleFactor: scale,
        locale: 'es-CL',
      });
    }

    const page = context.pages()[0] ?? (await context.newPage());
    return { browser: context.browser(), context, page };
  }

  // Ephemeral (fresh profile each time — Google often blocks OAuth)
  let browser: Browser;
  if (chromiumFamily && chromiumOpts) {
    browser = await chromium.launch({
      headless: chromiumOpts.headless,
      args: chromiumOpts.args,
      ignoreDefaultArgs: chromiumOpts.ignoreDefaultArgs,
      ...(engine === 'chrome' ? { channel: 'chrome' as const } : {}),
    });
  } else if (engine === 'firefox') {
    browser = await firefox.launch({ headless });
  } else {
    browser = await webkit.launch({ headless });
  }

  const context = await browser.newContext({ viewport, locale: 'es-CL', deviceScaleFactor: scale });
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Playwright-backed recorder: launches a browser, injects DOM listeners,
 * highlights targets, screenshots, and builds CaptureStep objects.
 *
 * Prefers a persistent profile so Google/OAuth sessions survive across recordings.
 */
export class RecorderService {
  private sessions = new Map<string, TutorialSession>();
  private activeSessionId: string | null = null;
  private runtime: ActiveRuntime | null = null;
  private queue: Promise<void> = Promise.resolve();
  /** Called when stop is requested from the in-browser floating control. */
  private onStoppedFromBrowser: ((session: TutorialSession) => Promise<void>) | null = null;
  /** Survives after stop so finalize/avatar can read the session flag. */
  private avatarFlags = new Map<string, boolean>();
  /** UC-0011 sticky main-menu module per live recording session. */
  private menuModuleBySession = new Map<string, string>();
  /** Deduplicate binding + queue deliveries of the same gesture. */
  private recentGestureKeys = new Map<string, number>();

  setOnStoppedFromBrowser(handler: (session: TutorialSession) => Promise<void>): void {
    this.onStoppedFromBrowser = handler;
  }

  async start(input: StartSessionRequest): Promise<TutorialSession> {
    if (this.activeSessionId) {
      const pageClosed = !this.runtime?.page || this.runtime.page.isClosed();
      if (pageClosed) {
        await this.forceStop();
      } else {
        throw new Error(`Recording already active: ${this.activeSessionId}`);
      }
    }

    const session: TutorialSession = {
      id: randomUUID(),
      title: input.title ?? `Tutorial — ${new URL(input.url).hostname}`,
      createdAt: new Date().toISOString(),
      steps: [],
    };

    await mkdir(path.join(CAPTURES_ROOT, session.id), { recursive: true });

    const engine = input.browser ?? 'chrome';
    // freshLogin forces an ephemeral browser so cookies from prior recordings are not reused.
    const persistent = input.freshLogin ? false : (input.persistentProfile ?? true);

    let opened: { browser: Browser | null; context: BrowserContext; page: Page };
    try {
      opened = await openCaptureContext({
        engine,
        headless: input.headless ?? false,
        persistent,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (engine === 'chrome' && /channel|chrome|executable/i.test(msg)) {
        throw new Error(
          `No se pudo abrir Google Chrome instalado (${msg}). Elige Chromium o instala Chrome.`
        );
      }
      throw err;
    }

    const { browser, context, page } = opened;

    const enableAvatarScript =
      input.enableAvatarScript ?? getEnv().enableAvatarScript;

    this.sessions.set(session.id, session);
    this.avatarFlags.set(session.id, enableAvatarScript);
    this.menuModuleBySession.delete(session.id);
    this.activeSessionId = session.id;
    this.runtime = {
      browser,
      context,
      page,
      sessionId: session.id,
      capturing: false,
      suppressNavigationSteps: false,
      lastUrl: input.url,
      navigationReady: false,
      enableAvatarScript,
    };

    await context.addInitScript({ content: STEALTH_INIT });
    const captureScript = buildCaptureInitScript({
      enableAvatarScript,
    });
    await context.addInitScript({ content: captureScript });

    // Binding on context survives navigations (page.exposeFunction was dropping clicks).
    await context.exposeBinding(
      '__toolswebCapture',
      async (_source, raw: unknown) => {
        const payload = raw as BrowserCapturePayload;
        const work = () => this.handleBrowserEvent(payload);
        // Freeze must await the shot before replayClick; everything else is queued.
        if (payload?.freezeNavigation === true) {
          await this.enqueue(work);
          return { ok: true };
        }
        void this.enqueue(work);
        return { ok: true, queued: true };
      }
    );

    // Persistent context may already have pages; ensure init on current page too.
    await page.addInitScript({ content: STEALTH_INIT });
    await page.addInitScript({ content: captureScript });

    page.on('framenavigated', (frame) => {
      if (frame !== page.mainFrame()) return;
      const runtime = this.runtime;
      if (!runtime || runtime.sessionId !== session.id || !runtime.navigationReady) return;

      // Re-assert listeners after every document load (SPA hard-nav / multi-page sites).
      void this.ensureCaptureInstalled(page);

      if (runtime.suppressNavigationSteps) return;
      const url = frame.url();
      if (!url || url === 'about:blank') return;
      if (url === runtime.lastUrl) return;
      runtime.lastUrl = url;
      const capturedAt = new Date().toISOString();
      const authScreen = isSensitiveAuthUrl(url);
      void this.enqueue(async () => {
        await this.ensureCaptureInstalled(page);
        let hostname = url;
        try {
          hostname = new URL(url).hostname;
        } catch {
          /* keep raw */
        }
        await this.recordStep({
          action: 'navigate',
          url,
          description: authScreen
            ? `Sign-in screen (${hostname})`
            : `Navigate to ${url}`,
          target: {
            tagName: 'document',
            selector: 'document',
            text: url,
          },
          capturedAt,
        });
      });
    });

    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    this.runtime.lastUrl = page.url();

    await this.recordStep({
      action: 'navigate',
      url: page.url(),
      description: `Open ${page.url()}`,
      target: {
        tagName: 'document',
        selector: 'document',
        text: page.url(),
      },
      capturedAt: new Date().toISOString(),
    });

    await this.ensureCaptureInstalled(page);
    this.runtime.navigationReady = true;
    this.startQueueDrain(page);

    return session;
  }

  /** Poll in-page queue so gestures survive when exposeBinding is flaky. */
  private startQueueDrain(page: Page): void {
    const runtime = this.runtime;
    if (!runtime) return;
    if (runtime.drainTimer) clearInterval(runtime.drainTimer);
    const drainMs = getEnv().captureQueueDrainMs;
    runtime.drainTimer = setInterval(() => {
      void this.drainCaptureQueue(page);
    }, drainMs);
  }

  private async drainCaptureQueue(page: Page): Promise<void> {
    const runtime = this.runtime;
    if (!runtime || !this.activeSessionId || page.isClosed()) return;
    if (runtime.sessionId !== this.activeSessionId) return;
    try {
      const batch = await page.evaluate(() => {
        const w = window as Window & { __toolswebQueue?: unknown[] };
        const q = Array.isArray(w.__toolswebQueue) ? w.__toolswebQueue.splice(0) : [];
        return q as BrowserCapturePayload[];
      });
      for (const payload of batch) {
        if (!payload || typeof payload !== 'object') continue;
        void this.enqueue(() => this.handleBrowserEvent(payload));
      }
    } catch {
      /* page mid-navigation */
    }
  }

  /** Inject stealth + capture listeners into the live page document. */
  private async ensureCaptureInstalled(page: Page): Promise<void> {
    const runtime = this.runtime;
    if (!runtime || page.isClosed()) return;
    try {
      await page.evaluate(STEALTH_INIT);
      await page.evaluate(() => {
        const w = window as Window & {
          __toolswebForceReinstall?: boolean;
          __toolswebInstalled?: boolean;
          __toolswebListenersOk?: boolean;
        };
        w.__toolswebForceReinstall = true;
        w.__toolswebInstalled = false;
        w.__toolswebListenersOk = false;
      });
      await page.evaluate(
        buildCaptureInitScript({
          enableAvatarScript: runtime.enableAvatarScript,
        })
      );
      const ok = await page.evaluate(() => {
        const w = window as Window & {
          __toolswebCapture?: unknown;
          __toolswebInstalled?: boolean;
          __toolswebListenersOk?: boolean;
          __toolswebQueue?: unknown[];
        };
        return {
          installed: w.__toolswebInstalled === true,
          listenersOk: w.__toolswebListenersOk === true,
          hasBinding: typeof w.__toolswebCapture === 'function',
          queueReady: Array.isArray(w.__toolswebQueue),
        };
      });
      if (!ok.listenersOk || !ok.queueReady) {
        console.warn('[RecorderService] capture inject incomplete', ok);
      }
    } catch (err) {
      console.warn('[RecorderService] ensureCaptureInstalled failed', err);
    }
  }

  async stop(sessionId: string): Promise<TutorialSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (this.activeSessionId !== sessionId) {
      throw new Error(`Session ${sessionId} is not the active recording`);
    }

    await this.queue;
    await this.teardownRuntime();
    return session;
  }

  /** Stop whatever is active (orphan recovery). */
  async forceStop(): Promise<TutorialSession | null> {
    const id = this.activeSessionId;
    if (!id) {
      await this.teardownRuntime();
      return null;
    }
    try {
      return await this.stop(id);
    } catch {
      await this.teardownRuntime();
      return this.sessions.get(id) ?? null;
    }
  }

  get(sessionId: string): TutorialSession | undefined {
    return this.sessions.get(sessionId);
  }

  /** True only while a browser recording is active (not merely cached in memory). */
  isRecording(sessionId?: string): boolean {
    if (!this.activeSessionId || !this.runtime) return false;
    if (sessionId) return this.activeSessionId === sessionId;
    return true;
  }

  getActiveSessionId(): string | null {
    return this.isRecording() ? this.activeSessionId : null;
  }

  getActiveSession(): TutorialSession | null {
    const id = this.getActiveSessionId();
    if (!id) return null;
    return this.sessions.get(id) ?? null;
  }

  /** Whether this session captured metadata / should run avatar LLM on stop. */
  isAvatarScriptEnabled(sessionId: string): boolean {
    return this.avatarFlags.get(sessionId) ?? getEnv().enableAvatarScript;
  }

  private async teardownRuntime(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) {
      this.activeSessionId = null;
      return;
    }
    if (runtime.drainTimer) {
      clearInterval(runtime.drainTimer);
      runtime.drainTimer = undefined;
    }
    try {
      if (!runtime.page.isClosed()) {
        await this.drainCaptureQueue(runtime.page);
      }
    } catch {
      /* ignore */
    }
    this.activeSessionId = null;
    this.runtime = null;
    try {
      await runtime.context.close();
    } catch {
      /* ignore */
    }
    if (runtime.browser?.isConnected()) {
      try {
        await runtime.browser.close();
      } catch {
        /* ignore */
      }
    }
  }

  private gestureDedupeKey(payload: BrowserCapturePayload): string {
    return [
      payload.capturedAt ?? '',
      payload.action,
      payload.selector ?? '',
      payload.description ?? '',
      payload.freezeId ?? '',
    ].join('|');
  }

  private shouldSkipDuplicateGesture(payload: BrowserCapturePayload): boolean {
    const key = this.gestureDedupeKey(payload);
    const now = Date.now();
    const prev = this.recentGestureKeys.get(key);
    if (prev !== undefined && now - prev < 2500) return true;
    this.recentGestureKeys.set(key, now);
    // Opportunistic prune
    if (this.recentGestureKeys.size > 200) {
      for (const [k, t] of this.recentGestureKeys) {
        if (now - t > 5000) this.recentGestureKeys.delete(k);
      }
    }
    return false;
  }

  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch((err) => {
      console.error('[RecorderService]', err);
    });
    return this.queue;
  }

  private async handleBrowserEvent(payload: BrowserCapturePayload): Promise<void> {
    const runtime = this.runtime;
    if (!runtime || !this.activeSessionId) return;
    if (this.shouldSkipDuplicateGesture(payload)) return;

    const target: CaptureTarget = {
      tagName: payload.tagName || 'unknown',
      selector: payload.selector || 'unknown',
      ...(payload.text !== undefined ? { text: payload.text } : {}),
      ...(payload.boundingBox !== undefined ? { boundingBox: payload.boundingBox } : {}),
      ...(payload.clickPoint !== undefined ? { clickPoint: payload.clickPoint } : {}),
    };

    const freezeNav = payload.action === 'click' && payload.freezeNavigation === true;
    if (freezeNav) runtime.suppressNavigationSteps = true;
    try {
      const metadata = runtime.enableAvatarScript
        ? metadataFromPayload(payload)
        : undefined;
      await this.recordStep({
        action: payload.action === 'navigate' ? 'navigate' : payload.action,
        url: payload.url || runtime.page.url(),
        description: payload.description || `${payload.action} on ${target.selector}`,
        target,
        ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
        ...(payload.capturedAt ? { capturedAt: payload.capturedAt } : {}),
      });
    } finally {
      if (payload.freezeId) {
        try {
          if (!runtime.page.isClosed()) {
            await runtime.page.evaluate((id) => {
              const w = window as Window & { __toolswebFreezeAck?: string };
              w.__toolswebFreezeAck = id;
            }, payload.freezeId);
          }
        } catch {
          /* ignore */
        }
      }
      if (freezeNav) {
        // Allow the replayed click to create a navigate step afterwards.
        runtime.suppressNavigationSteps = false;
        runtime.lastUrl = runtime.page.url();
      }
    }
  }

  private async recordStep(input: {
    action: CaptureAction;
    url: string;
    description: string;
    target: CaptureTarget;
    metadata?: StepElementMetadata;
    /** Gesture time from browser; falls back to enqueue time. */
    capturedAt?: string;
  }): Promise<CaptureStep | null> {
    const runtime = this.runtime;
    const sessionId = this.activeSessionId;
    if (!runtime || !sessionId) return null;

    const session = this.sessions.get(sessionId);
    if (!session) return null;

    runtime.capturing = true;
    try {
      const isInteraction =
        input.action === 'click' || input.action === 'input' || input.action === 'select';

      // Always have a ring target for mouse gestures (listbox may unmount before shot).
      if (isInteraction && !input.target.boundingBox && input.target.clickPoint) {
        const { x, y } = input.target.clickPoint;
        input.target.boundingBox = {
          x: Math.max(0, x - 28),
          y: Math.max(0, y - 28),
          width: 56,
          height: 56,
        };
      }
      if (
        isInteraction &&
        input.target.boundingBox &&
        !input.target.clickPoint &&
        (input.action === 'click' || input.action === 'select')
      ) {
        const box = input.target.boundingBox;
        input.target.clickPoint = {
          x: box.x + box.width / 2,
          y: box.y + Math.min(24, box.height / 2),
        };
      }

      // Paint highlight FIRST on the current view (pre-navigation), then shot quickly.
      if (input.target.boundingBox && isInteraction) {
        try {
          await runtime.page.evaluate(
            (p) => {
              const w = window as Window & {
                __toolswebPaintHighlight?: (x: unknown) => void;
              };
              w.__toolswebPaintHighlight?.(p);
            },
            {
              action: input.action,
              boundingBox: input.target.boundingBox,
              clickPoint: input.target.clickPoint ?? null,
            }
          );
        } catch {
          /* page may be mid-navigation */
        }
      }

      const authNavigate =
        input.action === 'navigate' && isSensitiveAuthUrl(input.url);
      const captureEnv = getEnv();

      // Interaction: instant settle (no networkidle — that waited for the NEXT screen).
      // Navigate: full ready wait; OAuth hosts get a longer settle so login UI paints.
      await waitForCaptureReady(runtime.page, {
        timeoutMs: isInteraction
          ? 200
          : authNavigate
            ? captureEnv.captureAuthNavigateTimeoutMs
            : 5000,
        instant: isInteraction,
      });

      if (input.target.boundingBox && isInteraction) {
        try {
          // Re-assert highlight in case settle cleared paint.
          await runtime.page.evaluate(
            (p) => {
              const w = window as Window & {
                __toolswebPaintHighlight?: (x: unknown) => void;
              };
              w.__toolswebPaintHighlight?.(p);
            },
            {
              action: input.action,
              boundingBox: input.target.boundingBox,
              clickPoint: input.target.clickPoint ?? null,
            }
          );
          // Hold ring+cursor long enough to appear in the PNG.
          await new Promise((r) =>
            setTimeout(r, captureEnv.captureHighlightHoldMs)
          );
        } catch {
          /* ignore */
        }
      } else if (!isInteraction) {
        await new Promise((r) => setTimeout(r, 30));
      }

      const png = await runtime.page.screenshot({
        type: 'png',
        fullPage: false,
        animations: 'allow',
      });

      // Clear only after the shot — browser emit must not clear mid-queue (UC-0002).
      try {
        await runtime.page.evaluate(() => {
          const w = window as Window & { __toolswebClearHighlight?: () => void };
          w.__toolswebClearHighlight?.();
        });
      } catch {
        /* ignore */
      }

      // UC-0002: blank-skip only navigate — keep click/input/select so option flows stay visible.
      // Never skip OAuth / sign-in screens (Google login loaders can look mostly white).
      if (
        input.action === 'navigate' &&
        !authNavigate &&
        isMostlyBlankPng(png, 0.9)
      ) {
        console.warn(
          `[RecorderService] Skipping blank/near-empty capture (navigate): ${input.description}`
        );
        return null;
      }

      const stepNumber = session.steps.length + 1;
      const baseName = `step-${String(stepNumber).padStart(3, '0')}.png`;
      const screenshotPath = path.join(
        CAPTURES_ROOT,
        sessionId,
        hasEncryptionKey() ? `${baseName}.enc` : baseName
      );
      if (hasEncryptionKey()) {
        await writeFile(screenshotPath, encryptAes256Gcm(png, resolveEncryptionKey()));
      } else {
        await writeFile(screenshotPath, png);
      }

      const safeTarget: CaptureTarget = {
        ...input.target,
        ...(input.target.text !== undefined
          ? { text: sanitizeTutorialText(input.target.text) }
          : {}),
      };

      const meta = input.metadata ?? {};
      if (meta.menuModuleTrigger) {
        this.menuModuleBySession.set(
          sessionId,
          sanitizeTutorialText(meta.menuModuleTrigger)
        );
      }
      const stickyModule = this.menuModuleBySession.get(sessionId);
      const timestamp = isValidIsoTimestamp(input.capturedAt)
        ? input.capturedAt
        : new Date().toISOString();
      const step: CaptureStep = {
        id: randomUUID(),
        stepNumber,
        timestamp,
        url: sanitizeTutorialUrl(input.url),
        action: input.action,
        target: safeTarget,
        screenshotPath,
        imageBase64: png.toString('base64'),
        description: sanitizeTutorialText(input.description),
        ...(meta.ariaLabel !== undefined
          ? { ariaLabel: sanitizeTutorialText(meta.ariaLabel) }
          : {}),
        ...(meta.closestHeader !== undefined
          ? { closestHeader: sanitizeTutorialText(meta.closestHeader) }
          : {}),
        ...(meta.formContext !== undefined
          ? { formContext: sanitizeTutorialText(meta.formContext) }
          : {}),
        ...(meta.placeholder !== undefined
          ? { placeholder: sanitizeTutorialText(meta.placeholder) }
          : {}),
        ...(stickyModule ? { menuModule: stickyModule } : {}),
      };

      session.steps.push(step);
      return step;
    } finally {
      try {
        if (!runtime.page.isClosed()) {
          await runtime.page.evaluate(() => {
            const w = window as Window & {
              __toolswebCapturing?: boolean;
              __toolswebClearHighlight?: () => void;
            };
            w.__toolswebCapturing = false;
            w.__toolswebClearHighlight?.();
          });
        }
      } catch {
        /* ignore */
      }
      runtime.capturing = false;
    }
  }
}
