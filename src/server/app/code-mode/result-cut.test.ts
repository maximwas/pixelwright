import { describe, expect, it } from "vitest";
import { ResultCut } from "@/server/app/code-mode/result-cut.ts";

const cut = new ResultCut();

describe("ResultCut", () => {
  it("keeps a result within its characters as it is", () => {
    const value = { rows: [{ id: "1:2" }] };

    expect(cut.result(value, 24_000)).toEqual({ result: value });
  });

  it("cuts a bigger result structurally: valid JSON within the cap, long lists and texts cut with markers, the original size said", () => {
    const rows = Array.from({ length: 3_000 }, (_slot, index) => ({ id: `1:${index}`, name: `Row ${index}` }));
    const value = { page: "Orbit — Pricing", rows, note: "x".repeat(30_000) };
    const { result, chars } = cut.result(value, 24_000) as { result: typeof value; chars: number };

    expect(JSON.stringify(result).length).toBeLessThanOrEqual(24_000);
    expect(JSON.stringify(result).length).toBeGreaterThan(12_000);
    expect(chars).toBe(JSON.stringify(value).length);
    expect(result.page).toBe("Orbit — Pricing");
    expect(result.rows[0]).toEqual({ id: "1:0", name: "Row 0" });
    expect(result.rows.at(-1)).toMatch(/^--- TRUNCATED: \d+ more items ---$/);
    expect(result.note).toMatch(/^x+--- TRUNCATED: \d+ more characters ---$/);
  });

  it("keeps the last log lines within its characters, first saying how many earlier lines it left out", () => {
    const lines = Array.from({ length: 100 }, (_slot, index) => `line ${index} ${"-".repeat(90)}`);
    const kept = cut.logs(lines, 1_000);

    expect(kept[0]).toMatch(/^--- TRUNCATED: \d+ earlier lines ---$/);
    expect(kept.at(-1)).toBe(lines.at(-1));
    expect(kept.join("").length).toBeLessThanOrEqual(1_000);
  });

  it("keeps the end of a last line too long to fit, and counts the lines the sandbox left out", () => {
    const kept = cut.logs(["short", `${"y".repeat(5_000)}END`], 1_000, 7);

    expect(kept[0]).toBe("--- TRUNCATED: 8 earlier lines ---");
    expect(kept[1]).toMatch(/^…y+END$/);
    expect(kept.join("").length).toBeLessThanOrEqual(1_000);
  });
});
