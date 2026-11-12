import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { type LiveBlock, LiveClient } from "../support/live-client.ts";
import { TEST_MCP } from "../support/test-mcp.ids.ts";

/** Layers of 185:239, the coverage frame of Test MCP, read only: the text of mixed runs. */
const MIXED_RUNS = "185:421";
/** The coverage frame itself, read only. */
const COVERAGE = "185:239";

/** One script's answer, parsed from execute's text block, and the image blocks after it. */
interface Run {
  readonly answer: {
    readonly result: unknown;
    readonly logs: string[];
    readonly error?: string;
    readonly calls: Record<string, number>;
  };
  readonly images: LiveBlock[];
}

// Reads only: execute's script, run on the server, every pw call inside it naming Test MCP itself.
describe("read/execute-script", () => {
  const { file } = inject("live");
  let client: LiveClient;

  beforeAll(async () => {
    client = await new LiveClient().connect();
    await client.waitForTestMcp();
  });

  afterAll(() => client.close());

  async function run(script: string): Promise<Run> {
    const { isError, content } = await client.blocks("execute", { file, script, timeout: 120 });
    const [text, ...images] = content;

    expect(isError).toBe(false);

    return { answer: JSON.parse(text?.text ?? "null") as Run["answer"], images };
  }

  it("loops over the 10 Plan Card instances with nodesFind and inspect, and returns a short list", async () => {
    const { answer } = await run(`const { nodes } = await pw.nodesFind({ component: "Plan Card", within: "file" });
const cards = [];
for (const { id, name } of nodes) {
  const { layers: [layer] } = await pw.inspect({ nodes: [id] });
  cards.push({ id, name, width: layer.box.width });
}
return cards;`);

    expect(answer.error).toBeUndefined();
    expect(answer.result).toHaveLength(10);
    expect(answer.result).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: TEST_MCP.ids.planStarter, width: expect.any(Number) })]),
    );
    expect(answer.calls).toEqual({ "pw.nodesFind": 1, "pw.inspect": 10 });
  });

  it("reads 185:421 with designRead and filters its tree in the script, no XML parsed", async () => {
    const { answer } = await run(`const { xml, tree } = await pw.designRead({ node: "${MIXED_RUNS}" });
const texts = [];
const walk = (element) => {
  if (element.tag === "Text") texts.push({ id: element.id, text: element.text });
  element.children.forEach(walk);
};
walk(tree);
return { xmlChars: xml.length, root: tree.id, texts };`);

    expect(answer.error).toBeUndefined();
    expect(answer.result).toMatchObject({
      xmlChars: expect.any(Number),
      root: MIXED_RUNS,
      texts: expect.arrayContaining([expect.objectContaining({ id: MIXED_RUNS, text: expect.any(String) })]),
    });
  });

  it("answers every text of the coverage frame with its font sizes through utils.layers, inspect in batches", async () => {
    const { answer } = await run(`const { nodes } = await pw.nodesFind({ type: "TEXT", within: "${COVERAGE}" });
const { layers } = await utils.layers({ type: "TEXT", within: "${COVERAGE}" }, { fields: ["text"] });
return { found: nodes.map(({ id }) => id), texts: layers.map(({ id, text }) => ({ id, fontSizes: text.fontSizes })) };`);
    const { found, texts } = answer.result as { found: string[]; texts: { id: string; fontSizes: number[] }[] };

    expect(answer.error).toBeUndefined();
    expect(texts.map(({ id }) => id)).toEqual(found);
    expect(texts.every(({ fontSizes }) => fontSizes.length > 0 && fontSizes.every(Number.isFinite))).toBe(true);
    expect(answer.calls).toEqual({ "pw.nodesFind": 2, "pw.inspect": Math.ceil(found.length / 100) });
  });

  it("has no pw.screenshot, node_show or selection_wait: a script cannot show an image or act on the user's view", async () => {
    const { answer } = await run(
      "return [typeof pw.screenshot, typeof pw.nodeShow, typeof pw.selectionWait, typeof pw.nodesFind];",
    );

    expect(answer.result).toEqual(["undefined", "undefined", "undefined", "function"]);
  });

  it("reads execute's file for a pw call that names none, and the file a call names when it does", async () => {
    const { answer } = await run(
      'const own = await pw.status();\nconst other = await pw.status({ file: "No such file" }).catch((error) => error.message);\nreturn { own: typeof own, other };',
    );

    expect(answer.result).toMatchObject({ own: "object", other: expect.stringMatching(/^pw\.status: /) });
  });

  it("refuses the 51st pw call of a run, and still lists the 50 that succeeded", async () => {
    const { answer } = await run("for (let index = 0; index < 51; index += 1) await pw.status();");

    expect(answer.error).toMatch(/^Error: pw\.status: a run makes at most 50 pw calls/);
    expect(answer.calls).toEqual({ "pw.status": 50 });
  });

  it("answers a syntax error with its line before any pw call runs", async () => {
    const { answer } = await run(
      `const plans = await pw.nodesFind({ component: "Plan Card" });\nreturn plans.nodes.map((node) => node.id;`,
    );

    expect(answer.error).toMatch(/^SyntaxError: .+\n {4}at line 2, column \d+\nline 2: return plans\.nodes/);
    expect(answer.calls).toEqual({});
  });

  it("throws on a key a read's answer type does not have, naming its fields", async () => {
    const { answer } = await run(`const answer = await pw.nodesFind({ type: "TEXT", within: "${COVERAGE}" });
return answer.layers;`);

    expect(answer.error).toMatch(/^Error: pw\.nodesFind: no field "layers" here; fields: nodes, /);
  });
});
