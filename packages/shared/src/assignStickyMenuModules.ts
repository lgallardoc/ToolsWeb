import type { CaptureStep } from './types/tutorial.js';

const MAX_MODULE_LEN = 80;

function cleanModuleLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  if (/^\[?REDACTED\]?$/i.test(t)) return undefined;
  // Strip common description prefixes
  t = t.replace(/^(Click on|Select in|Focus on)\s+[\w-]+:\s*/i, '');
  t = t.replace(/^Open menu:\s*/i, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length < 2) return undefined;
  if (/^\[?REDACTED\]?$/i.test(t)) return undefined;
  if (t.length > MAX_MODULE_LEN) t = t.slice(0, MAX_MODULE_LEN);
  // Ignore ultra-noisy chrome dumps
  if (/with-scroll-bars-hidden|overflow:/i.test(t) && t.length > 40) {
    return undefined;
  }
  return t;
}

/**
 * Infer a primary-nav module label when a click precedes navigation (UC-0011 legacy).
 */
export function inferNavModuleFromClickNavigate(
  step: CaptureStep,
  next: CaptureStep | undefined
): string | undefined {
  if (step.action !== 'click') return undefined;
  if (!next || next.action !== 'navigate') return undefined;
  const desc = step.description ?? '';
  if (/^Open menu:/i.test(desc)) return undefined;
  // Prefer description over target.text: sanitized sessions often redact target.text.
  return (
    cleanModuleLabel(desc) ??
    cleanModuleLabel(step.target.text) ??
    cleanModuleLabel(step.ariaLabel)
  );
}

/**
 * Assign sticky `menuModule` + 1-based `menuModuleIndex` (interstitial Paso N).
 * Does not delete/merge capture steps — indices are independent of stepNumber (UC-0011).
 */
export function assignStickyMenuModules(steps: CaptureStep[]): CaptureStep[] {
  let current: string | undefined;
  let moduleIndex = 0;
  return steps.map((step, index) => {
    const candidate =
      cleanModuleLabel(step.menuModule) ??
      inferNavModuleFromClickNavigate(step, steps[index + 1]);

    if (candidate && candidate !== current) {
      current = candidate;
      moduleIndex += 1;
    }

    if (!current) return step;
    return {
      ...step,
      menuModule: current,
      menuModuleIndex: moduleIndex,
    };
  });
}
