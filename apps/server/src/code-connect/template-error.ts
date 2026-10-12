/** An error of one instance's template, named as Figma names them: PROPERTY_NOT_FOUND, TEMPLATE_TIMEOUT… */
export class TemplateError extends Error {
  readonly code: string;

  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.code = code;
  }
}
