// Clean: a kernel module that token-name.ts imports past the kernel's index.ts.
export function slug(name: string): string {
  return name.toLowerCase().replaceAll(" ", "-");
}
