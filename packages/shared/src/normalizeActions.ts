import type { TutorialAction, TutorialActionType } from './types/action.js';

const DEDUPE_WINDOW_MS = 500;
const CLICK_NAV_WINDOW_MS = 2500;

function actionKey(a: TutorialAction): string {
  const sel =
    a.target?.locatorCandidates?.[0]?.value ??
    a.target?.accessibleName ??
    a.target?.text ??
    '';
  return [a.type, a.url, sel, a.value ?? ''].join('|');
}

/**
 * Deduplicate identical actions inside a short time window (Prompt Maestro §17).
 */
export function dedupeActions(actions: TutorialAction[]): TutorialAction[] {
  const out: TutorialAction[] = [];
  for (const action of actions) {
    const prev = out[out.length - 1];
    if (
      prev &&
      actionKey(prev) === actionKey(action) &&
      action.timestamp - prev.timestamp <= DEDUPE_WINDOW_MS
    ) {
      continue;
    }
    out.push(action);
  }
  return out;
}

function fieldKey(a: TutorialAction): string {
  const css =
    a.target?.locatorCandidates?.find((c) => c.strategy === 'css')?.value ?? '';
  return [a.url, css, a.target?.name ?? '', a.target?.placeholder ?? ''].join('|');
}

/**
 * Collapse consecutive input/change on the same field into the last value.
 */
export function groupFieldEdits(actions: TutorialAction[]): TutorialAction[] {
  const out: TutorialAction[] = [];
  for (const action of actions) {
    const prev = out[out.length - 1];
    const editable =
      (action.type === 'input' || action.type === 'change') &&
      prev &&
      (prev.type === 'input' || prev.type === 'change') &&
      fieldKey(prev) === fieldKey(action);

    if (editable && prev) {
      out[out.length - 1] = {
        ...action,
        sequence: prev.sequence,
        previousValue: prev.previousValue ?? prev.value,
        id: prev.id,
      };
      continue;
    }
    out.push(action);
  }
  return out;
}

/**
 * When a click is immediately followed by navigation, keep the click (with dest URL)
 * and drop the bare navigate step.
 */
export function collapseClickNavigation(actions: TutorialAction[]): TutorialAction[] {
  const out: TutorialAction[] = [];
  for (let i = 0; i < actions.length; i += 1) {
    const cur = actions[i];
    if (!cur) continue;
    const next = actions[i + 1];
    if (
      cur.type === 'click' &&
      next &&
      next.type === 'navigation' &&
      next.timestamp - cur.timestamp <= CLICK_NAV_WINDOW_MS
    ) {
      out.push({
        ...cur,
        metadata: {
          ...cur.metadata,
          navigatedTo: next.url,
        },
      });
      i += 1;
      continue;
    }
    out.push(cur);
  }
  return out;
}

function resequence(actions: TutorialAction[]): TutorialAction[] {
  return actions.map((a, i) => ({ ...a, sequence: i + 1 }));
}

/**
 * Pipeline: raw → dedupe → group field edits → collapse click+nav → resequence.
 */
export function normalizeActions(actions: TutorialAction[]): TutorialAction[] {
  const deduped = dedupeActions(actions);
  const grouped = groupFieldEdits(deduped);
  const collapsed = collapseClickNavigation(grouped);
  return resequence(collapsed);
}

export function isInteractiveType(type: TutorialActionType): boolean {
  return type !== 'navigation';
}
