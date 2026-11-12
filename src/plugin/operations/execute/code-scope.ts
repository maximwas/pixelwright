import { InjectionToken, injectable } from "@needle-di/core";

/**
 * What execute's code keeps between calls while the plugin window is open (T-154): the `pw` it gets, with pw.state for
 * its data. Pixelwright's helpers are put back on it every call; what code puts there itself stays until the window
 * closes.
 */
@injectable()
export class CodeScope {
  readonly #pw: Record<string, unknown> = { state: {} };

  /** pw with these helpers on it, over what earlier calls left. */
  with(helpers: Readonly<Record<string, unknown>>): Record<string, unknown> {
    return Object.assign(this.#pw, helpers);
  }
}

export const CODE_SCOPE = new InjectionToken<CodeScope>("CodeScope");
