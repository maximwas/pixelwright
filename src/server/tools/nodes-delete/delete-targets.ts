import { NODES_DELETE_ID, NODES_DELETE_TEXT } from "@/server/tools/nodes-delete/nodes-delete.constants.ts";

export interface DeleteSplit {
  readonly nodes: string[];
  readonly dropped: { id: string; message: string }[];
}

/**
 * The ids a delete really sends: each once, and none inside a listed layer, as the plugin deletes the layer first and
 * answers "No layer" for the second, which a dry run would not (T-045). The server knows only the ancestry an id
 * spells (`I1:2;3:4` is inside `1:2`); a plain frame's children are the plugin's to know.
 */
export class DeleteTargets {
  split(ids: readonly string[]): DeleteSplit {
    const listed = new Set(ids);
    const nodes: string[] = [];
    const dropped: DeleteSplit["dropped"] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      const ancestor = this.#ancestors(id).find((candidate) => listed.has(candidate));

      if (seen.has(id)) {
        dropped.push({ id, message: NODES_DELETE_TEXT.listedTwice });
      } else if (ancestor === undefined) {
        nodes.push(id);
      } else {
        dropped.push({ id, message: NODES_DELETE_TEXT.insideListed(ancestor) });
      }

      seen.add(id);
    }

    return { nodes, dropped };
  }

  /** `I1:2;3:4;5:6` is inside `I1:2;3:4`, which is inside `1:2`. */
  #ancestors(id: string): string[] {
    const parts = id.replace(NODES_DELETE_ID.instancePrefix, "").split(NODES_DELETE_ID.separator);

    return parts.slice(0, -1).map((_part, index) => {
      const path = parts.slice(0, index + 1).join(NODES_DELETE_ID.separator);

      return index === 0 ? path : NODES_DELETE_ID.instancePrefix + path;
    });
  }
}
