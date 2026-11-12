import type { StatusFile } from "./live-client.ts";
import { TEST_MCP } from "./test-mcp.ids.ts";

/**
 * What must hold before any live test runs (A§10.5 step 3), each failure in words saying what to do: it is Test MCP
 * (its key is null, so its page names it), its tab is the visible one (a background tab is throttled, FX-010), and
 * Allow edits is on.
 */
export class LiveChecks {
  problem(file: StatusFile): string | null {
    if (!TEST_MCP.pages.some((page) => page === file.page)) {
      return `The file named Test MCP is on page "${file.page}", which Test MCP has not: open the real Test MCP.`;
    }

    if (!file.visible) {
      return "Test MCP is not the visible tab: bring its tab to the front in Figma Desktop (a background tab is throttled) and run again.";
    }

    if (!file.allowEdits) {
      return "Allow edits is off in Test MCP: turn it on in the Pixelwright New window and run again.";
    }

    return null;
  }
}
