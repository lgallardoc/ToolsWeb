import type { LocatorCandidate, SemanticBoundingBox, SemanticTarget } from '@toolsweb/shared';
import { filterFieldValue } from '@toolsweb/shared';

const ATTR_UI = 'data-tutorial-recorder-ui';

export function isRecorderUi(el: Element | null): boolean {
  return !!(el && el.closest?.(`[${ATTR_UI}="true"]`));
}

function trimText(raw: string | null | undefined, max = 120): string | undefined {
  if (raw == null) return undefined;
  const t = String(raw).replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

function buildCssSelector(el: Element): string {
  if (el.id && !/^[0-9a-f-]{8,}$/i.test(el.id)) return `#${cssEscape(el.id)}`;
  const testId =
    el.getAttribute('data-testid') ||
    el.getAttribute('data-test') ||
    el.getAttribute('data-qa');
  if (testId) return `[data-testid="${cssEscape(testId)}"]`;
  const name = el.getAttribute('name');
  if (name) return `${el.tagName.toLowerCase()}[name="${cssEscape(name)}"]`;
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && node.nodeType === 1 && depth < 5) {
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(node) + 1;
        part += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(part);
    node = parent;
    depth += 1;
    if (node && node.tagName.toLowerCase() === 'body') break;
  }
  return parts.join(' > ');
}

function boundingBoxOf(el: Element): SemanticBoundingBox | undefined {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return undefined;
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    top: r.top,
    right: r.right,
    bottom: r.bottom,
    left: r.left,
  };
}

function findClosestHeader(el: Element): string | undefined {
  let node: Element | null = el;
  while (node) {
    let sib = node.previousElementSibling;
    while (sib) {
      if (/^H[1-6]$/i.test(sib.tagName)) {
        const t = trimText(sib.textContent);
        if (t) return t;
      }
      const inner = sib.querySelector('h1,h2,h3,h4,h5,h6');
      if (inner) {
        const t = trimText(inner.textContent);
        if (t) return t;
      }
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  return undefined;
}

function findFormContext(el: Element): string | undefined {
  const scope = el.closest('fieldset, form');
  if (!scope) return undefined;
  if (scope.tagName.toUpperCase() === 'FIELDSET') {
    const legend = scope.querySelector('legend');
    const t = trimText(legend?.textContent);
    if (t) return t;
  }
  return (
    trimText(scope.getAttribute('aria-label')) ||
    trimText(scope.getAttribute('name')) ||
    trimText(scope.id)
  );
}

function getAssociatedLabel(el: Element): string | undefined {
  const id = el.id;
  if (id) {
    const label = document.querySelector(`label[for="${cssEscape(id)}"]`);
    const t = trimText(label?.textContent);
    if (t) return t;
  }
  const wrapped = el.closest('label');
  return trimText(wrapped?.textContent);
}

function generateLocatorCandidates(el: Element): LocatorCandidate[] {
  const out: LocatorCandidate[] = [];
  const testId =
    el.getAttribute('data-testid') ||
    el.getAttribute('data-test') ||
    el.getAttribute('data-qa');
  if (testId) out.push({ strategy: 'testId', value: testId, score: 95 });
  const aria = trimText(el.getAttribute('aria-label'));
  const role = el.getAttribute('role') || el.tagName.toLowerCase();
  if (aria) out.push({ strategy: 'roleAndName', value: `${role}:${aria}`, score: 85 });
  const label = getAssociatedLabel(el);
  if (label) out.push({ strategy: 'label', value: label, score: 80 });
  const placeholder = trimText(el.getAttribute('placeholder'));
  if (placeholder) out.push({ strategy: 'placeholder', value: placeholder, score: 70 });
  if (el.id && !/^[0-9a-f-]{36}$/i.test(el.id)) {
    out.push({ strategy: 'id', value: el.id, score: 65 });
  }
  const name = el.getAttribute('name');
  if (name) out.push({ strategy: 'name', value: name, score: 60 });
  const text = trimText(el.textContent, 60);
  if (text && text.length < 40) out.push({ strategy: 'text', value: text, score: 50 });
  out.push({ strategy: 'css', value: buildCssSelector(el), score: 35 });
  return out;
}

/** Prompt Maestro analyzeElement — SemanticTarget from DOM element. */
export function analyzeElement(el: Element): SemanticTarget {
  const tagName = el.tagName.toLowerCase();
  const inputType =
    tagName === 'input' ? el.getAttribute('type') ?? 'text' : undefined;
  const ariaLabel = trimText(el.getAttribute('aria-label'));
  const label = getAssociatedLabel(el);
  const placeholder = trimText(el.getAttribute('placeholder'));
  const text = trimText(
    tagName === 'input' || tagName === 'textarea'
      ? (el as HTMLInputElement).value
      : el.textContent,
    80
  );
  const accessibleName = ariaLabel || label || placeholder || text;
  const boundingBox = boundingBoxOf(el);
  const href = tagName === 'a' ? trimText(el.getAttribute('href'), 300) : undefined;

  const target: SemanticTarget = {
    tagName,
    locatorCandidates: generateLocatorCandidates(el),
    ...(el.getAttribute('role') ? { role: el.getAttribute('role')! } : {}),
    ...(accessibleName ? { accessibleName } : {}),
    ...(text ? { text } : {}),
    ...(ariaLabel ? { ariaLabel } : {}),
    ...(label ? { label } : {}),
    ...(placeholder ? { placeholder } : {}),
    ...(trimText(el.getAttribute('title'))
      ? { title: trimText(el.getAttribute('title')) }
      : {}),
    ...(el.getAttribute('name') ? { name: el.getAttribute('name')! } : {}),
    ...(inputType ? { inputType } : {}),
    ...(findClosestHeader(el) ? { closestHeader: findClosestHeader(el) } : {}),
    ...(findFormContext(el) ? { formContext: findFormContext(el) } : {}),
    ...(el.getAttribute('data-testid')
      ? { testId: el.getAttribute('data-testid')! }
      : {}),
    ...(href ? { href } : {}),
    ...(boundingBox ? { boundingBox } : {}),
  };
  return target;
}

export function readFieldValue(el: Element): {
  value: string | undefined;
  sensitive: boolean;
} {
  const tag = el.tagName.toUpperCase();
  if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
    return { value: undefined, sensitive: false };
  }
  const input = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const raw = String(input.value ?? '');
  const label = getAssociatedLabel(el);
  const hint: {
    inputType?: string;
    name?: string;
    id?: string;
    placeholder?: string;
    ariaLabel?: string;
    label?: string;
  } = {
    ...('type' in input && input.type ? { inputType: String(input.type) } : {}),
    ...(input.getAttribute('name') ? { name: input.getAttribute('name')! } : {}),
    ...(input.id ? { id: input.id } : {}),
    ...(input.getAttribute('placeholder')
      ? { placeholder: input.getAttribute('placeholder')! }
      : {}),
    ...(input.getAttribute('aria-label')
      ? { ariaLabel: input.getAttribute('aria-label')! }
      : {}),
    ...(label ? { label } : {}),
  };
  return filterFieldValue(raw, hint);
}

export function eventElement(event: Event): Element | null {
  let t = event.target;
  if (typeof event.composedPath === 'function') {
    const path = event.composedPath();
    for (const node of path) {
      if (node instanceof Element) {
        t = node;
        break;
      }
    }
  }
  if (t instanceof Text) t = t.parentElement;
  return t instanceof Element ? t : null;
}

export function currentViewport() {
  return {
    width: window.innerWidth || 1,
    height: window.innerHeight || 1,
    devicePixelRatio: window.devicePixelRatio || 1,
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0,
  };
}
