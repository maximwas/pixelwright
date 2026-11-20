/** The apply profile's roots (P-118): the named layers no other named layer holds, since a root is read with all inside it. */
export class OutermostLayers {
  /** `aboveOf`: the ids of the layers a layer sits in, up to its page. The order asked is kept. */
  of(ids: readonly string[], aboveOf: (id: string) => readonly string[]): string[] {
    const named = new Set(ids);

    return ids.filter((id) => !aboveOf(id).some((above) => named.has(above)));
  }
}
