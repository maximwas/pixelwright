// Clean: the xml domain's entry point that xml-read.operation.ts imports.
export function escapeXml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}
