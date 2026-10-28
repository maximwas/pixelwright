import { createServer } from "node:net";

/** A port nothing listens on right now. */
export async function freePort(): Promise<number> {
  const server = createServer();

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  const address = server.address();

  await new Promise<void>((resolve) => server.close(() => resolve()));

  if (address === null || typeof address === "string") {
    throw new Error("no TCP address");
  }

  return address.port;
}
