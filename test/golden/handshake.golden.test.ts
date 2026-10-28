import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as zod from "zod/mini";
import {
  HelloProtocolSchema,
  PluginHandshakeSchema,
  ServerHandshakeSchema,
} from "@/shared/protocol/handshake.schema.ts";
import { PluginInfoSchema } from "@/shared/protocol/plugin-info.schema.ts";

/** Frames 0.7.0 sends, recorded from its own code (the fixture's source says how), as the exact bytes on the wire. */
const RECORDING = zod.parse(
  zod.object({
    pluginToServer: zod.record(zod.string(), zod.string()),
    serverToPlugin: zod.record(zod.string(), zod.string()),
  }),
  JSON.parse(readFileSync(new URL("fixtures/handshake-0.7.0.json", import.meta.url), "utf8")),
);

const { info, ...handshake } = RECORDING.pluginToServer;

describe("the 0.7.0 handshake frames", () => {
  // A schema writes its fields in its own order: the bytes come back equal only if every field and its place stayed.
  it.each(Object.entries(handshake))("still read a 0.7.0 plugin's %s, field for field and in order", (_name, frame) => {
    expect(JSON.stringify(zod.parse(PluginHandshakeSchema, JSON.parse(frame)))).toBe(frame);
  });

  it.each(Object.entries(RECORDING.serverToPlugin))("still describe the server's %s byte for byte", (_name, frame) => {
    expect(JSON.stringify(zod.parse(ServerHandshakeSchema, JSON.parse(frame)))).toBe(frame);
  });

  it("still read a 0.7.0 plugin's info event", () => {
    const event = JSON.parse(info ?? "");

    expect(JSON.stringify(zod.parse(PluginInfoSchema, event.data))).toBe(JSON.stringify(event.data));
  });

  it("read a 0.7.0 hello's protocol and plugin version, so it can be turned away by name", () => {
    expect(zod.parse(HelloProtocolSchema, JSON.parse(handshake.helloNoKey ?? ""))).toMatchObject({
      protocol: 5,
      plugin: { pluginVersion: "0.7.0" },
    });
  });
});
