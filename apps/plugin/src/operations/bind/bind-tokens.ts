import type { BindInput, BindKind, OperationOutput } from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import type { PluginServices } from "../../services/plugin-services.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { BindChoices } from "./bind-choices.ts";
import { BindContext } from "./bind-context.ts";
import { BindReport } from "./bind-report.ts";
import { bindableLayers, bindRoots } from "./bind-walk.ts";
import { colorUses } from "./color-uses.ts";
import { numberUses } from "./number-uses.ts";
import type { RawUse } from "./raw-use.ts";
import { remapTokens } from "./remap.ts";
import { effectUses, textUses } from "./style-uses.ts";

/** How a layer's raw values of each kind are found, in the order a layer is read. */
const FINDERS: readonly (readonly [
  BindKind,
  (layer: SceneNode, context: BindContext) => Promise<RawUse[]> | RawUse[],
])[] = [
  ["color", colorUses],
  ["number", numberUses],
  ["effect", effectUses],
  ["text", textUses],
];

/** What binding the layers needs: the call, its shared context, where results go, and when time is up. */
interface BindRun {
  readonly input: BindInput;
  readonly context: BindContext;
  readonly report: BindReport;
  readonly deadline: number;
}

/**
 * The `bind` operation: under the roots, every raw value bound to the one token holding it (or the call's pick), the
 * rest listed; or, with remaps, one token's uses rebound to another. Instances are left to their components. A dry run
 * writes nothing and works with Allow edits off; a real run is one undo step.
 */
export async function bindTokens(input: BindInput, { edits }: PluginServices): Promise<OperationOutput<"bind">> {
  if (!input.dryRun) {
    edits.require();
  }

  const roots = await bindRoots(input.roots);
  const context = await BindContext.of(roots);
  const report = new BindReport();
  const deadline = Date.now() + OP_BUDGET_MS;
  const { layers, instances, finished } = bindableLayers(roots, deadline);
  let done = true;

  if (input.remap.length > 0) {
    await remapTokens(layers, input, context, report);
  } else {
    done = await bindValues(layers, {
      input,
      context,
      report,
      deadline,
    });
  }

  if (instances > 0) {
    report.note(
      instances === 1
        ? "1 instance was left alone: bind its main component, and its instances follow."
        : `${instances} instances were left alone: bind their main components, and the instances follow.`,
    );
  }

  if (!input.dryRun && report.wrote) {
    figma.commitUndo();
  }

  return report.result(!finished || !done);
}

/** Each layer's raw values bound or listed; false when time ran out first. */
async function bindValues(layers: readonly SceneNode[], run: BindRun): Promise<boolean> {
  const choices = new BindChoices(run.input.choose, run.context.index);

  for (const layer of layers) {
    if (Date.now() > run.deadline) {
      return false;
    }

    for (const [kind, find] of FINDERS) {
      if (run.input.kinds.includes(kind)) {
        for (const use of await find(layer, run.context)) {
          await settle(use, choices, run);
        }
      }
    }
  }

  return true;
}

/** What becomes of one raw value: bound (unless the run is dry), left with its candidates, or with no token. */
async function settle(use: RawUse, choices: BindChoices, { input, report }: BindRun): Promise<void> {
  const decision = choices.decide(use);

  if (decision.kind === "refused") {
    report.error(use.layer.id, decision.message);
  } else if (decision.kind === "ambiguous") {
    report.ambiguous(use);
  } else if (decision.kind === "unmatched") {
    report.unmatched(use);
  } else {
    try {
      if (!input.dryRun) {
        await use.bind(decision.candidate, decision.snapped);
      }

      report.bound(use, decision.candidate, decision.snapped);
    } catch (error) {
      report.error(use.layer.id, errorMessage(error));
    }
  }
}
