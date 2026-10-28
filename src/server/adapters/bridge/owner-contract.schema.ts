import { eventIterator, oc } from "@orpc/contract";
import * as zod from "zod/mini";
import { LIMITS } from "@/shared/limits/limits.constants.ts";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";

const ConnectedFileSchema = zod.object({
  session: zod.string(),
  name: zod.string(),
  key: zod.nullable(zod.string()),
  page: zod.string(),
  editorType: zod.string(),
  allowEdits: zod.boolean(),
  visible: zod.boolean(),
  active: zod.boolean(),
  pluginVersion: zod.string(),
});

/** What the owner tells its peers on every change (S-033): its files, and the pairing code it made. */
const PeerStatusSchema = zod.object({
  files: zod.array(ConnectedFileSchema),
  pairing: zod.nullable(
    zod.object({
      code: zod.nullable(zod.string()),
      expiresInSeconds: zod.nullable(zod.int()),
      lockedForSeconds: zod.nullable(zod.int()),
      waiting: zod.int(),
    }),
  ),
});

/**
 * What the owner serves its peers over oRPC (A§5.3 step 4), plain data (A§5.4): `request` runs one op on a session's
 * plugin and returns its envelope; `status` is an event iterator of the owner's files and pairing. The owner never
 * calls a peer, so one contract on one channel is enough.
 */
export const OWNER_CONTRACT = {
  request: oc
    .input(
      zod.object({
        session: zod.string(),
        op: zod.enum(OP_NAME),
        input: zod.unknown(),
        timeoutMs: zod.int().check(zod.positive(), zod.lte(LIMITS.requestMaxTimeoutMs)),
      }),
    )
    .output(zod.unknown()),
  status: oc.output(eventIterator(PeerStatusSchema)),
};

export type PeerStatus = zod.output<typeof PeerStatusSchema>;
