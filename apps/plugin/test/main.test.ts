import { beforeAll, describe, expect, it } from "vitest";

/** A file name that closes the window's inline script and opens its own: any Figma file may be named like this. */
const HOSTILE_NAME = "Brand kit</script><script>window.injected = true</script>";
const STORED_KEY = {
  id: "0123456789abcdef",
  secret: "ab".repeat(32),
};
const NEW_KEY = {
  id: "fedcba9876543210",
  secret: "cd".repeat(32),
};
const posted: unknown[][] = [];
let windowHtml = "";

/** figma.clientStorage as an earlier run left it: Allow edits on (from stage 1) and a paired key. */
const stored = new Map<string, unknown>([
  ["pixelwright.allowEdits", true],
  ["pixelwright.pairing", STORED_KEY],
]);

const fakeFigma = {
  editorType: "figma",
  fileKey: undefined,
  command: "",
  root: { name: HOSTILE_NAME },
  currentPage: {
    id: "0:1",
    name: "Page 1",
  },
  clientStorage: {
    getAsync: async (key: string) => stored.get(key),
    setAsync: async (key: string, value: unknown) => {
      stored.set(key, value);
    },
    deleteAsync: async (key: string) => {
      stored.delete(key);
    },
  },
  showUI: (html: string) => {
    windowHtml = html;
  },
  ui: {
    postMessage: (message: unknown[]) => posted.push(message),
    onmessage: null as ((message: unknown) => void) | null,
  },
  on: () => {},
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeAll(async () => {
  // The Plugin API is a global of Figma's sandbox: the fake has to exist before the utilities module loads.
  Object.assign(globalThis, {
    figma: fakeFigma,
    __html__: "/* ui bundle */",
  });

  const { default: main } = await import("../src/main.ts");

  await main();
});

describe("the plugin's main code", () => {
  it("keeps file and page names out of the window's HTML", () => {
    expect(windowHtml).not.toContain("</script><script>");
    expect(windowHtml).not.toContain("Brand kit");
  });

  it("answers the window's READY with the stored key, then the context with Allow edits off", async () => {
    posted.length = 0;
    fakeFigma.ui.onmessage?.(["READY"]);
    await tick();

    expect(posted).toEqual([
      ["PAIRING", STORED_KEY],
      [
        "CONTEXT",
        expect.objectContaining({
          file: {
            name: HOSTILE_NAME,
            key: null,
          },
          allowEdits: false,
        }),
      ],
    ]);
  });

  it("keeps the key the window was issued, and forgets it when told", async () => {
    fakeFigma.ui.onmessage?.(["SAVE_PAIRING", NEW_KEY]);
    await tick();
    expect(stored.get("pixelwright.pairing")).toEqual(NEW_KEY);

    fakeFigma.ui.onmessage?.(["SAVE_PAIRING", null]);
    await tick();
    expect(stored.has("pixelwright.pairing")).toBe(false);
  });

  it("sends no key when storage holds something that is not one", async () => {
    stored.set("pixelwright.pairing", { id: "not a key" });
    posted.length = 0;
    fakeFigma.ui.onmessage?.(["READY"]);
    await tick();

    expect(posted[0]).toEqual(["PAIRING", null]);
  });
});
