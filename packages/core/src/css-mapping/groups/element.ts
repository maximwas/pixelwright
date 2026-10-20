import type { Rule } from "../property-group.ts";

/** A link, on an element or on a run of its text. */
export const HREF_RULE: Rule = {
  attributes: ["href"],
  write: ({ own }, out) => out.set("hyperlink", own("href") ?? "", "href"),
};

/**
 * What an element says about its layer beyond CSS: its name, link, component, variant and properties, description,
 * notes, the property a layer of a new component makes, and an asset's file. design_read writes them as it walks the
 * tree; here they are written back.
 */
export const ELEMENT_RULES: readonly Rule[] = [
  {
    attributes: ["name"],
    write: ({ own }, out) => out.set("name", own("name") ?? "", "name"),
  },
  HREF_RULE,
  {
    attributes: ["component"],
    write: ({ own }, out) => out.set("component", own("component") ?? "", "component"),
  },
  {
    attributes: ["variant"],
    write: listRule("variant"),
  },
  {
    attributes: ["props"],
    write: listRule("props"),
  },
  {
    attributes: ["description"],
    write: ({ own }, out) => out.set("description", own("description") ?? "", "description"),
  },
  {
    attributes: ["note"],
    write: ({ own }, out) => out.set("notes", notesOf(own("note") ?? ""), "note"),
  },
  {
    attributes: ["prop", "visibleProp", "swapProp"],
    write: ({ own }, out) => {
      const text = own("prop");
      const visible = own("visibleProp");
      const swap = own("swapProp");

      out.set(
        "property",
        {
          ...(text === undefined ? {} : { text }),
          ...(visible === undefined ? {} : { visible }),
          ...(swap === undefined ? {} : { swap }),
        },
        text === undefined ? (visible === undefined ? "swapProp" : "visibleProp") : "prop",
      );
    },
  },
  {
    attributes: ["mask"],
    write: ({ own }, out) => {
      const value = (own("mask") ?? "").trim().toLowerCase();

      if (value === "none" || value === "") {
        out.set("mask", { isMask: false }, "mask");
      } else if (value === "alpha" || value === "vector" || value === "luminance") {
        out.set(
          "mask",
          {
            isMask: true,
            maskType: value.toUpperCase() as "ALPHA" | "VECTOR" | "LUMINANCE",
          },
          "mask",
        );
      } else {
        out.fail("mask", `mask="${value}" is not alpha, vector, luminance or none.`);
      }
    },
  },
  {
    attributes: ["src"],
    write: ({ tag, own }, out) => {
      if (tag === "Image" || tag === "Icon") {
        out.set(
          "asset",
          {
            kind: tag === "Image" ? "image" : "icon",
            src: own("src") ?? "",
          },
          "src",
        );
      } else {
        out.fail(
          "src",
          `src makes an <Image> or an <Icon>, not a <${tag}>.`,
          `Fill it with the picture by its background: background="url(${own("src") ?? ""})".`,
        );
      }
    },
  },
];

/** design_read's list `Name=Value, Other=Value`, a comma, equals sign or backslash in it escaped with a backslash. */
function listRule(key: "variant" | "props"): Rule["write"] {
  return ({ own }, out) => {
    const value = own(key) ?? "";
    const items = listOf(value);

    if (items === null) {
      out.fail(
        key,
        `${key}="${value}" is not a list of Name=Value, separated by commas.`,
        "Escape a comma or = in a name or value with a backslash.",
      );
    } else {
      out.set(key, items, key);
    }
  };
}

/** design_read's list `Name=Value, Other=Value`, a comma, equals sign or backslash in it escaped with a backslash. */
function listOf(value: string): Record<string, string> | null {
  const items = splitEscaped(value, ",");
  const pairs: [string, string][] = [];

  for (const [index, item] of items.entries()) {
    const at = unescapedIndex(item, "=");

    if (at !== -1) {
      pairs.push([unescaped(item.slice(0, at)).trim(), unescaped(item.slice(at + 1)).trim()]);
    } else if (index < items.length - 1 || unescaped(item).trim() !== "") {
      // Every item names a property; only a trailing comma may leave an empty one.
      return null;
    }
  }

  return Object.fromEntries(pairs);
}

/** design_read's notes: `Category: note | Another`, a bar or backslash in a note escaped with a backslash. */
function notesOf(value: string): { category: string | null; label: string }[] {
  return splitEscaped(value, "|")
    .map((item) => unescaped(item).trim())
    .filter((item) => item !== "")
    .map((item) => {
      const at = item.indexOf(": ");

      return at === -1
        ? {
            category: null,
            label: item,
          }
        : {
            category: item.slice(0, at),
            label: item.slice(at + 2),
          };
    });
}

/** The parts between unescaped separators, their escapes kept (an escaped separator is no separator). */
function splitEscaped(value: string, separator: string): string[] {
  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < value.length; index++) {
    if (value[index] === "\\") {
      index += 1;
    } else if (value[index] === separator) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  parts.push(value.slice(start));

  return parts;
}

/** Where a character first stands unescaped, or -1. */
function unescapedIndex(value: string, char: string): number {
  for (let index = 0; index < value.length; index++) {
    if (value[index] === "\\") {
      index += 1;
    } else if (value[index] === char) {
      return index;
    }
  }

  return -1;
}

/** The text with its backslash escapes undone: a backslash keeps the character after it. */
function unescaped(value: string): string {
  return value.replace(/\\([\s\S])/g, "$1");
}
