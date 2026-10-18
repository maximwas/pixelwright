/**
 * What execute's code keeps between calls while the plugin runs: the `pw` object it gets, with pw.state for its data.
 * Pixelwright's helpers are put back on it every call; what the code puts there itself stays until the window closes.
 */
export class CodeScope {
  readonly #pw: Record<string, unknown> = { state: {} };

  /** pw with these helpers on it, over what earlier calls left. */
  with(helpers: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return Object.assign(this.#pw, helpers);
  }
}
