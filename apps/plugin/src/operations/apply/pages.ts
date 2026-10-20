import { WriteError } from "../../figma/write-error.ts";
import { errorMessage } from "../../utils/error-message.ts";

/**
 * A new page, last among the file's pages. Past the Figma plan's page limit Figma refuses it ("The Starter plan only
 * comes with 3 pages…"), said here in plain words; `name` is the page's, for that message.
 */
export function newPage(name: string | undefined): PageNode {
  try {
    return figma.createPage();
  } catch (error) {
    const limit = /comes with (\d+) pages?/i.exec(errorMessage(error))?.[1];

    if (limit === undefined) {
      throw error;
    }

    throw new WriteError(
      `The file's Figma plan allows ${limit} pages: ${name ?? "the page"} is not made, and the layers in it are not created.`,
      'Put them on a page the file has: <Page id="…"> with a page id from file_map, or the parent input.',
    );
  }
}

/** The page a <Page id> names, its layers loaded unless a dry run only checks it. */
export async function existingPage(id: string | null, { load }: { readonly load: boolean }): Promise<PageNode> {
  const node = id === null ? null : await figma.getNodeByIdAsync(id);

  if (node?.type !== "PAGE") {
    throw new WriteError(
      node === null ? `No page ${id} in this file.` : `${id} is a ${node.type.toLowerCase()}, not a page.`,
      "file_map lists the file's pages with their ids.",
    );
  }

  if (load) {
    await node.loadAsync();
  }

  return node;
}
