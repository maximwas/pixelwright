import type { SnapshotNode } from "@pixelwright/core";
import { InstanceHandle, type Runner } from "./handles.ts";
import { reactHelpers } from "./react-helpers.ts";
import { sectionsOf, templateTag } from "./sections.ts";

/** The `figma` a template imports, for this instance (figma-types.d.ts Figma); `batch` is a batch row's own. */
export function figmaApi(node: SnapshotNode, run: Runner, batch: Readonly<Record<string, unknown>> = {}) {
  const selected = new InstanceHandle(node, run);
  const tsx = templateTag("tsx");

  return {
    selectedInstance: selected,
    currentLayer: selected,
    properties: selected.__properties__,
    batch,
    code: templateTag("raw"),
    tsx,
    html: templateTag("html"),
    swift: templateTag("swift"),
    kotlin: templateTag("kotlin"),
    value: (raw: unknown, preview?: unknown) => ({
      type: "VALUE",
      value: raw,
      preview: preview ?? raw,
    }),
    helpers: {
      react: reactHelpers(tsx),
      swift: { renderChildren: prefixed },
      kotlin: { renderChildren: prefixed },
    },
  };
}

/** Swift's and Kotlin's renderChildren: a prefix of code, then the children's sections. */
function prefixed(children: unknown, prefix: string) {
  return [
    {
      type: "CODE",
      code: prefix,
    },
    ...sectionsOf(children),
  ];
}
