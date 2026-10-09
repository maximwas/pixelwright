import { EDITS_STORAGE_PREFIX, FILE_ID_KEY } from "../constants/plugin.ts";

/**
 * Allow edits as the user left it in this file, on this computer: figma.clientStorage is the user's own and shared by
 * every file, so each file has its own key, by its id. The id is Figma's file key where Figma gives one (private
 * plugins), else one Pixelwright keeps in the file's plugin data, written the first time Allow edits is turned on
 * there: a file that is only read stays as it was, and a copy of an allowed file carries the id along.
 */
export async function readEditsAllowed(): Promise<boolean> {
  const id = fileId();

  return id !== null && typeof (await figma.clientStorage.getAsync(`${EDITS_STORAGE_PREFIX}${id}`)) === "string";
}

let saving = Promise.resolve();

/** Keeps the switch for this file: on stores when it was turned on, off forgets it. One save at a time, in order. */
export function saveEditsAllowed(allowed: boolean): Promise<void> {
  const saved = saving.then(() => save(allowed));

  // A failed save is its caller's; the next one still runs.
  saving = saved.catch(() => {});

  return saved;
}

async function save(allowed: boolean): Promise<void> {
  if (allowed) {
    await figma.clientStorage.setAsync(`${EDITS_STORAGE_PREFIX}${fileId() ?? newFileId()}`, new Date().toISOString());

    return;
  }

  const id = fileId();

  if (id !== null) {
    await figma.clientStorage.deleteAsync(`${EDITS_STORAGE_PREFIX}${id}`);
  }
}

function fileId(): string | null {
  const kept = figma.root.getPluginData(FILE_ID_KEY);

  return figma.fileKey ?? (kept === "" ? null : kept);
}

/** An id for this file, kept in it. Unique, not secret: the main thread's sandbox promises no crypto. */
function newFileId(): string {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

  figma.root.setPluginData(FILE_ID_KEY, id);

  return id;
}
