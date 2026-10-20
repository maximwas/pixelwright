import {
  type ApplyChange,
  type FigmaProps,
  type OperationOutput,
  type PaintSpec,
  PlannedComponents,
  type TokenUse,
  tokenUsesOf,
} from "@pixelwright/core";
import type { TypedLayer } from "../../figma/capabilities.ts";
import { ComponentIndex } from "../../figma/component-index.ts";
import { checkPaints } from "../../figma/paints.ts";
import type { TokenIndex } from "../../figma/tokens/token-index.ts";
import { variantFor } from "../../figma/variants.ts";
import { WriteError } from "../../figma/write-error.ts";
import type { ApplyFonts } from "./apply-fonts.ts";
import { ApplyReport } from "./apply-report.ts";
import { canMake, newLayerType } from "./new-layers.ts";
import { existingPage } from "./pages.ts";
import { existingLayer } from "./targets.ts";
import { typeRefusals } from "./type-refusals.ts";

type Fail = (error: unknown, attribute?: string) => void;

type TokenCheck = (index: TokenIndex, use: TokenUse, props: FigmaProps) => Promise<unknown>;

/**
 * How a dry run checks each kind of token a change names, without importing anything. Paints are checked as a list,
 * by the rule the real run writes them with.
 */
const TOKEN_CHECKS: Readonly<Record<TokenUse["kind"], TokenCheck>> = {
  FLOAT: (index, { token }) => index.find(token, "FLOAT"),
  PAINT: (index, { key }, props) => checkPaints(paintsAt(props, key), index),
  EFFECT_STYLE: async (index, { token }) => {
    if ((await index.style(token, "EFFECT")) === null) {
      throw new WriteError(`No effect style is named ${token} in this file or the libraries its page uses.`);
    }
  },
  TEXT_STYLE: async (index, { token: name }) => await index.textStyle(name),
};

/** A page takes only its name: the one an id names is there, a new one is made on the real run. No layer type. */
async function checkedPage(change: ApplyChange): Promise<null> {
  if (change.kind === "update") {
    await existingPage(change.id, { load: false });
  }

  return null;
}

/** The list of paints a property holds. */
function paintsAt(props: FigmaProps, key: keyof FigmaProps): readonly PaintSpec[] {
  if (key === "strokes") {
    return props.strokes?.paints ?? [];
  }

  return (key === "fills" ? props.fills : props.textFills) ?? [];
}

/**
 * A dry run: for each change, the layer or the parent exists, the component and variant an instance names are there
 * (one the XML makes, or the file's), what the write refuses for the layer's type is refused, and every token and
 * font it names is found. Nothing is written or imported.
 */
export class DryRunCheck {
  readonly #changes: readonly ApplyChange[];
  readonly #byRef: ReadonlyMap<string, ApplyChange>;
  readonly #fonts: ApplyFonts;
  readonly #tokens: () => Promise<TokenIndex>;
  readonly #report = new ApplyReport();
  readonly #planned = new PlannedComponents();
  readonly #components = new ComponentIndex();
  /** The changes checked so far: a create's parent must be one of them. */
  readonly #checked = new Set<string>();

  constructor(
    changes: readonly ApplyChange[],
    { fonts, tokens }: { fonts: ApplyFonts; tokens: () => Promise<TokenIndex> },
  ) {
    this.#changes = changes;
    this.#byRef = new Map(changes.map((change) => [change.ref, change]));
    this.#fonts = fonts;
    this.#tokens = tokens;
  }

  async run(): Promise<OperationOutput<"apply">> {
    for (const change of this.#changes) {
      const fail: Fail = (error, attribute) => this.#report.fail(change, error, attribute);

      try {
        const layer = await this.#target(change);

        this.#report.planned(change);
        this.#checked.add(change.ref);
        await this.#neighbour(change, fail);
        this.#planned.record(change, this.#byRef);
        await this.#props(change, fail, this.#refused(change, layer));
      } catch (error) {
        fail(error);
      }
    }

    return this.#report.result();
  }

