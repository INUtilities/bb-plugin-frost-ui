import { readSidebarChrome } from "./sidebar-chrome.ts";
import { hasOwnDrawerTouchGesture } from "./drawer-touch-owner.ts";

const OPEN_DRAWER = '[data-persistent-drawer-content][data-state="open"]';

/** Keep touch and wheel scroll at the active phone drawer's boundary. */
export function injectDrawerScrollGuard(doc: Document, canScrollVertically: (drawer: HTMLElement) => boolean = () => true,
  revealFocus: (drawer: HTMLElement, target: HTMLElement) => void = () => {}): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  let touch: { id: number; x: number; y: number; drawer: HTMLElement; ownGesture: boolean } | null = null;
  const activeDrawer = () => readSidebarChrome(doc).device === "phone"
    ? Array.from(doc.querySelectorAll<HTMLElement>(OPEN_DRAWER)).filter(drawer => !drawer.closest('[inert], [aria-hidden="true"]')).at(-1) ?? null : null;
  const positions = new WeakMap<HTMLElement, number>();
  const resetScroll = (drawer: HTMLElement) => {
    for (const element of [drawer, ...Array.from(drawer.querySelectorAll<HTMLElement>("*"))]) {
      if (!(element instanceof view.HTMLElement)) continue;
      positions.set(element, 0);
      if (element.scrollTop !== 0) element.scrollTop = 0;
    }
  };
  // Capture existing positions on activation; closing/reopening is the reset boundary.
  doc.querySelectorAll<HTMLElement>(OPEN_DRAWER).forEach(drawer => {
    for (const element of [drawer, ...Array.from(drawer.querySelectorAll<HTMLElement>("*"))]) {
      if (!(element instanceof view.HTMLElement)) continue;
      if (element.scrollTop !== 0) positions.set(element, element.scrollTop);
    }
  });
  const lifecycle = new view.MutationObserver(records => {
    if (readSidebarChrome(doc).device !== "phone") return;
    for (const record of records) {
      const drawer = record.target;
      if (drawer instanceof view.HTMLElement && drawer.matches("[data-persistent-drawer-content]") &&
          (drawer.getAttribute("data-state") === "closed" || record.oldValue === "closed")) resetScroll(drawer);
    }
  });
  lifecycle.observe(doc.body, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["data-state"] });
  const focusTarget = () => {
    const active = doc.activeElement;
    return doc.getElementById(active?.getAttribute("aria-activedescendant") ?? "") ?? active;
  };
  const focus = () => {
    const drawer = activeDrawer(), target = focusTarget();
    if (drawer && target instanceof view.HTMLElement && drawer.contains(target)) revealFocus(drawer, target);
  };
  const scroll = (event: Event) => {
    const drawer = activeDrawer(), element = event.target;
    if (!drawer || !(element instanceof view.HTMLElement) || !drawer.contains(element)) return;
    if (canScrollVertically(drawer)) { positions.set(element, element.scrollTop); return; }
    const top = Math.min(positions.get(element) ?? 0, Math.max(0, element.scrollHeight - element.clientHeight));
    positions.set(element, top);
    if (element.scrollTop !== top) element.scrollTop = top;
    focus();
  };
  const canScroll = (target: Element, drawer: HTMLElement, dx: number, dy: number) => {
    const horizontal = Math.abs(dx) > Math.abs(dy);
    if (!horizontal && !canScrollVertically(drawer)) return false;
    for (let node: Element | null = target; node && node !== drawer.parentElement; node = node.parentElement) {
      if (!(node instanceof view.HTMLElement)) continue;
      const style = view.getComputedStyle(node);
      const overflow = horizontal ? style.overflowX : style.overflowY;
      if (!/auto|scroll/.test(overflow)) continue;
      const position = horizontal ? node.scrollLeft : node.scrollTop;
      const extent = horizontal ? node.scrollWidth - node.clientWidth : node.scrollHeight - node.clientHeight;
      const delta = horizontal ? dx : dy;
      if (extent > 1 && (delta > 0 ? position > 0 : position < extent - 1)) return true;
      // A nested scroller reaching its edge must not hand off to the page behind the drawer.
    }
    return false;
  };
  const start = (event: TouchEvent) => {
    const drawer = activeDrawer();
    if (!drawer || event.touches.length !== 1) { touch = null; return; }
    const point = event.touches[0]!;
    const target = event.target as Element | null;
    const ownGesture = !!target?.closest && drawer.contains(target) && hasOwnDrawerTouchGesture(target, drawer, view);
    touch = { id: point.identifier, x: point.clientX, y: point.clientY, drawer, ownGesture };
  };
  const move = (event: TouchEvent) => {
    const drawer = activeDrawer(), current = touch;
    if (!drawer || !current || (current.ownGesture && current.drawer === drawer) || event.touches.length !== 1 || event.defaultPrevented) return;
    const point = Array.from(event.touches).find(item => item.identifier === current.id);
    const target = event.target as Element | null;
    if (!point || !target?.closest) return;
    const dx = point.clientX - current.x, dy = point.clientY - current.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
    if (target.closest("[data-persistent-drawer-handle]")) return;
    if (!drawer.contains(target) || !canScroll(target, drawer, dx, dy)) event.preventDefault();
  };
  const end = () => { touch = null; };
  const wheel = (event: WheelEvent) => {
    const drawer = activeDrawer(), target = event.target as Element | null;
    if (!drawer || !target?.closest || event.ctrlKey) return;
    if (!drawer.contains(target) || !canScroll(target, drawer, -event.deltaX, -event.deltaY)) event.preventDefault();
  };
  doc.addEventListener("focusin", focus, true);
  doc.addEventListener("scroll", scroll, true);
  doc.addEventListener("touchstart", start, { capture: true, passive: true });
  doc.addEventListener("touchmove", move, { capture: true, passive: false });
  doc.addEventListener("touchend", end, true);
  doc.addEventListener("touchcancel", end, true);
  doc.addEventListener("wheel", wheel, { capture: true, passive: false });
  return () => {
    lifecycle.disconnect();
    doc.removeEventListener("focusin", focus, true);
    doc.removeEventListener("scroll", scroll, true);
    doc.removeEventListener("touchstart", start, true);
    doc.removeEventListener("touchmove", move, true);
    doc.removeEventListener("touchend", end, true);
    doc.removeEventListener("touchcancel", end, true);
    doc.removeEventListener("wheel", wheel, true);
  };
}
