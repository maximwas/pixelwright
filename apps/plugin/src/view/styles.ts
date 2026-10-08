/** The window's styles, on Figma's theme variables so it follows the editor's light and dark themes. */
export const WINDOW_CSS = `
body { margin: 0; background: var(--figma-color-bg); color: var(--figma-color-text); font: 11px/16px Inter, system-ui, sans-serif; }
#create-figma-plugin { display: flex; flex-direction: column; gap: 8px; padding: 12px; }
.status { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--figma-color-bg-warning); }
.dot[data-tone="ok"] { background: var(--figma-color-bg-success); }
.dot[data-tone="error"] { background: var(--figma-color-bg-danger); }
.toggle { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.toggle input { appearance: none; position: relative; width: 28px; height: 16px; margin: 0; border-radius: 8px; background: var(--figma-color-bg-tertiary); cursor: pointer; }
.toggle input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--figma-color-bg); transition: transform 120ms; }
.toggle input:checked { background: var(--figma-color-bg-brand); }
.toggle input:checked::after { transform: translateX(12px); }
.note { margin: 0; color: var(--figma-color-text-secondary); }
.actions { margin: 0; padding: 8px 0 0; list-style: none; border-top: 1px solid var(--figma-color-border); }
.actions li { display: flex; justify-content: space-between; color: var(--figma-color-text-secondary); }
`;
