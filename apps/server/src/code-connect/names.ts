import { basename } from "node:path";
import type { TemplateFile } from "../types/code-connect.ts";

/** The code component a connection is for: its `component`, else its file's name before `.figma.`. */
export function templateName(template: TemplateFile): string {
  return template.component ?? basename(template.path).split(".figma.")[0] ?? template.path;
}

/** A name as names are compared: its last / part, lower case, letters and digits only ("Buttons/Primary Button" → primarybutton). */
export function comparable(name: string): string {
  return (name.split("/").pop() ?? name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

/** A property's name as Figma shows it: TEXT, BOOLEAN and INSTANCE_SWAP keys end in #<id>. */
export function propertyName(name: string): string {
  const hash = name.lastIndexOf("#");

  return hash === -1 ? name : name.slice(0, hash);
}
