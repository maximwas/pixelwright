import type { TONE } from "@/plugin-ui/view/plugin-window/plugin-window.constants.ts";

/** The connection in a word and a sentence, and the line under the code field while the server waits for a code. */
export interface StatusLine {
  readonly tone: (typeof TONE)[keyof typeof TONE];
  readonly title: string;
  readonly detail: string | null;
  readonly note: string | null;
}

/** ui.html's elements the window fills in. */
export interface WindowParts {
  readonly dot: HTMLElement;
  readonly title: HTMLElement;
  readonly detail: HTMLElement;
  readonly pairing: HTMLFormElement;
  readonly code: HTMLInputElement;
  readonly note: HTMLElement;
}
