import { InjectionToken, inject, injectable } from "@needle-di/core";
import { LOG_COMPONENT } from "@/core/ports/logger.constants.ts";
import { LOGGER, type LogFields } from "@/core/ports/logger.port.ts";
import type { ConnectedFile, PairingStatus } from "@/core/ports/plugin-link.port.ts";
import type { UpgradeRejection } from "@/server/adapters/bridge/listener/upgrade-guard.ts";
import { PAIRING_CODES } from "@/server/adapters/bridge/plugin/pairing-codes.ts";
import type { BridgeSession } from "@/server/adapters/bridge/sessions/bridge-session.ts";
import {
  MAX_SESSIONS,
  MAX_WAITING,
  SESSION_LOG,
  SUPERSEDED_REASON,
} from "@/server/adapters/bridge/sessions/sessions.constants.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import { CLOSE_CODE } from "@/shared/protocol/protocol.constants.ts";

/**
 * The owner's Registry of plugin windows (S-010, S-011): the sessions, one per open file; the unpaired windows waiting
 * for a code, never listed and never asked; the bridge's own sequence; and the last plugin turned away, for the status
 * hint until a plugin connects (S-003).
 */
@injectable()
export class SessionRegistry {
  readonly #pairing;
  readonly #logger;
  readonly #sessions = new Map<string, BridgeSession>();
  readonly #waiting = new Set<object>();
  #onChange: (() => void) | null = null;
  #sequence = 0;
  #rejection: UpgradeRejection | null = null;
  #refusal: ProtocolRefusal | null = null;

  constructor(pairing = inject(PAIRING_CODES), logger = inject(LOGGER)) {
    this.#pairing = pairing;
    this.#logger = logger;
  }

  /** The next position on the bridge's sequence: connections and windows coming to the front never tie. */
  next(): number {
    this.#sequence += 1;

    return this.#sequence;
  }

  /** Calls `listener`, the owner's router, on every change of the files or of the windows waiting (S-033). */
  onChange(listener: () => void): void {
    this.#onChange = listener;
  }

  /** A session's info changed (S-012). */
  changed(): void {
    this.#onChange?.();
  }

  /** An unpaired window starts waiting for the code; false when MAX_WAITING wait already. */
  wait(window: object): boolean {
    if (this.#waiting.size >= MAX_WAITING) {
      return false;
    }

    this.#waiting.add(window);
    this.changed();

    return true;
  }

  /** It stopped waiting: paired, closed, or gone. */
  stopWaiting(window: object): void {
    if (this.#waiting.delete(window)) {
      this.changed();
    }
  }

  /** For status alone: the code while a window waits, minted by this very ask (S-020), or the pause. */
  pairing(): PairingStatus | null {
    return this.#pairing.status(this.#waiting.size);
  }

  /** Whether a window that proved its key or typed the code may become a session: under the cap, or one reconnecting. */
  admits(info: PluginInfo): boolean {
    return this.#sessions.size < MAX_SESSIONS || this.#findWindow(info.instanceId) !== undefined;
  }

  /** A new session. An older socket of the same window, half-open after sleep say, is closed 4409 and leaves now. */
  add(session: BridgeSession): void {
    const older = this.#findWindow(session.info.instanceId);

    if (older !== undefined) {
      this.#sessions.delete(older.id);
      older.close(CLOSE_CODE.superseded, SUPERSEDED_REASON);
    }

    this.#sessions.set(session.id, session);
    this.#rejection = null;
    this.#refusal = null;
    this.#logChange(SESSION_LOG.connected, session, { pluginVersion: session.info.pluginVersion });
  }

  /** A session's socket closed: it leaves, unless a newer socket of its window replaced it already. */
  remove(session: BridgeSession, code: number): void {
    if (this.#sessions.get(session.id) !== session) {
      return;
    }

    this.#sessions.delete(session.id);
    this.#logChange(SESSION_LOG.disconnected, session, { code });
  }

  /** The session a tool uses when it names no file (S-011), or null when none is connected. */
  active(): BridgeSession | null {
    return [...this.#sessions.values()].reduce<BridgeSession | null>(
      (best, session) => (best === null || session.outranks(best) ? session : best),
      null,
    );
  }

  /** The session of that id, or undefined once its socket closed (S-042). */
  find(id: string): BridgeSession | undefined {
    return this.#sessions.get(id);
  }

  /** The connected files, the active one marked. */
  files(): ConnectedFile[] {
    const active = this.active();

    return [...this.#sessions.values()].map((session) => session.file(session === active));
  }

  /** The upgrade guard refused a plugin's window (Host or Origin). */
  rejected(rejection: UpgradeRejection): void {
    this.#rejection = rejection;
  }

  /** A plugin of another protocol was turned away at hello. */
  refused(refusal: ProtocolRefusal): void {
    this.#refusal = refusal;
  }

  /** The last plugin window the upgrade guard refused since a plugin last connected. */
  rejection(): UpgradeRejection | null {
    return this.#rejection;
  }

  /** The last plugin turned away for its protocol since a plugin last connected. */
  refusal(): ProtocolRefusal | null {
    return this.#refusal;
  }

  /** A session came or left: one line with its file and the sessions there are now, then the change. */
  #logChange(
    message: string,
    session: BridgeSession,
    fields: LogFields,
  ): void {
    this.#logger.info(message, {
      component: LOG_COMPONENT.bridge,
      file: session.info.file.name,
      ...fields,
      sessions: this.#sessions.size,
    });
    this.changed();
  }

  #findWindow(instanceId: string): BridgeSession | undefined {
    return [...this.#sessions.values()].find((session) => session.info.instanceId === instanceId);
  }
}

export const SESSION_REGISTRY = new InjectionToken<SessionRegistry>("SessionRegistry");

/** A plugin turned away at hello for its protocol (S-004), kept for the status hint. */
export interface ProtocolRefusal {
  readonly protocol: number;
  /** The version its hello named, or null when it named none readable. */
  readonly pluginVersion: string | null;
}
