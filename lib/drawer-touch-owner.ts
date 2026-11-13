/** A nested control with its own touch gesture must receive its complete event stream. */
export function hasOwnDrawerTouchGesture(target: Element, drawer: HTMLElement, view: Window): boolean {
  for (let node: Element | null = target; node && node !== drawer; node = node.parentElement) {
    if (node.matches('[draggable="true"], [data-vaul-no-drag], [data-no-drawer-drag]')) return true;
    if (view.getComputedStyle(node).touchAction === "none") return true;
  }
  return false;
}
