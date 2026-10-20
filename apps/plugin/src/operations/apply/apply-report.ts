import type { ApplyChange, ApplyError, OperationOutput } from "@pixelwright/core";
import { WriteError } from "../../figma/write-error.ts";
import { errorMessage } from "../../utils/error-message.ts";

type Applied = OperationOutput<"apply">;

/** A component property the call added (a dry run's: would add). */
export type AddedProperty = NonNullable<Applied["properties"]>[number];

/** What a call made, changed, added to components and could not write, element by element. */
export class ApplyReport {
  readonly #created: Applied["created"] = [];
  /** The ids of the layers the call made. */
  readonly #made = new Set<string>();
  readonly #changed = new Set<string>();
  readonly #errors: ApplyError[] = [];
  readonly #properties: AddedProperty[] = [];

  /** An element's error, under the attribute it came from; a WriteError's hint goes with it. */
  fail(change: ApplyChange, error: unknown, attribute?: string): void {
    const hint = error instanceof WriteError ? error.hint : undefined;

    this.#errors.push({
      line: change.line,
      column: change.column,
      ...(change.id === null ? {} : { id: change.id }),
      ...(attribute === undefined ? {} : { attribute }),
      message: errorMessage(error),
      ...(hint === undefined ? {} : { hint }),
    });
  }

  made(change: ApplyChange, node: BaseNode): void {
    this.#created.push({
      line: change.line,
      ref: change.ref,
      id: node.id,
      tag: change.tag,
      name: node.name,
    });
    this.#made.add(node.id);
  }

  /** A layer written to, once; a layer the call made is in created (its properties are bound after it is). */
  wroteTo(node: BaseNode): void {
    if (!this.#made.has(node.id)) {
      this.#changed.add(node.id);
    }
  }

  /** A property added to a component, once: a dry run meets one it would add again on another layer. */
  added(property: AddedProperty): void {
    const { component, name, type } = property;

    if (!this.#properties.some((one) => one.component === component && one.name === name && one.type === type)) {
      this.#properties.push(property);
    }
  }

  /** A dry run's: the layer the change would make, which has no id yet, or the one it would write to. */
  planned(change: ApplyChange): void {
    if (change.kind === "create") {
      this.#created.push({
        line: change.line,
        ref: change.ref,
        tag: change.tag,
      });
    } else if (change.id !== null) {
      this.#changed.add(change.id);
    }
  }

  /** Whether the call made or changed anything: its one undo step. */
  get touched(): boolean {
    return this.#created.length > 0 || this.#changed.size > 0;
  }

  /** What the call did; the properties of the components it made are theirs from the start, so left out. */
  result(): Applied {
    const properties = this.#properties.filter(({ component }) => !this.#made.has(component));

    return {
      created: this.#created,
      changed: [...this.#changed],
      errors: this.#errors,
      ...(properties.length === 0 ? {} : { properties }),
    };
  }
}
