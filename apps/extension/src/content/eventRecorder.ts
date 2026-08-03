import type { ContentActionPayload, TutorialActionType } from '@toolsweb/shared';
import {
  analyzeElement,
  currentViewport,
  eventElement,
  isRecorderUi,
  readFieldValue,
} from './semantic.js';

export type EventRecorderOptions = {
  onAction: (action: ContentActionPayload) => void;
};

/**
 * Content-script EventRecorder (Prompt Maestro §5).
 * Capture-phase delegation; input debounced; skips recorder UI chrome.
 */
export class EventRecorder {
  private active = false;
  private inputTimer: ReturnType<typeof setTimeout> | null = null;
  private abort: AbortController | null = null;
  private readonly onAction: (action: ContentActionPayload) => void;

  constructor(options: EventRecorderOptions) {
    this.onAction = options.onAction;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.abort = new AbortController();
    const opts: AddEventListenerOptions = {
      capture: true,
      signal: this.abort.signal,
    };
    document.addEventListener('click', this.onClick, opts);
    document.addEventListener('dblclick', this.onDblClick, opts);
    document.addEventListener('input', this.onInput, opts);
    document.addEventListener('change', this.onChange, opts);
    document.addEventListener('submit', this.onSubmit, opts);
  }

  stop(): void {
    this.active = false;
    if (this.inputTimer) clearTimeout(this.inputTimer);
    this.inputTimer = null;
    this.abort?.abort();
    this.abort = null;
  }

  get isActive(): boolean {
    return this.active;
  }

  private emit(
    type: TutorialActionType,
    el: Element,
    extra?: Partial<ContentActionPayload>
  ): void {
    if (!this.active) return;
    if (isRecorderUi(el)) return;
    const target = analyzeElement(el);
    const field = readFieldValue(el);
    this.onAction({
      type,
      timestamp: Date.now(),
      url: location.href,
      pageTitle: document.title || '',
      target,
      sensitive: field.sensitive,
      viewport: currentViewport(),
      metadata: { source: 'content-script' },
      ...(field.value !== undefined ? { value: field.value } : {}),
      ...extra,
    });
  }

  private readonly onClick = (event: MouseEvent): void => {
    if (event.button !== 0) return;
    const el = eventElement(event);
    if (!el) return;
    if (el.closest('select, option')) return;
    this.emit('click', el);
  };

  private readonly onDblClick = (event: MouseEvent): void => {
    const el = eventElement(event);
    if (!el) return;
    this.emit('doubleClick', el);
  };

  private readonly onInput = (event: Event): void => {
    const el = eventElement(event);
    if (!el) return;
    const tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
    if (this.inputTimer) clearTimeout(this.inputTimer);
    this.inputTimer = setTimeout(() => {
      this.emit('input', el);
    }, 350);
  };

  private readonly onChange = (event: Event): void => {
    const el = eventElement(event);
    if (!el) return;
    const tag = el.tagName;
    if (tag === 'SELECT') {
      this.emit('change', el);
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (this.inputTimer) clearTimeout(this.inputTimer);
      this.emit('change', el);
    }
  };

  private readonly onSubmit = (event: Event): void => {
    const el = eventElement(event);
    if (!el) return;
    const form = el.closest('form') ?? el;
    this.emit('submit', form);
  };
}
