import { randomInt } from "node:crypto";
import { PAIRING_CODE_LENGTH, proofEquals } from "@pixelwright/core";
import { PAIRING_ATTEMPTS, PAIRING_CODE_TTL_MS } from "../constants/bridge.ts";
import type { ActiveCode, CodeCheck, PairingCodesOptions } from "../types/bridge.ts";

const randomCode = () => String(randomInt(0, 10 ** PAIRING_CODE_LENGTH)).padStart(PAIRING_CODE_LENGTH, "0");

/**
 * The one pairing code in force: shown through status, typed by the user into the plugin window. It lasts a couple of
 * minutes and a few wrong tries (from any waiting socket), then a fresh one replaces it, so guessing gets nowhere.
 */
export class PairingCodes {
  readonly #now: () => number;
  readonly #randomDigits: () => string;
  readonly #ttlMs: number;
  readonly #attempts: number;
  #current: ActiveCode | null = null;

  constructor({
    now = Date.now,
    randomDigits = randomCode,
    ttlMs = PAIRING_CODE_TTL_MS,
    attempts = PAIRING_ATTEMPTS,
  }: PairingCodesOptions = {}) {
    this.#now = now;
    this.#randomDigits = randomDigits;
    this.#ttlMs = ttlMs;
    this.#attempts = attempts;
  }

  /** The code in force, or null when there is none, it expired or it ran out of tries. */
  active(): ActiveCode | null {
    const current = this.#current;

    if (current === null || this.#now() >= current.expiresAt || current.attemptsLeft <= 0) {
      return null;
    }

    return current;
  }

  /** The code in force, making a fresh one when there is none. */
  ensure(): ActiveCode {
    const active = this.active();

    if (active !== null) {
      return active;
    }

    this.#current = {
      code: this.#randomDigits(),
      expiresAt: this.#now() + this.#ttlMs,
      attemptsLeft: this.#attempts,
    };

    return this.#current;
  }

  /** Checks a typed code: the right one is used up, a wrong one spends a try. */
  check(code: string): CodeCheck {
    const active = this.active();

    if (active === null) {
      return { outcome: "expired" };
    }

    if (proofEquals(code, active.code)) {
      this.#current = null;

      return { outcome: "ok" };
    }

    const attemptsLeft = active.attemptsLeft - 1;

    this.#current = {
      ...active,
      attemptsLeft,
    };

    return {
      outcome: "wrong",
      attemptsLeft,
    };
  }
}
