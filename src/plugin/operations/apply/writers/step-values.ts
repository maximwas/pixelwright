import { InjectionToken, inject, injectable } from "@needle-di/core";
import { ASSIGN } from "@/plugin/adapters/figma/assign.ts";
import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { TOKEN_KIND } from "@/plugin/operations/apply/apply.constants.ts";
import { TOKEN_INDEX } from "@/plugin/operations/apply/token-index.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

type LengthValue = number | { readonly token: string };

/** A length a step takes: pixels, a token, null (no limit) or nothing given. */
type Length = LengthValue | null | undefined;

/** A length as Figma takes it: a number, null, or the number variable its token names. */
export type ResolvedLength = number | null | Variable;

type Lengths = Partial<Record<VariableBindableNodeField, Length>>;

type Resolved = Partial<Record<VariableBindableNodeField, ResolvedLength | undefined>>;

/**
 * A step's lengths as Figma takes them (T-135, C-181): pixels, or a token's number variable bound to the field. Every
 * token is found as a FLOAT the file reaches (an unknown name or another type refused on dry and real runs alike),
 * then all are resolved, a library's imported, before the first is written, so a step fails whole; a number over a
 * bound field unbinds it.
 */
@injectable()
export class StepValues {
  readonly #tokens;
  readonly #assign;

  constructor(tokens = inject(TOKEN_INDEX), assign = inject(ASSIGN)) {
    this.#tokens = tokens;
    this.#assign = assign;
  }

  /**
   * Each token among the props' lengths found as a number variable, without importing (a dry run's check, a real
   * run's); one that cannot bind is refused on its prop.
   */
  async check(props: Partial<Record<keyof FigmaProps, Length | readonly Length[]>>): Promise<void> {
    for (const [key, given] of Object.entries(props) as [keyof FigmaProps, Length | readonly Length[]][]) {
      for (const length of Array.isArray(given) ? given : [given]) {
        if (this.#isToken(length)) {
          await this.#found(key, length.token);
        }
      }
    }
  }

  /** The lengths by field, every token's variable found first: one that cannot bind writes none of them. */
  async resolve(lengths: Lengths): Promise<Resolved> {
    const resolved: Resolved = {};

    for (const [field, length] of Object.entries(lengths) as [VariableBindableNodeField, Length][]) {
      if (length !== undefined) {
        resolved[field] = this.#isToken(length) ? await this.#tokens.variable(length.token, TOKEN_KIND.number) : length;
      }
    }

    return resolved;
  }

  /** Resolved lengths on their fields: a variable bound, a number or null written where it differs. */
  set(node: SceneNode, resolved: Resolved): void {
    for (const [field, value] of Object.entries(resolved) as [
      VariableBindableNodeField,
      ResolvedLength | undefined,
    ][]) {
      if (value !== undefined && !this.bind(node, field, value)) {
        this.#assign.set(node as FrameNode, { [field]: value });
      }
    }
  }

  async write(node: SceneNode, lengths: Lengths): Promise<void> {
    this.set(node, await this.resolve(lengths));
  }

  /** A variable bound to the field unless it is already (true); a number or null takes off one bound (false: the caller writes it). */
  bind(
    node: SceneNode,
    field: VariableBindableNodeField,
    value: ResolvedLength,
  ): boolean {
    const layer = node as FrameNode;
    const bound = layer.boundVariables?.[field]?.id;

    if (typeof value === "number" || value === null) {
      if (bound !== undefined) {
        layer.setBoundVariable(field, null);
      }

      return false;
    }

    if (bound !== value.id) {
      layer.setBoundVariable(field, value);
    }

    return true;
  }

  async #found(key: keyof FigmaProps, token: string): Promise<void> {
    try {
      await this.#tokens.check(token, TOKEN_KIND.number);
    } catch (error) {
      throw error instanceof WriteError ? new WriteError(error.message, error.hint, [key]) : error;
    }
  }

  #isToken(length: Length): length is { readonly token: string } {
    return typeof length === "object" && length !== null;
  }
}

export const STEP_VALUES = new InjectionToken<StepValues>("StepValues");
