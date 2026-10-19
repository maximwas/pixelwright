import type { ApplyChange, ApplyError, OperationOutput } from "@pixelwright/core";
import { WriteError } from "../../figma/write-error.ts";
import { errorMessage } from "../../utils/error-message.ts";

type Applied = OperationOutput<"apply">;

/** What a call made, changed and could not write, element by element. */
export class ApplyReport {
  readonly #created: Applied["created"] = [];
  readonly #changed: string[] = [];
  readonly #errors: ApplyError[] = [];

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
  }

  wroteTo(node: BaseNode): void {
    this.#changed.push(node.id);
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
      this.#changed.push(change.id);
    }
  }

  /** Whether the call made or changed anything: its one undo step. */
  get touched(): boolean {
    return this.#created.length > 0 || this.#changed.length > 0;
  }

  result(): Applied {
    return {
      created: this.#created,
      changed: this.#changed,
      errors: this.#errors,
    };
  }
}
