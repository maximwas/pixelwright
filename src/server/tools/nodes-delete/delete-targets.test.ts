import { describe, expect, it } from "vitest";
import { DeleteTargets } from "@/server/tools/nodes-delete/delete-targets.ts";

// T-045: the dry run and the real run must agree, so a layer listed twice or inside a listed layer is named, not counted.
describe("DeleteTargets", () => {
  it("keeps a plain list as it is", () => {
    expect(new DeleteTargets().split(["1:2", "3:4"])).toEqual({ nodes: ["1:2", "3:4"], dropped: [] });
  });

  it("drops a repeated id and names it", () => {
    const { nodes, dropped } = new DeleteTargets().split(["1:2", "3:4", "1:2"]);

    expect(nodes).toEqual(["1:2", "3:4"]);
    expect(dropped.map(({ id }) => id)).toEqual(["1:2"]);
    expect(dropped[0]?.message).toContain("twice");
  });

  it("drops a layer whose ancestor is also listed, and names the ancestor", () => {
    const { nodes, dropped } = new DeleteTargets().split(["I1:2;3:4;5:6", "1:2", "I1:2;3:4"]);

    expect(nodes).toEqual(["1:2"]);
    expect(dropped.map(({ id }) => id)).toEqual(["I1:2;3:4;5:6", "I1:2;3:4"]);
    expect(dropped[0]?.message).toContain("1:2");
  });
});
