import type { LiveClient } from "./live-client.ts";
import { TEST_MCP } from "./test-mcp.ids.ts";

/** The Section every live write makes its layers in, on the page "Start here". */
const SCRATCH = { name: "Live tests", gap: 400, width: 1_200, height: 800 } as const;

/** The prefix every layer a live test makes is named with: `live:<file>:<case>`. */
const LIVE_PREFIX = "live:";

/**
 * The live run's scratch and its sweep (A§10.5), both through execute in Test MCP: the "Live tests" Section on "Start
 * here", made once beside the page's content and that page made current, since the change journal watches the current
 * page only; and every `live:` layer on that page removed at the end, whichever test left it.
 */
export class LiveCleanup {
  readonly #client: LiveClient;

  constructor(client: LiveClient) {
    this.#client = client;
  }

  /** The scratch Section's id, made when Test MCP has none yet. */
  async scratch(): Promise<string> {
    const answer = await this.#client.call("execute", {
      file: TEST_MCP.file,
      code: `const page = await pw.node(${JSON.stringify(TEST_MCP.ids.startHere)});
await figma.setCurrentPageAsync(page);
let section = page.findChild((node) => node.type === "SECTION" && node.name === ${JSON.stringify(SCRATCH.name)});
if (section === null) {
  const right = Math.max(0, ...page.children.map((node) => node.x + node.width));
  section = figma.createSection();
  section.name = ${JSON.stringify(SCRATCH.name)};
  section.x = right + ${SCRATCH.gap};
  section.y = 0;
  section.resizeWithoutConstraints(${SCRATCH.width}, ${SCRATCH.height});
}
return section.id;`,
    });

    if (typeof answer.result !== "string") {
      throw new Error(`The "${SCRATCH.name}" Section could not be made: ${JSON.stringify(answer)}`);
    }

    return answer.result;
  }

  /** Removes every layer on "Start here" whose name starts with live:, and says how many went. */
  async sweep(): Promise<number> {
    const answer = await this.#client.call("execute", {
      file: TEST_MCP.file,
      code: `const page = await pw.node(${JSON.stringify(TEST_MCP.ids.startHere)});
await page.loadAsync();
const layers = page.findAll((node) => node.name.startsWith(${JSON.stringify(LIVE_PREFIX)}));
for (const layer of layers) {
  if (!layer.removed) layer.remove();
}
return layers.length;`,
    });

    return Number(answer.result);
  }
}
