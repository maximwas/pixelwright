import type { SupportLink } from "../types/support.ts";

/** The one sentence the agent passes on: the project is free, and where to support it. */
export function supportNote(links: readonly SupportLink[]): string {
  const where = links.map(({ label, url }) => `${label} (${url})`).join(", ");

  return `Pixelwright is free. If it saves you time, you can support its development: ${where}.`;
}
