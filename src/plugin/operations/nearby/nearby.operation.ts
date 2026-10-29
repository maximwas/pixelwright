import { inject, injectable } from "@needle-di/core";
import type * as zod from "zod/mini";
import { NEARBY_NOTES } from "@/core/inspect/nearby.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { NODE_LOOKUP } from "@/plugin/adapters/figma/lookup/node-lookup.ts";
import { OP_REPORT } from "@/plugin/app/op-report.ts";
import { Operation } from "@/plugin/app/operation.ts";
import { NEARBY_TEXT, NOTE } from "@/plugin/operations/nearby/nearby.constants.ts";
import { NOTE_CANDIDATES } from "@/plugin/operations/nearby/note-candidates.ts";
import { ERROR_CODE } from "@/shared/errors/error-code.constants.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";
import { NEARBY } from "@/shared/ops/nearby/nearby.constants.ts";
import type { nearbyOp } from "@/shared/ops/nearby/nearby.manifest.ts";

type NearbyInput = zod.output<typeof nearbyOp.input>;

type NearbyOutput = zod.output<typeof nearbyOp.output>;

/**
 * The designer's notes around the screen that holds a layer (T-058, K-062): the screen is its topmost layer under the
 * page or a section; the notes are chosen here and ranked by core's NearbyNotes, within `distance` px, nearest first,
 * NEARBY.maxNotes of them and how many more. Reads only.
 */
@injectable()
export class NearbyOperation extends Operation<NearbyInput, NearbyOutput> {
  readonly #lookup;
  readonly #candidates;
  readonly #notes;

  constructor(
    report = inject(OP_REPORT),
    lookup = inject(NODE_LOOKUP),
    candidates = inject(NOTE_CANDIDATES),
    notes = inject(NEARBY_NOTES),
  ) {
    super(report);
    this.#lookup = lookup;
    this.#candidates = candidates;
    this.#notes = notes;
  }

  protected async execute({ node, distance }: NearbyInput): Promise<NearbyOutput> {
    const layer = await this.#lookup.existing(node);

    if (layer.type === FIGMA_NODE_TYPE.document || layer.type === FIGMA_NODE_TYPE.page) {
      throw new PixelwrightError(ERROR_CODE.nodeNotFound, NEARBY_TEXT.page(node));
    }

    const screen = this.#screen(layer);
    const box = screen.absoluteBoundingBox;

    if (box === null) {
      throw new PixelwrightError(ERROR_CODE.opFailed, NEARBY_TEXT.noBox(screen.name));
    }

    return {
      screen: { id: screen.id, name: screen.name },
      ...this.#notes.notes(box, this.#candidates.around(screen), { distance, max: NEARBY.maxNotes }),
    };
  }

  /** The screen a layer is on, as flows reads a page's screens: its topmost layer under the page or a section. */
  #screen(layer: SceneNode): SceneNode {
    const { parent } = layer;

    return parent === null ||
      parent.type === FIGMA_NODE_TYPE.page ||
      parent.type === NOTE.section ||
      parent.type === FIGMA_NODE_TYPE.document
      ? layer
      : this.#screen(parent);
  }
}
