import type { OperationResult } from "@pixelwright/core";
import type { SnapshotInstance, TemplateFile } from "../types/code-connect.ts";
import { comparable, templateName } from "./names.ts";

/** How a connection matched: by the component's key, by the id its url names, or by name. */
export type MatchRule = "key" | "id" | "name";

export interface ConnectionMatch {
  readonly template: TemplateFile;
  readonly by: MatchRule;
}

type ComponentEntry = OperationResult<"components">["components"][number];

/** What a connection is matched against: an instance's component (and set), or a component listed on its own. */
interface Target {
  readonly keys: readonly string[];
  readonly ids: readonly string[];
  readonly name: string;
  readonly remote: boolean;
}

/**
 * The project's connections indexed once per read, matched in this order: 1 a keyed connection by the set's or
 * component's key, in any file (a keyed one is tried by no other rule); keyless ones 2 by the id their url names (a
 * component this file defines) with the names agreeing, 3 by name, 4 by the id alone. Once the file's key is known, a
 * url's id counts only from this file's urls. The first connection by path wins each rule.
 */
export class ConnectionIndex {
  readonly #byKey = new Map<string, TemplateFile>();
  readonly #byNode = new Map<string, TemplateFile[]>();
  readonly #byName = new Map<string, TemplateFile>();
  readonly #order = new Map<TemplateFile, number>();

  constructor(templates: readonly TemplateFile[], { fileKey = null }: { fileKey?: string | null } = {}) {
    templates.forEach((template, order) => {
      this.#order.set(template, order);

      if (template.key !== undefined) {
        this.#byKey.set(template.key, this.#byKey.get(template.key) ?? template);

        return;
      }

      if (template.nodeId !== undefined && (fileKey === null || template.fileKey === fileKey)) {
        this.#byNode.set(template.nodeId, [...(this.#byNode.get(template.nodeId) ?? []), template]);
      }

      const name = comparable(templateName(template));

      this.#byName.set(name, this.#byName.get(name) ?? template);
    });
  }

  /** The connection for an instance, by its component's and set's key, id and name. */
  match(instance: SnapshotInstance): ConnectionMatch | null {
    return this.#find({
      keys: [instance.setKey, instance.componentKey].filter((key) => key !== undefined),
      ids: [instance.componentId, instance.setId].filter((id) => id !== undefined),
      name: instance.setName ?? instance.componentName,
      remote: instance.remote ?? false,
    });
  }

  /** The connection for a component components_read lists: a set's also by a url naming one of its variants. */
  forOwner(entry: ComponentEntry): ConnectionMatch | null {
    return this.#find({
      keys: [entry.key],
      ids: [entry.id, ...(entry.variants ?? []).map(({ id }) => id)],
      name: entry.name,
      remote: entry.remote,
    });
  }

  #find(target: Target): ConnectionMatch | null {
    const keyed = target.keys.map((key) => this.#byKey.get(key)).find((template) => template !== undefined);

    if (keyed !== undefined) {
      return {
        template: keyed,
        by: "key",
      };
    }

    const name = comparable(target.name);
    const byId = target.remote ? [] : this.#linked(target.ids);
    const both = byId.find((template) => comparable(templateName(template)) === name);
    const byName = this.#byName.get(name);
    const found: [TemplateFile | undefined, MatchRule][] = [
      [both, "id"],
      [byName, "name"],
      [byId[0], "id"],
    ];
    const [template, by] = found.find(([each]) => each !== undefined) ?? [undefined, "id"];

    return template === undefined
      ? null
      : {
          template,
          by,
        };
  }

  /** The keyless connections whose url names one of these ids, in path order. */
  #linked(ids: readonly string[]): TemplateFile[] {
    return [...new Set(ids.flatMap((id) => this.#byNode.get(id) ?? []))].sort(
      (left, right) => (this.#order.get(left) ?? 0) - (this.#order.get(right) ?? 0),
    );
  }
}
