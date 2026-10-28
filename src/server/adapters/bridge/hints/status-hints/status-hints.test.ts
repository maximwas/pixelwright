import { describe, expect, it } from "vitest";
import { STATUS_HINT_ORDER } from "./status-hints.constants.ts";
import { StatusHints } from "./status-hints.ts";
import type { HintFacts } from "./status-hints.types.ts";

/** The table in the order the root binds it. */
const hints = new StatusHints(STATUS_HINT_ORDER.map((Rule) => new Rule()));

const OWNER: HintFacts = {
  role: "owner",
  port: 18_721,
  failure: null,
  closeCode: null,
  pairing: null,
  files: 0,
  rejection: null,
  refusal: null,
};

/** A 0.7.0 plugin, turned away at hello. */
const OLDER = {
  protocol: 5,
  pluginVersion: "0.7.0",
};

const CODE = {
  code: "123456",
  expiresInSeconds: 90,
  lockedForSeconds: null,
  waiting: 1,
};

const LOCK = {
  code: null,
  expiresInSeconds: null,
  lockedForSeconds: 60,
  waiting: 2,
};

const REFUSED = {
  reason: "origin",
  origin: "https://evil.example",
} as const;

/** Every lower row's facts at once: a row above must win against all of them. */
const EVERYTHING = {
  pairing: CODE,
  files: 1,
  rejection: REFUSED,
  refusal: OLDER,
};

const NO_FILE =
  "No Figma file is connected: open the file in Figma Desktop, run Plugins → Development → Pixelwright New, and keep the plugin window open.";

describe("StatusHints, in priority order", () => {
  it.each<[string, Partial<HintFacts>, string | null]>([
    [
      "the bridge switched off beats a code, a file and a refusal",
      {
        role: "disabled",
        ...EVERYTHING,
      },
      "The plugin bridge is off (PIXELWRIGHT_PLUGIN_BRIDGE=off): remove the variable and restart the MCP server.",
    ],
    [
      "a bridge that could not start says why",
      {
        role: "failed",
        failure: "port 18721 is taken.",
        ...EVERYTHING,
      },
      "The plugin bridge could not start: port 18721 is taken.",
    ],
    [
      "a bridge handed over asks for a restart",
      {
        role: "handedOver",
        ...EVERYTHING,
      },
      "A newer Pixelwright server, another MCP client's, took the Figma bridge over, so this one switched its bridge off: restart Pixelwright in this MCP client (/mcp in Claude Code) to reach Figma again.",
    ],
    [
      "an owner handing over (4410) is joined in a moment",
      {
        role: "unavailable",
        closeCode: 4410,
      },
      "A newer Pixelwright server is taking the bridge over on port 18721: this session joins it in a moment.",
    ],
    [
      "an owner on another version (4426) is named",
      {
        role: "unavailable",
        closeCode: 4426,
      },
      "Another MCP client session runs another Pixelwright version and holds port 18721: run the same version in both, or close that session. This one keeps retrying.",
    ],
    [
      "a port held by a stranger",
      { role: "unavailable" },
      "Port 18721 is held by a program that is not Pixelwright: free it. This session keeps retrying.",
    ],
    [
      "a pairing code beats a connected file and a refusal",
      EVERYTHING,
      "A plugin is waiting to be paired: ask the user to type 123456 into the Pixelwright New window in Figma (valid for 90 s). Only the user types it; never type or send it anywhere yourself.",
    ],
    [
      "the pairing pause beats a connected file and a refusal",
      {
        ...EVERYTHING,
        pairing: LOCK,
      },
      "Pairing is paused for 60 s: too many wrong codes were typed for a waiting plugin, possibly by another program on this computer (a web page can try). Ask the user to wait, then call status again for a new code.",
    ],
    [
      "a connected file beats a refusal: nothing to do",
      {
        files: 1,
        rejection: REFUSED,
        refusal: OLDER,
      },
      null,
    ],
    [
      "an older plugin turned away beats a refused connection, and is named with its version",
      {
        rejection: REFUSED,
        refusal: OLDER,
      },
      "The Pixelwright New plugin 0.7.0 that tried to connect is older than this server (protocol 5; this server speaks 6), so it was turned away: ask the user to install the plugin that comes with this server's version and run it again in Figma.",
    ],
    [
      "a newer plugin turned away asks to update the server",
      {
        refusal: {
          protocol: 7,
          pluginVersion: null,
        },
      },
      "The Pixelwright New plugin that tried to connect is newer than this server (protocol 7; this server speaks 6), so it was turned away: update this Pixelwright server and restart it in this MCP client (/mcp in Claude Code).",
    ],
    [
      "a refusal beats no file",
      { rejection: REFUSED },
      "A connection from origin https://evil.example was refused (origin): if it was not the Pixelwright New plugin, ignore it.",
    ],
    [
      "a refusal without an Origin",
      {
        rejection: {
          reason: "origin",
          origin: null,
        },
      },
      "A connection from origin (none) was refused (origin): if it was not the Pixelwright New plugin, ignore it.",
    ],
    ["an owner with nothing connected", {}, NO_FILE],
    ["a peer with nothing connected", { role: "peer" }, NO_FILE],
  ])("%s", (_case, facts, expected) => {
    expect(
      hints.hint({
        ...OWNER,
        ...facts,
      }),
    ).toBe(expected);
  });
});
