import { randomInt, timingSafeEqual } from "node:crypto";
import { inject, injectable } from "@needle-di/core";
import { CLOCK } from "@/core/ports/clock/clock.port.ts";
import { LOG_COMPONENT } from "@/core/ports/logger/logger.constants.ts";
import { LOGGER } from "@/core/ports/logger/logger.port.ts";
import type { PairingStatus } from "@/core/ports/plugin-link/plugin-link.port.ts";
import { PAIRING_REASON } from "@/shared/protocol/handshake.constants.ts";
import type { PairingReason } from "@/shared/protocol/handshake.schema.ts";
import { PAIRING_CODE_DIGITS } from "@/shared/protocol/protocol.constants.ts";
import {
  CODE_CHECK,
  PAIRING_ATTEMPTS,
  PAIRING_CODE_PAD,
  PAIRING_CODE_TTL_MS,
  PAIRING_LOCK_MS,
  PAIRING_LOG,
  PAIRING_MAX_LOCK_MS,
} from "./pairing-codes.constants.ts";
import type { ActiveCode, CodeCheck, PairingPrompt } from "./pairing-codes.types.ts";

/**
 * The one pairing code in force, for every waiting plugin window. Only status mints one (S-020): a plugin asking to
 * pair never does, so a guesser cannot draw fresh codes. A code lasts 120 s and 5 wrong tries, shared by every window;
 * when they are spent, pairing pauses for every window at once, 30 s and twice as long each time up to an hour, until
 * a pairing succeeds (S-021, D-09). The code never reaches the log.
 */
@injectable()
export class PairingCodes {
  readonly #clock;
  readonly #logger;
  #current: ActiveCode | null = null;
  /** The end of the pause; in the past while pairing is open. */
  #lockedUntil = 0;
  #nextLockMs = PAIRING_LOCK_MS;

  constructor(
    clock = inject(CLOCK),
    logger = inject(LOGGER),
  ) {
    this.#clock = clock;
    this.#logger = logger;
  }

  /** For status alone: null while no window waits; else the code in force (minted now if none) or the pause. */
  status(waiting: number): PairingStatus | null {
    if (waiting === 0) {
      return null;
    }

    const locked = this.#locked();
    const code = locked ? null : this.#ensure(waiting);

    return {
      code: code?.code ?? null,
      expiresInSeconds: code === null ? null : this.#secondsUntil(code.expiresAt),
      lockedForSeconds: locked ? this.#secondsUntil(this.#lockedUntil) : null,
      waiting,
    };
  }

  /**
   * What a waiting window is told (pairing_required, S-022): the tries and time the code in force has left, or, while
   * pairing is paused, "locked" and the pause left. It never mints a code: only status does.
   */
  prompt(reason: PairingReason): PairingPrompt {
    const now = this.#clock.now();

    if (this.#locked()) {
      return {
        reason: PAIRING_REASON.locked,
        attemptsLeft: 0,
        expiresInMs: this.#lockedUntil - now,
      };
    }

    const active = this.#active();

    return {
      reason,
      attemptsLeft: active?.attemptsLeft ?? PAIRING_ATTEMPTS,
      expiresInMs: active === null ? 0 : active.expiresAt - now,
    };
  }

  /** A typed code: the right one is used up and resets the pauses, a wrong one spends a try, the last try locks. */
  check(typed: string): CodeCheck {
    if (this.#locked()) {
      return {
        outcome: CODE_CHECK.locked,
        until: this.#lockedUntil,
      };
    }

    const active = this.#active();

    if (active === null) {
      return { outcome: CODE_CHECK.expired };
    }

    if (this.#matches(typed, active.code)) {
      this.#current = null;
      this.#nextLockMs = PAIRING_LOCK_MS;

      return { outcome: CODE_CHECK.ok };
    }

    return active.attemptsLeft > 1 ? this.#spend(active) : this.#lock();
  }

  #ensure(waiting: number): ActiveCode {
    const active = this.#active();

    if (active !== null) {
      return active;
    }

    this.#current = {
      code: String(randomInt(0, 10 ** PAIRING_CODE_DIGITS)).padStart(PAIRING_CODE_DIGITS, PAIRING_CODE_PAD),
      expiresAt: this.#clock.now() + PAIRING_CODE_TTL_MS,
      attemptsLeft: PAIRING_ATTEMPTS,
    };
    this.#logger.info(PAIRING_LOG.minted, {
      component: LOG_COMPONENT.bridge,
      expiresInMs: PAIRING_CODE_TTL_MS,
      attempts: PAIRING_ATTEMPTS,
      waiting,
    });

    return this.#current;
  }

  /** The code in force, or null when there is none, it expired or its tries are spent. */
  #active(): ActiveCode | null {
    const current = this.#current;

    return current === null || this.#clock.now() >= current.expiresAt ? null : current;
  }

  #spend(active: ActiveCode): CodeCheck {
    const attemptsLeft = active.attemptsLeft - 1;

    this.#current = {
      ...active,
      attemptsLeft,
    };

    return {
      outcome: CODE_CHECK.wrong,
      attemptsLeft,
    };
  }

  #lock(): CodeCheck {
    const until = this.#clock.now() + this.#nextLockMs;

    this.#logger.warn(PAIRING_LOG.locked, {
      component: LOG_COMPONENT.bridge,
      lockedForMs: this.#nextLockMs,
    });
    this.#current = null;
    this.#lockedUntil = until;
    this.#nextLockMs = Math.min(this.#nextLockMs * 2, PAIRING_MAX_LOCK_MS);

    return {
      outcome: CODE_CHECK.locked,
      until,
    };
  }

  #locked(): boolean {
    return this.#clock.now() < this.#lockedUntil;
  }

  /** Compares without stopping at the first different digit, so the time taken tells a guesser nothing. */
  #matches(
    typed: string,
    code: string,
  ): boolean {
    const left = Buffer.from(typed);
    const right = Buffer.from(code);

    return left.length === right.length && timingSafeEqual(left, right);
  }

  #secondsUntil(time: number): number {
    return Math.max(0, Math.ceil((time - this.#clock.now()) / 1000));
  }
}
