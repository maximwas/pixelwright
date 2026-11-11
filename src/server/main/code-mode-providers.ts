import type { Container } from "@needle-di/core";
import { camelCase } from "es-toolkit";
import { CODE_SANDBOX } from "@/core/ports/code-sandbox.port.ts";
import { QuickJsSandbox } from "@/server/adapters/sandbox/quickjs-sandbox.ts";
import { ANSWER_SHAPES, AnswerShapes } from "@/server/app/code-mode/answer-shapes.ts";
import { PW_TOOLS } from "@/server/app/code-mode/code-mode.tokens.ts";
import { CODE_RUNNER, CodeRunner } from "@/server/app/code-mode/code-runner.ts";
import { PW_BRIDGE, PwBridge } from "@/server/app/code-mode/pw-bridge.ts";
import { RESULT_CUT, ResultCut } from "@/server/app/code-mode/result-cut.ts";
import type { ToolManifest } from "@/server/app/tool-runner/tool-manifest.types.ts";
import { ToolCatalog } from "@/server/tools/tool.catalog.ts";

/**
 * execute's script: the QuickJS sandbox, pw's table (every read tool by its camelCase name, here, since a tool must
 * not import the catalog), the answers' shapes, the bridge to the tool runner, the result's cut and the run.
 */
export class CodeModeProviders {
  register(container: Container): void {
    container
      .bind({ provide: CODE_SANDBOX, useClass: QuickJsSandbox })
      .bind({ provide: PW_TOOLS, useValue: this.#tools() })
      .bind({ provide: ANSWER_SHAPES, useClass: AnswerShapes })
      .bind({ provide: PW_BRIDGE, useClass: PwBridge })
      .bind({ provide: RESULT_CUT, useClass: ResultCut })
      .bind({ provide: CODE_RUNNER, useClass: CodeRunner });
  }

  /** pw.nodesFind is nodes_find: the names scripts/pw/answer-types.ts gives types_read too. */
  #tools(): ReadonlyMap<string, ToolManifest> {
    return new Map(new ToolCatalog().reads().map((manifest) => [camelCase(manifest.name), manifest]));
  }
}
