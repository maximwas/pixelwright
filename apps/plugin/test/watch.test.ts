import { describe, expect, it } from "vitest";
import { noteOwnWrite, startChangeJournal } from "../src/figma/changes.ts";
import { runOperation } from "../src/figma/operations.ts";
import { installFigma, tree } from "./helpers/fake-figma.ts";

const page = () =>
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
        type: "TEXT",
        name: "Title",
      },
    ],
  });

describe("selection_wait", () => {
  it("answers once the user selects something else", async () => {
    const installed = installFigma(page());

    installed.figma.currentPage.selection = [];

    const waiting = runOperation("selection_wait", {
      timeoutMs: 5_000,
      from: null,
    });

    installed.figma.currentPage.selection = [installed.figma.currentPage.children?.[1] as never];
    installed.emit("selectionchange");

    await expect(waiting).resolves.toMatchObject({
      changed: true,
      nodes: [
        {
          id: "1:2",
          name: "Title",
        },
      ],
    });
  });

  it("answers unchanged when the time runs out, with what it started from", async () => {
    installFigma(page());

    await expect(
      runOperation("selection_wait", {
        timeoutMs: 20,
        from: null,
      }),
    ).resolves.toMatchObject({
      changed: false,
      from: [],
    });
  });
});

describe("changes_since", () => {
  it("lists what changed after a cursor: by whom, one layer's run of changes by one hand merged, Pixelwright's own marked", async () => {
    const installed = installFigma(page());
    const [card, title] = installed.figma.currentPage.children ?? [];
    const change = (node: unknown, type: string, origin: string, properties: string[] = []) => ({
      nodeChanges: [
        {
          id: (node as { id: string }).id,
          node,
          type,
          origin,
          properties,
        },
      ],
    });

    startChangeJournal();
    installed.emit("nodechange", change(card, "PROPERTY_CHANGE", "LOCAL", ["fills"]), "0:1");

    const { cursor } = (await runOperation("changes", {})) as { cursor: number };

    installed.emit("nodechange", change(title, "PROPERTY_CHANGE", "REMOTE", ["characters"]), "0:1");
    installed.emit("nodechange", change(title, "PROPERTY_CHANGE", "REMOTE", ["fontSize"]), "0:1");
    noteOwnWrite();
    installed.emit("nodechange", change(card, "PROPERTY_CHANGE", "LOCAL", ["width"]), "0:1");

    const later = (await runOperation("changes", { since: cursor })) as {
      changes: { id: string; change: string; properties: string[]; by: string }[];
    };

    expect(later.changes.map(({ id, change: kind, properties, by }) => [id, kind, properties, by])).toEqual([
      ["1:2", "changed", ["characters", "fontSize"], "collaborator"],
      ["1:1", "changed", ["width"], "pixelwright"],
    ]);
  });
});

describe("changes_since after the review", () => {
  const change = (node: unknown, type: string, origin: string, properties: string[] = []) => ({
    nodeChanges: [
      {
        id: (node as { id: string }).id,
        node,
        type,
        origin,
        properties,
      },
    ],
  });

  it("tells a deletion of a layer whose creation it already reported", async () => {
    const installed = installFigma(page());
    const [card] = installed.figma.currentPage.children ?? [];

    startChangeJournal();
    installed.emit("nodechange", change(card, "CREATE", "LOCAL"), "0:1");

    const { cursor } = (await runOperation("changes", {})) as { cursor: number };

    installed.emit(
      "nodechange",
      change(
        {
          id: "1:1",
          removed: true,
        },
        "DELETE",
        "LOCAL",
      ),
      "0:1",
    );

    const later = (await runOperation("changes", { since: cursor })) as { changes: { id: string; change: string }[] };

    expect(later.changes.map(({ id, change: kind }) => [id, kind])).toEqual([["1:1", "deleted"]]);
  });

  it("keeps the user's change to a layer when Pixelwright changes it after", async () => {
    const installed = installFigma(page());
    const [card] = installed.figma.currentPage.children ?? [];

    startChangeJournal();
    installed.emit("nodechange", change(card, "PROPERTY_CHANGE", "LOCAL", ["characters"]), "0:1");
    noteOwnWrite();
    installed.emit("nodechange", change(card, "PROPERTY_CHANGE", "LOCAL", ["fills"]), "0:1");

    const all = (await runOperation("changes", {})) as { changes: { by: string; properties: string[] }[] };

    expect(all.changes.map(({ by, properties }) => [by, properties])).toEqual([
      ["user", ["characters"]],
      ["pixelwright", ["fills"]],
    ]);
  });

  it("says a cursor from before the plugin started again is past what it knows", async () => {
    const installed = installFigma(page());
    const [card] = installed.figma.currentPage.children ?? [];

    startChangeJournal();
    installed.emit("nodechange", change(card, "PROPERTY_CHANGE", "LOCAL", ["fills"]), "0:1");

    const { cursor } = (await runOperation("changes", {})) as { cursor: number };

    startChangeJournal();
    installed.emit("nodechange", change(card, "PROPERTY_CHANGE", "LOCAL", ["width"]), "0:1");

    await expect(runOperation("changes", { since: cursor })).resolves.toMatchObject({
      truncated: true,
      changes: [{ properties: ["width"] }],
    });
  });
});
