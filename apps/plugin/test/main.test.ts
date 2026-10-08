import { beforeAll, describe, expect, it } from "vitest";

/** A file name that closes the window's inline script and opens its own: any Figma file may be named like this. */
const HOSTILE_NAME = "Brand kit</script><script>window.injected = true</script>";
const posted: unknown[][] = [];
let windowHtml = "";

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
    getAsync: async () => true,
    setAsync: async () => {},
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

  it("sends the context once the window says it is ready, with Allow edits off whatever an earlier run stored", () => {
    fakeFigma.ui.onmessage?.(["READY"]);

    expect(posted.at(-1)).toEqual([
      "CONTEXT",
      expect.objectContaining({
        file: {
          name: HOSTILE_NAME,
          key: null,
        },
        allowEdits: false,
      }),
    ]);
  });
});
