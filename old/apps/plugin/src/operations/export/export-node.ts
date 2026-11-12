import type { OperationInput, OperationOutput } from "@pixelwright/core";
import type { PluginServices } from "../../services/plugin-services.ts";
import { inModes } from "./in-modes.ts";
import { renderNode } from "./render-node.ts";

/** One chunk of a layer's export, rendered once per stream (one export the server reads). */
export async function exportNode(
  input: OperationInput<"export">,
  services: PluginServices,
): Promise<OperationOutput<"export">> {
  const { node: id, format, effects, offset, length, maxSide, modes } = input;
  const key = JSON.stringify([id, format, input.scale, effects, maxSide, modes]);
  const render = () =>
    renderNode(id, {
      format,
      scale: input.scale,
      effects,
      maxSide,
    });
  const { result, totalBytes, chunk } = await services.exports.read(
    input.stream ?? key,
    key,
    {
      offset,
      length,
    },
    () => (modes === undefined || Object.keys(modes).length === 0 ? render() : inModes(id, modes, render, services)),
  );

  return {
    scale: result.scale,
    totalBytes,
    bytes: chunk,
  };
}
