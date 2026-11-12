/** A write that cannot be done, with what to do instead: design_apply returns both on the attribute's error. */
export class WriteError extends Error {
  readonly hint: string | undefined;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "WriteError";
    this.hint = hint;
  }
}
