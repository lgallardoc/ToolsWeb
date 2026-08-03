/**
 * Deterministic narration + normalize pipeline fixtures.
 * Run: npx tsx packages/shared/scripts/assert-narrative.mts
 */
import { randomUUID } from 'node:crypto';
import {
  TutorialActionSchema,
  ViewportStateSchema,
  generateDeterministicNarration,
  generateNarrativeStep,
  normalizeActions,
} from '../src/index.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const sessionId = randomUUID();
const viewport = ViewportStateSchema.parse({
  width: 1440,
  height: 900,
  devicePixelRatio: 2,
  scrollX: 0,
  scrollY: 0,
});

function action(
  partial: Record<string, unknown> & { type: string; sequence: number; timestamp: number }
) {
  return TutorialActionSchema.parse({
    id: randomUUID(),
    sessionId,
    url: 'https://example.com/app',
    pageTitle: 'App',
    sensitive: false,
    viewport,
    metadata: { source: 'content-script' },
    target: {
      tagName: 'button',
      accessibleName: 'Nuevo usuario',
      locatorCandidates: [{ strategy: 'text', value: 'Nuevo usuario', score: 80 }],
    },
    ...partial,
  });
}

const clickLine = generateNarrativeStep(
  action({ type: 'click', sequence: 1, timestamp: 1000 })
);
assert(/Haz clic/.test(clickLine) && /Nuevo usuario/.test(clickLine), clickLine);

const inputLine = generateNarrativeStep(
  action({
    type: 'input',
    sequence: 2,
    timestamp: 2000,
    target: {
      tagName: 'input',
      label: 'Correo electrónico',
      locatorCandidates: [],
    },
  })
);
assert(/Ingresa/.test(inputLine) && /Correo/.test(inputLine), inputLine);

const raw = [
  action({ type: 'click', sequence: 1, timestamp: 1000 }),
  action({ type: 'click', sequence: 2, timestamp: 1100 }), // dedupe
  action({
    type: 'input',
    sequence: 3,
    timestamp: 3000,
    value: 'a',
    target: {
      tagName: 'input',
      locatorCandidates: [{ strategy: 'css', value: '#email', score: 40 }],
    },
  }),
  action({
    type: 'input',
    sequence: 4,
    timestamp: 3200,
    value: 'ab',
    target: {
      tagName: 'input',
      locatorCandidates: [{ strategy: 'css', value: '#email', score: 40 }],
    },
  }),
  action({ type: 'click', sequence: 5, timestamp: 5000 }),
  action({
    type: 'navigation',
    sequence: 6,
    timestamp: 5200,
    url: 'https://example.com/users',
    target: {
      tagName: 'document',
      locatorCandidates: [],
    },
  }),
];

const normalized = normalizeActions(raw);
assert(normalized.length === 3, `expected 3 after normalize, got ${normalized.length}`);
assert(normalized[1]?.value === 'ab', 'last input value kept');
assert(normalized[2]?.metadata.navigatedTo === 'https://example.com/users', 'nav collapsed');

const narration = generateDeterministicNarration(raw, { title: 'Alta' });
assert(/Primero/i.test(narration.fullSpokenText), narration.fullSpokenText);
assert(/tutorial/i.test(narration.fullSpokenText), 'title preface');
assert(!/DOM|CSS|selector|Playwright/i.test(narration.fullSpokenText), 'no tech jargon');

console.log('assert-narrative: OK', {
  normalized: normalized.length,
  preview: narration.fullSpokenText.slice(0, 120),
});
