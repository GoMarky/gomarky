import { createView } from './code/view';

const toolbar_panel_id = 'toolbar_panel';
export function activate(): void {
  const controls = createView();

  const appEl = document.querySelector<HTMLElement>(`#${toolbar_panel_id}`) as HTMLElement;

  appEl.appendChild(controls);
}

export function deactivate(): void {
  // deactivate here
}
