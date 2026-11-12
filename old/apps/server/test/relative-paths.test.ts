import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Snapshot } from "@pixelwright/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { memoryFiles } from "../src/assets/written-files.ts";
import { assetsExportTool } from "../src/features/assets-export/tool.ts";
import { designApplyTool } from "../src/features/design-apply/tool.ts";
import { DesignReadInputSchema } from "../src/features/design-read/schemas.ts";
import { designReadTool } from "../src/features/design-read/tool.ts";
import { ExecuteInputSchema } from "../src/features/execute/schemas.ts";
import { executeTool } from "../src/features/execute/tool.ts";
import { ImageCompareInputSchema } from "../src/features/image-compare/schemas.ts";
import { imageCompareTool } from "../src/features/image-compare/tool.ts";
import { ScreenshotInputSchema } from "../src/features/screenshot/schemas.ts";
import { screenshotTool } from "../src/features/screenshot/tool.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { ProjectFolder } from "../src/project/project-folder.ts";
import type { BridgeView, ToolContext } from "../src/types/mcp.ts";
import { PNG } from "./helpers/images.ts";
import { recordingBridge } from "./helpers/recording-bridge.ts";

const ROW = JSON.parse(
  await readFile(new URL("../../../packages/core/test/fixtures/orbit-customers.json", import.meta.url), "utf8"),
) as Snapshot;

const signal = new AbortController().signal;

/** The Orbit customers row in a plugin that renders every export as one real PNG and runs code as 42. */
function plugin() {
  const { bridge } = recordingBridge(ROW);
  const ran: string[] = [];
  const request: BridgeView["request"] = async (op, input, options) => {
    if (op === "export") {
      const { offset = 0 } = input as { offset?: number };

      return {
        scale: 1,
        totalBytes: PNG.length,
        bytes: PNG.subarray(offset).toString("base64"),
      };
    }

    if (op === "execute") {
      ran.push((input as { code: string }).code);

      return {
        result: 42,
        logs: [],
      };
    }

    return bridge.request(op, input, options);
  };

  return {
    ran,
    client: new PluginClient({
      ...bridge,
      request,
    }),
  };
}

const listed = (dir: string) => readdir(dir).catch(() => []);

describe("relative paths a tool takes", () => {
  const before = process.cwd();
  let project: string;
  let elsewhere: string;
  let context: (client: PluginClient) => ToolContext;

  // The server's working directory is another folder than the session's project, as when a client starts it elsewhere.
  beforeEach(async () => {
    project = await mkdtemp(join(tmpdir(), "pixelwright-project-"));
    elsewhere = await mkdtemp(join(tmpdir(), "pixelwright-cwd-"));
    process.chdir(elsewhere);
    context = (client) =>
      ({
        plugin: client,
        files: memoryFiles(),
        project: new ProjectFolder(project),
      }) as never;
  });

  afterEach(() => {
    process.chdir(before);
  });

  it("writes assets_export's dir in the project folder", async () => {
    const result = await assetsExportTool(context(plugin().client)).run(
      {
        nodes: ["54:434"],
        dir: "assets",
        original: false,
      },
      signal,
    );

    expect(result.errors).toEqual([]);
    expect(await listed(join(project, "assets"))).toHaveLength(1);
    expect(await listed(elsewhere)).toEqual([]);
  });

  it("writes design_read's assetsDir in the project folder, its XML naming the files as given", async () => {
    const result = await designReadTool(context(plugin().client)).run(
      DesignReadInputSchema.parse({
        node: "54:434",
        assetsDir: "src/assets",
      }),
    );

    // Every render here is the same PNG, so the row's assets share its first one's file.
    expect(await listed(join(project, "src/assets"))).toEqual(["logo-nova.svg"]);
    expect(await listed(elsewhere)).toEqual([]);
    expect((result.content[0] as { text: string }).text).toContain('src="src/assets/logo-nova.svg"');
  });

  it("reads design_apply's src from the project folder", async () => {
    await writeFile(join(project, "photo.png"), PNG);
    await writeFile(join(elsewhere, "other.png"), PNG);

    const tool = designApplyTool(context(plugin().client));
    const apply = (src: string) =>
      tool.run(
        {
          xml: `<Image src="${src}" width="10px" height="10px"/>`,
          dryRun: true,
        },
        signal,
      );

    expect((await apply("photo.png")).errors).toEqual([]);
    expect((await apply("other.png")).errors).toEqual([
      expect.objectContaining({
        message: `other.png is not a file the server can read (relative paths are from the project folder: ${project}).`,
      }),
    ]);
  });

  it("saves screenshot's save in the project folder", async () => {
    await screenshotTool(context(plugin().client)).run(
      ScreenshotInputSchema.parse({
        node: "54:434",
        save: "shots/row.png",
      }),
    );

    expect(await readFile(join(project, "shots/row.png"))).toEqual(PNG);
    expect(await listed(elsewhere)).toEqual([]);
  });

  it("reads image_compare's reference and writes its diff in the project folder", async () => {
    await writeFile(join(project, "build.png"), PNG);

    const result = await imageCompareTool(context(plugin().client)).run(
      ImageCompareInputSchema.parse({
        node: "54:434",
        reference: "build.png",
        diff: "diffs/row.png",
      }),
      signal,
    );

    expect(result).toMatchObject({
      rmse: 0,
      diff: join(project, "diffs/row.png"),
    });
    expect(await listed(join(project, "diffs"))).toEqual(["row.png"]);
    expect(await listed(elsewhere)).toEqual([]);
  });

  it("runs execute's script from the project folder", async () => {
    const { client, ran } = plugin();

    await writeFile(join(project, "copies.js"), "return 1;");
    await executeTool(context(client)).run(ExecuteInputSchema.parse({ script: "copies.js" }), signal);

    expect(ran).toEqual(["return 1;"]);
  });
});
