import { homedir } from "node:os";
import { describe, expect, it } from "vitest";
import type { ClientRoots } from "@/core/ports/client-roots.port.ts";
import { ProjectFolder } from "@/server/app/project/project-folder.ts";

const roots = (...uris: string[]): ClientRoots => ({ uris: async () => uris });

describe("ProjectFolder (T-008)", () => {
  it("starts a relative path in the client's first file root, an https root skipped", async () => {
    const folder = new ProjectFolder(
      roots("https://example.com/repo", "file:///work/app", "file:///other"),
      "/fallback",
    );

    await expect(folder.resolve("design/plan.js")).resolves.toBe("/work/app/design/plan.js");
  });

  it("falls back to CLAUDE_PROJECT_DIR or the working directory when the client lists no root", async () => {
    await expect(new ProjectFolder(roots(), "/work/app").resolve("plan.js")).resolves.toBe("/work/app/plan.js");
  });

  // GUI clients start servers in / or the home folder (S-081).
  it.each([
    ["home", homedir()],
    ["/", "/"],
  ])("refuses %s as a project folder, an absolute path still resolves", async (_name, fallback) => {
    const folder = new ProjectFolder(roots(), fallback);

    await expect(folder.resolve("plan.js")).rejects.toThrow("is no project folder");
    await expect(folder.resolve("/work/app/plan.js")).resolves.toBe("/work/app/plan.js");
  });
});
