import { randomUUID } from "node:crypto";

/** One tool call's id: every log line about the call carries it, so the call can be followed end to end (plan 3.2). */
export class CallId {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** A new id, unique across every server writing the shared log. */
  static next(): CallId {
    return new CallId(randomUUID());
  }

  toString(): string {
    return this.value;
  }
}
