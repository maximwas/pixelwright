import * as zod from "zod/mini";
import { UPDATE_FRAME } from "@/shared/protocol/update.constants.ts";

/** The server's frame: npm's newer version, for the window's banner (S-070). */
export const UpdateFrameSchema = zod.object({ type: zod.literal(UPDATE_FRAME.update), version: zod.string() });

/** The window's frame: the user closed the banner for this version. */
export const DismissFrameSchema = zod.object({ type: zod.literal(UPDATE_FRAME.dismiss), version: zod.string() });
