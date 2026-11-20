import { InjectionToken, injectable } from "@needle-di/core";

/** The file's undo steps and its version history: Figma's globals, which operations reach only through here. */
@injectable()
export class FileHistory {
  /** What the op changed so far becomes one undo step (T-045, T-121). */
  commitUndo(): void {
    figma.commitUndo();
  }

  /** A named version in the file's history, with its description; its id (P-025). */
  async saveVersion(title: string, description: string): Promise<string> {
    return (await figma.saveVersionHistoryAsync(title, description)).id;
  }
}

export const FILE_HISTORY = new InjectionToken<FileHistory>("FileHistory");
