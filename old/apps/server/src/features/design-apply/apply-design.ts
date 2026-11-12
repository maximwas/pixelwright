import {
  type ApplyChange,
  type ApplyError,
  assessElements,
  CurrentLayers,
  changesToSend,
  layersToRead,
  planChanges,
  readApply,
  sortedErrors,
} from "@pixelwright/core";
import type * as z from "zod";
import { memoryFiles, type WrittenFiles } from "../../assets/written-files.ts";
import { versionBefore } from "../../history/version-before.ts";
import type { PluginClient } from "../../plugin/plugin-client.ts";
import type { PluginSession } from "../../plugin/plugin-session.ts";
import { FileAttacher } from "./attach-files.ts";
import { UPLOAD_CHUNK_BYTES } from "./constants.ts";
import { fileChangesOf, KnownRenders } from "./file-changes.ts";
import type { DesignApplyInputSchema, DesignApplyOutputSchema } from "./schemas.ts";
import { SourceFiles } from "./source-files.ts";

type DesignApplyArgs = z.output<typeof DesignApplyInputSchema>;
type DesignApplied = z.input<typeof DesignApplyOutputSchema>;

/** Where design_apply reads files from, how it sends them, and the store of files design_read wrote. */
export interface ApplyDeps {
  /** The folder a relative src starts from: the project folder. */
  readonly cwd?: string;
  readonly chunkBytes?: number;
  readonly files?: WrittenFiles;
}

/**
 * The XML read, then the layers it names as they are, so what they already have is left out, then the changes in
 * Figma's terms with their files attached, in one apply: all on the one file the call targets.
 */
export async function applyDesign(
  plugin: PluginClient,
  { xml, parent, dryRun, file, version: title }: DesignApplyArgs,
  { cwd = process.cwd(), chunkBytes = UPLOAD_CHUNK_BYTES, files = memoryFiles() }: ApplyDeps = {},
): Promise<DesignApplied> {
  const read = readApply(xml);

  if (read.elements.length === 0) {
    return answer(dryRun, read.errors);
  }

  // Every operation of the call goes to this one file, whatever file comes to the front meanwhile.
  const session = plugin.session(file);
  const sources = new SourceFiles(cwd);
  const ids = layersToRead(read.elements);
  const layers = ids.length === 0 ? CurrentLayers.none() : CurrentLayers.of(await session.run("entries", { ids }));
  const { assessed, errors: refused } = assessElements(read.elements, layers);
  const planned = planChanges({
    elements: read.elements,
    assessed,
    layers,
    files: await fileChangesOf(assessed, sources, new KnownRenders(files)),
  });
  const attached = await new FileAttacher(session, sources, {
    dryRun,
    chunkBytes,
  }).attach(planned.changes);
  const errors = [...read.errors, ...refused, ...planned.errors, ...attached.errors];
  const sent = changesToSend(attached.changes);

  return sent.length === 0
    ? answer(dryRun, sortedErrors(errors))
    : await write(session, {
        changes: sent,
        parent,
        dryRun,
        title,
        errors,
      });
}

/** The answer of a call that writes nothing. */
function answer(dryRun: boolean, errors: ApplyError[]): DesignApplied {
  return {
    created: [],
    changed: [],
    dryRun,
    errors,
  };
}

/** The version first when one is asked for, then one apply; its errors join the call's, all in the XML's order. */
async function write(
  session: PluginSession,
  {
    changes,
    parent,
    dryRun,
    title,
    errors,
  }: {
    changes: ApplyChange[];
    parent: string | undefined;
    dryRun: boolean;
    title: string | undefined;
    errors: ApplyError[];
  },
): Promise<DesignApplied> {
  const version = await versionBefore(session, {
    title,
    dryRun,
  });
  const applied = await session.run("apply", {
    changes,
    ...(parent === undefined ? {} : { parent }),
    dryRun,
  });

  return {
    created: applied.created,
    changed: applied.changed,
    errors: sortedErrors([...errors, ...applied.errors]),
    ...(applied.properties === undefined ? {} : { properties: applied.properties }),
    dryRun,
    ...(version === undefined ? {} : { version }),
  };
}
