import type { ApplyChange, FontSpec, OperationOutput } from "@pixelwright/core";
import { ComponentIndex } from "../../figma/component-index.ts";
import type { IdLookup } from "../../figma/id-lookup.ts";
import type { TokenIndex } from "../../figma/tokens/token-index.ts";
import type { WriteError } from "../../figma/write-error.ts";
import type { ApplyFonts } from "./apply-fonts.ts";
import type { ApplyImages } from "./apply-images.ts";
import { ApplyReport } from "./apply-report.ts";
import { Counterparts } from "./counterparts.ts";
import { createLayer, finishNew } from "./new-layers.ts";
import { PendingSets } from "./pending-sets.ts";
import { Placement } from "./placement.ts";
import { PropertyMarks } from "./property-marks.ts";
import { existingLayer } from "./targets.ts";
import { LayerWriter } from "./writers/layer-writer.ts";
import type { PropertyMark, WriteScope } from "./writers/write-scope.ts";

type Fail = (error: unknown, attribute?: string) => void;

/** What a run is given: where top-level layers go, the call's lookups by id, fonts, tokens and images. */
export interface RunParts {
  readonly top: PageNode | SceneNode | null;
  readonly lookup: IdLookup;
  readonly fonts: ApplyFonts;
  readonly tokens: () => Promise<TokenIndex>;
  readonly images: ApplyImages;
}

/**
 * design_apply's changes written in Figma, element by element in document order, so one that fails leaves the
 * others: each layer found (a counterpart in a copy or a new instance, an existing layer) or made, paired, moved,
 * written, then recorded. New component sets wait for their variants. One undo step closes the call.
 */
export class ApplyRun implements WriteScope {
  readonly components = new ComponentIndex();
  readonly #changes: readonly ApplyChange[];
  readonly #byRef: ReadonlyMap<string, ApplyChange>;
  readonly #layers = new Map<string, SceneNode | null>();
  readonly #parts: RunParts;
  readonly #report = new ApplyReport();
  readonly #counterparts = new Counterparts();
  readonly #marks = new PropertyMarks();
  readonly #placement: Placement;
  readonly #sets: PendingSets;
  readonly #writer = new LayerWriter(this);
  /** Whether any layer was written to, though every step may have failed: the call's undo step closes then too. */
  #ran = false;

  constructor(changes: readonly ApplyChange[], parts: RunParts) {
    this.#changes = changes;
    this.#byRef = new Map(changes.map((change) => [change.ref, change]));
    this.#parts = parts;
    this.#placement = new Placement(changes, this.#layers, parts.top);
    this.#sets = new PendingSets(this.#byRef, {
      write: (node, change, fail) => this.#write(node, change, fail),
      made: (change, node) => this.#report.made(change, node),
      components: this.components,
      marks: this.#marks,
      layers: this.#layers,
    });
  }

  async run(): Promise<OperationOutput<"apply">> {
    for (const change of this.#changes) {
      const fail: Fail = (error, attribute) => this.#report.fail(change, error, attribute);

      try {
        await this.#apply(change, fail);
      } catch (error) {
        fail(error);
      }
    }

    await this.#sets.settle();

    if (this.#report.touched || this.#ran) {
      figma.commitUndo();
    }

    return this.#report.result();
  }

  get lookup(): IdLookup {
    return this.#parts.lookup;
  }

  tokens(): Promise<TokenIndex> {
    return this.#parts.tokens();
  }

  uploads(stream: string): Uint8Array | undefined {
    return this.#parts.images.bytes(stream);
  }

  font(spec: FontSpec): FontName | WriteError | undefined {
    return this.#parts.fonts.font(spec);
  }

  isUnloaded(font: FontName): boolean {
    return this.#parts.fonts.isUnloaded(font);
  }

  image(asset: { readonly src: string; readonly stream?: string }): Image {
    return this.#parts.images.image(asset);
  }

  mark(mark: PropertyMark): void {
    this.#marks.add(mark);
  }

  async #apply(change: ApplyChange, fail: Fail): Promise<void> {
    if (change.kind === "create" && change.tag === "Instance" && change.copyOf === undefined) {
      // Components made earlier in the call are whole before an instance is made of one.
      await this.#sets.settle(change);
    }

    const node = await this.#target(change);

    this.#layers.set(change.ref, node);
    await this.#pair(change, node);

    const moved = await this.#move(change, node, fail);

    if (change.kind === "create" && change.tag === "ComponentSet" && change.copyOf === undefined) {
      this.#sets.hold(change, node, fail);

      return;
    }

    const now = this.#sets.writable({
      node,
      change,
      fail,
    });

    this.#record(change, node, (await this.#write(node, now, fail)) || moved);
  }

  async #write(node: SceneNode, change: ApplyChange, fail: Fail): Promise<boolean> {
    this.#ran = true;

    return await this.#writer.write(node, change, fail);
  }

  async #target(change: ApplyChange): Promise<SceneNode> {
    if (change.source !== undefined) {
      return await this.#counterpart(change);
    }

    return change.kind === "update"
      ? await existingLayer(change, { load: true })
      : await createLayer(change, this.#placement, this);
  }

  /** A layer inside a copy or a new instance: the counterpart there of the layer the element names. */
  async #counterpart(change: ApplyChange): Promise<SceneNode> {
    const scope = change.copy ?? "";
    const node = this.#counterparts.find(change, {
      inCopy: this.#byRef.get(scope)?.copyOf !== undefined,
      made: (this.#layers.get(scope) ?? null) !== null,
    });

    // A text there exists only now: its fonts (an instance's are its component's) load before it is written.
    if (node.type === "TEXT") {
      await this.#parts.fonts.loadFor(node);
    }

    return node;
  }

  async #pair(change: ApplyChange, node: SceneNode): Promise<void> {
    if (change.copyOf !== undefined) {
      const source = await figma.getNodeByIdAsync(change.copyOf);

      if (source !== null) {
        this.#counterparts.pairCopy(change.ref, source, node);
      }
    } else if (change.kind === "create" && change.tag === "Instance") {
      this.#counterparts.pairInstance(change.ref, node);
    }
  }

  /** A layer that cannot go where the change places it keeps its place; its attributes are still written. */
  async #move(change: ApplyChange, node: SceneNode, fail: Fail): Promise<boolean> {
    if (!(change.move ?? false)) {
      return false;
    }

    try {
      await this.#placement.move(node, change);

      return true;
    } catch (error) {
      fail(error, change.before === undefined ? (change.after === undefined ? undefined : "after") : "before");

      return false;
    }
  }

  #record(change: ApplyChange, node: SceneNode, wrote: boolean): void {
    if (change.kind === "create") {
      finishNew(node, change);

      // A component or set made here is found by the instances after it; a variant is found through its set.
      if (
        node.type === "COMPONENT_SET" ||
        (node.type === "COMPONENT" && this.#byRef.get(change.parent ?? "")?.tag !== "ComponentSet")
      ) {
        this.components.add(node);
      }

      this.#report.made(change, node);
    } else if (wrote && change.source === undefined) {
      this.#report.wroteTo(node);
    }
  }
}
