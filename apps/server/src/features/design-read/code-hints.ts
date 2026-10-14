import { sourceMissing } from "../../code-connect/code-source.ts";
import type { CodeRead } from "../../code-connect/connect.ts";
import type { TemplateFile } from "../../types/code-connect.ts";

/** How many components without code the hint names before "and N more". */
const NAMED_UNCONNECTED = 5;

/**
 * What design_read says of the project's Code Connect files for this read (each hint gets "Code Connect: " before it): the components it shows that have no code
 * (the most used first), a source file that no longer exists, and a plugin too old for keyed files to match.
 */
export async function codeHints(
  code: CodeRead,
  { templates, project, node }: { templates: readonly TemplateFile[]; project: string; node: string },
): Promise<string[]> {
  return [
    ...unconnectedHint(code, node),
    ...(await missingSources(code, project)),
    ...(code.setKeysMissing && templates.some(({ key }) => key !== undefined)
      ? [
          "The Pixelwright plugin in this file is older than the server, so keyed Code Connect files cannot match it: update it (npx -y pixelwright@latest).",
        ]
      : []),
  ];
}

function unconnectedHint(code: CodeRead, node: string): string[] {
  const counted = [...code.unconnected].sort(([, left], [, right]) => right - left);

  if (counted.length === 0) {
    return [];
  }

  const named = counted.slice(0, NAMED_UNCONNECTED).map(([name, instances]) => `${name} (${instances})`);
  const more = counted.length - named.length;
  const list = more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ");

  return [
    `${counted.length} component${counted.length === 1 ? "" : "s"} shown here ${counted.length === 1 ? "has" : "have"} no code: ${list}. components_read within=${node} mapped=false gives their keys and properties: connect each with a batch row or a template (guide code-connect), or build it.`,
  ];
}

/** A hint for each source a used connection names that does not exist, once each. */
async function missingSources(code: CodeRead, project: string): Promise<string[]> {
  const hints: string[] = [];

  for (const { template, source } of code.components) {
    const hint = `${source}, the source ${template} names, does not exist: the code moved or was deleted; correct it there.`;

    if (
      source !== undefined &&
      !hints.includes(hint) &&
      (await sourceMissing(project, {
        path: template,
        source: "",
        codeSource: source,
      }))
    ) {
      hints.push(hint);
    }
  }

  return hints;
}
