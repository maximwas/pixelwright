/**
 * The synchronous Plugin API that throws with documentAccess "dynamic-page", by the name Figma's error gives it, and
 * the call to make instead (as @figma/plugin-typings deprecates them).
 */
const ASYNC_FORMS: Readonly<Record<string, string>> = {
  getNodeById: "await figma.getNodeByIdAsync(id)",
  getStyleById: "await figma.getStyleByIdAsync(id)",
  currentPage: "await figma.setCurrentPageAsync(page)",
  getLocalPaintStyles: "await figma.getLocalPaintStylesAsync()",
  getLocalTextStyles: "await figma.getLocalTextStylesAsync()",
  getLocalEffectStyles: "await figma.getLocalEffectStylesAsync()",
  getLocalGridStyles: "await figma.getLocalGridStylesAsync()",
  getFileThumbnailNode: "await figma.getFileThumbnailNodeAsync()",
  getVariableById: "await figma.variables.getVariableByIdAsync(id)",
  getVariableCollectionById: "await figma.variables.getVariableCollectionByIdAsync(id)",
  getLocalVariables: "await figma.variables.getLocalVariablesAsync()",
  getLocalVariableCollections: "await figma.variables.getLocalVariableCollectionsAsync()",
  mainComponent: "await instance.getMainComponentAsync()",
  instances: "await component.getInstancesAsync()",
  consumers: "await style.getStyleConsumersAsync()",
  fillStyleId: "await node.setFillStyleIdAsync(id)",
  strokeStyleId: "await node.setStrokeStyleIdAsync(id)",
  effectStyleId: "await node.setEffectStyleIdAsync(id)",
  gridStyleId: "await node.setGridStyleIdAsync(id)",
  textStyleId: "await node.setTextStyleIdAsync(id)",
  setRangeTextStyleId: "await text.setRangeTextStyleIdAsync(start, end, id)",
  setRangeFillStyleId: "await text.setRangeFillStyleIdAsync(start, end, id)",
  vectorNetwork: "await node.setVectorNetworkAsync(network)",
  reactions: "await node.setReactionsAsync(reactions)",
};

/**
 * The async call to make instead, when Figma refused a synchronous one for dynamic-page without naming it: the API
 * found by name in Figma's message, else in the code's line that threw. Null when the error is another, or Figma's
 * message already names the async form.
 */
export function asyncHint(message: string, line: string): string | null {
  if (!message.includes("dynamic-page") || message.includes("Async")) {
    return null;
  }

  const named = (text: string) =>
    Object.keys(ASYNC_FORMS).find((name) => new RegExp(`(?<![A-Za-z])${name}(?![A-Za-z])`).test(text));
  const name = named(message) ?? named(line);

  return name === undefined
    ? "This plugin's documentAccess is dynamic-page: call the Async form of what threw."
    : `Use ${ASYNC_FORMS[name]} instead: this plugin's documentAccess is dynamic-page.`;
}
