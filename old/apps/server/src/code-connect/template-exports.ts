import type { Executed, TemplateFile } from "../types/code-connect.ts";
import { sectionsOf } from "./sections.ts";
import { TemplateError } from "./template-error.ts";

/**
 * What a template exports as its code: `{ example, imports?, id?, metadata? }`, or a figma.value (what Figma's React
 * parser writes for a value: its preview is its code).
 */
export function exported(value: unknown, template: TemplateFile): Executed {
  if (typeof value === "object" && value !== null && "example" in value) {
    return {
      sections: sectionsOf(value.example),
      imports: "imports" in value && Array.isArray(value.imports) ? value.imports.filter(isString) : [],
      id: "id" in value && typeof value.id === "string" ? value.id : null,
      metadata: "metadata" in value ? value.metadata : undefined,
    };
  }

  if (typeof value === "object" && value !== null && "preview" in value) {
    return {
      sections: sectionsOf(value.preview),
      imports: [],
      id: null,
      metadata: "metadata" in value ? value.metadata : undefined,
    };
  }

  throw new TemplateError(
    "TEMPLATE_EXAMPLE",
    `${template.path} has no example: it must export default { example: figma.code\`…\` }.`,
  );
}

/** A template's metadata as nesting templates read it: `__props`, and `props` (what Figma's migrate writes) the same. */
export function metadataOf(metadata: unknown): Record<string, unknown> {
  const given = typeof metadata === "object" && metadata !== null ? (metadata as Record<string, unknown>) : {};
  const props = given.__props ?? given.props ?? {};

  return {
    ...given,
    __props: given.__props ?? props,
    props: given.props ?? props,
  };
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
