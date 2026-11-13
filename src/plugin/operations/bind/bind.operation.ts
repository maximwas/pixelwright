import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { LAYER_WALK } from "@/plugin/adapters/figma/lookup/layer-walk.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { BIND_LAYERS } from "@/plugin/operations/bind/bind-layers.ts";
import { LAYER_VALUES } from "@/plugin/operations/bind/layer-values.ts";
import { BIND_LIMIT } from "@/shared/ops/bind/bind.constants.ts";
import type { bindOp } from "@/shared/ops/bind/bind.manifest.ts";
import type { ScannedLayer } from "@/shared/ops/bind/bind.schema.ts";

type BindInput = zod.output<typeof bindOp.input>;

type BindOutput = zod.output<typeof bindOp.output>;

/**
 * The bind op (P-164, T-167): under `within` (a layer, a page, every page with "file", else the selection) the layers
 * tokens_bind may bind, each with its raw values of the kinds asked, or with remap ids its uses of them, and the
 * library variables Figma infers for them; the server matches them to the file's tokens. A read: Allow edits may be off. The walk keeps to the op's budget (P-075) and to
 * BIND_LIMIT.maxLayers layers; either cut says so.
 */
@injectable()
export class BindOperation extends Operation<BindInput, BindOutput> {
  readonly #walk;
  readonly #layers;
  readonly #values;

  constructor(
    report = inject(OP_REPORT),
    walk = inject(LAYER_WALK),
    layers = inject(BIND_LAYERS),
    values = inject(LAYER_VALUES),
  ) {
    super(report);
    this.#walk = walk;
    this.#layers = layers;
    this.#values = values;
  }

  protected async execute(input: BindInput): Promise<BindOutput> {
    const deadline = this.#walk.deadline();
    const left = { instances: 0, defaults: 0 };
    const layers: ScannedLayer[] = [];
    const roots = await this.#layers.roots(input.within);
    const { cut } = this.#walk.until(this.#layers.under(roots, input.overrides, left), deadline, {
      accepts: (layer) => {
        const scanned = this.#values.scan(layer, input);

        if (scanned !== null) {
          layers.push(scanned);
        }

        return scanned !== null;
      },
      enough: BIND_LIMIT.maxLayers + 1,
    });

    const kept = layers.slice(0, BIND_LIMIT.maxLayers);

    return {
      layers: kept,
      variables: await this.#values.variables(kept),
      ...left,
      cut: cut || layers.length > BIND_LIMIT.maxLayers,
    };
  }
}
