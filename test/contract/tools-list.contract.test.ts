import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ServerMain } from "@/server/main/server.main.ts";

/** Every tool as 0.7.0 listed it, plus the reviewed changes; until item 68 each registered tool is checked by name. */
const GOLDEN: { name: string }[] = JSON.parse(
  readFileSync(new URL("../golden/__golden__/tools.json", import.meta.url), "utf8"),
);

/** guide's topics as files: what guide lists and answers comes from them (T-210). */
const TOPICS = new URL("../../src/server/tools/guide/topics/", import.meta.url);
const TOPIC_NAMES = readdirSync(TOPICS)
  .map((file) => file.replace(/\.md$/, ""))
  .sort();

function topicText(name: string): string {
  return readFileSync(new URL(`${name}.md`, TOPICS), "utf8");
}

/** A client of the server as the composition root wires it, bridge off, over an in-memory transport. */
class ContractClient {
  readonly home = mkdtempSync(join(tmpdir(), "pixelwright-contract-"));
  readonly endpoint = new ServerMain({
    home: this.home,
    logLevel: "silent",
    pluginBridge: false,
    bridgePort: 0,
    pluginOrigins: [],
    projectDir: tmpdir(),
  }).endpoint();
  readonly client = new Client({ name: "contract", version: "1.0.0" });

  async connect(): Promise<void> {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();

    await this.endpoint.connect(serverSide);
    await this.client.connect(clientSide);
  }
}

describe("the MCP contract", () => {
  const contract = new ContractClient();

  beforeAll(() => contract.connect());
  afterAll(() => contract.client.close());

  it("names the dev channel's server and tells the client to start with status", () => {
    expect(contract.client.getServerVersion()?.name).toBe("pixelwright-new");
    expect(contract.client.getInstructions()).toContain("Start with status:");
  });

  it("lists every registered tool exactly as its tools.json entry, key order included", async () => {
    const { tools } = await contract.client.listTools();

    for (const tool of tools) {
      const entry = GOLDEN.find(({ name }) => name === tool.name);

      expect(JSON.stringify(tool, null, 2)).toBe(JSON.stringify(entry, null, 2));
    }

    expect(tools.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "status",
        "selection_get",
        "node_show",
        "selection_wait",
        "changes_since",
        "file_map",
        "viewport_get",
        "nodes_find",
        "outline",
        "screenshot",
        "design_read",
        "image_compare",
        "styles_compare",
        "inspect",
        "measure",
        "nodes_diff",
        "breakpoints_find",
        "flow_read",
        "variants_read",
        "fonts_check",
        "execute",
        "tokens_read",
        "tokens_usage",
        "components_read",
        "library_search",
        "baseline_save",
        "baseline_diff",
        "assets_export",
        "guide",
      ]),
    );
    expect(tools).toHaveLength(29);
  });

  it("lists no outputSchema for the tools that answer in content blocks, so a client keeps the image (T-005)", async () => {
    const { tools } = await contract.client.listTools();

    expect(tools.filter(({ outputSchema }) => outputSchema === undefined).map(({ name }) => name)).toEqual([
      "screenshot",
      "design_read",
    ]);
  });

  it("answers status with role disabled and the hint, as structuredContent and the same JSON as text", async () => {
    const answer = await contract.client.callTool({ name: "status", arguments: {} });

    expect(answer.structuredContent).toMatchObject({
      server: { role: "disabled", channel: "pixelwright-new" },
      hint: expect.stringContaining("PIXELWRIGHT_PLUGIN_BRIDGE=off"),
    });
    expect(answer.content).toEqual([{ type: "text", text: JSON.stringify(answer.structuredContent) }]);
  });

  it("closes every tool's input to arguments it does not name, so a wrong one is an error and not a default", async () => {
    const { tools } = await contract.client.listTools();

    expect(
      tools.filter(({ inputSchema }) => inputSchema.additionalProperties !== false).map(({ name }) => name),
    ).toEqual([]);
  });

  // A removed argument is an error that names it: a client that still sends screenshot's `modes` must not believe the
  // render switched modes.
  it.each([
    ["status", { bogus: 1 }, "bogus"],
    ["screenshot", { node: "1:2", modes: { Theme: "Dark" } }, "modes"],
    ["image_compare", { node: "1:2", bogus: 1 }, "bogus"],
    ["components_read", { local: true }, "local"],
  ])("refuses an unknown argument of %s by name", async (name, args, key) => {
    const answer = await contract.client.callTool({ name, arguments: args });

    expect(answer.isError).toBe(true);
    expect(answer.content).toEqual([{ type: "text", text: expect.stringContaining(`"${key}"`) }]);
  });

  it("lists guide's topics as the files in topics/, in its enum and its description, and answers each with its file", async () => {
    const { tools } = await contract.client.listTools();
    const guide = tools.find(({ name }) => name === "guide");
    const index = await contract.client.callTool({ name: "guide", arguments: {} });
    const topic = guide?.inputSchema.properties?.topic as { enum: string[] } | undefined;
    const topics = (index.structuredContent as { topics?: { name: string }[] } | undefined)?.topics ?? [];

    expect([...(topic?.enum ?? [])].sort()).toEqual(TOPIC_NAMES);
    expect(TOPIC_NAMES.filter((name) => !guide?.description?.includes(`${name} (`))).toEqual([]);
    expect(index.structuredContent).toMatchObject({ topic: "index", markdown: expect.stringMatching(/^# /) });
    expect(topics.map(({ name }) => name).sort()).toEqual(TOPIC_NAMES);

    for (const name of TOPIC_NAMES) {
      const answer = await contract.client.callTool({ name: "guide", arguments: { topic: name } });

      expect(topicText(name)).toMatch(/^# /);
      expect(answer.structuredContent).toEqual({ topic: name, markdown: topicText(name) });
    }
  });

  it("names in its topics only the tools it lists, so a renamed tool fails here (R-038)", async () => {
    const listed = new Set((await contract.client.listTools()).tools.map(({ name }) => name));
    const named = TOPIC_NAMES.flatMap((name) => topicText(name).match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []);

    expect(named.length).toBeGreaterThan(0);
    expect([...new Set(named.filter((word) => !listed.has(word)))]).toEqual([]);
  });

  // 0.8.0 reads only (plan 5.0): a description, a schema, the instructions or a topic that names a write tool sends
  // the model after a tool it cannot call.
  it("names no tool it does not register in its tools, its instructions or the guide", async () => {
    const { tools } = await contract.client.listTools();
    const listed = new Set(tools.map(({ name }) => name));
    const unregistered = GOLDEN.map(({ name }) => name).filter((name) => !listed.has(name));
    const texts = [JSON.stringify(tools), contract.client.getInstructions() ?? "", ...TOPIC_NAMES.map(topicText)];

    expect(unregistered.length).toBeGreaterThan(0);
    expect(unregistered.filter((name) => texts.some((text) => new RegExp(`\\b${name}\\b`).test(text)))).toEqual([]);
  });
});
