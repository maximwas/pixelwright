import { applyTextEdits, type TextEdit, type TextsInput, type TextsOutput, textEdits } from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import { type BoundProperty, boundProperty, propertyName } from "../../figma/component-properties.ts";
import { textFonts } from "../../figma/fonts.ts";
import { requireRoots } from "../../figma/nodes.ts";
import { layersUntil } from "../../figma/walk.ts";
import type { PluginServices } from "../../services/plugin-services.ts";
import { errorMessage } from "../../utils/error-message.ts";

/** The most texts the answer lists; the totals count them all. */
const MAX_LISTED = 200;

/** What one call does to each text: dry or not, and the instance properties it has already set. */
interface ReplaceRun {
  readonly dryRun: boolean;
  readonly set: Set<string>;
}

/**
 * The `texts` operation: the replacements made in every text under the roots, each match replaced where it stands, so
 * its run keeps its style; a text an instance shows from a component property changes through the property. A dry run
 * writes nothing and works with Allow edits off; a real run is one undo step.
 */
export async function replaceTexts(input: TextsInput, { edits }: PluginServices): Promise<TextsOutput> {
  if (!input.dryRun) {
    edits.require();
  }

  const deadline = Date.now() + OP_BUDGET_MS;
  const output: TextsOutput = {
    changed: [],
    texts: 0,
    count: 0,
    errors: [],
    more: false,
  };
  const run: ReplaceRun = {
    dryRun: input.dryRun,
    set: new Set(),
  };

  const walked = layersUntil(await requireRoots(input.roots), deadline);

  output.more = !walked.finished;

  for (const text of walked.layers.filter((node): node is TextNode => node.type === "TEXT")) {
    if (Date.now() > deadline) {
      output.more = true;
      break;
    }

    await replaceIn(text, textEdits(text.characters, input.replacements), {
      run,
      output,
    });
  }

  if (!input.dryRun && output.texts > 0) {
    figma.commitUndo();
  }

  return output;
}

/** One text's edits made (or found, in a dry run), and the answer told; a text Figma refuses is an error of its own. */
async function replaceIn(
  text: TextNode,
  edits: readonly TextEdit[],
  { run, output }: { run: ReplaceRun; output: TextsOutput },
): Promise<void> {
  if (edits.length === 0) {
    return;
  }

  const before = text.characters;
  const after = applyTextEdits(before, edits);

  try {
    const property = await write(text, {
      edits,
      after,
      run,
    });

    output.texts += 1;
    output.count += edits.length;

    if (output.changed.length < MAX_LISTED) {
      output.changed.push({
        id: text.id,
        name: text.name,
        before,
        after,
        count: edits.length,
        ...(property === null ? {} : { property: propertyName(property.key) }),
      });
    }
  } catch (error) {
    output.errors.push({
      id: text.id,
      message: errorMessage(error),
    });
  }
}

/** The text changed: through its instance's property, or edit by edit from the last, so earlier places stand. */
async function write(
  text: TextNode,
  { edits, after, run }: { edits: readonly TextEdit[]; after: string; run: ReplaceRun },
): Promise<BoundProperty | null> {
  const property = boundProperty(text, "characters");

  await fontsOf(text, run.dryRun);

  if (run.dryRun) {
    return property;
  }

  if (property !== null) {
    const key = `${property.instance.id} ${property.key}`;

    if (!run.set.has(key)) {
      property.instance.setProperties({ [property.key]: after });
      run.set.add(key);
    }

    return property;
  }

  for (const { start, end, text: replacement } of [...edits].sort((a, b) => b.start - a.start)) {
    // In after the match, with the style of its last character, then the match out: the run keeps its style.
    if (replacement !== "") {
      text.insertCharacters(end, replacement, "BEFORE");
    }

    text.deleteCharacters(start, end);
  }

  return null;
}

/** The text's fonts loaded (only checked in a dry run); one missing is an error naming it. */
async function fontsOf(text: TextNode, dryRun: boolean): Promise<void> {
  for (const font of textFonts(text)) {
    const missing = dryRun
      ? text.hasMissingFont
      : await figma.loadFontAsync(font).then(
          () => false,
          () => true,
        );

    if (missing) {
      throw new Error(
        `Its font ${font.family} ${font.style} is not on this machine: install it, or change the text in Figma.`,
      );
    }
  }
}
