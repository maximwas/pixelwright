import * as zod from "zod/mini";
import { OP_NAME } from "@/shared/ops/op-meta.constants.ts";
import { PluginKeySchema } from "@/shared/protocol/handshake.schema.ts";
import { PluginInfoSchema } from "@/shared/protocol/plugin-info.schema.ts";
import {
  ACTIVITY_OUTCOME,
  UI_CHANNEL_FIELD,
  UI_CHANNEL_NAME,
  WINDOW_MESSAGE,
  WINDOW_MESSAGE_FIELD,
} from "@/shared/window/ui-message.constants.ts";

/** What main knows of the file: the plugin info without the window's own instance id and visibility. */
const PluginContextSchema = zod.omit(PluginInfoSchema, { instanceId: true, visible: true });

/** One op main answered, as the window's activity lists it (P-051); a quiet op never comes (O-027). */
const ActivityEntrySchema = zod.object({ op: zod.enum(OP_NAME), outcome: zod.enum(ACTIVITY_OUTCOME) });

/** An op whose handler still runs after the watchdog answered for it (D-06), and when it started, in epoch ms. */
const BusyOpSchema = zod.object({ op: zod.enum(OP_NAME), since: zod.number() });

const WindowMessageSchema = zod.discriminatedUnion(WINDOW_MESSAGE_FIELD, [
  zod.object({ type: zod.literal(WINDOW_MESSAGE.ready) }),
  zod.object({
    type: zod.literal(WINDOW_MESSAGE.start),
    /** The key an earlier pairing stored, or null: anything else in its slot counts as none (P-007). */
    key: zod.nullable(PluginKeySchema),
    context: PluginContextSchema,
  }),
  zod.object({ type: zod.literal(WINDOW_MESSAGE.savePairing), key: PluginKeySchema }),
  zod.object({ type: zod.literal(WINDOW_MESSAGE.allowEdits), on: zod.boolean() }),
  /** The window's file tab came to the front or went behind: only the window's document knows (S-012, FX-010). */
  zod.object({ type: zod.literal(WINDOW_MESSAGE.visible), on: zod.boolean() }),
  /** Main lists an op it answered. */
  zod.object({ type: zod.literal(WINDOW_MESSAGE.activity), entry: ActivityEntrySchema }),
  /** Every op still running past its answer; an empty list once none is. */
  zod.object({ type: zod.literal(WINDOW_MESSAGE.busy), ops: zod.array(BusyOpSchema) }),
  /** A link the user clicked: main opens it in the browser if it is one of ours (K-102). */
  zod.object({ type: zod.literal(WINDOW_MESSAGE.openLink), url: zod.string() }),
  /** The height of what the window shows: main fits the window to it (P-002). */
  zod.object({ type: zod.literal(WINDOW_MESSAGE.resize), height: zod.number() }),
]);

/**
 * One figma.ui message (A§5.4): a server frame stamped with the epoch of the socket it belongs to, so a frame for a
 * socket that has closed never reaches the next one (P1), or a window message.
 */
export const UiMessageSchema = zod.discriminatedUnion(UI_CHANNEL_FIELD, [
  zod.object({ ch: zod.literal(UI_CHANNEL_NAME.server), e: zod.int().check(zod.gte(0)), d: zod.string() }),
  zod.object({ ch: zod.literal(UI_CHANNEL_NAME.window), d: WindowMessageSchema }),
]);

export type PluginContext = zod.output<typeof PluginContextSchema>;

export type WindowMessage = zod.output<typeof WindowMessageSchema>;

export type ActivityEntry = zod.output<typeof ActivityEntrySchema>;

export type BusyOp = zod.output<typeof BusyOpSchema>;

export type UiMessage = zod.output<typeof UiMessageSchema>;
