// `pnpm dev:read <fixture>`: the design XML of one Orbit fixture (test/golden/fixtures/orbit-<fixture>.json), built
// offline the way design_read builds it on the server: customers, desktop-top, plans or pricing.
import { readFileSync } from "node:fs";
import * as zod from "zod/mini";
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { DesignXml } from "@/core/design/design-xml.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

class DevRead {
  readonly #design = new DesignXml(
    new LayerTree(new DesignBuilder(new NodeTag(), new NameValueList())),
    new XmlWriter(new XmlEscape()),
  );

  /** The process exit code: 1 without a fixture's name. */
  run(argv: readonly string[]): number {
    const [fixture] = argv;

    if (fixture === undefined) {
      process.stderr.write("Usage: pnpm dev:read <customers|desktop-top|plans|pricing>\n");

      return 1;
    }

    const file = new URL(`../test/golden/fixtures/orbit-${fixture}.json`, import.meta.url);
    const model = zod.parse(ReadModelSchema, JSON.parse(readFileSync(file, "utf8")));

    // `| head` closes the pipe early: the rest of the XML is not wanted, so that is no error.
    process.stdout.on("error", () => process.exit(0));
    process.stdout.write(`${this.#design.xml(model)}\n`);

    return 0;
  }
}

process.exitCode = new DevRead().run(process.argv.slice(2));
