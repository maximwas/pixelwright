import { injectable } from "@needle-di/core";
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from "quickjs-emscripten-core";
import type { CodeSandbox, SandboxAnswer, SandboxRun } from "@/core/ports/code-sandbox.port.ts";
import { QuickJsRun } from "@/server/adapters/sandbox/quickjs-run.ts";

/**
 * Adapter: the code in QuickJS compiled to WebAssembly (quickjs-emscripten-core 0.32.0 with the quickjs-ng sync build;
 * research §1, §6). Pure WASM, so it runs for every npx user on any OS, chip and Node; a fresh runtime per run, with
 * its memory and stack limits, disposed when the run ends. The module loads at the first run, and again after
 * QuickJS aborted freeing a runtime.
 */
@injectable()
export class QuickJsSandbox implements CodeSandbox {
  #module: Promise<QuickJSWASMModule> | undefined;

  async run(run: SandboxRun): Promise<SandboxAnswer> {
    this.#module ??= newQuickJSWASMModuleFromVariant(import("@jitl/quickjs-ng-wasmfile-release-sync"));

    const runtime = (await this.#module).newRuntime();

    runtime.setMemoryLimit(run.limits.memoryBytes);
    runtime.setMaxStackSize(run.limits.stackBytes);

    const quickJs = new QuickJsRun(runtime, runtime.newContext(), run);

    try {
      return await quickJs.answer();
    } finally {
      if (!quickJs.dispose()) {
        // The aborted module's heap is not what the next run needs (it failed "out of memory"): load a fresh one.
        this.#module = undefined;
      }
    }
  }
}
