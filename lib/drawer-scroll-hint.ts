import { readSidebarChrome, SIDEBAR_CHROME_EVENT } from "./sidebar-chrome.ts";

const DRAWER = '[data-persistent-drawer-content][data-state="open"]';
const HINT = "data-frost-drawer-scroll-hint";
const HEIGHT = 24;

/** Blur only the lower edge of scrollable content inside the active phone drawer. */
export function injectDrawerScrollHint(doc: Document): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  const hints = new Map<HTMLElement, HTMLElement>();
  const masks = new Map<HTMLElement, { mask: string; webkit: string }>();
  const observed = new Set<Element>();
  let frame = 0;
  let frameIsTimeout = false;
  let disposed = false;
  let active: HTMLElement | null = null;
  let candidates: HTMLElement[] = [];
  let needsScan = true;
  const resize = typeof view.ResizeObserver === "function" ? new view.ResizeObserver(() => schedule()) : null;
  const restore = (node: HTMLElement) => {
    const previous = masks.get(node);
    if (!previous) return;
    node.style.maskImage = previous.mask;
    node.style.setProperty("-webkit-mask-image", previous.webkit);
    masks.delete(node);
  };
  const clear = () => { for (const hint of hints.values()) hint.remove(); hints.clear(); for (const node of masks.keys()) restore(node); };
  const reset = () => {
    clear(); active = null; candidates = []; needsScan = true;
    for (const node of observed) resize?.unobserve(node);
    observed.clear();
  };
  const sync = () => {
    frame = 0;
    if (disposed) return;
    if (readSidebarChrome(doc).device !== "phone") { reset(); return; }
    const drawer = Array.from(doc.querySelectorAll<HTMLElement>(DRAWER)).at(-1);
    if (!drawer) { reset(); return; }
    if (active !== drawer) { clear(); active = drawer; needsScan = true; }
    const drawerRect = drawer.getBoundingClientRect();
    const wanted = new Set<HTMLElement>();
    const masked = new Set<HTMLElement>();
    if (needsScan) {
      const nodes = [drawer, ...Array.from(drawer.querySelectorAll<HTMLElement>("*"))];
      candidates = nodes.filter(node => node instanceof view.HTMLElement && !node.hasAttribute(HINT) && !node.matches("textarea, input, select") && /^(auto|scroll)$/.test(view.getComputedStyle(node).overflowY));
      const nextObserved = new Set<Element>([drawer, ...candidates]);
      for (const node of observed) if (!nextObserved.has(node)) { resize?.unobserve(node); observed.delete(node); }
      for (const node of nextObserved) if (!observed.has(node)) { resize?.observe(node); observed.add(node); }
      needsScan = false;
    }
    for (const node of candidates) {
      if (!node.isConnected || node.clientHeight <= 0 || node.closest('[hidden], [aria-hidden="true"]')) continue;
      if (node.scrollHeight <= node.clientHeight + 1) continue;
      if (node.scrollTop + node.clientHeight >= node.scrollHeight - 1) continue;
      const rect = node.getBoundingClientRect();
      let left = Math.max(rect.left, drawerRect.left), right = Math.min(rect.right, drawerRect.right);
      let bottom = Math.min(rect.bottom, drawerRect.bottom), visibleTop = Math.max(rect.top, drawerRect.top);
      for (let ancestor = node.parentElement; ancestor && ancestor !== drawer; ancestor = ancestor.parentElement) {
        const clipping = view.getComputedStyle(ancestor), bounds = ancestor.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(clipping.overflowX || clipping.overflow)) { left = Math.max(left, bounds.left); right = Math.min(right, bounds.right); }
        if (/(auto|scroll|hidden|clip)/.test(clipping.overflowY || clipping.overflow)) { visibleTop = Math.max(visibleTop, bounds.top); bottom = Math.min(bottom, bounds.bottom); }
      }
      const top = Math.max(visibleTop, bottom - HEIGHT);
      if (right <= left || bottom <= top) continue;
      // A mask on the drawer would fade its surface as well as its content.
      const targets = node === drawer
        ? Array.from(drawer.children).filter((child): child is HTMLElement => child instanceof view.HTMLElement && !child.hasAttribute(HINT) && !child.hasAttribute("data-persistent-drawer-handle"))
        : [node];
      for (const target of targets) {
        const targetRect = target.getBoundingClientRect();
        if (node === drawer && (targetRect.bottom <= top || targetRect.top >= bottom)) continue;
        const computed = view.getComputedStyle(target);
        if (!masks.has(target)) {
        if ((computed.maskImage && computed.maskImage !== "none") || (computed.getPropertyValue("-webkit-mask-image") && computed.getPropertyValue("-webkit-mask-image") !== "none")) continue;
          masks.set(target, { mask: target.style.maskImage, webkit: target.style.getPropertyValue("-webkit-mask-image") });
        }
        const start = Math.max(0, top - targetRect.top);
        const end = Math.max(start + 1, bottom - targetRect.top);
        const fade = `linear-gradient(to bottom, black ${start}px, transparent ${end}px)`;
        if (target.style.maskImage !== fade) target.style.maskImage = fade;
        if (target.style.getPropertyValue("-webkit-mask-image") !== fade) target.style.setProperty("-webkit-mask-image", fade);
        masked.add(target);
      }
      wanted.add(node);
      let hint = hints.get(node);
      if (!hint || hint.parentElement !== drawer) {
        hint?.remove();
        hint = doc.createElement("div");
        hint.setAttribute(HINT, "");
        hint.setAttribute("aria-hidden", "true");
        hint.style.cssText = "position:absolute;z-index:10;pointer-events:none";
        drawer.append(hint);
        hints.set(node, hint);
      }
      hint.style.left = `${left - drawerRect.left}px`;
      hint.style.top = `${top - drawerRect.top + drawer.scrollTop}px`;
      hint.style.width = `${right - left}px`;
      hint.style.height = `${bottom - top}px`;
    }
    for (const [node, hint] of hints) if (!wanted.has(node)) { hint.remove(); hints.delete(node); }
    for (const node of masks.keys()) if (!masked.has(node)) restore(node);
  };
  const schedule = () => {
    if (disposed || frame) return;
    frameIsTimeout = typeof view.requestAnimationFrame !== "function";
    frame = frameIsTimeout ? view.setTimeout(sync, 0) : view.requestAnimationFrame(sync);
  };
  const changes = new view.MutationObserver(records => {
    const hasDrawer = (node: Node) => node instanceof view.Element && (node.matches("[data-persistent-drawer-content]") || !!node.querySelector("[data-persistent-drawer-content]"));
    if (records.some(record => {
      const target = record.target instanceof view.Element ? record.target : record.target.parentElement;
      const changed = Array.from(record.addedNodes).concat(Array.from(record.removedNodes));
      if (target?.closest("[data-persistent-drawer-content]")) {
        if (target.hasAttribute(HINT) || (record.attributeName === "style" && (target.matches("[data-persistent-drawer-content]") || masks.has(target as HTMLElement)))) return false;
        return record.type === "attributes" || changed.some(node => !(node instanceof view.Element) || !node.hasAttribute(HINT));
      }
      return record.type === "childList" && changed.some(hasDrawer);
    })) { needsScan = true; schedule(); }
  });
  changes.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state", "hidden", "aria-hidden", "class", "style"] });
  doc.addEventListener("scroll", schedule, true);
  view.addEventListener("resize", schedule);
  view.addEventListener(SIDEBAR_CHROME_EVENT, schedule);
  schedule();
  return () => {
    disposed = true;
    if (frame) {
      if (frameIsTimeout) view.clearTimeout(frame);
      else view.cancelAnimationFrame(frame);
    }
    changes.disconnect(); resize?.disconnect(); clear();
    doc.removeEventListener("scroll", schedule, true);
    view.removeEventListener("resize", schedule);
    view.removeEventListener(SIDEBAR_CHROME_EVENT, schedule);
  };
}
