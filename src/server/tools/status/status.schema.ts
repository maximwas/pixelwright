import * as zod from "zod/mini";
import { PLUGIN_LINK_ROLES } from "@/core/ports/plugin-link/plugin-link.constants.ts";
import { STATUS_FIELD } from "@/server/tools/status/status.constants.ts";

/** Strict: a misspelt argument is refused by name instead of being dropped without a word. */
export const StatusInputSchema = zod.strictObject({
  probe: zod._default(zod.boolean(), false).check(zod.describe(STATUS_FIELD.probe)),
});

const FileSchema = zod.object({
  session: zod.string(),
  name: zod.string(),
  key: zod.nullable(zod.string()).check(zod.describe(STATUS_FIELD.key)),
  page: zod.string(),
  editorType: zod.string(),
  allowEdits: zod.boolean(),
  active: zod.boolean(),
  pluginVersion: zod.string(),
});

export const StatusOutputSchema = zod.object({
  server: zod.object({
    version: zod.string(),
    /** The product this build is: pixelwright-new until the release, beside the 0.7.0 in daily use. */
    channel: zod.string(),
    role: zod.enum(PLUGIN_LINK_ROLES),
    /** The bridge protocol this server speaks; a plugin on another one is turned away. */
    protocol: zod.int(),
    port: zod.int(),
  }),
  files: zod.array(FileSchema),
  probe: zod.nullable(
    zod.object({
      ok: zod.boolean(),
      ms: zod.nullable(zod.number()),
      error: zod.nullable(zod.string()),
    }),
  ),
  /** While an unpaired plugin waits: the code the user types into the Pixelwright window, never typed by the model. */
  pairing: zod.nullable(
    zod.object({
      code: zod.nullable(zod.string()),
      expiresInSeconds: zod.nullable(zod.int()),
      lockedForSeconds: zod.nullable(zod.int()),
      waiting: zod.int(),
    }),
  ),
  hint: zod.nullable(zod.string()),
  /** When a file has no key: why, and where to take it from. */
  note: zod.exactOptional(zod.string()),
});

export type StatusInput = zod.output<typeof StatusInputSchema>;

export type StatusOutput = zod.output<typeof StatusOutputSchema>;
