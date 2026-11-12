import { OperationRegistry } from "../../src/operations/registry.ts";
import { createServices, type PluginServices } from "../../src/services/plugin-services.ts";

/** A plugin as its composition root makes one: its operations over the installed fake Figma, and its services. */
export interface TestPlugin {
  readonly run: (op: string, input: unknown) => Promise<unknown>;
  readonly services: PluginServices;
}

/** A plugin with Allow edits off unless asked; tests turn it on and off through its services. */
export function testPlugin({ allowEdits = false }: { allowEdits?: boolean } = {}): TestPlugin {
  const services = createServices();
  const registry = new OperationRegistry(services);

  services.edits.allow(allowEdits);

  return {
    run: (op, input) => registry.run(op, input),
    services,
  };
}
