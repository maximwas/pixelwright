import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";

const lists = new NameValueList();

/** A name or value made mostly of what must be escaped, its ends never blank: the parser trims each side. */
const PART = fc
  .string({ unit: fc.constantFrom(",", "=", "\\", " ", "a", "Z", "é", "😀") })
  .filter((part) => part.trim() === part);

// K-069: a variant or a component's properties as one `Name=Value, Other=Value` list, `,` `=` `\` escaped.
describe("NameValueList", () => {
  it("reads back every list it writes, separators and backslashes in names and values included", () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          PART.filter((name) => name !== ""),
          PART,
        ),
        (values) => {
          expect(lists.parse(lists.write(values))).toEqual(values);
        },
      ),
    );
  });

  it.each([
    ["Figma's variant name", "State=Hover, Size=L", { State: "Hover", Size: "L" }],
    ["a trailing comma", "State=Hover,", { State: "Hover" }],
    ["an item that names no property", "State=Hover, Large", null],
  ])("reads %s", (_name, text, expected) => {
    expect(lists.parse(text)).toEqual(expected);
  });
});
