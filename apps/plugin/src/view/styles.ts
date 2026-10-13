/** The window's styles, on Figma's theme variables so it follows the editor's light and dark themes. */
export const WINDOW_CSS = `
body { margin: 0; background: var(--figma-color-bg); color: var(--figma-color-text); font: 11px/16px Inter, system-ui, sans-serif; }
#create-figma-plugin { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
.status { display: flex; align-items: flex-start; gap: 8px; }
.dot { flex: none; width: 8px; height: 8px; margin-top: 4px; border-radius: 50%; background: var(--figma-color-bg-warning); }
.dot[data-tone="ok"] { background: var(--figma-color-bg-success); }
.dot[data-tone="error"] { background: var(--figma-color-bg-danger); }
.title { display: block; font-size: 12px; font-weight: 600; }
.detail { margin: 2px 0 0; color: var(--figma-color-text-secondary); }
.note { margin: 0; color: var(--figma-color-text-secondary); }
.hint { margin: 0; padding: 8px 10px; border-radius: 6px; color: var(--figma-color-text); background: var(--figma-color-bg-warning-tertiary); }
.edits { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; border: 1px solid var(--figma-color-border); border-radius: 6px; }
.toggle { display: flex; align-items: center; justify-content: space-between; font-weight: 500; cursor: pointer; }
.toggle input { appearance: none; position: relative; width: 28px; height: 16px; margin: 0; border-radius: 8px; background: var(--figma-color-bg-tertiary); cursor: pointer; }
.toggle input::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: var(--figma-color-bg); transition: transform 120ms; }
.toggle input:checked { background: var(--figma-color-bg-brand); }
.toggle input:checked::after { transform: translateX(12px); }
.pairing { display: flex; gap: 8px; }
.pairing input { flex: 1; min-width: 0; padding: 4px 8px; font: 500 13px/20px Inter, system-ui, sans-serif; letter-spacing: 0.2em; color: var(--figma-color-text); background: var(--figma-color-bg); border: 1px solid var(--figma-color-border); border-radius: 5px; }
.pairing button { padding: 4px 12px; font: 500 11px/20px Inter, system-ui, sans-serif; color: var(--figma-color-text-onbrand); background: var(--figma-color-bg-brand); border: none; border-radius: 5px; cursor: pointer; }
.heading { margin: 0 0 4px; font-size: 11px; font-weight: 600; color: var(--figma-color-text-secondary); }
.actions { margin: 0; padding: 0; list-style: none; }
.actions li { display: flex; justify-content: space-between; gap: 8px; }
.actions .what { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions .when { flex: none; color: var(--figma-color-text-tertiary); }
.actions .warning .what { color: var(--figma-color-text-warning); }
.actions .empty { color: var(--figma-color-text-tertiary); }
.brand { display: flex; align-items: center; gap: 6px; }
.mark svg { display: block; width: 16px; height: 16px; }
.brand-name { font-size: 12px; font-weight: 600; }
.support { margin: 0; color: var(--figma-color-text-tertiary); }
.support a { color: var(--figma-color-text-brand); text-decoration: underline; cursor: pointer; }
[hidden] { display: none !important; }
`;
