export function domContentLoaded(): Promise<void> {
  return new Promise<any>(resolve => {
    const readyState = document.readyState;
    if (readyState === 'complete' || (document && document.body !== null)) {
      resolve();
    } else {
      window.addEventListener('DOMContentLoaded', resolve, false);
    }
  });
}

export function preventElementDrag(element: HTMLElement): void {
  element.ondragover = () => false;
  element.ondragleave = () => false;
  element.ondragend = () => false;
}
