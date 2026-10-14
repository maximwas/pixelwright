import {
  type ApplyChange,
  type FigmaProps,
  type OperationOutput,
  PlannedComponents,
  type TokenUse,
  tokenUsesOf,
} from "@pixelwright/core";
import { ComponentIndex } from "../../figma/component-index.ts";
import type { TokenIndex } from "../../figma/tokens/token-index.ts";
import { variantFor } from "../../figma/variants.ts";
import { WriteError } from "../../figma/write-error.ts";
import type { ApplyFonts } from "./apply-fonts.ts";
import { ApplyReport } from "./apply-report.ts";
import { canMake } from "./new-layers.ts";
import { existingLayer } from "./targets.ts";

type Fail = (error: unknown, attribute?: string) => void;

/** How a dry run checks each kind of token a change names, without importing anything. */
const TOKEN_CHECKS: Readonly<Record<TokenUse["kind"], (index: TokenIndex, token: string) => Promise<unknown>>> = {
  FLOAT: (index, token) => index.find(token, "FLOAT"),
  PAINT: async (index, token) => (await index.style(token, "PAINT")) ?? (await index.find(token, "COLOR")),
  EFFECT_STYLE: async (index, token) => {
    if ((await index.style(token, "EFFECT")) === null) {
      throw new WriteError(`No effect style is named ${token} in this file or the libraries its page uses.`);
    }
  },
  TEXT_STYLE: async (index, name) => await index.textStyle(name),
};

/**
 * A dry run: for each change, the layer or the parent exists, the component and variant an instance names are there
 * (one the XML makes, or the file's), and every token and font it names is found. Nothing is written or imported.
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
        await this.#target(change);
        this.#checked.add(change.ref);
        await this.#neighbour(change, fail);
        this.#planned.record(change, this.#byRef);
        await this.#props(change, fail);
      } catch (error) {
        fail(error);
      }
    }

    return this.#report.result();
  }

  /** What the change writes onto: there, or makeable. A copy's or a new instance's layers are made on a real run. */
  async #target(change: ApplyChange): Promise<void> {
    if (change.source !== undefined) {
      return;
    }

    if (change.kind === "update") {
      await existingLayer(change, { load: false });
    } else if (change.copyOf !== undefined) {
      if ((await figma.getNodeByIdAsync(change.copyOf)) === null) {
        throw new WriteError(`No layer ${change.copyOf} to copy.`);
      }
    } else if (change.tag === "Instance") {
      await this.#instance(change);
    } else if (!canMake(change.tag)) {
      throw new WriteError(`Creating a ${change.tag} is not available.`);
    } else if (change.parent !== null && !this.#checked.has(change.parent)) {
      throw new WriteError("Its parent element was not written: fix the parent's error first.");
    }
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

  /** Every font and token the change and its runs name. */
  async #props(change: ApplyChange, fail: Fail): Promise<void> {
    for (const props of [change.props, ...(change.text?.runs ?? []).map((run) => run.props)]) {
      this.#font(change, props, fail);

      for (const { key, token, kind } of tokenUsesOf(props)) {
        try {
          await TOKEN_CHECKS[kind](await this.#tokens(), token);
        } catch (error) {
          fail(error, change.sources[key] ?? key);
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