  /**
   * What the change writes onto: there, or makeable; with the type the layer is or will be made as. A copy's or a new
   * instance's layers are made on a real run, and a new set's frame becomes a set: their types are not known yet.
   */
  async #target(change: ApplyChange): Promise<TypedLayer | null> {
    if (change.source !== undefined) {
      return null;
    }

    if (change.tag === "Page") {
      return await checkedPage(change);
    }

    if (change.kind === "update") {
      return await existingLayer(change, { load: false });
    }

    if (change.copyOf !== undefined) {
      const source = await figma.getNodeByIdAsync(change.copyOf);

      if (source === null) {
        throw new WriteError(`No layer ${change.copyOf} to copy.`);
      }

      return source.type === "PAGE" || source.type === "DOCUMENT" ? null : { type: source.type };
    }

    if (change.tag === "Instance") {
      await this.#instance(change);
    } else if (!canMake(change.tag)) {
      throw new WriteError(`Creating a ${change.tag} is not available.`);
    } else if (change.parent !== null && !this.#checked.has(change.parent)) {
      throw new WriteError("Its parent element was not written: fix the parent's error first.");
    }

    const type = newLayerType(change.tag);

    return type === null ? null : { type };
  }

  /** What the write would refuse for the layer's type, reported; the properties refused are not checked further. */
  #refused(change: ApplyChange, layer: TypedLayer | null): Set<keyof FigmaProps> {
    const refused = new Set<keyof FigmaProps>();

    for (const { error, keys, attribute } of layer === null ? [] : typeRefusals(layer, change)) {
      this.#report.fail(change, error, attribute);

      for (const key of keys) {
        refused.add(key);
      }
    }

    return refused;
  }

  /**
   * The component and variant an instance names, found without making anything: one this XML makes, or the file's. A
   * library one named by key is checked on a real run: finding it imports it, which writes to the file.
   */
  async #instance(change: ApplyChange): Promise<void> {
    const name = change.props.component ?? "";

    if (!this.#planned.has(name) && !name.startsWith("key:")) {
      variantFor(await this.#components.find(name), change.props.variant ?? {});
    }

    const missing = this.#planned.missingVariant(name, change.props.variant ?? {});

    if (missing !== null) {
      throw new WriteError(missing);
    }
  }

  async #neighbour(change: ApplyChange, fail: Fail): Promise<void> {
    const neighbour = change.before ?? change.after;

    if (neighbour !== undefined && (await figma.getNodeByIdAsync(neighbour)) === null) {
      fail(
        new WriteError(`No layer ${neighbour} to put this one next to.`),
        change.before === undefined ? "after" : "before",
      );
    }
  }

  /**
   * Every font and token the change and its runs name: one error a property at most, as the real run's step gives; a
   * property its layer's type refused is not checked again.
   */
  async #props(change: ApplyChange, fail: Fail, refused: ReadonlySet<keyof FigmaProps>): Promise<void> {
    for (const props of [change.props, ...(change.text?.runs ?? []).map((run) => run.props)]) {
      this.#font(change, props, fail);

      const done = new Set<keyof FigmaProps>(refused);

      for (const use of tokenUsesOf(props)) {
        if (done.has(use.key)) {
          continue;
        }

        try {
          await TOKEN_CHECKS[use.kind](await this.#tokens(), use, props);
        } catch (error) {
          done.add(use.key);
          fail(error, change.sources[use.key] ?? use.key);
        }

        // A list of paints is checked whole at its first token.
        if (use.kind === "PAINT") {
          done.add(use.key);
        }
      }
    }
  }

  #font(change: ApplyChange, props: FigmaProps, fail: Fail): void {
    const font = props.font === undefined ? undefined : this.#fonts.font(props.font);

    if (font instanceof WriteError) {
      fail(font, change.sources.font ?? "font");
    }
  }
}
