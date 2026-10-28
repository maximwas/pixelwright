import { describe, expect, it } from "vitest";
import { PairingCodes } from "@/server/adapters/bridge/pairing-codes/pairing-codes.ts";
import { BridgeSession } from "@/server/adapters/bridge/sessions/bridge-session/bridge-session.ts";
import { SessionRegistry } from "@/server/adapters/bridge/sessions/session-registry/session-registry.ts";
import { PinoLogger } from "@/server/adapters/logging/pino-logger/pino-logger.ts";
import type { PluginInfo } from "@/shared/protocol/plugin-info.schema.ts";

const info = (
  instanceId: string,
  visible = true,
): PluginInfo => ({
  instanceId,
  pluginVersion: "0.8.0",
  editorType: "figma",
  file: {
    name: `File of ${instanceId}`,
    key: null,
  },
  page: {
    id: "0:1",
    name: "Start here",
  },
  allowEdits: false,
  visible,
});

/** A SessionRegistry built by hand; each session's socket records how the registry closed it. */
class RegistryProbe {
  readonly logger = new PinoLogger(
    {
      level: "silent",
      file: "unused",
    },
    [],
  );

  readonly registry = new SessionRegistry(new PairingCodes({ now: () => Date.now() }, this.logger), this.logger);
  readonly closes: { window: string; code: number; reason: string }[] = [];

  add(
    instanceId: string,
    visible = true,
  ): BridgeSession {
    const socket = {
      send: () => undefined,
      close: (
        code: number,
        reason: string,
      ) =>
        this.closes.push({
          window: instanceId,
          code,
          reason,
        }),
    };
    const session = new BridgeSession(socket, info(instanceId, visible), this.registry);

    this.registry.add(session);

    return session;
  }

  names(): string[] {
    return this.registry.files().map((file) => file.name);
  }
}

describe("SessionRegistry", () => {
  it("keeps one session per window: a second one closes the first 4409, which leaves at once", () => {
    const probe = new RegistryProbe();
    const first = probe.add("window-a");
    const second = probe.add("window-a");

    expect(probe.closes).toEqual([
      {
        window: "window-a",
        code: 4409,
        reason: "superseded by a newer connection of the same plugin window",
      },
    ]);
    expect(probe.registry.files().map((file) => file.session)).toEqual([second.id]);
    // The first socket's late close must not take the second session with it.
    probe.registry.remove(first, 4409);
    expect(probe.registry.files().map((file) => file.session)).toEqual([second.id]);
  });

  it("admits 16 open files, and past them only a window that reconnects", () => {
    const probe = new RegistryProbe();

    for (let index = 0; index < 16; index += 1) {
      probe.add(`window-${index}`);
    }

    expect(probe.registry.admits(info("window-16"))).toBe(false);
    expect(probe.registry.admits(info("window-3"))).toBe(true);
  });

  it("lets eight unpaired windows wait, and one more once a slot is free", () => {
    const probe = new RegistryProbe();
    const windows = Array.from({ length: 9 }, () => ({}));

    expect(windows.map((window) => probe.registry.wait(window))).toEqual([...Array(8).fill(true), false]);
    expect(probe.registry.pairing()?.waiting).toBe(8);
    probe.registry.stopWaiting(windows[0] ?? {});
    expect(probe.registry.wait(windows[8] ?? {})).toBe(true);
  });

  it("shows no pairing code while no window waits", () => {
    expect(new RegistryProbe().registry.pairing()).toBeNull();
  });

  it("marks active the window in front last, else the one connected last", () => {
    const probe = new RegistryProbe();

    probe.add("window-a");
    probe.add("window-b", false);
    expect(
      probe.registry
        .files()
        .filter((file) => file.active)
        .map((file) => file.name),
    ).toEqual(["File of window-a"]);
    probe.add("window-c");
    expect(
      probe.registry
        .files()
        .filter((file) => file.active)
        .map((file) => file.name),
    ).toEqual(["File of window-c"]);
  });

  it("forgets the plugins turned away once a plugin connects", () => {
    const probe = new RegistryProbe();

    probe.registry.rejected({
      reason: "origin",
      origin: "https://evil.example",
    });
    probe.registry.refused({
      protocol: 5,
      pluginVersion: "0.7.0",
    });
    expect(probe.registry.refusal()).not.toBeNull();
    probe.add("window-a");
    expect(probe.registry.rejection()).toBeNull();
    expect(probe.registry.refusal()).toBeNull();
    expect(probe.names()).toEqual(["File of window-a"]);
  });
});
