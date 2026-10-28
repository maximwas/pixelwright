/**
 * How many modes a collection may have in this file, as Figma said when it refused one ("Limited to 2 modes only"): the
 * plan's limit, which the Plugin API gives no other way. Kept while the plugin runs, so a later dry run refuses what the
 * write would; known again for another `figma`, as tests install.
 */
export class ModeLimit {
  #learned: { readonly api: PluginAPI; readonly limit: number } | null = null;

  /** The limit Figma refused a mode at in this file, if it has. */
  get known(): number | null {
    return this.#learned?.api === figma ? this.#learned.limit : null;
  }

  learn(limit: number): void {
    this.#learned = {
      api: figma,
      limit,
    };
  }
}
