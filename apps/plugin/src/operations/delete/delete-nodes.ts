import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { pageOf } from "../../figma/nodes.ts";
import type { EditsGuard } from "../../services/edits-guard.ts";
import { errorMessage } from "../../utils/error-message.ts";

/**
 * Deletes layers, each on its own: one Figma will not delete (inside an instance, a page) stays with its reason. One
 * undo step for the call; refused while Allow edits is off.
 */
export async function deleteNodes(
  { nodes }: OperationInput<"delete">,
  edits: EditsGuard,
): Promise<OperationOutput<"delete">> {
  edits.require();

  const deleted: string[] = [];
  const errors: OperationOutput<"delete">["errors"] = [];

  for (const id of nodes) {
    try {
      const node = await figma.getNodeByIdAsync(id);

      if (node === null || node.type === "PAGE" || node.type === "DOCUMENT") {
        throw new Error(`No layer ${id} in this file.`);
      }

      if (insideInstance(node)) {
        throw new Error(
          'A layer inside an instance comes from its component and cannot be deleted: hide it with display="none" in design_apply.',
        );
      }

      const page = pageOf(node);

      if (page !== null && page !== figma.currentPage) {
        await page.loadAsync();
      }

      (node as SceneNode).remove();
      deleted.push(id);
    } catch (error) {
      errors.push({
        id,
        message: errorMessage(error),
      });
    }
  }

  if (deleted.length > 0) {
    figma.commitUndo();
  }

  return {
    deleted,
    errors,
  };
}

function insideInstance(node: BaseNode): boolean {
  for (let current = node.parent; current !== null; current = current.parent) {
    if (current.type === "INSTANCE") {
      return true;
    }
  }

  return false;
}
