import { InjectionToken, inject, injectable } from "@needle-di/core";
import type { TypedLayer } from "@/plugin/adapters/figma/capabilities.ts";
import { FIGMA_NODE_TYPE } from "@/plugin/adapters/figma/figma.constants.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_TEXT, NEW_LAYER_TYPE } from "@/plugin/operations/apply/apply.constants.ts";
import type { ApplyCall } from "@/plugin/operations/apply/apply.types.ts";
import { APPLY_CHECKS } from "@/plugin/operations/apply/checks.ts";
import { NEW_LAYERS } from "@/plugin/operations/apply/new-layers.ts";
import { PAGES } from "@/plugin/operations/apply/pages.ts";
import { PLACEMENT } from "@/plugin/operations/apply/placement.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData } from "@/shared/ops/apply/apply.schema.ts";

/**
 * The layer each change writes, found or made and placed (T-123..T-126): an existing one (moved when its change says
 * so), a page, a copy's layer for the source's, a copy, or a new layer at its XML place. A dry run checks the same and
 * knows a layer it would make by its type alone.
 */
@injectable()
export class ApplyLayers {
  readonly #checks;
  readonly #layers;
  readonly #placement;
  readonly #pages;

  constructor(
    checks = inject(APPLY_CHECKS),
    layers = inject(NEW_LAYERS),
    placement = inject(PLACEMENT),
    pages = inject(PAGES),
  ) {
    this.#checks = checks;
    this.#layers = layers;
    this.#placement = placement;
    this.#pages = pages;
  }

  async of(change: ApplyChangeData, call: ApplyCall): Promise<TypedLayer> {
    const create = change.kind === APPLY_CHANGE_KIND.create;

    if (NEW_LAYER_TYPE[change.tag] === FIGMA_NODE_TYPE.page) {
      return create ? this.#page(change, call) : await this.#pages.existing(change.id, !call.dry);
    }

    if (change.source !== undefined) {
      return await this.#counterpart(change, call);
    }

    if (create) {
      return await this.#created(change, call);
    }

    return await this.#moved(await this.#checks.existing(change, !call.dry), change, call);
  }

  /** The layer, placed again when its change says it moves. */
  async #moved(
    node: SceneNode,
    change: ApplyChangeData,
    call: ApplyCall,
  ): Promise<SceneNode> {
    if (change.moves ?? false) {
      await this.#placement.move(node, change, call);
    }

    return node;
  }

  /** After its write: a new layer finished as NewLayers does; a copy keeps what its source had. */
  finish(node: SceneNode | PageNode, change: ApplyChangeData): void {
    if (change.copyOf === undefined && node.type !== FIGMA_NODE_TYPE.page) {
      this.#layers.finish(node, change.props);
    }
  }

  /** A made layer whose write failed goes, so a failed element leaves nothing in the user's file (a page stays). */
  discard(node: TypedLayer | undefined): void {
    if (node !== undefined && "remove" in node && node.type !== FIGMA_NODE_TYPE.page) {
      this.#layers.discard(node as SceneNode);
    }
  }

  combine(holder: SceneNode): ComponentSetNode {
    return this.#layers.combine(holder);
  }

  #page(change: ApplyChangeData, call: ApplyCall): TypedLayer {
    return call.dry ? { type: FIGMA_NODE_TYPE.page } : this.#pages.made(change.props.name);
  }

  /** Inside a copy: the copy's layer for the source's; a dry run checks the source's, which the copy's stands for. */
  async #counterpart(change: ApplyChangeData, call: ApplyCall): Promise<TypedLayer> {
    const copy = call.changes.find(({ ref }) => ref === change.copy);

    if (copy?.copyOf === undefined) {
      throw new WriteError(APPLY_TEXT.instanceLayers);
    }

    const made = call.layers.has(copy.ref);

    if (call.dry) {
      if (!made) {
        throw new WriteError(APPLY_TEXT.copyNotMade);
      }

      return await this.#moved(await this.#checks.existing(change, false, change.source), change, call);
    }

    return await this.#moved(call.counterparts.find(change, made), change, call);
  }

  /** A new layer's place checked, and on a real run the layer made (or the source cloned) there. */
  async #created(change: ApplyChangeData, call: ApplyCall): Promise<TypedLayer> {
    const parent = change.parent === null ? call.top : call.layers.get(change.parent);

    if (parent === undefined) {
      const failed = change.parent === null ? undefined : call.failed.get(change.parent);

      throw new WriteError(
        failed === undefined ? APPLY_TEXT.noParent : APPLY_TEXT.parentFailed(failed.tag, failed.line),
      );
    }

    if (change.copyOf === undefined) {
      const type = this.#checks.creatable(change, parent);

      return call.dry ? { type } : this.#layers.create(type, change, await this.#placement.whereTo(change, call));
    }

    const source = await this.#checks.existing(change, !call.dry, change.copyOf);

    this.#checks.creatable(change, parent, source.type);

    if (call.dry) {
      return { type: source.type };
    }

    const copy = this.#layers.copy(source, await this.#placement.whereTo(change, call));

    call.counterparts.pairCopy(change.ref, source, copy);

    return copy;
  }
}

export const APPLY_LAYERS = new InjectionToken<ApplyLayers>("ApplyLayers");
