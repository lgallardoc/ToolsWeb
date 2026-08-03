/**
 * Fixture-based Zod validation for Prompt Maestro contracts (ADR-0005).
 * Run: npx tsx packages/shared/scripts/assert-contracts.mts
 */
import { randomUUID } from 'node:crypto';
import {
  ActionSessionSchema,
  LocatorCandidateSchema,
  SemanticTargetSchema,
  TutorialActionSchema,
  ViewportStateSchema,
  captureStepToTutorialAction,
} from '../src/types/action.ts';
import { CaptureStepSchema } from '../src/types/tutorial.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const viewport = ViewportStateSchema.parse({
  width: 1440,
  height: 900,
  devicePixelRatio: 2,
  scrollX: 0,
  scrollY: 100,
});

const locators = [
  LocatorCandidateSchema.parse({
    strategy: 'testId',
    value: 'submit-btn',
    score: 95,
  }),
  LocatorCandidateSchema.parse({
    strategy: 'css',
    value: 'button.primary',
    score: 35,
  }),
];

const target = SemanticTargetSchema.parse({
  tagName: 'button',
  role: 'button',
  accessibleName: 'Guardar',
  ariaLabel: 'Guardar',
  locatorCandidates: locators,
  boundingBox: {
    x: 10,
    y: 20,
    width: 120,
    height: 40,
    top: 20,
    left: 10,
    right: 130,
    bottom: 60,
  },
});

const sessionId = randomUUID();
const action = TutorialActionSchema.parse({
  id: randomUUID(),
  sessionId,
  sequence: 1,
  type: 'click',
  timestamp: Date.now(),
  url: 'https://example.com/form',
  pageTitle: 'Formulario',
  target,
  sensitive: false,
  viewport,
  metadata: { source: 'content-script', browser: 'chromium' },
  narrative: 'Haz clic en “Guardar”.',
});

const session = ActionSessionSchema.parse({
  id: sessionId,
  name: 'Alta de usuario',
  status: 'completed',
  startedAt: Date.now() - 10_000,
  endedAt: Date.now(),
  initialUrl: 'https://example.com/',
  actions: [action],
});

assert(session.actions.length === 1, 'session should hold one action');

const bridgeStep = CaptureStepSchema.parse({
  id: randomUUID(),
  stepNumber: 2,
  timestamp: new Date().toISOString(),
  url: 'https://example.com/login',
  action: 'input',
  target: {
    tagName: 'input',
    selector: 'input[type="password"]',
    text: '••••••',
    boundingBox: { x: 0, y: 0, width: 200, height: 32 },
  },
  description: 'Type into password: contraseña',
  placeholder: 'Contraseña',
});

const mapped = captureStepToTutorialAction(bridgeStep, sessionId, {
  browser: 'chrome',
});
assert(mapped.type === 'input', 'mapped type');
assert(mapped.sensitive === true, 'password should mark sensitive');
assert(mapped.metadata.source === 'playwright-bridge', 'bridge source');
assert(
  (mapped.target?.locatorCandidates?.length ?? 0) >= 1,
  'locators from selector'
);

console.log('assert-contracts: OK', {
  actionTypesSample: action.type,
  mappedSensitive: mapped.sensitive,
  sessionActions: session.actions.length,
});
