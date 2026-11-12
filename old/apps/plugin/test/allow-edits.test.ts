import { describe, expect, it, vi } from "vitest";

/** figma.clientStorage: this user's, on this computer, shared by every file. */
const storage = new Map<string, unknown>();
/** Each file's plugin data on its document. */
const fileA = new Map<string, string>();
const fileB = new Map<string, string>();
let file = fileA;
const posted: unknown[][] = [];

const fakeFigma = {
  editorType: "figma",
  fileKey: undefined as string | undefined,
  command: "",
  root: {
    name: "Untitled",
    getPluginData: (key: string) => file.get(key) ?? "",
    setPluginData: (key: string, value: string) => {
      file.set(key, value);
    },
  },
  currentPage: {
    on: () => {},
    id: "0:1",
    name: "Page 1",
  },
  clientStorage: {
    getAsync: async (key: string) => storage.get(key),
    setAsync: async (key: string, value: unknown) => {
      storage.set(key, value);
    },
    deleteAsync: async (key: string) => {
      storage.delete(key);
    },
  },
  showUI: () => {},
  ui: {
    postMessage: (message: unknown[]) => posted.push(message),
    onmessage: null as ((message: unknown) => void) | null,
    resize: () => {},
  },
  on: () => {},
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Allow edits as the last context the window got shows it. */
function shown(): boolean {
  const context = posted.findLast((message) => message[0] === "CONTEXT")?.[1] as { allowEdits: boolean };

  return context.allowEdits;
}

/** A new run of the plugin in this file: its main code starts afresh and the window says READY. */
async function run(which: Map<string, string>): Promise<boolean> {
  file = which;
  vi.resetModules();
  Object.assign(globalThis, {
    figma: fakeFigma,
    __html__: "",
  });

  const { default: main } = await import("../src/main.ts");

  main();
  posted.length = 0;
  fakeFigma.ui.onmessage?.(["READY"]);
  await tick();

  return shown();
}

async function switchTo(value: boolean): Promise<void> {
  fakeFigma.ui.onmessage?.(["ALLOW_EDITS", value]);
  await tick();
}

describe("Allow edits", () => {
  // Five fresh imports of the plugin's main code: near vitest's 5 s default when the full suite loads the machine.
  it("is remembered for the file it was turned on in, on this computer, until it is turned off", async () => {
    expect(await run(fileA)).toBe(false);
    // A file that was only read is left as it was.
    expect(fileA.size).toBe(0);

    await switchTo(true);
    expect(shown()).toBe(true);
    expect(fileA.size).toBe(1);

    expect(await run(fileA)).toBe(true);
    expect(await run(fileB)).toBe(false);
    expect(fileB.size).toBe(0);

    expect(await run(fileA)).toBe(true);
    await switchTo(false);
    expect(await run(fileA)).toBe(false);
  }, 20_000);

  it("keeps the last choice when an earlier save is still running", async () => {
    const file = new Map<string, string>();
    const { setAsync } = fakeFigma.clientStorage;

    // Storage that takes a while to store and no time to forget.
    fakeFigma.clientStorage.setAsync = async (key, value) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      await setAsync(key, value);
    };

    try {
      expect(await run(file)).toBe(false);
      fakeFigma.ui.onmessage?.(["ALLOW_EDITS", true]);
      fakeFigma.ui.onmessage?.(["ALLOW_EDITS", false]);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(await run(file)).toBe(false);
    } finally {
      fakeFigma.clientStorage.setAsync = setAsync;
    }
  });

  it("goes by Figma's file key where Figma gives one, writing nothing into the file", async () => {
    const file = new Map<string, string>();

    fakeFigma.fileKey = "aB3dE5gH7jK9mN1pQ3sT5v";

    try {
      expect(await run(file)).toBe(false);
      await switchTo(true);
      expect(await run(file)).toBe(true);
      expect(file.size).toBe(0);
    } finally {
      fakeFigma.fileKey = undefined;
    }
  });
});
