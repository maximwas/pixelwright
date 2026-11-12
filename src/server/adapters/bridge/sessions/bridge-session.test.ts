import { createBirpc } from "birpc";
import { describe, expect, it } from "vitest";
import { BridgeSession } from "@/server/adapters/bridge/sessions/bridge-session.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";
import type { PluginFunctions, ServerFunctions } from "@/shared/protocol/rpc.types.ts";

const hello = (visible: boolean): PluginInfo => ({
  instanceId: "window-1",
  pluginVersion: "0.8.0",
  editorType: "figma",
  file: { name: "Test MCP", key: null },
  page: { id: "0:1", name: "Start here" },
  allowEdits: false,
  visible,
});

/** A session and the plugin-side birpc its socket talks to; the sequence counts like the registry's. */
const connected = (info: PluginInfo) => {
  let position = 0;
  const sequence = {
    changed: () => undefined,
    next: () => {
      position += 1;

      return position;
    },
  };
  let toPlugin: (text: string) => void = () => undefined;
  const session = new BridgeSession({ send: (text) => toPlugin(text), close: () => undefined }, info, sequence);
  const plugin = createBirpc<ServerFunctions, PluginFunctions>(
    { run: () => new Promise(() => undefined) },
    {
      post: (text: string) => session.rpc.receive(text),
      on: (deliver: (text: string) => void) => {
        toPlugin = deliver;
      },
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (text: string): unknown => JSON.parse(text),
    },
  );

  return { session, plugin, sequence };
};

describe("BridgeSession's plugin info events (S-012)", () => {
  it("updates the page, the tab and Allow edits, and the tab that comes to the front becomes the active file", async () => {
    const front = connected(hello(true));
    const behind = connected(hello(false));
    const { instanceId: _instanceId, ...update } = hello(true);

    await behind.plugin.pluginInfo.asEvent({
      ...update,
      page: { id: "54:226", name: "Orbit — Pricing" },
      allowEdits: true,
    });

    expect(behind.session.file(true)).toMatchObject({ page: "Orbit — Pricing", allowEdits: true, visible: true });
    expect(behind.session.info.instanceId).toBe("window-1");
    expect(behind.session.outranks(front.session)).toBe(true);
  });

  it("ignores an event that does not parse", async () => {
    const { session, plugin } = connected(hello(true));

    await plugin.pluginInfo.asEvent(JSON.parse('{"page": 3}'));

    expect(session.file(true).page).toBe("Start here");
  });
});
