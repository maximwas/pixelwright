import { WriteError } from "@/plugin/adapters/figma/write-error.ts";
import { APPLY_CHANGE_KIND } from "@/shared/ops/apply/apply.constants.ts";
import type { ApplyChangeData, ApplyCreated, ApplyErrorEntry, ApplyProperty } from "@/shared/ops/apply/apply.schema.ts";
import type { FigmaProps } from "@/shared/write-intents/write-intent.schema.ts";

/** What a call made, changed and could not write, element by element (T-120): one per call, dry or real. */
export class ApplyReport {
  readonly #created: ApplyCreated[] = [];
  /** The ids of the layers the call made: a write to one is in created, not changed. */
  readonly #made = new Set<string>();
  readonly #changed = new Set<string>();
  readonly #errors: ApplyErrorEntry[] = [];

  /** An element's error, under the attribute its first prop came from; a WriteError's hint goes with it (P-081). */
  fail(
    change: ApplyChangeData,
    error: unknown,
    keys: readonly (keyof FigmaProps)[] = [],
  ): void {
    const attribute = keys.map((key) => change.sources[key]).find((source) => source !== undefined) ?? keys[0];
    const hint = error instanceof WriteError ? error.hint : undefined;

    this.#errors.push({
      line: change.line,
      column: change.column,
      ...(change.id === null ? {} : { id: change.id }),
      ...(attribute === undefined ? {} : { attribute }),
      message: error instanceof Error ? error.message : String(error),
      ...(hint === undefined ? {} : { hint }),
    });
  }

  made(change: ApplyChangeData, node: Pick<BaseNode, "id" | "name">): void {
    this.#created.push({ line: change.line, ref: change.ref, id: node.id, tag: change.tag, name: node.name });
    this.#made.add(node.id);
  }

  /** Whether the call made the layer. */
  isMade(id: string): boolean {
    return this.#made.has(id);
  }

  /** A layer the call made and took away again is no longer created; whether it was one. */
  unmade(id: string): boolean {
    const at = this.#created.findIndex((one) => one.id === id);

    if (at < 0) {
      return false;
    }

    this.#created.splice(at, 1);
    this.#made.delete(id);

    return true;
  }

  /** A layer written to, once. */
  wroteTo(id: string): void {
    if (!this.#made.has(id)) {
      this.#changed.add(id);
    }
  }

  /** A dry run's: the layer the change would make, which has no id yet, or the one it would write to. */
  planned(change: ApplyChangeData, writes: boolean): void {
    if (change.kind === APPLY_CHANGE_KIND.create) {
      this.#created.push({ line: change.line, ref: change.ref, tag: change.tag });
    } else if (writes && change.id !== null) {
      this.#changed.add(change.id);
    }
  }

  /** What the call did; the properties of the components it made are theirs from the start, so left out. */
  result(added: readonly ApplyProperty[] = []): {
    created: ApplyCreated[];
    changed: string[];
    errors: ApplyErrorEntry[];
    properties?: ApplyProperty[];
  } {
    const properties = added.filter(({ component }) => !this.#made.has(component));

    return {
      created: this.#created,
      changed: [...this.#changed],
      errors: this.#errors,
      ...(properties.length === 0 ? {} : { properties }),
    };
  }
}
