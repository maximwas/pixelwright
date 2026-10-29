// `pnpm dev:read <fixture>`: the design XML of one Orbit fixture (test/golden/fixtures/orbit-<fixture>.json), built
// offline the way design_read builds it on the server: customers, desktop-top, plans or pricing.
import { readFileSync } from "node:fs";
import * as zod from "zod/mini";
import { CssReader } from "@/core/css/css-reader.ts";
import { GradientCss } from "@/core/css/gradients/gradient-css.ts";
import { GradientGeometry } from "@/core/css/gradients/gradient-geometry.ts";
import { AppearanceGroup } from "@/core/css/groups/appearance/appearance-group.ts";
import { EffectsGroup } from "@/core/css/groups/effects/effects-group.ts";
import { GeometryGroup } from "@/core/css/groups/geometry/geometry-group.ts";
import { Placement } from "@/core/css/groups/geometry/placement.ts";
import { LayoutGroup } from "@/core/css/groups/layout/layout-group.ts";
import { FillsGroup } from "@/core/css/groups/paint/fills-group.ts";
import { StrokesGroup } from "@/core/css/groups/paint/strokes-group.ts";
import { ImagePaint } from "@/core/css/paints/image-paint.ts";
import { PaintList } from "@/core/css/paints/paint-list.ts";
import { SolidPaint } from "@/core/css/paints/solid-paint.ts";
import { GroupRegistry } from "@/core/css/registry/group-registry.ts";
import { CssLength } from "@/core/css/values/css-length.ts";
import { CssSplit } from "@/core/css/values/css-split.ts";
import { CssUrl } from "@/core/css/values/css-url.ts";
import { CssVar } from "@/core/css/values/css-var.ts";
import { DesignBuilder } from "@/core/design/builder/design-builder.ts";
import { DesignXml } from "@/core/design/design-xml.ts";
import { LayerTree } from "@/core/design/tree/layer-tree.ts";
import { NameValueList } from "@/core/kernel/lists/name-value-list.ts";
import { NumberFormat } from "@/core/kernel/numbers/number-format.ts";
import { NodeTag } from "@/core/xml/node-tag.ts";
import { XmlEscape } from "@/core/xml/xml-escape.ts";
import { XmlWriter } from "@/core/xml/xml-writer.ts";
import { ReadModelSchema } from "@/shared/read-model/read-model.schema.ts";

class DevRead {
  readonly #format = new NumberFormat();
  readonly #lengths = new CssLength(new CssVar(new CssSplit()), this.#format);
  readonly #solid = new SolidPaint();
  readonly #paints = new PaintList(
    this.#solid,
    new GradientCss(new GradientGeometry(), this.#solid, this.#lengths, this.#format),
    new ImagePaint(new CssUrl(new CssSplit())),
  );
  readonly #design = new DesignXml(
    new LayerTree(
      new DesignBuilder(
        new NodeTag(),
        new NameValueList(),
        new CssReader(
          new GroupRegistry([
            new LayoutGroup(this.#lengths, this.#format),
            new GeometryGroup(new Placement(this.#lengths, this.#format), this.#lengths, this.#format),
            new AppearanceGroup(this.#lengths, this.#format),
            new FillsGroup(this.#paints),
            new StrokesGroup(this.#paints, this.#format),
            new EffectsGroup(this.#solid, this.#lengths, this.#format),
          ]),
        ),
      ),
    ),
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
