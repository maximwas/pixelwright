import type { SnapshotNode } from "@pixelwright/core";
import type { RenderedInstance, TemplateFile } from "../types/code-connect.ts";
import { RenderSession } from "./render-session.ts";

/** Connected instances whose code is the same: listed once, with all their ids. */
export interface CodeGroup {
  readonly ids: string[];
  readonly component: string;
  readonly template: string;
  /** The code component's file or package, as its Code Connect file writes it. */
  readonly source?: string;
  readonly snippet: string;
  readonly imports: string[];
  /** The properties of its instances that their code never reads, all of them together. */
  readonly unread?: string[];
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
  /** The components of the instances shown as layers that no connection connects, with how many. */
  readonly unconnected: ReadonlyMap<string, number>;
  /** Some instance's set has no key in the read: a plugin older than the server, which keyed files cannot match. */
  readonly setKeysMissing: boolean;
}

/**
 * The code of the visible instances templates connect, outermost first. An instance its template renders is written as
 * $code (its nested instances live in its snippet) — but never the layer the read is of, whose own layers were asked
 * for. One whose layers the read left out is not rendered (its code would miss them), one whose template fails is read
 * on with its children; their errors are listed once per template. Snippets and imports take at most `room`
 * characters: the instances past it are read as layers.
 */
export function connectSnapshot(
  root: SnapshotNode,
  templates: readonly TemplateFile[],
  room: number,
  fileKey: string | null = null,
): CodeRead {
  return new CodeConnector(root, new RenderSession(templates, { fileKey }), room).read();
}

/** One read's walk for code: the code found so far, grouped, its errors, and the room it has taken. */
class CodeConnector {
  readonly #root: SnapshotNode;
  readonly #room: number;
  readonly #session: RenderSession;
  readonly #connected = new Map<string, string>();
  readonly #groups = new Map<string, CodeGroup>();
  readonly #errors = new Map<string, CodeErrorGroup>();
  readonly #unconnected = new Map<string, number>();
  #setKeysMissing = false;
  #used = 0;
  #left = 0;

  constructor(root: SnapshotNode, session: RenderSession, room: number) {
    this.#root = root;
    this.#room = room;
    this.#session = session;
  }

  read(): CodeRead {
    this.#visit(this.#root);

    return {
      connected: this.#connected,
      components: [...this.#groups.values()],
      errors: [...this.#errors.values()],
      left: this.#left,
      used: Math.min(this.#used, this.#room),
      unconnected: this.#unconnected,
      setKeysMissing: this.#setKeysMissing,
    };
  }

  #visit(node: SnapshotNode): void {
    if (!node.visible || this.#connects(node)) {
      return;
    }

    for (const child of node.children ?? []) {
      this.#visit(child);
    }
  }

  /** Whether the instance is written as $code, its children with it; whatever keeps it out is counted or listed. */
  #connects(node: SnapshotNode): boolean {
    const template = this.#session.connectionOf(node)?.template ?? null;

    if (node.instance !== undefined) {
      this.#setKeysMissing ||= node.instance.setId !== undefined && node.instance.setKey === undefined;
    }

    if (template === null) {
      if (node.instance !== undefined) {
        const name = node.instance.setName ?? node.instance.componentName;

        this.#unconnected.set(name, (this.#unconnected.get(name) ?? 0) + 1);
      }

      return false;
    }

    if (this.#used > this.#room) {
      // Past the room for code: a connected instance is read as layers.
      this.#left += 1;

      return false;
    }

    if (cut(node)) {
      this.#fail(
        template.path,
        `TEMPLATE_CUT: the read left out layers inside ${node.name} (${node.id}), which its code needs: read it with design_read node=${node.id}.`,
        node.id,
      );

      return false;
    }

    const outcome = this.#session.render(node);

    if (outcome === null) {
      return false;
    }

    if ("error" in outcome) {
      this.#fail(outcome.template, outcome.error, node.id);

      return false;
    }

    if (!this.#fits(node, outcome, template) || node === this.#root) {
      return false;
    }

    this.#connected.set(node.id, outcome.component);

    return true;
  }

  /** Whether the code fits in the room left, taken when it does: a group's snippet once, then each id it adds. */
  #fits(node: SnapshotNode, outcome: Exclude<RenderedInstance, { error: string }>, template: TemplateFile): boolean {
    const key = `${outcome.template}\n${outcome.snippet}`;
    const group = this.#groups.get(key);
    const size = group === undefined ? outcome.snippet.length + outcome.imports.join("\n").length : node.id.length;

    if (this.#used + size > this.#room) {
      this.#left += 1;
      this.#used = this.#room + 1;

      return false;
    }

    this.#used += size;

    const unread = this.#session.coverage(node.id)?.unread ?? [];

    if (group === undefined) {
      this.#groups.set(key, {
        ids: [node.id],
        component: outcome.component,
        template: outcome.template,
        ...(template.codeSource === undefined ? {} : { source: template.codeSource }),
        snippet: outcome.snippet,
        imports: outcome.imports,
        ...(unread.length === 0 ? {} : { unread }),
      });
    } else {
      group.ids.push(node.id);
      this.#groups.set(key, withUnread(group, unread));
    }

    return true;
  }

  /** An instance a template failed on, listed under the first error of its kind from that template. */
  #fail(template: string, error: string, id: string): void {
    const code = error.split(":")[0] ?? error;
    const group = this.#errors.get(`${template}\n${code}`);

    if (group === undefined) {
      this.#errors.set(`${template}\n${code}`, {
        template,
        error,
        ids: [id],
      });
    } else {
      group.ids.push(id);
    }
  }
}

/** A group with more of its instances' unread properties, each once. */
function withUnread(group: CodeGroup, unread: readonly string[]): CodeGroup {
  const all = [...new Set([...(group.unread ?? []), ...unread])];

  return all.length === 0
    ? group
    : {
        ...group,
        unread: all,
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
