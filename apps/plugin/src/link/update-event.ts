import { UPDATE_EVENT, UpdateEventSchema } from "@pixelwright/core";

/** The server's UPDATE_EVENT, the newest Pixelwright npm has, passed on; any other event, or data it cannot read, not. */
export function tellUpdate(name: string, data: unknown, onUpdate: ((version: string) => void) | undefined): void {
  const update = name === UPDATE_EVENT ? UpdateEventSchema.safeParse(data) : null;

  if (update?.success) {
    onUpdate?.(update.data.version);
  }
}
