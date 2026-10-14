import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceMissing } from "../src/code-connect/code-source.ts";

async function project(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-source-"));

  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), text);
  }

  return root;
}

const connection = (path: string, codeSource: string) => ({
  path,
  source: "",
  codeSource,
});

describe("sourceMissing", () => {
  it("takes an absolute source inside the project as written", async () => {
    const root = await project({ "src/Card.tsx": "" });

    expect(await sourceMissing(root, connection("Card.figma.ts", join(root, "src/Card.tsx")))).toBe(false);
    expect(await sourceMissing(root, connection("Card.figma.ts", join(root, "src/Gone.tsx")))).toBe(true);
  });

  it("never looks outside the project: a source there is not checked, so never missing", async () => {
    const root = await project({ "src/Card.tsx": "" });

    expect(await sourceMissing(root, connection("Card.figma.ts", "../../../../Gone.tsx"))).toBe(false);
    expect(await sourceMissing(root, connection("ui/Card.figma.ts", "../../Gone.tsx"))).toBe(false);
    expect(await sourceMissing(root, connection("Card.figma.ts", "/tmp/elsewhere/Gone.tsx"))).toBe(false);
  });
});
