import { readSidebarChrome, SIDEBAR_CHROME_EVENT } from "./sidebar-chrome.ts";
import { postSlideHaptic, readNativeBridge } from "./sidebar-depth.ts";

const DRAWER = '[data-persistent-drawer-content][data-state="open"]';
const BACK = '[role="menuitem"]:has([data-icon="ChevronLeft"])';

/** Animate host-owned menu pages without changing their state or close behavior. */
export function injectDrawerMenuTransition(doc: Document): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  let timer = 0;
  let snapshot: HTMLElement | null = null;
  let animations: Animation[] = [];
  let observer: MutationObserver | null = null;
  const clear = () => {
    view.clearTimeout(timer);
    animations.forEach(animation => animation.cancel());
    animations = [];
    observer?.disconnect(); observer = null;
    snapshot?.remove(); snapshot = null;
  };
  const click = (event: MouseEvent) => {
    if (readSidebarChrome(doc).device !== "phone" || event.defaultPrevented) return;
    const item = (event.target as Element | null)?.closest?.<HTMLElement>('[role="menuitem"]');
    const drawer = item?.closest<HTMLElement>(DRAWER);
    if (!item || !drawer) return;
    const backwards = !!item.querySelector('[data-icon="ChevronLeft"]');
    if (!backwards && !item.querySelector('[data-icon="ChevronRight"]')) return;
    const hadBack = !!drawer.querySelector(BACK);
    const rect = drawer.getBoundingClientRect();
    const computed = view.getComputedStyle(drawer);
    const copy = drawer.cloneNode(true) as HTMLElement;
    copy.removeAttribute("id");
    copy.querySelectorAll("[id]").forEach(element => element.removeAttribute("id"));
    copy.setAttribute("data-state", "closed");
    copy.setAttribute("data-bb-drawer-transition-snapshot", "");
    copy.setAttribute("aria-hidden", "true");
    copy.setAttribute("inert", "");
    for (const [name, value] of Object.entries({ position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, right: "auto", bottom: "auto", width: `${rect.width}px`, height: `${rect.height}px`, "max-height": "none", margin: "0", transform: "none", translate: "none", "pointer-events": "none", "z-index": "2147483646", "border-radius": computed.borderRadius, "corner-shape": computed.getPropertyValue("corner-shape"), "clip-path": computed.clipPath, background: computed.background, "backdrop-filter": computed.backdropFilter, "box-shadow": computed.boxShadow })) copy.style.setProperty(name, value, "important");
    copy.style.setProperty("transform", "none");
    clear();
    timer = view.setTimeout(() => {
      if (!drawer.isConnected || !drawer.matches(DRAWER)) return;
      const hasBack = !!drawer.querySelector(BACK);
      if (backwards ? !hadBack || hasBack : hadBack || !hasBack) return;
      postSlideHaptic(readNativeBridge(doc), "impact-light");
      if (view.matchMedia?.("(prefers-reduced-motion: reduce)").matches || typeof drawer.animate !== "function") return;
      snapshot = copy;
      doc.body.append(copy);
      const hostTransform = view.getComputedStyle(drawer).transform;
      const resting = hostTransform === "none" ? "translateY(0px)" : hostTransform;
      animations = [
        copy.animate([{ transform: "translateY(0px)" }, { transform: "translateY(110%)" }], { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" }),
        drawer.animate([{ transform: `${resting} translateY(110%)` }, { transform: resting }], { duration: 220, easing: "cubic-bezier(.22,1,.36,1)" }),
      ];
      observer = new view.MutationObserver(() => { if (!drawer.isConnected || !drawer.matches(DRAWER)) clear(); });
      observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state"] });
      Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => { if (snapshot === copy) clear(); });
    }, 0);
  };
  doc.addEventListener("click", click, true);
  view.addEventListener(SIDEBAR_CHROME_EVENT, clear);
  return () => { clear(); doc.removeEventListener("click", click, true); view.removeEventListener(SIDEBAR_CHROME_EVENT, clear); };
}
