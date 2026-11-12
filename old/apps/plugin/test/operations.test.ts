import { describe, expect, it } from "vitest";
import { installFigma, tree } from "./helpers/fake-figma.ts";
import { testPlugin } from "./helpers/test-plugin.ts";

/** The plugin these tests run, over the fake Figma. */
const plugin = testPlugin();

describe("plugin operations", () => {
  it("answers ping and refuses an operation it does not have", async () => {
    await expect(plugin.run("ping", null)).resolves.toEqual({ pong: true });
    await expect(plugin.run("format_disk", null)).rejects.toMatchObject({ code: "UNKNOWN_OP" });
  });

  it("refuses an input its schema does not take, naming the operation", async () => {
    await expect(plugin.run("delete", { nodes: [] })).rejects.toMatchObject({
      code: "OP_FAILED",
      message: expect.stringMatching(/^delete: invalid input: /),
    });
  });

  it("marks what Figma reports just after a write as Pixelwright's, and after a read as the user's", async () => {
    const installed = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        name: "Page 1",
        children: [
          {
            id: "1:1",
            type: "FRAME",
            name: "Card",
          },
          {
            id: "1:2",
            type: "FRAME",
            name: "Old",
          },
        ],
      }),
    );
    const writer = testPlugin({ allowEdits: true });
    const reported = (id: string) =>
      installed.emit(
        "nodechange",
        {
          nodeChanges: [
            {
              id,
              node: installed.figma.currentPage.children?.find((layer) => layer.id === id),
              type: "PROPERTY_CHANGE",
              origin: "LOCAL",
              properties: ["fills"],
            },
          ],
        },
        "0:1",
      );

    writer.services.journal.start();
    await writer.run("ping", null);
    reported("1:1");
    await writer.run("delete", { nodes: ["1:2"] });
    reported("1:1");

    const { changes } = (await writer.run("changes", {})) as { changes: { id: string; by: string }[] };

    expect(changes.map(({ id, by }) => `${id} ${by}`)).toEqual(["1:1 user", "1:1 pixelwright"]);
  });

  it("marks what Figma reports just after texts_replace and instances_reattach as Pixelwright's", async () => {
    const installed = installFigma(
      tree({
        id: "0:1",
        type: "PAGE",
        name: "Page 1",
        children: [
          {
            id: "1:1",
            type: "FRAME",
            name: "Card",
          },
        ],
      }),
    );
    const writer = testPlugin({ allowEdits: true });
    const reported = () =>
      installed.emit(
        "nodechange",
        {
          nodeChanges: [
            {
              id: "1:1",
              node: installed.figma.currentPage.children?.[0],
              type: "PROPERTY_CHANGE",
              origin: "LOCAL",
              properties: ["characters"],
            },
          ],
        },
        "0:1",
      );
    const journalled = async () =>
      ((await writer.run("changes", {})) as { changes: { by: string }[] }).changes.map(({ by }) => by);

    writer.services.journal.start();
    await writer.run("texts", {
      roots: ["1:1"],
      replacements: [
        {
          find: "Pro",
          replace: "Plus",
        },
      ],
    });
    reported();
    expect(await journalled()).toEqual(["pixelwright"]);

    writer.services.journal.start();
    await writer.run("instances", {
      roots: ["1:1"],
      reattach: true,
    });
    reported();
    expect(await journalled()).toEqual(["pixelwright"]);
  });
});
