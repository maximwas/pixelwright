/**
 * The update banner's two frames inside a session (S-070), beside the RPC: the server tells the window npm's newer
 * version, the window tells the server the user closed the banner for it. Each is one event, never answered.
 */
export const UPDATE_FRAME = { update: "update", dismiss: "dismiss_update" } as const;

/**
 * How each frame's text begins: JSON.stringify writes `type` first and an RPC frame never begins so, so the window and
 * the server tell these apart without parsing every RPC frame.
 */
export const UPDATE_FRAME_HEAD = {
  update: JSON.stringify({ type: UPDATE_FRAME.update }).slice(0, -1),
  dismiss: JSON.stringify({ type: UPDATE_FRAME.dismiss }).slice(0, -1),
} as const;
