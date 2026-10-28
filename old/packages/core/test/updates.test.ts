import { describe, expect, it } from "vitest";
import { changelogLink, isNewerVersion, isUpdateLink, UPDATE_GUIDE_LINK, UpdateEventSchema } from "../src/index.ts";

describe("a newer Pixelwright", () => {
  it("is newer part by part, the parts compared as numbers", () => {
    expect(isNewerVersion("0.3.10", "0.3.9")).toBe(true);
    expect(isNewerVersion("0.4.0", "0.3.9")).toBe(true);
    expect(isNewerVersion("1.0.0", "0.9.12")).toBe(true);
    expect(isNewerVersion("0.3.1", "0.3.1")).toBe(false);
    expect(isNewerVersion("0.3.0", "0.3.1")).toBe(false);
  });

  it("is never a prerelease or a version it cannot read", () => {
    expect(isNewerVersion("0.4.0-beta.1", "0.3.1")).toBe(false);
    expect(isNewerVersion("latest", "0.3.1")).toBe(false);
    expect(isNewerVersion("0.4.0", "dev")).toBe(false);
  });

  it("links its changes on the site and the update steps in the README, the only update links the plugin opens", () => {
    expect(changelogLink("0.3.2")).toBe("https://maximwas.github.io/pixelwright/changelog/#v0-3-2");
    expect(UPDATE_GUIDE_LINK).toBe("https://github.com/maximwas/pixelwright#updating");
    expect(isUpdateLink(UPDATE_GUIDE_LINK)).toBe(true);
    expect(isUpdateLink(changelogLink("0.3.2"))).toBe(true);
    expect(isUpdateLink("https://maximwas.github.io/pixelwright/changelog/#v0-3-2/../../evil")).toBe(false);
    expect(isUpdateLink("https://example.com/#updating")).toBe(false);
  });

  it("comes to the plugin as an event holding its version", () => {
    expect(UpdateEventSchema.safeParse({ version: "0.3.2" }).success).toBe(true);
    expect(UpdateEventSchema.safeParse({ version: 3 }).success).toBe(false);
  });
});
