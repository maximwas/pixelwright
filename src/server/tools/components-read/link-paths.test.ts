import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { LinkPaths } from "@/server/tools/components-read/link-paths.ts";

const paths = new LinkPaths();

/** A project folder holding these files, empty. */
async function project(files: readonly string[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pixelwright-links-"));

  for (const file of files) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), "");
  }

  return root;
}

// T-192: a code link people attached in Dev Mode names the project file it points at, when it is one.
describe("a Dev Mode link's project file", () => {
  it("turns GitHub, GitLab and Bitbucket file links and vscode links into project files, a branch with slashes too", async () => {
    const root = await project(["src/Card.tsx", "packages/ui/Button.tsx"]);

    expect(await paths.of("https://github.com/acme/site/blob/main/src/Card.tsx", root)).toBe("src/Card.tsx");
    expect(await paths.of("https://github.com/acme/site/blob/feature/new-card/src/Card.tsx#L12", root)).toBe(
      "src/Card.tsx",
    );
    expect(await paths.of("https://gitlab.com/acme/site/-/blob/release/2.0/src/Card.tsx#L4-8", root)).toBe(
      "src/Card.tsx",
    );
    expect(await paths.of("https://bitbucket.org/acme/site/src/main/packages/ui/Button.tsx?at=main", root)).toBe(
      "packages/ui/Button.tsx",
    );
    expect(await paths.of(`vscode://file${join(root, "src/Card.tsx")}:12:4`, root)).toBe("src/Card.tsx");
  });

  it("gives nothing for a link that escapes the project or does not decode, and never throws", async () => {
    const root = await project(["src/Card.tsx"]);
    const up = "..%2F".repeat(20);

    expect(await paths.of(`https://github.com/o/r/blob/main/${up}etc%2Fhosts`, root)).toBeUndefined();
    expect(await paths.of("https://github.com/acme/ui/blob/main/docs/50%off.md", root)).toBeUndefined();
    expect(await paths.of("vscode://file/Users/x/100%.tsx", root)).toBeUndefined();
  });

  it("gives nothing for a file outside the project, one that is not there, or a link to no repository file", async () => {
    const root = await project(["src/Card.tsx"]);

    expect(await paths.of("vscode://file/etc/hosts", root)).toBeUndefined();
    expect(await paths.of("https://github.com/acme/site/blob/main/src/Gone.tsx", root)).toBeUndefined();
    expect(await paths.of("https://storybook.acme.dev/?path=/story/card", root)).toBeUndefined();
    expect(await paths.of("not a url", root)).toBeUndefined();
  });
});
