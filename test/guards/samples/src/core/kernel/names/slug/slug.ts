// Clean: a kernel module, the target of the planted imports beside it and in test/support.
export class SlugMaker {
  make(name: string): string {
    return name.trim().toLowerCase();
  }
}
