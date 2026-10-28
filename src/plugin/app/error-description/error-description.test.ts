import { describe, expect, it } from "vitest";
import { ErrorDescription } from "@/plugin/app/error-description/error-description.ts";
import { PixelwrightError } from "@/shared/errors/pixelwright-error/pixelwright-error.ts";

describe("ErrorDescription", () => {
  const errors = new ErrorDescription();

  it("keeps an expected failure's code and makes anything else OP_FAILED", () => {
    expect(errors.describe(new PixelwrightError("NODE_NOT_FOUND", "1:2 is gone"))).toEqual({
      code: "NODE_NOT_FOUND",
      message: "1:2 is gone",
    });
    expect(errors.describe("plain")).toEqual({
      code: "OP_FAILED",
      message: "plain",
    });
  });

  it("tells the user to reopen the window when Figma's sandbox spent its callback ids (P-023)", () => {
    const { message } = errors.describe(new Error("Attempted to invoke callback with invalid id -32605"));

    expect(message).toMatch(/^Attempted to invoke callback with invalid id -32605\. /);
    expect(message).toContain("close and reopen the Pixelwright plugin window");
  });
});
