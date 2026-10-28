import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readConfig } from "../src/config/config.ts";
import { LatestVersion } from "../src/updates/latest-version.ts";

const DAY = 24 * 60 * 60 * 1_000;
const NOW = Date.parse("2026-10-17T12:00:00Z");
const dirs: string[] = [];

/** A home with latest.json holding a version checked so long ago, or none. */
function home(kept?: { version: string; ago: number }): string {
  const dir = mkdtempSync(join(tmpdir(), "pixelwright-latest-"));

  dirs.push(dir);

  if (kept !== undefined) {
    writeFileSync(
      join(dir, "latest.json"),
      JSON.stringify({
        version: kept.version,
        checkedAt: new Date(NOW - kept.ago).toISOString(),
      }),
    );
  }

  return dir;
}

/** npm's answer for pixelwright@latest, counting the times it was asked. */
function npm(version: string | Error) {
  const asked: string[] = [];
  const fetch = async (url: string | URL | Request) => {
    asked.push(String(url));

    if (version instanceof Error) {
      throw version;
    }

    return new Response(
      JSON.stringify({
        name: "pixelwright",
        version,
      }),
      { status: 200 },
    );
  };

  return {
    asked,
    fetch,
  };
}

const latest = (dir: string, fetch: typeof globalThis.fetch, enabled = true) =>
  new LatestVersion({
    file: join(dir, "latest.json"),
    enabled,
    now: () => NOW,
    fetch,
  });

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, {
      recursive: true,
      force: true,
    });
  }
});

describe("the newest Pixelwright on npm", () => {
  it("is asked of npm at most once a day: a fresh answer kept in the home is used as it is", async () => {
    const { asked, fetch } = npm("0.4.0");

    expect(
      await latest(
        home({
          version: "0.3.2",
          ago: DAY / 2,
        }),
        fetch,
      ).check(),
    ).toBe("0.3.2");
    expect(asked).toEqual([]);
  });

  it("is asked again when the kept answer is a day old, and the new one kept", async () => {
    const { asked, fetch } = npm("0.3.2");
    const dir = home({
      version: "0.3.1",
      ago: DAY + 1,
    });

    expect(await latest(dir, fetch).check()).toBe("0.3.2");
    expect(asked).toEqual(["https://registry.npmjs.org/pixelwright/latest"]);
    expect(JSON.parse(readFileSync(join(dir, "latest.json"), "utf8"))).toEqual({
      version: "0.3.2",
      checkedAt: new Date(NOW).toISOString(),
    });
  });

  it("is the last answer kept when npm cannot be reached, and nothing when none was", async () => {
    const offline = npm(new Error("getaddrinfo ENOTFOUND registry.npmjs.org"));

    expect(
      await latest(
        home({
          version: "0.3.1",
          ago: 3 * DAY,
        }),
        offline.fetch,
      ).check(),
    ).toBe("0.3.1");
    expect(await latest(home(), offline.fetch).check()).toBeNull();
  });

  it("is never asked when PIXELWRIGHT_NO_UPDATE_CHECK turns the check off", async () => {
    const { asked, fetch } = npm("0.4.0");

    expect(
      await latest(
        home({
          version: "0.3.2",
          ago: 3 * DAY,
        }),
        fetch,
        false,
      ).check(),
    ).toBeNull();
    expect(asked).toEqual([]);
  });

  it("is checked unless PIXELWRIGHT_NO_UPDATE_CHECK is set", () => {
    expect(readConfig({}).updateCheck).toBe(true);
    expect(readConfig({ PIXELWRIGHT_NO_UPDATE_CHECK: "1" }).updateCheck).toBe(false);
  });
});
