import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { USED_TOKENS } from "@/plugin/adapters/figma/variables/used-tokens.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { USAGE } from "@/shared/ops/usage/usage.constants.ts";
import type { usageOp } from "@/shared/ops/usage/usage.manifest.ts";

type UsageInput = zod.output<typeof usageOp.input>;

type UsageOutput = zod.output<typeof usageOp.output>;

/**
 * The usage op (P-126, T-106): the layers under `within` (a layer or page, every page with "file", else the current
 * page) that use the style or variable, and where, a mixed text's runs read too (O-024). The caller's budget bounds
 * the scan (D-48): when it is spent the op answers with what it found, cut. One layer past USAGE.maxLayers ends the
 * scan: more says the rest exist.
 */
@injectable()
export class UsageOperation extends Operation<UsageInput, UsageOutput> {
  readonly #walk;
  readonly #used;

  constructor(
    report = inject(OP_REPORT),
    walk = inject(LAYER_WALK),
    used = inject(USED_TOKENS),
  ) {
    super(report);
    this.#walk = walk;
    this.#used = used;
  }

  protected async execute({ id, variable, within, budgetMs }: UsageInput): Promise<UsageOutput> {
    const deadline = this.#walk.deadline(budgetMs);
    const layers: UsageOutput["layers"] = [];
    const { cut } = this.#walk.until(this.#walk.layers(await this.#used.roots(within)), deadline, {
      accepts: (layer) => {
        const property = this.#used.where(layer, id, variable);

        if (property !== null) {
          layers.push({ id: layer.id, name: layer.name, type: layer.type, property });
        }

        return property !== null;
      },
      enough: USAGE.maxLayers + 1,
    });

    return { layers: layers.slice(0, USAGE.maxLayers), more: cut || layers.length > USAGE.maxLayers, cut };
  }
}
