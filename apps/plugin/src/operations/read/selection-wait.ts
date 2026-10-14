import type { OperationInput, OperationOutput } from "@pixelwright/core";
import { selection } from "./selection.ts";

/**
 * Waits until the user selects something other than `from` (the selection now when null), or the time runs out; the
 * answer says which, with the selection at that moment.
 */
export async function selectionWait({
  timeoutMs,
  from,
}: OperationInput<"selection_wait">): Promise<OperationOutput<"selection_wait">> {
  const start = from ?? figma.currentPage.selection.map((node) => node.id);
  const key = start.join(",");
  const differs = () => {
    const now = figma.currentPage.selection;

    return now.length > 0 && now.map((node) => node.id).join(",") !== key;
  };

  const changed = differs()
    ? true
    : await new Promise<boolean>((resolve) => {
        const done = (value: boolean) => {
          figma.off("selectionchange", onChange);
          clearTimeout(timer);
          resolve(value);
        };
        const onChange = () => {
          if (differs()) {
            done(true);
          }
        };
        const timer = setTimeout(() => done(false), timeoutMs);

        figma.on("selectionchange", onChange);
      });

  return {
    changed,
    from: start,
    ...(await selection()),
  };
}
