import { BridgeError } from "@pixelwright/core";

let allowed = false;

/** The plugin window's Allow edits switch, for this file: off until the user turns it on, or left it on (edits-store.ts). */
export function setEditsAllowed(value: boolean): void {
  allowed = value;
}

export function editsAllowed(): boolean {
  return allowed;
}

/** Refuses a write while Allow edits is off: the plugin itself holds the catch, whatever the MCP client allowed. */
export function requireEdits(): void {
  if (!allowed) {
    throw new BridgeError(
      "EDITS_DISABLED",
      "Allow edits is off in the Pixelwright plugin window: turn it on there to write to this file (dryRun checks changes without it).",
    );
  }
}
