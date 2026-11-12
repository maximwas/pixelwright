import type { TemplateFile } from "../types/code-connect.ts";
import { comparable, templateName } from "./names.ts";

/**
 * The connections in use, as they are read: the first for each key, the first for each Figma component a url names; a
 * later one is a problem. Two keyless ones named alike both stay, the second a problem too: a library's component,
 * matched by name, gets the first. A keyed one is never matched by name, so its name clashes with nothing.
 */
export class KeptConnections {
  readonly templates: TemplateFile[] = [];
  readonly #problems: string[];
  readonly #byKey = new Map<string, string>();
  readonly #byNode = new Map<string, string>();
  readonly #byName = new Map<string, string>();

  constructor(problems: string[]) {
    this.#problems = problems;
  }

  add(template: TemplateFile): void {
    if (template.key === undefined ? this.#keptByNode(template) : this.#keptByKey(template)) {
      this.templates.push(template);
    }
  }

  #keptByKey(template: TemplateFile & { key?: string }): boolean {
    const key = template.key ?? "";
    const first = this.#byKey.get(key);

    if (first !== undefined) {
      this.#problems.push(`${template.path}: connects the same key as ${first}, which is the one used.`);

      return false;
    }

    this.#byKey.set(key, template.path);

    return true;
  }

  #keptByNode(template: TemplateFile): boolean {
    const node = `${template.fileKey ?? ""} ${template.nodeId ?? ""}`;
    const first = this.#byNode.get(node);

    if (first !== undefined) {
      this.#problems.push(`${template.path}: connects the same Figma component as ${first}, which is the one used.`);

      return false;
    }

    this.#byNode.set(node, template.path);

    const name = templateName(template);
    const named = this.#byName.get(comparable(name));

    if (named === undefined) {
      this.#byName.set(comparable(name), template.path);
    } else {
      this.#problems.push(
        `${template.path}: also named ${name}, as ${named}: a library's ${name}, matched by name, gets ${named}.`,
      );
    }

    return true;
  }
}
