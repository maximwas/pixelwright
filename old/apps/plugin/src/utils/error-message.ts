/**
 * Figma's words when its plugin sandbox has spent its callback ids. It numbers the callbacks it makes in 16 bits, and
 * every grid track it hands out (gridRowSizes, gridColumnSizes: objects with setters) takes new ones, so after thousands
 * of calls through one plugin window each read or write of a grid's tracks fails. Only a new window starts afresh.
 */
const SPENT_CALLBACKS = /Attempted to invoke callback with invalid id/;

const REOPEN =
  "Figma's plugin sandbox has run out of callback ids in this long-open plugin window, so it can no longer read or " +
  "write a grid's tracks: close and reopen the Pixelwright plugin window, then try again. The file is not affected.";

/** A thrown value as a sentence: an Error's message, anything else as text; Figma's spent sandbox with its cure. */
export function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  return SPENT_CALLBACKS.test(message) && !message.includes(REOPEN) ? `${message}. ${REOPEN}` : message;
}

/** The error an operation answers with: one Figma's spent sandbox threw says so (see errorMessage); others as thrown. */
export function explained(error: unknown): unknown {
  return error instanceof Error && errorMessage(error) !== error.message ? new Error(errorMessage(error)) : error;
}
