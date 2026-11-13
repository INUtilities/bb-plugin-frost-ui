import { readSidebarChrome, SIDEBAR_CHROME_EVENT } from "./sidebar-chrome.ts";
import { postSlideHaptic, readNativeBridge } from "./sidebar-depth.ts";
import { DRAWER_EXPANSION_CSS, injectDrawerExpansion } from "./drawer-expansion.ts";
import { EASE } from "./motion.ts";
import { injectDrawerScrollGuard } from "./drawer-scroll-guard.ts";
import { injectDrawerMenuTransition } from "./drawer-menu-transition.ts";
import { injectDrawerScrollHint } from "./drawer-scroll-hint.ts";

// Defer only while Chat UI's phone bridge is active; new-thread pages may have no bridge.
export const PHONE_DRAWER_SELECTOR = `[data-persistent-drawer-content]:not(
  html[data-bb-chat-ui-root-device="phone"] :is(
    [data-bb-plugin="bb--composer"],
    [data-bb-chat-ui-pr-menu],
    [data-bb-chat-ui-model-menu],
    [data-bb-chat-ui-option-menu],
    :has(> div[aria-label="Prompt actions"])
  )
)`;
const PHONE = "html[data-bb-sidebar-phone]";
const DRAWER = `${PHONE} ${PHONE_DRAWER_SELECTOR}`;
const GRAB = "color-mix(in oklab, var(--muted-foreground) 45%, transparent)";

/** Phone drawer: 8px inset, rounded corners, 40×4px grabber, one frost face. */
const CSS = `
${DRAWER} {
  --bb-mobile-sheet-face: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.68);
  --bb-mobile-sheet-edge: color-mix(in oklab, var(--popover) 35%, transparent);
  --bb-mobile-sheet-shadow: color-mix(in oklab, var(--ink, var(--foreground)) 22%, transparent);
  left: 8px !important;
  right: 8px !important;
  width: auto !important;
  max-width: none !important;
  max-height: min(calc(92dvh - var(--bb-drawer-keyboard-inset, 0px) - 8px), var(--bb-drawer-initial-max-height, 100dvh)) !important;
  border: 0 !important;
  border-radius: 48px !important;
  overflow: hidden;
  padding-bottom: max(0px, calc(var(--bb-safe-area-bottom, env(safe-area-inset-bottom, 0px)) - 8px)) !important;
  color: var(--foreground);
  background: var(--bb-mobile-sheet-face) !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
  box-shadow: 0 12px 32px -14px var(--bb-mobile-sheet-shadow), inset 0 1px 3px var(--bb-mobile-sheet-edge) !important;
}
html.dark[data-bb-sidebar-phone] ${PHONE_DRAWER_SELECTOR} {
  --bb-mobile-sheet-face: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.76);
  --bb-mobile-sheet-edge: color-mix(in oklab, var(--foreground) 8%, transparent);
  --bb-mobile-sheet-shadow: color-mix(in oklab, var(--ink, var(--background)) 60%, transparent);
}
/* Add to the host transform, never replace it or its keyboard-owned inline bottom. */
${DRAWER}[data-state="open"] { translate: 0 -8px; }
${DRAWER} > [data-persistent-drawer-handle] {
  height: 24px !important;
  padding-top: 8px;
  align-items: flex-start !important;
  background: transparent !important;
}
${DRAWER} > [data-persistent-drawer-handle] > div {
  width: 40px !important;
  height: 4px !important;
  background: ${GRAB} !important;
}
${PHONE} [data-persistent-drawer-content] :is([role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [cmdk-item], button[aria-pressed], button[class~="hover:bg-state-hover"]):not(:disabled, [aria-disabled="true"]):is(:active, [data-bb-mobile-pressed]) {
  background-color: var(--state-hover) !important;
}
${PHONE} [data-persistent-drawer-content][data-state="open"] { overscroll-behavior: contain; }
/* A command root is already inside the drawer's surface; retain the list's selected states. */
${PHONE} [data-persistent-drawer-content] > div > [cmdk-root].bg-popover { background: transparent !important; }
${PHONE} [data-persistent-drawer-content] .sticky.bg-background {
  background: color-mix(in oklab, var(--background) 80%, transparent) !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
/* Separate plugin-owned bottom sheets share the same safe upper limit. */
${PHONE} [data-bb-plugin][data-vaul-drawer][data-vaul-drawer-direction="bottom"] {
  max-height: calc(100dvh - var(--bb-safe-area-top, env(safe-area-inset-top, 0px)) - 8px - var(--bb-drawer-keyboard-inset, 0px)) !important;
}
${PHONE} [data-persistent-drawer-content]:has(~ [data-persistent-drawer-content][data-state="open"]):not(#bb-mobile-sheet-expansion):not(#bb-mobile-sheet-geometry):not(#bb-mobile-sheet-stacked) {
  translate: 0 calc(100% + 16px) !important;
  pointer-events: none !important;
  transition: translate 220ms ${EASE.out} !important;
}
@media (prefers-reduced-motion: reduce) {
  ${PHONE} [data-persistent-drawer-content]:has(~ [data-persistent-drawer-content][data-state="open"]) { transition: none !important; }
}
${PHONE} [data-persistent-drawer-backdrop] { background: transparent !important; }
${DRAWER_EXPANSION_CSS}
`;

