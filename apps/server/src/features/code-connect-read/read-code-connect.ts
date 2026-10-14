import type * as z from "zod";
import { ConnectionIndex } from "../../code-connect/connection-index.ts";
import { findTemplates } from "../../code-connect/templates.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { CodeConnectReadInputSchema, CodeConnectReadOutputSchema } from "./schemas.ts";
import { reportsOf, withValues } from "./template-report.ts";
import { TemplateUses } from "./template-uses.ts";

type Output = z.output<typeof CodeConnectReadOutputSchema>;

/**
 * The project's connections against the instances of a page or layer, as design_read shows them: what each connects
 * and how, what a trial run gives (its error, what its code leaves out), what none connects, and why a file is out.
 */
export async function readCodeConnect(
  plugin: PluginClient,
  { node, file }: z.output<typeof CodeConnectReadInputSchema>,
  root: string,
): Promise<Output> {
  const { templates, problems } = await findTemplates(root);
  const session = plugin.session(file);
  const within = node ?? session.info()?.page.id ?? "";
  const snapshot = await session.run("snapshot", {
    node: within,
    css: "none",
  });
  const fileKey = session.info()?.file.key ?? null;
  const uses = new TemplateUses(new ConnectionIndex(templates, { fileKey }));

  uses.visit(snapshot.root);

  const reports = await reportsOf({
    templates,
    uses,
    root,
    fileKey,
  });
  // One read of the components the page uses gives the variant options every getEnum mapping is checked against.
  const components = reports.some(({ enums }) => enums.length > 0)
    ? await session.run("components", {
        scope: "used",
        within,
        limit: 500,
      })
    : null;

  return {
    root,
    templates: withValues(reports, components),
    unconnected: [...uses.unconnected.values()],
    problems: [
      ...(templates.length === 0 && problems.length === 0
        ? [
            `No Code Connect templates (*.figma.ts, *.figma.js) or batch files (*.figma.batch.json) in ${root}: write them as Figma documents them (guide topic code-connect).`,
          ]
        : []),
      ...problems,
      ...(uses.cut
        ? ["Some layers were read without their children (Figma's size budget): pass node to look in one section."]
        : []),
    ],
  };
}
