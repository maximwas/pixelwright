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
    attributes: ["prop", "visibleProp"],
    write: ({ own }, out) => {
      const text = own("prop");
      const visible = own("visibleProp");

      out.set(
        "property",
        {
          ...(text === undefined ? {} : { text }),
          ...(visible === undefined ? {} : { visible }),
        },
        text === undefined ? "visibleProp" : "prop",
      );
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
          "A frame's image is its background: url(…).",
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

function listOf(value: string): Record<string, string> | null {
  const items: [string, string][] = [];
  let name: string | null = null;
  let current = "";

  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? "";

    if (char === "\\" && index + 1 < value.length) {
      index += 1;
      current += value[index] ?? "";
    } else if (char === "=" && name === null) {
      name = current.trim();
      current = "";
    } else if (char === ",") {
      if (name === null) {
        return null;
      }

      items.push([name, current.trim()]);
      name = null;
      current = "";
    } else {
      current += char;
    }
  }

  if (name !== null) {
    items.push([name, current.trim()]);
  } else if (current.trim() !== "") {
    return null;
  }

  return Object.fromEntries(items);
}

/** design_read's notes: `Category: note | Another`, a bar or backslash in a note escaped with a backslash. */
function notesOf(value: string): { category: string | null; label: string }[] {
  const items: string[] = [];
  let current = "";

  for (let index = 0; index < value.length; index++) {
    const char = value[index] ?? "";

    if (char === "\\" && index + 1 < value.length) {
      index += 1;
      current += value[index] ?? "";
    } else if (char === "|") {
      items.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  items.push(current);

  return items
    .map((item) => item.trim())
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
