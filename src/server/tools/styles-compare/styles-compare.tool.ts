import { inject, injectable } from "@needle-di/core";
import type { StylesCompared } from "@/core/checks/build-styles/build-styles.schema.ts";
import { BUILD_STYLES } from "@/core/checks/build-styles/build-styles.ts";
import { PLUGIN_SESSION } from "@/server/app/sessions/plugin-session.ts";
import { Tool } from "@/server/app/tool-runner/tool.ts";
import {
  type StylesCompareInput,
  StylesCompareInputSchema,
} from "@/server/tools/styles-compare/styles-compare.schema.ts";
import { readOp } from "@/shared/ops/read/read.manifest.ts";

/**
 * styles_compare (T-090): one read op reads every pair's layer with its insides, and core's BuildStyles holds each
 * build's computed styles against the layer as design_read writes it. Reads only.
 */
@injectable()
export class StylesCompareTool extends Tool<StylesCompareInput, StylesCompared> {
  protected readonly input = StylesCompareInputSchema;
  readonly #session;
  readonly #styles;

  constructor(session = inject(PLUGIN_SESSION), styles = inject(BUILD_STYLES)) {
    super();
    this.#session = session;
    this.#styles = styles;
  }

  protected async run({ pairs, tolerance }: StylesCompareInput): Promise<StylesCompared> {
    const { reads } = await this.#session.run(readOp, { nodes: [...new Set(pairs.map(({ node }) => node))] });

    return this.#styles.compare(reads, pairs, tolerance);
  }
}
