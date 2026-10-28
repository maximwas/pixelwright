import { afterEach, describe, expect, it, vi } from "vitest";
import { MainChannel } from "@/plugin-ui/adapters/main-channel/main-channel.ts";
import { Backoff } from "@/plugin-ui/link/backoff/backoff.ts";
import { SocketLink } from "@/plugin-ui/link/socket-link/socket-link.ts";
import { StopReasons } from "@/plugin-ui/link/stop-reasons/stop-reasons.ts";
import { WindowLink } from "@/plugin-ui/link/window-link/window-link.ts";
import { PluginWindow } from "@/plugin-ui/view/plugin-window/plugin-window.ts";
import type { UiMessage } from "@/shared/window/ui-message.schema.ts";
import { MemoryBridge as Bridge } from "./support/memory-bridge.ts";

// The window's own classes, real, in a stand-in for its frame (ui.html's elements, figma.ui's postMessage), against
// item 03's real PluginConnection.

/** One of ui.html's elements, as much of it as the window touches. */
class Element {
  textContent = "";
  hidden = false;
  value = "";
  readonly dataset: Record<string, string> = {};
  #submit: (event: { preventDefault(): void }) => void = () => {};

  addEventListener(
    _type: string,
    listener: (event: { preventDefault(): void }) => void,
  ): void {
    this.#submit = listener;
  }

  submit(): void {
    this.#submit({ preventDefault: () => {} });
  }
}

/** The window's frame in Figma: ui.html's elements, what the window posts to main, and main's messages to it. */
class Frame {
  readonly posted: UiMessage[] = [];
  readonly #elements = new Map<string, Element>();
  #receive: (event: { data: unknown }) => void = () => {};

  constructor() {
    vi.stubGlobal("document", {
      visibilityState: "visible",
      getElementById: (id: string) => this.element(id),
    });
    vi.stubGlobal("window", {
      addEventListener: (
        _type: string,
        listener: (event: { data: unknown }) => void,
      ) => {
        this.#receive = listener;
      },
    });
    vi.stubGlobal("parent", {
      postMessage: (message: { pluginMessage: UiMessage }) => this.posted.push(message.pluginMessage),
    });
  }

  element(id: string): Element {
    const element = this.#elements.get(id) ?? new Element();

    this.#elements.set(id, element);

    return element;
  }

  fromMain(message: UiMessage): void {
    this.#receive({ data: { pluginMessage: message } });
  }
}

const CONTEXT = {
  pluginVersion: "0.8.0",
  editorType: "figma",
  file: {
    name: "Test MCP",
    key: null,
  },
  page: {
    id: "0:1",
    name: "Start here",
  },
  allowEdits: false,
};

const windowLink = (bridge: Bridge) =>
  new WindowLink(new MainChannel(), new SocketLink(bridge, new Backoff(), new StopReasons()), new PluginWindow());

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WindowLink", () => {
  it("says ready, pairs with the code typed into the field, and gives main the key bridge.json holds", () => {
    const frame = new Frame();
    const bridge = new Bridge();

    windowLink(bridge).start();

    expect(frame.posted).toEqual([
      {
        ch: "window",
        d: { type: "ready" },
      },
    ]);

    frame.fromMain({
      ch: "window",
      d: {
        type: "start",
        key: null,
        context: CONTEXT,
      },
    });

    expect(frame.element("title").textContent).toBe("Pair this window");
    expect(frame.element("pairing").hidden).toBe(false);

    frame.element("code").value = ` ${bridge.code()} `;
    frame.element("pairing").submit();

    const saved = frame.posted.at(-1);
    const key = saved?.ch === "window" && saved.d.type === "save_pairing" ? saved.d.key : null;

    expect(key).not.toBeNull();
    expect(bridge.keys.findKey(key?.id ?? "")).toEqual(key);
    expect(frame.element("title").textContent).toBe("Connected (Test MCP)");
    expect(frame.element("pairing").hidden).toBe(true);
    expect(bridge.sessions.files()).toMatchObject([{ name: "Test MCP" }]);
  });

  it("connects with the key main stored, and relays the session's frames both ways with their socket's epoch", () => {
    const frame = new Frame();
    const bridge = new Bridge();

    const key = bridge.keys.addKey();

    windowLink(bridge).start();
    // Main answers ready once; a second answer starts no second link.
    frame.fromMain({
      ch: "window",
      d: {
        type: "start",
        key,
        context: CONTEXT,
      },
    });
    frame.fromMain({
      ch: "window",
      d: {
        type: "start",
        key,
        context: CONTEXT,
      },
    });
    bridge.servers[0]?.send('{"call":1}');
    frame.fromMain({
      ch: "server",
      e: 1,
      d: '{"answer":1}',
    });

    expect(frame.element("title").textContent).toBe("Connected (Test MCP)");
    expect(frame.posted.at(-1)).toEqual({
      ch: "server",
      e: 1,
      d: '{"call":1}',
    });
    expect(bridge.plugins[0]?.sent.at(-1)).toEqual({ answer: 1 });
    expect(bridge.plugins).toHaveLength(1);
  });
});
