import { isCancel } from "@clack/prompts";

/** Ctrl+C or Esc in a prompt: the setup stops, and nothing it has not done yet happens. */
export class SetupCancelled extends Error {
  constructor() {
    super("Setup cancelled.");
    this.name = "SetupCancelled";
  }
}

/** A prompt's answer, or SetupCancelled when the person backed out. */
export function answered<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    throw new SetupCancelled();
  }

  return value as Exclude<T, symbol>;
}
