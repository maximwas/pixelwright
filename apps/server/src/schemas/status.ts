import * as z from "zod";

export const StatusInputSchema = z.object({
  probe: z.boolean().default(false).describe("Also ping the active file's plugin and report the round trip."),
});

const FileSchema = z.object({
  session: z.string(),
  name: z.string(),
  key: z.string().nullable(),
  page: z.string(),
  editorType: z.string(),
  allowEdits: z.boolean(),
  active: z.boolean(),
  pluginVersion: z.string(),
});

export const StatusOutputSchema = z.object({
  server: z.object({
    version: z.string(),
    role: z.enum(["owner", "peer", "handedOver", "unavailable", "failed", "disabled"]),
    /** The bridge protocol this server speaks; a plugin on another one is turned away. */
    protocol: z.number().int(),
    port: z.number().int(),
  }),
  files: z.array(FileSchema),
  probe: z
    .object({
      ok: z.boolean(),
      ms: z.number().nullable(),
      error: z.string().nullable(),
    })
    .nullable(),
  /** While an unpaired plugin waits: the code the user types into the Pixelwright window, never typed by the model. */
  pairing: z
    .object({
      code: z.string().nullable(),
      expiresInSeconds: z.number().int().nullable(),
      lockedForSeconds: z.number().int().nullable(),
      waiting: z.number().int(),
    })
    .nullable(),
  hint: z.string().nullable(),
});
