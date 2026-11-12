import { describe, expect, it } from "vitest";
import { OpReport } from "@/plugin/app/op-report.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error.ts";

describe("OpReport", () => {
  const report = new OpReport();

  it("keeps an expected failure's code and makes anything else OP_FAILED", () => {
    expect(report.failed(new PixelwrightError("NODE_NOT_FOUND", "1:2 is gone"))).toEqual({
      ok: false,
      error: { code: "NODE_NOT_FOUND", message: "1:2 is gone" },
    });
    expect(report.failed("plain")).toEqual({ ok: false, error: { code: "OP_FAILED", message: "plain" } });
  });

  it("tells the user to reopen the window when Figma's sandbox spent its callback ids (P-023)", () => {
    const result = report.failed(new Error("Attempted to invoke callback with invalid id -32605"));

    expect(result).toMatchObject({
      ok: false,
      error: { message: expect.stringMatching(/^Attempted to invoke callback with invalid id -32605\. /) },
    });
    expect(result).toMatchObject({
      error: { message: expect.stringContaining("close and reopen the Pixelwright plugin window") },
    });
  });
});
