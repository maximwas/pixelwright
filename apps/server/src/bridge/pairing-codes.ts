import { randomInt } from "node:crypto";
import { PAIRING_CODE_LENGTH, proofEquals } from "@pixelwright/core";
import {
  PAIRING_ATTEMPTS,
  PAIRING_CODE_TTL_MS,
  PAIRING_COOLDOWN_MS,
  PAIRING_MAX_COOLDOWN_MS,
} from "../constants/bridge.ts";
import type { ActiveCode, CodeCheck, PairingCodesLike, PairingCodesOptions } from "../types/bridge.ts";

const randomCode = () => String(randomInt(0, 10 ** PAIRING_CODE_LENGTH)).padStart(PAIRING_CODE_LENGTH, "0");

/**
 * The one pairing code in force: made only when status asks for it, typed by the user into the plugin window. It
 * lasts a couple of minutes and a few wrong tries (from any waiting socket). Once its tries run out, pairing pauses,
 * twice as long each time, so a guesser gets a handful of tries an hour instead of a fresh code every moment.
 */
export class PairingCodes implements PairingCodesLike {
  readonly #now: () => number;
  readonly #randomDigits: () => string;
  readonly #ttlMs: number;
  readonly #attempts: number;
  readonly #cooldownMs: number;
  readonly #maxCooldownMs: number;
  #current: ActiveCode | null = null;
  #lockedUntil: number | null = null;
  #nextCooldownMs: number;

  constructor({
    now = Date.now,
    randomDigits = randomCode,
    ttlMs = PAIRING_CODE_TTL_MS,
    attempts = PAIRING_ATTEMPTS,
    cooldownMs = PAIRING_COOLDOWN_MS,
    maxCooldownMs = PAIRING_MAX_COOLDOWN_MS,
  }: PairingCodesOptions = {}) {
    this.#now = now;
    this.#randomDigits = randomDigits;
    this.#ttlMs = ttlMs;
    this.#attempts = attempts;
    this.#cooldownMs = cooldownMs;
    this.#maxCooldownMs = maxCooldownMs;
    this.#nextCooldownMs = cooldownMs;
  }

  now(): number {
    return this.#now();
  }

  /** When the pause after spent codes ends, or null when pairing is not paused. */
  lockedUntil(): number | null {
    if (this.#lockedUntil !== null && this.#now() >= this.#lockedUntil) {
      this.#lockedUntil = null;
    }

    return this.#lockedUntil;
  }

  /** The code in force, or null when there is none, it expired or it ran out of tries. */
  active(): ActiveCode | null {
    const current = this.#current;

    if (current === null || this.#now() >= current.expiresAt || current.attemptsLeft <= 0) {
      return null;
    }

    return current;
  }

  /** The code in force, making a fresh one when there is none; null while pairing is paused. */
  ensure(): ActiveCode | null {
    const active = this.active();

    if (active !== null) {
      return active;
    }

    if (this.lockedUntil() !== null) {
      return null;
    }

    this.#current = {
      code: this.#randomDigits(),
      expiresAt: this.#now() + this.#ttlMs,
      attemptsLeft: this.#attempts,
    };

    return this.#current;
  }

  /** Checks a typed code: the right one is used up, a wrong one spends a try, the last try pauses pairing. */
  check(code: string): CodeCheck {
    const lockedUntil = this.lockedUntil();

    if (lockedUntil !== null) {
      return {
        outcome: "locked",
        until: lockedUntil,
      };
    }

    const active = this.active();

    if (active === null) {
      return { outcome: "expired" };
    }

    if (proofEquals(code, active.code)) {
      this.#current = null;
      this.#nextCooldownMs = this.#cooldownMs;

      return { outcome: "ok" };
    }

    const attemptsLeft = active.attemptsLeft - 1;

    if (attemptsLeft > 0) {
      this.#current = {
        ...active,
        attemptsLeft,
      };

      return {
        outcome: "wrong",
        attemptsLeft,
      };
    }

    this.#current = null;
    this.#lockedUntil = this.#now() + this.#nextCooldownMs;
    this.#nextCooldownMs = Math.min(this.#nextCooldownMs * 2, this.#maxCooldownMs);

    return {
      outcome: "locked",
      until: this.#lockedUntil,
    };
  }
}
