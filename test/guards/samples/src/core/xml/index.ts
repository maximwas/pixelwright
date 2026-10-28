// Clean: the xml domain's entry point that xml-read.operation.ts imports.
export class XmlEscaper {
  escape(text: string): string {
    return encodeURIComponent(text);
  }
}
