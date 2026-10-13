import type { SnapshotNode } from "@pixelwright/core";
import type * as z from "zod";
import { resolveTarget } from "../bridge/target.ts";
import { runOp } from "../mcp/run-op.ts";
import type { CodeConnectReadInputSchema, CodeConnectReadOutputSchema } from "../schemas/tools.ts";
import type { TemplateFile } from "../types/code-connect.ts";
import type { BridgeView } from "../types/mcp.ts";
import { renderInstance } from "./runtime.ts";
import { findTemplates, templateFor } from "./templates.ts";

type Output = z.output<typeof CodeConnectReadOutputSchema>;

/** The project's templates against the instances of a page or layer: what each connects, what none does, why. */
export async function readCodeConnect(
  bridge: BridgeView,
  { node, file }: z.output<typeof CodeConnectReadInputSchema>,
  root: string,
): Promise<Output> {
  const { templates, problems } = await findTemplates(root);
  const session = resolveTarget(bridge.plugins(), file).session;
  const page = bridge.plugins().find((plugin) => plugin.session === session)?.info.page.id;
  const snapshot = await runOp(
    bridge,
    "snapshot",
    {
      node: node ?? page ?? "",
      css: "none",
    },
    file,
  );
  const matched = new Map<TemplateFile, { counts: Map<string, number>; first: SnapshotNode }>();
  const unconnected = new Map<string, number>();
  let cut = false;
  const visit = (layer: SnapshotNode) => {
    if (!layer.visible) {
      return;
    }

    cut ||= layer.childCount > (layer.children?.length ?? 0);

    if (layer.instance !== undefined) {
      const name = layer.instance.setName ?? layer.instance.componentName;
      const template = templateFor(layer.instance, templates);

      if (template === null) {
        unconnected.set(name, (unconnected.get(name) ?? 0) + 1);
      } else {
        const entry = matched.get(template) ?? {
          counts: new Map<string, number>(),
          first: layer,
        };

        entry.counts.set(name, (entry.counts.get(name) ?? 0) + 1);
        matched.set(template, entry);
      }
    }

    for (const child of layer.children ?? []) {
      visit(child);
    }
  };

  visit(snapshot.root);

  return {
    root,
    templates: templates.map((template) => {
      const entry = matched.get(template);
      const trial = entry === undefined ? null : renderInstance(entry.first, templates);

      return {
        path: template.path,
        ...(template.url === undefined ? {} : { url: template.url }),
        ...(template.component === undefined ? {} : { component: template.component }),
        matches: [...(entry?.counts ?? [])].map(([component, instances]) => ({
          component,
          instances,
        })),
        ...(trial !== null && "error" in trial ? { error: trial.error } : {}),
      };
    }),
    unconnected: [...unconnected].map(([component, instances]) => ({
      component,
      instances,
    })),
    problems: [
      ...(templates.length === 0 && problems.length === 0
        ? [
            `No Code Connect templates (*.figma.ts, *.figma.js) in ${root}: write one per component as Figma documents them (guide topic code-connect).`,
          ]
        : []),
      ...problems,
      ...(cut
        ? ["Some layers were read without their children (Figma's size budget): pass node to look in one section."]
        : []),
    ],
  };
}