/** Style only the shared host primitive. Native layout, focus and gestures own its DOM. */
export function injectPhoneDrawers(doc: Document): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};
  const stopExpansion = injectDrawerExpansion(doc);
  const stopScrollGuard = injectDrawerScrollGuard(doc, stopExpansion.canScroll, stopExpansion.revealFocus);
  const stopMenuTransition = injectDrawerMenuTransition(doc);
  const stopScrollHint = injectDrawerScrollHint(doc);
  let style: HTMLStyleElement | null = null;
  const openDrawers = new WeakSet<Element>();
  const swipeMarkers = new Set<Element>();
  const releaseSwipeMarker = (drawer: Element) => {
    if (!swipeMarkers.delete(drawer)) return;
    drawer.removeAttribute("data-no-sidebar-swipe");
  };
  const syncSwipeMarker = (drawer: Element) => {
    if (readSidebarChrome(doc).device === "phone" && drawer.getAttribute("data-state") === "open") {
      if (!drawer.hasAttribute("data-no-sidebar-swipe")) {
        drawer.setAttribute("data-no-sidebar-swipe", "");
        swipeMarkers.add(drawer);
      }
    } else releaseSwipeMarker(drawer);
  };
  const updateDrawer = (drawer: Element, announce: boolean) => {
    if (!drawer.matches("[data-persistent-drawer-content]")) return;
    syncSwipeMarker(drawer);
    if (drawer.getAttribute("data-state") !== "open") {
      if (openDrawers.has(drawer) && readSidebarChrome(doc).device === "phone") {
        drawer.querySelectorAll<HTMLButtonElement>('button[aria-expanded="true"][aria-controls]').forEach(button => {
          const controlled = doc.getElementById(button.getAttribute("aria-controls") ?? "");
          if (controlled && drawer.contains(controlled)) button.click();
        });
      }
      openDrawers.delete(drawer); return;
    }
    if (openDrawers.has(drawer)) return;
    openDrawers.add(drawer);
    if (announce && readSidebarChrome(doc).device === "phone") {
      postSlideHaptic(readNativeBridge(doc), "impact-light");
    }
  };
  const visit = (node: Node, announce: boolean) => {
    if (!(node instanceof view.Element)) return;
    updateDrawer(node, announce);
    node.querySelectorAll("[data-persistent-drawer-content]").forEach(drawer => updateDrawer(drawer, announce));
  };
  doc.querySelectorAll("[data-persistent-drawer-content]").forEach(drawer => updateDrawer(drawer, false));
  const openObserver = new view.MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") updateDrawer(record.target as Element, true);
      else {
        if (record.target !== doc.body && !(record.target as Element).closest?.("[data-persistent-drawer-content]")) continue;
        record.removedNodes.forEach(node => {
          if (!(node instanceof view.Element)) return;
          openDrawers.delete(node);
          releaseSwipeMarker(node);
          node.querySelectorAll("[data-persistent-drawer-content]").forEach(drawer => { openDrawers.delete(drawer); releaseSwipeMarker(drawer); });
        });
        record.addedNodes.forEach(node => visit(node, true));
      }
    }
  });
  openObserver.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
  let pressed: { element: Element; id: number; x: number; y: number } | null = null;
  const clearPressed = () => { pressed?.element.removeAttribute("data-bb-mobile-pressed"); pressed = null; };
  const onTouchStart = (event: TouchEvent) => {
    clearPressed();
    if (readSidebarChrome(doc).device !== "phone" || event.touches.length !== 1) return;
    const target = (event.target as Element | null)?.closest?.(':is([role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [role="option"], [cmdk-item], button[aria-pressed], button[class~="hover:bg-state-hover"]):not(:disabled, [aria-disabled="true"])');
    const drawer = target?.closest("[data-persistent-drawer-content]");
    if (!target || !drawer || drawer.getAttribute("data-state") !== "open") return;
    const point = event.touches[0]!;
    pressed = { element: target, id: point.identifier, x: point.clientX, y: point.clientY };
    target.setAttribute("data-bb-mobile-pressed", "");
  };
  const onTouchMove = (event: TouchEvent) => {
    if (!pressed) return;
    const point = Array.from(event.touches).find(item => item.identifier === pressed?.id);
    if (!point || Math.hypot(point.clientX - pressed.x, point.clientY - pressed.y) > 7) clearPressed();
  };
  doc.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
  doc.addEventListener("touchmove", onTouchMove, { capture: true, passive: true });
  doc.addEventListener("touchend", clearPressed, true);
  doc.addEventListener("touchcancel", clearPressed, true);
  const sync = () => {
    doc.querySelectorAll("[data-persistent-drawer-content]").forEach(syncSwipeMarker);
    if (readSidebarChrome(doc).device !== "phone") {
      style?.remove();
      style = null;
    } else if (!style) {
      style = doc.createElement("style");
      style.id = "bb-mobile-phone-drawers";
      style.textContent = CSS;
      doc.head.append(style);
    }
  };
  sync();
  view.addEventListener(SIDEBAR_CHROME_EVENT, sync);
  return () => {
    stopExpansion();
    stopScrollGuard();
    stopMenuTransition();
    stopScrollHint();
    view.removeEventListener(SIDEBAR_CHROME_EVENT, sync);
    openObserver.disconnect();
    swipeMarkers.forEach(releaseSwipeMarker);
    clearPressed();
    doc.removeEventListener("touchstart", onTouchStart, true);
    doc.removeEventListener("touchmove", onTouchMove, true);
    doc.removeEventListener("touchend", clearPressed, true);
    doc.removeEventListener("touchcancel", clearPressed, true);
    style?.remove();
    style = null;
  };
}
