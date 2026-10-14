import type { SnapshotNode } from "@pixelwright/core";
import type * as z from "zod";
import { renderInstance } from "../../code-connect/render-session.ts";
import { findTemplates, templateFor } from "../../code-connect/templates.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { SnapshotInstance, TemplateFile } from "../../types/code-connect.ts";
import type { CodeConnectReadInputSchema, CodeConnectReadOutputSchema } from "./schemas.ts";

type Output = z.output<typeof CodeConnectReadOutputSchema>;

/** The project's templates against the instances of a page or layer: what each connects, what none does, why. */
export async function readCodeConnect(
  plugin: PluginClient,
  { node, file }: z.output<typeof CodeConnectReadInputSchema>,
  root: string,
): Promise<Output> {
  const { templates, problems } = await findTemplates(root);
  const session = plugin.session(file);
  const snapshot = await session.run("snapshot", {
    node: node ?? session.info()?.page.id ?? "",
    css: "none",
  });
  const uses = new TemplateUses(templates);

  uses.visit(snapshot.root);

  return {
    root,
    templates: templates.map((template) => uses.report(template)),
    unconnected: counted(uses.unconnected),
    problems: [
      ...(templates.length === 0 && problems.length === 0
        ? [
            `No Code Connect templates (*.figma.ts, *.figma.js) in ${root}: write one per component as Figma documents them (guide topic code-connect).`,
          ]
        : []),
      ...problems,
      ...(uses.cut
        ? ["Some layers were read without their children (Figma's size budget): pass node to look in one section."]
        : []),
    ],
  };
}

/** The visible instances of a read by template: how many of each component it connects, and the first one to try. */
class TemplateUses {
  readonly #templates: readonly TemplateFile[];
  readonly #matched = new Map<TemplateFile, { counts: Map<string, number>; first: SnapshotNode }>();
  /** The instances no template connects, by component. */
  readonly unconnected = new Map<string, number>();
  /** A visible layer was read without all its children. */
  cut = false;

  constructor(templates: readonly TemplateFile[]) {
    this.#templates = templates;
  }

  visit(layer: SnapshotNode): void {
    if (!layer.visible) {
      return;
    }

    this.cut ||= layer.childCount > (layer.children?.length ?? 0);

    if (layer.instance !== undefined) {
      this.#count(layer, layer.instance);
    }

    for (const child of layer.children ?? []) {
      this.visit(child);
    }
  }

  /** A template with what it connects, and the error a trial run on its first instance gives. */
  report(template: TemplateFile): Output["templates"][number] {
    const entry = this.#matched.get(template);
    const trial = entry === undefined ? null : renderInstance(entry.first, this.#templates);

    return {
      path: template.path,
      ...(template.url === undefined ? {} : { url: template.url }),
      ...(template.component === undefined ? {} : { component: template.component }),
      matches: counted(entry?.counts ?? new Map()),
      ...(trial !== null && "error" in trial ? { error: trial.error } : {}),
    };
  }

  #count(layer: SnapshotNode, instance: SnapshotInstance): void {
    const name = instance.setName ?? instance.componentName;
    const template = templateFor(instance, this.#templates);

    if (template === null) {
      this.unconnected.set(name, (this.unconnected.get(name) ?? 0) + 1);

      return;
    }

    const entry = this.#matched.get(template) ?? {
      counts: new Map<string, number>(),
      first: layer,
    };

    entry.counts.set(name, (entry.counts.get(name) ?? 0) + 1);
    this.#matched.set(template, entry);
  }
}

function counted(counts: ReadonlyMap<string, number>): { component: string; instances: number }[] {
  return [...counts].map(([component, instances]) => ({
    component,
    instances,
  }));
}
