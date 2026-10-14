import { readFileSync } from "node:fs";
import { SnapshotSchema } from "@pixelwright/core";
import { describe, expect, it } from "vitest";
import { checkContrast } from "../src/features/contrast-check/contrast-check.ts";
import { auditDesign } from "../src/features/design-audit/audit-design.ts";
import { PluginClient } from "../src/plugin/plugin-client.ts";
import { recordingBridge } from "./helpers/recording-bridge.ts";

const PRICING = SnapshotSchema.parse(
  JSON.parse(readFileSync(new URL("../../../packages/core/test/fixtures/orbit-pricing.json", import.meta.url), "utf8")),
);

describe("a tool call works on one file", () => {
  it("reads the selected layer and then the layer itself from the same file, whatever comes to the front meanwhile", async () => {
    for (const run of [checkContrast, auditDesign]) {
      const { bridge, requests } = recordingBridge(PRICING, { switching: true });

      await run(new PluginClient(bridge), {});

      expect(requests.map(({ op, session }) => `${op} ${session}`)).toEqual(["selection s1", "snapshot s1"]);
    }
  });
});
