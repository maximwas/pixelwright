import { applyTextEdits, type TextEdit, type TextsInput, type TextsOutput, textEdits } from "@pixelwright/core";
import { OP_BUDGET_MS } from "../../constants/plugin.ts";
import type { PluginServices } from "../../services/plugin-services.ts";
import { errorMessage } from "../../utils/error-message.ts";
import { textRoots, textsUnder } from "./text-walk.ts";

/** The most texts the answer lists; the totals count them all. */
const MAX_LISTED = 200;

/** A text property an instance shows the text from: the instance, and the property's key. */
interface BoundProperty {
  readonly instance: InstanceNode;
  readonly key: string;
}

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

  for (const text of textsUnder(await textRoots(input.roots))) {
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
        ...(property === null ? {} : { property: property.key.replace(/#[^#]*$/, "") }),
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
  const property = boundProperty(text);

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

/** The instance whose component property the text shows, if it shows one (a main component's own text is its own). */
function boundProperty(text: TextNode): BoundProperty | null {
  const key = text.componentPropertyReferences?.characters;

  for (let at = text.parent; key !== undefined && at !== null; at = at.parent) {
    if (at.type === "INSTANCE" && at.componentProperties[key] !== undefined) {
      return {
        instance: at,
        key,
      };
    }

    if (at.type === "COMPONENT" || at.type === "COMPONENT_SET") {
      return null;
    }
  }

  return null;
}

/** The text's fonts loaded (only checked in a dry run); one missing is an error naming it. */
async function fontsOf(text: TextNode, dryRun: boolean): Promise<void> {
  const fonts = text.characters.length === 0 ? [text.fontName] : text.getRangeAllFontNames(0, text.characters.length);

  for (const font of fonts) {
    if (typeof font !== "object") {
      continue;
    }

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
