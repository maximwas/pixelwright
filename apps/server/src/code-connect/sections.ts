import type { ResultSection, TemplateStringResult } from "../types/code-connect.ts";

const SECTION_TYPES = new Set(["CODE", "INSTANCE", "SLOT", "ERROR"]);

/** figma.code`…`, figma.tsx`…` and the like: the literal's text as code, each value as the sections it renders to. */
export function templateTag(language: string) {
  return (strings: TemplateStringsArray, ...values: unknown[]): TemplateStringResult => {
    const sections: ResultSection[] = [];

    strings.forEach((part, index) => {
      if (part !== "") {
        sections.push({
          type: "CODE",
          code: part,
        });
      }

      if (index < values.length) {
        sections.push(...sectionsOf(values[index]));
      }
    });

    return {
      type: "SECTIONS",
      language,
      sections,
    };
  };
}

/**
 * A value as it renders inside a template: nothing for undefined and null, its text for strings, numbers and booleans,
 * its sections for a template result, a section list or a layer handle (an instance, a text, an error).
 */
export function sectionsOf(value: unknown): ResultSection[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(sectionsOf);
  }

  if (typeof value === "object") {
    if (isTemplateResult(value)) {
      return value.sections;
    }

    if (
      "type" in value &&
      typeof value.type === "string" &&
      SECTION_TYPES.has(value.type) &&
      !("__render__" in value)
    ) {
      return [value as ResultSection];
    }

    if ("__render__" in value && typeof value.__render__ === "function") {
      return sectionsOf(value.__render__());
    }
  }

  return [
    {
      type: "CODE",
      code: String(value),
    },
  ];
}

/** The text sections render to: code as written, a nested instance as its own code, slots and errors as nothing. */
export function renderSections(sections: readonly ResultSection[]): string {
  return sections
    .map((section) =>
      section.type === "CODE"
        ? section.code
        : section.type === "INSTANCE"
          ? renderSections(section.resultSections ?? [])
          : "",
    )
    .join("");
}

/** The first error a rendering holds, nested instances included; null when it has none. */
export function firstError(sections: readonly ResultSection[]): string | null {
  for (const section of sections) {
    if (section.type === "ERROR") {
      return section.message;
    }

    if (section.type === "INSTANCE") {
      const nested = firstError(section.resultSections ?? []);

      if (nested !== null) {
        return nested;
      }
    }
  }

  return null;
}

/** The imports nested instances in a rendering need, in order, nested ones after their parent's. */
export function nestedImports(sections: readonly ResultSection[]): string[] {
  return sections.flatMap((section) =>
    section.type === "INSTANCE"
      ? [...(section.nestedImports ?? []), ...nestedImports(section.resultSections ?? [])]
      : section.type === "CODE"
        ? (section.nestedImports ?? [])
        : [],
  );
}

export function isTemplateResult(value: object): value is TemplateStringResult {
  return "type" in value && value.type === "SECTIONS" && "sections" in value && Array.isArray(value.sections);
}
