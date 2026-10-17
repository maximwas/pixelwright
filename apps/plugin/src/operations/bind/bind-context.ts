import {
  type BindCandidate,
  BindIndex,
  type ColorSpace,
  colorSpaceOf,
  type ModeMap,
  variableTokenName,
} from "@pixelwright/core";
import { RawTokensBuilder } from "../../figma/tokens/raw-tokens-builder.ts";

/** What a bind call shares across its layers: the file's tokens by value, its colour space, and Figma's lookups. */
export class BindContext {
  readonly index: BindIndex;
  readonly space: ColorSpace;
  readonly #variables = new Map<string, Promise<Variable | null>>();
  readonly #styles = new Map<string, Promise<BaseStyle | null>>();

  private constructor(index: BindIndex, space: ColorSpace) {
    this.index = index;
    this.space = space;
  }

  /** The file's own tokens, with the ones the roots' layers use (a team library's). */
  static async of(roots: readonly BaseNode[]): Promise<BindContext> {
    const builder = await RawTokensBuilder.local();

    for (const root of roots) {
      await builder.addUsed(root);
    }

    const raw = builder.build();

    return new BindContext(BindIndex.of(raw), colorSpaceOf(raw.colorProfile));
  }

  /** The layer's variable modes, collection id → mode id, as Figma resolves them (its parents' included). */
  modes(layer: SceneNode): ModeMap {
    const modes = (layer as { resolvedVariableModes?: unknown }).resolvedVariableModes;

    return typeof modes === "object" && modes !== null ? (modes as ModeMap) : {};
  }

  /** Figma's own matches for a field (inferredVariables), as candidates; a library's variable named by Figma. */
  async inferred(aliases: unknown): Promise<BindCandidate[]> {
    const ids = Array.isArray(aliases)
      ? aliases.flatMap((alias: { id?: unknown }) => (typeof alias?.id === "string" ? [alias.id] : []))
      : [];
    const candidates: BindCandidate[] = [];

    for (const id of ids) {
      const known = this.index.byId(id);
      const variable = known === undefined ? await this.#variable(id) : null;

      if (known !== undefined) {
        candidates.push(known);
      } else if (variable !== null) {
        candidates.push({
          token: variableTokenName(variable),
          id,
          source: "variable",
          type: variable.resolvedType,
        });
      }
    }

    return candidates;
  }

  /** A variable to bind, by id; an error when Figma cannot reach it now. */
  async variable(id: string): Promise<Variable> {
    const variable = await this.#variable(id);

    if (variable === null) {
      throw new Error(`Figma cannot reach the variable ${id} now: enable its library.`);
    }

    return variable;
  }

  /** A style, by id; an error when Figma cannot reach it now. */
  async style(id: string): Promise<BaseStyle> {
    let style = this.#styles.get(id);

    if (style === undefined) {
      style = figma.getStyleByIdAsync(id);
      this.#styles.set(id, style);
    }

    const found = await style;

    if (found === null) {
      throw new Error(`Figma cannot reach the style ${id} now: enable its library.`);
    }

    return found;
  }

  #variable(id: string): Promise<Variable | null> {
    let variable = this.#variables.get(id);

    if (variable === undefined) {
      variable = figma.variables.getVariableByIdAsync(id);
      this.#variables.set(id, variable);
    }

    return variable;
  }
}
