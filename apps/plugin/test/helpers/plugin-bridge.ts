import { PluginClient } from "../../../server/src/plugin/plugin-client.ts";
import type { BridgeView } from "../../../server/src/types/mcp.ts";
import { type TestPlugin, testPlugin } from "./test-plugin.ts";

/**
 * The server's view of the plugin with this plugin behind it: a request runs the plugin's operation on the fake Figma,
 * so a tool's server side and the plugin are tested together (testing them apart once hid a copy bug).
 */
export function pluginBridge(plugin: TestPlugin = testPlugin()): BridgeView {
  return {
    status: () => {
      throw new Error("not used");
    },
    pairing: () => null,
    plugins: () => [
      {
        session: "s1",
        info: {
          instanceId: "window-a",
          pluginVersion: "0.1.0",
          editorType: "figma",
          file: {
            name: "Orbit",
            key: null,
          },
          page: {
            id: "0:1",
            name: "Page 1",
          },
          allowEdits: true,
          visible: true,
        },
        active: true,
      },
    ],
    request: async (op, input) => await plugin.run(op, input),
  };
}

/** The server's PluginClient over pluginBridge: a feature's server side runs against this plugin. */
export function pluginClient(plugin: TestPlugin = testPlugin()): PluginClient {
  return new PluginClient(pluginBridge(plugin));
}
