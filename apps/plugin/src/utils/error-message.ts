/** A thrown value as a sentence: an Error's message, anything else as text. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
