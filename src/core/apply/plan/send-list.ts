import { CHANGE_KIND } from "@/core/apply/apply.constants.ts";
import type { ApplyChange } from "@/core/apply/apply.types.ts";

/**
 * The changes the plugin gets (C-176): what writes something, and a layer made with its parent and the layers beside
 * it, unchanged, so the plugin finds where it goes. The rest stays here, in document order.
 */
export class SendList {
  of(changes: readonly ApplyChange[]): ApplyChange[] {
    const made = changes.filter((change) => change.kind === CHANGE_KIND.create);
    const parents = new Set(made.flatMap((change) => (change.parent === null ? [] : [change.parent])));
    const beside = new Set(made.map((change) => change.parent ?? ""));

    return changes.filter(
      (change) => this.writes(change) || parents.has(change.ref) || beside.has(change.parent ?? ""),
    );
  }

  /** Whether a change writes its layer: makes it, or gives it a property. */
  writes(change: ApplyChange): boolean {
    return change.kind === CHANGE_KIND.create || Object.keys(change.props).length > 0;
  }
}
