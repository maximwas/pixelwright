// Clean: the xml domain's class that xml-read.operation.ts and the kernel's token-name.ts import.
export class XmlEscaper {
  escape(text: string): string {
    return encodeURIComponent(text);
  }
}
