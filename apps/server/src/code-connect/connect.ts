import type { SnapshotNode } from "@pixelwright/core";
import type { TemplateFile } from "../types/code-connect.ts";
import { RenderSession } from "./runtime.ts";
import { templateFor } from "./templates.ts";

/** Connected instances whose code is the same: listed once, with all their ids. */
export interface CodeGroup {
  readonly ids: string[];
  readonly component: string;
  readonly template: string;
  readonly snippet: string;
  readonly imports: string[];
}

/** Instances one template failed on, with the first of their errors. */
export interface CodeErrorGroup {
  readonly template: string;
  readonly error: string;
  readonly ids: string[];
}

export interface CodeRead {
  /** The instances to write as $code, with the name $code gives them. */
  readonly connected: Map<string, string>;
  readonly components: CodeGroup[];
  readonly errors: CodeErrorGroup[];
  /** Connected instances read as layers because the code would not fit. */
  readonly left: number;
  /** The characters the code takes. */
  readonly used: number;
}

/**
 * The code of the visible instances templates connect, outermost first. An instance its template renders is written as
 * $code (its nested instances live in its snippet) — but never the layer the read is of, whose own layers were asked
 * for. One whose layers the read left out is not rendered (its code would miss them), one whose template fails is read
 * on with its children; their errors are listed once per template. Snippets and imports take at most `room`
 * characters: the instances past it are read as layers.
 */
export function connectSnapshot(root: SnapshotNode, templates: readonly TemplateFile[], room: number): CodeRead {
  const session = new RenderSession(templates);
  const connected = new Map<string, string>();
  const groups = new Map<string, CodeGroup>();
  const errors = new Map<string, CodeErrorGroup>();
  let used = 0;
  let left = 0;
  const fail = (template: string, error: string, id: string) => {
    const code = error.split(":")[0] ?? error;
    const group = errors.get(`${template}\n${code}`);

    if (group === undefined) {
      errors.set(`${template}\n${code}`, {
        template,
        error,
        ids: [id],
      });
    } else {
      group.ids.push(id);
    }
  };
  const visit = (node: SnapshotNode) => {
    if (!node.visible) {
      return;
    }

    const template = node.instance === undefined ? null : templateFor(node.instance, templates);

    if (template !== null && used > room) {
      // Past the room for code: a connected instance is read as layers.
      left += 1;
    } else if (template !== null && cut(node)) {
      fail(
        template.path,
        `TEMPLATE_CUT: the read left out layers inside ${node.name} (${node.id}), which its code needs: read it with design_read node=${node.id}.`,
        node.id,
      );
    } else if (template !== null) {
      const outcome = session.render(node);

      if (outcome !== null && "error" in outcome) {
        fail(outcome.template, outcome.error, node.id);
      } else if (outcome !== null) {
        const key = `${outcome.template}\n${outcome.snippet}`;
        const group = groups.get(key);
        const size = group === undefined ? outcome.snippet.length + outcome.imports.join("\n").length : node.id.length;

        if (used + size > room) {
          left += 1;
          used = room + 1;
        } else {
          used += size;

          if (group === undefined) {
            groups.set(key, {
              ids: [node.id],
              component: outcome.component,
              template: outcome.template,
              snippet: outcome.snippet,
              imports: outcome.imports,
            });
          } else {
            group.ids.push(node.id);
          }

          if (node !== root) {
            connected.set(node.id, outcome.component);

            return;
          }
        }
      }
    }

    for (const child of node.children ?? []) {
      visit(child);
    }
  };

  visit(root);

  return {
    connected,
    components: [...groups.values()],
    errors: [...errors.values()],
    left,
    used: Math.min(used, room),
  };
}

/** The read left out layers inside this instance: a visible layer in it lists fewer children than it has. */
function cut(node: SnapshotNode): boolean {
  return (
    node.visible &&
    ((node.children?.length ?? 0) < node.childCount ||
      (node.children ?? []).some((child) => child.visible && cut(child)))
  );
}
