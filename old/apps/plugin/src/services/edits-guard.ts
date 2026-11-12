import { BridgeError } from "@pixelwright/core";

/**
 * The plugin window's Allow edits switch, for this file: off until the user turns it on, or left it on (EditsStore).
 * The plugin itself holds this catch, whatever the MCP client allowed.
 */
export class EditsGuard {
  #allowed = false;

  get allowed(): boolean {
    return this.#allowed;
  }

  allow(value: boolean): void {
    this.#allowed = value;
  }

  /** Refuses a write while Allow edits is off. */
  require(): void {
    if (!this.#allowed) {
      throw new BridgeError(
        "EDITS_DISABLED",
        "Allow edits is off in the Pixelwright plugin window: turn it on there to write to this file (dryRun checks changes without it).",
      );
    }
  }
}
