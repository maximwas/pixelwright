interface Ranked {
  readonly lastVisible: number;
  readonly connected: number;
}

/**
 * The session a tool uses when it names none: the one whose window came to the front last (its file tab), else the
 * one that connected last. Both are positions on the bridge's own sequence, so two sessions never tie.
 */
export function pickActive<T extends Ranked>(sessions: Iterable<T>): T | null {
  let best: T | null = null;

  for (const session of sessions) {
    if (best === null || outranks(session, best)) {
      best = session;
    }
  }

  return best;
}

function outranks(session: Ranked, other: Ranked): boolean {
  if (session.lastVisible !== other.lastVisible) {
    return session.lastVisible > other.lastVisible;
  }

  return session.connected > other.connected;
}
