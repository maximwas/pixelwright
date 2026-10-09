import { describe, expect, it } from "vitest";
import { runOperation } from "../src/figma/operations.ts";

describe("plugin operations", () => {
  it("answers ping and refuses an operation it does not have", async () => {
    await expect(runOperation("ping", null)).resolves.toEqual({ pong: true });
    await expect(runOperation("format_disk", null)).rejects.toMatchObject({ code: "UNKNOWN_OP" });
  });
});
