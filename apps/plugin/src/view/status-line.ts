import type { LinkState } from "../types/link.ts";

export interface StatusLine {
  readonly tone: "ok" | "wait" | "error";
  readonly text: string;
}

export function statusLine(link: LinkState, fileName: string): StatusLine {
  switch (link.kind) {
    case "connected":
      return {
        tone: "ok",
        text: `Connected · ${fileName}`,
      };
    case "connecting":
      return {
        tone: "wait",
        text: "Connecting to Pixelwright…",
      };
    case "waiting":
      return {
        tone: "wait",
        text: "Waiting for the Pixelwright server: start your MCP client with Pixelwright.",
      };
    case "stopped":
      return {
        tone: "error",
        text: link.reason,
      };
  }
}
