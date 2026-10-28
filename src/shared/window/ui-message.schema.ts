import * as zod from "zod/mini";
import { PluginKeySchema } from "@/shared/protocol/handshake.schema.ts";
import { PluginInfoSchema } from "@/shared/protocol/plugin-info.schema.ts";
import {
  UI_CHANNEL_FIELD,
  UI_CHANNEL_NAME,
  WINDOW_MESSAGE,
  WINDOW_MESSAGE_FIELD,
} from "@/shared/window/ui-message.constants.ts";

/** What main knows of the file: the plugin info without the window's own instance id and visibility. */
const PluginContextSchema = zod.omit(PluginInfoSchema, {
  instanceId: true,
  visible: true,
});

const WindowMessageSchema = zod.discriminatedUnion(WINDOW_MESSAGE_FIELD, [
  zod.object({ type: zod.literal(WINDOW_MESSAGE.ready) }),
  zod.object({
    type: zod.literal(WINDOW_MESSAGE.start),
    /** The key an earlier pairing stored, or null: anything else in its slot counts as none (P-007). */
    key: zod.nullable(PluginKeySchema),
    context: PluginContextSchema,
  }),
  zod.object({
    type: zod.literal(WINDOW_MESSAGE.savePairing),
    key: PluginKeySchema,
  }),
  zod.object({
    type: zod.literal(WINDOW_MESSAGE.allowEdits),
    on: zod.boolean(),
  }),
  /** The window's file tab came to the front or went behind: only the window's document knows (S-012, FX-010). */
  zod.object({
    type: zod.literal(WINDOW_MESSAGE.visible),
    on: zod.boolean(),
  }),
]);

/**
 * One figma.ui message (A§5.4): a server frame stamped with the epoch of the socket it belongs to, so a frame for a
 * socket that has closed never reaches the next one (P1), or a window message.
 */
export const UiMessageSchema = zod.discriminatedUnion(UI_CHANNEL_FIELD, [
  zod.object({
    ch: zod.literal(UI_CHANNEL_NAME.server),
    e: zod.int().check(zod.gte(0)),
    d: zod.string(),
  }),
  zod.object({
    ch: zod.literal(UI_CHANNEL_NAME.window),
    d: WindowMessageSchema,
  }),
]);

export type PluginContext = zod.output<typeof PluginContextSchema>;

export type WindowMessage = zod.output<typeof WindowMessageSchema>;

export type UiMessage = zod.output<typeof UiMessageSchema>;
