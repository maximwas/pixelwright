import { describe, expect, it } from "vitest";
import { readApply } from "../src/index.ts";

describe("design_apply's reader on a big XML", () => {
  it("reads 20 000 lines in well under a second, positions exact", () => {
    const lines = Array.from({ length: 20_000 }, (_, index) => `  <Rectangle id="1:${index + 2}" width="10px"/>`);
    const xml = `<Frame id="1:1">\n${lines.join("\n")}\n</Frame>`;
    const started = performance.now();
    const { elements, errors } = readApply(
      xml.replace('<Rectangle id="1:19999" width="10px"/>', '<Rectangle id="1:19999" widht="10px"/>'),
    );
    const took = performance.now() - started;

    expect(elements).toHaveLength(20_001);
    expect(errors).toEqual([
      expect.objectContaining({
        line: 19_999,
        column: 3,
      }),
    ]);
    expect(took).toBeLessThan(1_000);
  });
});
