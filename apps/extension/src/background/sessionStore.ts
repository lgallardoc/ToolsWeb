import type {
  ActionSession,
  ContentActionPayload,
  ExtensionMessage,
  ExtensionResponse,
  TutorialAction,
} from '@toolsweb/shared';
import {
  ActionSessionSchema,
  TutorialActionSchema,
  parseExtensionMessage,
} from '@toolsweb/shared';

/**
 * In-memory SessionRepository for the extension MVP (Prompt Maestro §13).
 * Not coupled to browser.storage yet — swap adapter later.
 */
export class SessionStore {
  private session: ActionSession | null = null;

  getCurrent(): ActionSession | null {
    return this.session;
  }

  start(input: {
    sessionId: string;
    name: string;
    initialUrl: string;
  }): ActionSession {
    this.session = ActionSessionSchema.parse({
      id: input.sessionId,
      name: input.name,
      status: 'recording',
      startedAt: Date.now(),
      initialUrl: input.initialUrl,
      actions: [],
    });
    return this.session;
  }

  pause(): ActionSession | null {
    if (!this.session || this.session.status !== 'recording') return this.session;
    this.session = { ...this.session, status: 'paused' };
    return this.session;
  }

  resume(): ActionSession | null {
    if (!this.session || this.session.status !== 'paused') return this.session;
    this.session = { ...this.session, status: 'recording' };
    return this.session;
  }

  stop(): ActionSession | null {
    if (!this.session) return null;
    this.session = {
      ...this.session,
      status: 'completed',
      endedAt: Date.now(),
    };
    return this.session;
  }

  appendAction(payload: ContentActionPayload): TutorialAction | null {
    if (!this.session || this.session.status !== 'recording') return null;
    const action = TutorialActionSchema.parse({
      ...payload,
      id: crypto.randomUUID(),
      sessionId: this.session.id,
      sequence: this.session.actions.length + 1,
    });
    this.session = {
      ...this.session,
      actions: [...this.session.actions, action],
    };
    return action;
  }

  exportJson(): string | null {
    if (!this.session) return null;
    return JSON.stringify(this.session, null, 2);
  }

  clear(): void {
    this.session = null;
  }
}

export function stateFromSession(session: ActionSession | null): ExtensionResponse['state'] {
  return {
    status: session?.status ?? 'idle',
    sessionId: session?.id ?? null,
  };
}

export async function handleExtensionMessage(
  store: SessionStore,
  raw: unknown,
  broadcast: (msg: ExtensionMessage) => Promise<void>
): Promise<ExtensionResponse> {
  let msg: ExtensionMessage;
  try {
    msg = parseExtensionMessage(raw);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'invalid message',
    };
  }

  switch (msg.type) {
    case 'START_RECORDING': {
      const payload = msg.payload ?? {};
      const sessionId = payload.sessionId ?? crypto.randomUUID();
      const session = store.start({
        sessionId,
        name: payload.name ?? `Session ${new Date().toISOString()}`,
        initialUrl: payload.initialUrl ?? 'https://invalid.local/',
      });
      await broadcast({
        type: 'RECORDING_STATE',
        payload: { status: 'recording', sessionId: session.id },
      });
      return { ok: true, session, state: stateFromSession(session) };
    }
    case 'PAUSE_RECORDING': {
      const session = store.pause();
      await broadcast({
        type: 'RECORDING_STATE',
        payload: {
          status: session?.status ?? 'idle',
          sessionId: session?.id ?? null,
        },
      });
      return { ok: true, session: session ?? undefined, state: stateFromSession(session) };
    }
    case 'RESUME_RECORDING': {
      const session = store.resume();
      await broadcast({
        type: 'RECORDING_STATE',
        payload: {
          status: session?.status ?? 'idle',
          sessionId: session?.id ?? null,
        },
      });
      return { ok: true, session: session ?? undefined, state: stateFromSession(session) };
    }
    case 'STOP_RECORDING': {
      const session = store.stop();
      await broadcast({
        type: 'RECORDING_STATE',
        payload: {
          status: session?.status ?? 'idle',
          sessionId: session?.id ?? null,
        },
      });
      return { ok: true, session: session ?? undefined, state: stateFromSession(session) };
    }
    case 'RECORDED_ACTION': {
      const action = store.appendAction(msg.payload);
      if (!action) {
        return { ok: false, error: 'not recording', state: stateFromSession(store.getCurrent()) };
      }
      const session = store.getCurrent();
      return { ok: true, session: session ?? undefined, state: stateFromSession(session) };
    }
    case 'GET_SESSION': {
      const session = store.getCurrent();
      return { ok: true, session: session ?? undefined, state: stateFromSession(session) };
    }
    case 'EXPORT_SESSION': {
      const exportJson = store.exportJson();
      return {
        ok: !!exportJson,
        exportJson: exportJson ?? undefined,
        session: store.getCurrent() ?? undefined,
        state: stateFromSession(store.getCurrent()),
        ...(exportJson ? {} : { error: 'no session' }),
      };
    }
    case 'SESSION_UPDATED':
    case 'RECORDING_STATE':
      return { ok: true, state: stateFromSession(store.getCurrent()) };
    default:
      return { ok: false, error: 'unhandled' };
  }
}
