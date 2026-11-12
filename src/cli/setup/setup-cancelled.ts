import { SETUP_ERROR, SETUP_TEXT } from "@/cli/setup/setup.constants.ts";

/** Ctrl+C or Esc at a question: the setup stops, and nothing it has not done yet happens. */
export class SetupCancelled extends Error {
  constructor() {
    super(SETUP_TEXT.cancelled);
    this.name = SETUP_ERROR.cancelled;
  }
}
