import type { SnapshotNode } from "@pixelwright/core";
import type { TemplateFile } from "../types/code-connect.ts";
import { renderInstance } from "./runtime.ts";

/** A visible instance a template connects: its code, or the error its template gave. */
export type CodeComponent =
  | { id: string; component: string; template: string; snippet: string; imports: string[] }
  | { id: string; template: string; error: string };

/**
 * The code of every visible instance a template connects, outermost first: an instance its template renders keeps its
 * nested instances inside its own snippet and is collapsed in the XML (`connected`); one whose template fails is
 * listed with its error and read on, its children included. The imports once each, in the order the code needs them.
 */
export function connectSnapshot(
  root: SnapshotNode,
  templates: readonly TemplateFile[],
): { connected: Map<string, string>; codeComponents: CodeComponent[]; imports: string[] } {
  const connected = new Map<string, string>();
  const codeComponents: CodeComponent[] = [];
  const visit = (node: SnapshotNode) => {
    if (!node.visible) {
      return;
    }

    const rendered = node.type === "INSTANCE" ? renderInstance(node, templates) : null;

    if (rendered !== null && "snippet" in rendered) {
      connected.set(node.id, rendered.component);
      codeComponents.push({
        id: node.id,
        ...rendered,
      });

      return;
    }

    if (rendered !== null) {
      codeComponents.push({
        id: node.id,
        ...rendered,
      });
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  visit(root);

  return {
    connected,
    codeComponents,
    imports: [...new Set(codeComponents.flatMap((code) => ("imports" in code ? code.imports : [])))],
  };
}
