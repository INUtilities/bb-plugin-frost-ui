import { EASE } from "./motion.ts";
import { readSidebarChrome, SIDEBAR_CHROME_EVENT } from "./sidebar-chrome.ts";
import { postSlideHaptic, readNativeBridge } from "./sidebar-depth.ts";
import { hasOwnDrawerTouchGesture } from "./drawer-touch-owner.ts";

const STAGE = "data-bb-mobile-sheet-stage";
const SETTLING = "data-bb-mobile-sheet-settling";
const REBOUNDING = "data-bb-mobile-sheet-rebounding";
const PANEL = "[data-persistent-drawer-content]";
const VARS = ["inset", "height", "gap", "offset"].map(name => `--bb-mobile-sheet-${name}`);
// Chat UI's collapsed face uses :not(#bb-chat-ui-sheet); expansion must override that face's geometry.
const S = `html[data-bb-sidebar-phone] ${PANEL}[${STAGE}][data-state="open"]:not(#bb-mobile-sheet-expansion):not(#bb-mobile-sheet-geometry)`;
const SQUIRCLE = `html[data-bb-sidebar-phone] ${PANEL}[data-state="open"]:not(#bb-mobile-sheet-expansion):not(#bb-mobile-sheet-geometry):not(#bb-mobile-sheet-squircle)`;

// Expansion also serves Chat UI's native drawers: Chat UI owns their collapsed face, not a controller.
export const DRAWER_EXPANSION_CSS = `
${S} {
  left: var(--bb-mobile-sheet-inset) !important;
  right: var(--bb-mobile-sheet-inset) !important;
  width: auto !important;
  height: var(--bb-mobile-sheet-height) !important;
  min-height: 0 !important;
  max-height: none !important;
  margin-top: 0 !important;
  border-radius: 48px !important;
  padding-bottom: max(0px, calc(var(--bb-safe-area-bottom, env(safe-area-inset-bottom, 0px)) - var(--bb-mobile-sheet-gap))) !important;
  translate: 0 calc(var(--bb-mobile-sheet-offset) - var(--bb-mobile-sheet-gap)) !important;
  transform: none !important;
  transition: none !important;
}
${S}[${SETTLING}] {
  transition: left 320ms ${EASE.out}, right 320ms ${EASE.out}, height 320ms ${EASE.out},
    translate 320ms ${EASE.out}, border-radius 320ms ${EASE.out}, padding-bottom 320ms ${EASE.out} !important;
}
${S}[${SETTLING}][${REBOUNDING}] {
  transition: left 320ms ${EASE.out}, right 320ms ${EASE.out}, height 320ms ${EASE.overshoot},
    translate 320ms ${EASE.out}, border-radius 320ms ${EASE.out}, padding-bottom 320ms ${EASE.out} !important;
}
${S}[${STAGE}="expanded"] > .overflow-y-auto {
  max-height: none !important;
  min-height: 0;
  flex: 1 1 auto;
}
/* Nested command pickers must pass the expanded height through to their list. */
${S}[${STAGE}="expanded"] [cmdk-root] :is(
  [cmdk-list]:has(.overflow-y-auto), [cmdk-list-sizer]:has(.overflow-y-auto),
  [cmdk-group]:has(.overflow-y-auto), [cmdk-group-items]:has(> .overflow-y-auto),
  [cmdk-group-items] > .overflow-y-auto
) {
  max-height: none !important;
  min-height: 0;
  flex: 1 1 auto;
}
${SQUIRCLE} { border-radius: 48px !important; }
@supports (corner-shape: squircle) {
  ${SQUIRCLE} {
    border-radius: 48px !important;
    corner-shape: squircle !important;
  }
}
/* The selected curve is shared across engines. Clamp corners on short sheets. */
@supports (clip-path: shape(from 0 0, line to 100% 0, line to 100% 100%, close)) {
    ${SQUIRCLE} {
      border-radius: 0 !important;
      clip-path: shape(
        from min(48px, 50%) 0,
        line to calc(100% - min(48px, 50%)) 0,
        curve to 100% min(48px, 50%) with calc(100% - min(14px, 12%)) 0 / 100% min(14px, 12%),
        line to 100% calc(100% - min(48px, 50%)),
        curve to calc(100% - min(48px, 50%)) 100% with 100% calc(100% - min(14px, 12%)) / calc(100% - min(14px, 12%)) 100%,
        line to min(48px, 50%) 100%,
        curve to 0 calc(100% - min(48px, 50%)) with min(14px, 12%) 100% / 0 calc(100% - min(14px, 12%)),
        line to 0 min(48px, 50%),
        curve to min(48px, 50%) 0 with 0 min(14px, 12%) / min(14px, 12%) 0,
        close
      ) !important;
    }
}
@media (prefers-reduced-motion: reduce) { ${S}[${SETTLING}] { transition: none !important; } }
`;

type Sheet = {
  drawer: HTMLElement;
  top: number;
  height: number;
  expandedHeight: number;
  overdrag: number;
  stretch: number;
  distance: number;
  expanded: boolean;
  progress: number;
  timer: number;
  observer: MutationObserver;
  canExpand: boolean;
  collapsedScrollAreas: { element: HTMLElement; height: number }[];
  viewportHeight: number;
  expandedTop: number;
  safeTop: number;
  needsMeasure: boolean;
  focusTarget?: HTMLElement;
};
type Drag = { sheet: Sheet; handle: Element; id: number; y0: number; top0: number;
  expanded: boolean; own: boolean; y: number; time: number; velocity: number; top: number; content?: boolean; resizing: boolean; pulsed: boolean };

type ExpansionState = { expanded: boolean; canExpand: boolean };
type Connection = { onClose: () => void; onState?: (state: ExpansionState) => void; onDisconnect?: () => void; cleanup?: () => void; publish?: (state: ExpansionState) => void };

/** Keep downward drags native. Only an upward/expanded handle gesture needs the adapter. */
export function injectDrawerExpansion(doc: Document): (() => void) & { canScroll(drawer: HTMLElement): boolean; revealFocus(drawer: HTMLElement, target: HTMLElement): void } {
  const view = doc.defaultView;
  if (!view) return Object.assign(() => {}, { canScroll: () => true, revealFocus: () => {} });
  const sheets = new Map<HTMLElement, Sheet>();
  const connections = new Map<HTMLElement, Connection>();
  let safeTopProbe: HTMLElement | null = null;
  let drag: Drag | null = null;
  let forwardingCancel = false;
  let shuttingDown = false;
  const reduced = () => view.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const readContentOverflow = (drawer: HTMLElement): number | null => {
    let measured = false;
    let overflow = 0;
    for (const element of [drawer, ...Array.from(drawer.querySelectorAll<HTMLElement>("*"))]) {
      if (!(element instanceof view.HTMLElement) || element.clientHeight <= 0) continue;
      if (element.closest('[aria-hidden="true"], [hidden], .sr-only')) continue;
      measured = true;
      if (element.scrollHeight <= element.clientHeight + 1) continue;
      const overflowStyle = view.getComputedStyle(element).overflowY;
      if (element === drawer || /auto|scroll/.test(overflowStyle)) {
        overflow = Math.max(overflow, element.scrollHeight - element.clientHeight);
      }
    }
    // Layout-less environments cannot tell whether content is clipped.
    return measured ? overflow : null;
  };
  const clear = (sheet: Sheet) => {
    view.clearTimeout(sheet.timer);
    sheet.observer.disconnect();
    sheet.drawer.removeAttribute(STAGE);
    sheet.drawer.removeAttribute(SETTLING);
    sheet.drawer.removeAttribute(REBOUNDING);
    for (const name of VARS) sheet.drawer.style.removeProperty(name);
    sheets.delete(sheet.drawer);
    if (drag?.sheet === sheet) drag = null;
    if (sheets.size === 0 && connections.size === 0) portals.disconnect();
  };
  // Observe portal removal only while a sheet is managed. Chat streaming is not observed.
  const portals = new view.MutationObserver(() => {
    for (const sheet of sheets.values()) if (!sheet.drawer.isConnected) clear(sheet);
    for (const [drawer, connection] of connections) if (!drawer.isConnected) {
      connections.delete(drawer); connection.cleanup?.(); connection.onDisconnect?.();
    }
    if (sheets.size === 0 && connections.size === 0) portals.disconnect();
  });
  // A bounded rubber band: continued finger travel produces diminishing movement.
  const pull = (distance: number, limit: number) => limit > 0 ? limit * distance / (distance + 48) : 0;
  const unpull = (distance: number, limit: number) =>
    limit > 0 ? 48 * Math.min(distance, limit * 0.999999) / (limit - Math.min(distance, limit * 0.999999)) : 0;
  const render = (sheet: Sheet, progress: number, offset = 0) => {
    const p = Math.max(0, Math.min(1, progress));
    sheet.progress = p;
    sheet.drawer.setAttribute(STAGE, sheet.expanded ? "expanded" : "dragging");
    const extraHeight = pull(Math.max(0, -offset), sheet.overdrag);
    sheet.stretch = extraHeight;
    const values = [8 * (1 - p), sheet.height + (sheet.expandedHeight - sheet.height) * p + extraHeight,
      8 * (1 - p), Math.max(0, offset)];
    values.forEach((value, index) => sheet.drawer.style.setProperty(VARS[index]!, `${value}px`));
  };
  const settle = (sheet: Sheet, expanded: boolean) => {
    view.clearTimeout(sheet.timer);
    sheet.expanded = expanded;
    connections.get(sheet.drawer)?.publish?.({ expanded, canExpand: sheet.canExpand });
    if (!reduced()) {
      sheet.drawer.setAttribute(SETTLING, "");
      if (sheet.stretch > 0) sheet.drawer.setAttribute(REBOUNDING, "");
      else sheet.drawer.removeAttribute(REBOUNDING);
    }
    render(sheet, expanded ? 1 : 0);
    const done = () => {
      sheet.drawer.removeAttribute(SETTLING); sheet.drawer.removeAttribute(REBOUNDING);
      if (!expanded) { clear(sheet); return; }
      const target = sheet.focusTarget;
      sheet.focusTarget = undefined;
      if (target?.isConnected && !sheet.drawer.closest('[inert], [aria-hidden="true"]') &&
          (target === doc.activeElement || (target.id && doc.activeElement?.getAttribute("aria-activedescendant") === target.id))) {
        target.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };
    if (reduced()) done();
    else sheet.timer = view.setTimeout(done, 340);
  };
  // The host saw pointerdown and owns capture. Cancel its pending drag without invoking close.
  const cancelNative = (current: Drag) => {
    forwardingCancel = true;
    try {
      const Pointer = view.PointerEvent ?? view.MouseEvent;
      current.handle.dispatchEvent(new Pointer("pointercancel", {
        bubbles: true, pointerId: current.id, clientY: current.y, button: 0,
      }));
    } finally { forwardingCancel = false; }
  };
  const ensureSheet = (drawer: HTMLElement): Sheet | null => {
    let sheet = sheets.get(drawer);
    if (!sheet) {
      const rect = drawer.getBoundingClientRect();
      if (rect.height <= 0) return null;
      // Focus can arrive before the owner's slide-in has finished. Measure its resting box.
      const transform = /^matrix(3d)?\(([^)]+)\)$/.exec(view.getComputedStyle(drawer).transform);
      const nativeY = transform ? Number(transform[2]!.split(",")[transform[1] ? 13 : 5]) || 0 : 0;
      const top = rect.top - nativeY, bottom = rect.bottom - nativeY;
      if (!safeTopProbe) {
        safeTopProbe = doc.createElement("div");
        safeTopProbe.setAttribute("data-bb-mobile-safe-top-probe", "");
        safeTopProbe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:var(--bb-safe-area-top, env(safe-area-inset-top, 0px))";
        doc.body.append(safeTopProbe);
      }
      const frameTop = doc.querySelector("[data-thread-window]")?.getBoundingClientRect().top ?? 0;
      const safeTop = (view.visualViewport?.offsetTop ?? 0) +
        Math.max(0, Number.parseFloat(view.getComputedStyle(safeTopProbe).paddingTop) || 0);
      const expandedTop = Math.max(safeTop, Math.min(top, Math.max(frameTop, safeTop) + 8));
      const contentOverflow = readContentOverflow(drawer);
      const collapsedScrollAreas = [drawer, ...Array.from(drawer.querySelectorAll<HTMLElement>("*"))]
        .filter(element => element.clientHeight > 0 && /auto|scroll/.test(view.getComputedStyle(element).overflowY))
        .map(element => ({ element, height: element.clientHeight }));
      const visibleBottom = view.visualViewport ? view.visualViewport.offsetTop + view.visualViewport.height : view.innerHeight;
      const viewportHeight = Math.max(0, Math.min(bottom + 8, visibleBottom) - expandedTop);
      if (viewportHeight <= 0) return null;
      const height = Math.min(rect.height, viewportHeight);
      const contentHeight = contentOverflow === null ? viewportHeight : height + contentOverflow;
      const expandedHeight = Math.max(height, Math.min(viewportHeight, contentHeight));
      const contentLimited = contentOverflow !== null && contentHeight < viewportHeight;
      const restingTop = bottom + 8 - expandedHeight;
      const observer = new view.MutationObserver(() => {
        const current = sheets.get(drawer);
        if (current && drawer.getAttribute("data-state") !== "open") clear(current);
      });
      sheet = { drawer, top, height,
        expandedHeight, distance: contentLimited ? Math.max(1, expandedHeight - height) : Math.max(48, top - expandedTop),
        overdrag: Math.min(24, Math.max(0, contentLimited ? restingTop - safeTop - 8 : expandedTop - safeTop)), stretch: 0,
        expanded: false, progress: 0, timer: 0, observer, canExpand: contentOverflow === null || contentOverflow > 0, collapsedScrollAreas,
        viewportHeight, expandedTop, safeTop, needsMeasure: false };
      sheets.set(drawer, sheet);
      observer.observe(drawer, { attributes: true, attributeFilter: ["data-state"] });
      portals.observe(doc.body, { childList: true });
    }
    return sheet;
  };
  const keyboardVisible = (drawer: HTMLElement) =>
    (Number.parseFloat(view.getComputedStyle(drawer).getPropertyValue("--bb-drawer-keyboard-inset")) || 0) > 0;
  const canScroll = (drawer: HTMLElement): boolean => {
    if (keyboardVisible(drawer) || !drawer.querySelector("[data-persistent-drawer-handle]")) return true;
    const existing = sheets.get(drawer);
    if (!existing && readContentOverflow(drawer) === 0) return true;
    const sheet = existing ?? ensureSheet(drawer);
    if (!sheet || sheet.expandedHeight <= sheet.height + 1) return true;
    // An owner's CSS can cap the rendered height below the requested geometry.
    const style = view.getComputedStyle(drawer);
    const cssMax = style.maxHeight.endsWith("px") ? Number.parseFloat(style.maxHeight) : Infinity;
    const extras = style.boxSizing === "border-box" ? 0 : [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth]
      .reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);
    const maximum = Math.min(sheet.expandedHeight, cssMax + extras);
    // Logical expanded state precedes the height transition. Wait for the actual maximum.
    return sheet.expanded && sheet.progress >= 1 && drawer.getBoundingClientRect().height >= maximum - 1;
  };
  const revealFocus = (drawer: HTMLElement, target: HTMLElement) => {
    if (canScroll(drawer) || !drawer.contains(target) || drawer.closest('[inert], [aria-hidden="true"]')) return;
    const rect = target.getBoundingClientRect();
    let clipped = false;
    for (let node = target.parentElement; node && drawer.contains(node); node = node.parentElement) {
      if (node.clientHeight <= 0 || !/auto|scroll/.test(view.getComputedStyle(node).overflowY)) continue;
      const bounds = node.getBoundingClientRect();
      if (rect.top < bounds.top || rect.bottom > bounds.bottom) { clipped = true; break; }
    }
    if (!clipped) return;
    const existing = sheets.get(drawer);
    if (existing && existing.progress === 0 && !drawer.hasAttribute(SETTLING)) clear(existing);
    const sheet = ensureSheet(drawer);
    if (!sheet?.canExpand || drag?.sheet === sheet) return;
    sheet.focusTarget = target;
    if (!sheet.expanded) settle(sheet, true);
  };
  const connect = (event: Event) => {
    if (shuttingDown) return;
    const drawer = event.target;
    if (!(drawer instanceof view.HTMLElement) || !drawer.matches(`${PANEL}[data-state="open"]`) ||
        drawer.closest('[inert], [aria-hidden="true"]') || readSidebarChrome(doc).device !== "phone") return;
    const detail = (event as CustomEvent).detail as Connection & { controller?: unknown };
    if (!detail || typeof detail.onClose !== "function" || connections.has(drawer)) return;
    connections.set(drawer, detail);
    const state = (): ExpansionState => {
      const sheet = sheets.get(drawer);
      return { expanded: sheet?.expanded === true, canExpand: sheet?.expanded === true || (readContentOverflow(drawer) ?? 1) > 0 };
    };
    let lastState = state();
    detail.publish = next => {
      if (lastState.expanded === next.expanded && lastState.canExpand === next.canExpand) return;
      lastState = next; detail.onState?.(next);
    };
    const release = (notify: boolean) => {
      if (connections.get(drawer) !== detail) return;
      const sheet = sheets.get(drawer); if (sheet) clear(sheet);
      connections.delete(drawer); detail.cleanup?.();
      if (sheets.size === 0 && connections.size === 0) portals.disconnect();
      if (notify) detail.onDisconnect?.();
    };
    const observerOptions: MutationObserverInit = { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ["style", "class", "hidden", "inert", "aria-hidden", "data-state"] };
    let observer: MutationObserver;
    const collapsedOverflow = (area: { element: HTMLElement; height: number }): number => {
      const element = area.element;
      // scrollHeight cannot be smaller than clientHeight. A flex-stretched scroll
      // area therefore needs a synchronous collapsed-height probe when content fits.
      if (element.clientHeight <= area.height + 1 || element.scrollHeight > element.clientHeight + 1) {
        return Math.max(0, element.scrollHeight - area.height);
      }
      const computed = view.getComputedStyle(element);
      const px = (value: string) => Number.parseFloat(value) || 0;
      const verticalPadding = px(computed.paddingTop) + px(computed.paddingBottom);
      const verticalBorder = px(computed.borderTopWidth) + px(computed.borderBottomWidth);
      const maxHeight = Math.max(0, area.height + (computed.boxSizing === "border-box" ? verticalBorder : -verticalPadding));
      const style = element.style;
      const max = [style.getPropertyValue("max-height"), style.getPropertyPriority("max-height")] as const;
      const min = [style.getPropertyValue("min-height"), style.getPropertyPriority("min-height")] as const;
      const pending = observer.takeRecords();
      observer.disconnect();
      try {
        style.setProperty("min-height", "0px", "important");
        style.setProperty("max-height", `${maxHeight}px`, "important");
        return Math.max(0, element.scrollHeight - area.height);
      } finally {
        if (max[0]) style.setProperty("max-height", max[0], max[1]); else style.removeProperty("max-height");
        if (min[0]) style.setProperty("min-height", min[0], min[1]); else style.removeProperty("min-height");
        observer.observe(drawer, observerOptions);
        if (pending.length) view.queueMicrotask(() => { if (connections.get(drawer) === detail) { observeSizes(); refresh(); } });
      }
    };
    const refresh = () => {
      if (connections.get(drawer) !== detail || !drawer.isConnected) return;
      if (drawer.closest('[inert], [aria-hidden="true"]')) return;
      let sheet = sheets.get(drawer);
      if (sheet?.needsMeasure) {
        const wasExpanded = sheet.expanded;
        clear(sheet); sheet = wasExpanded ? ensureSheet(drawer) ?? undefined : undefined;
        if (sheet?.canExpand) settle(sheet, true);
        else { if (sheet) clear(sheet); detail.publish?.({ expanded: false, canExpand: (readContentOverflow(drawer) ?? 1) > 0 }); }
      }
      const areas = sheet?.collapsedScrollAreas.filter(area => area.element.isConnected) ?? [];
      if (sheet?.expanded && areas.length > 0 && drag?.sheet !== sheet) {
        const overflow = Math.max(0, ...areas.map(collapsedOverflow));
        if (overflow <= 1) {
          sheet.canExpand = false;
          settle(sheet, false);
          return;
        }
        const newHeight = Math.max(sheet.height, Math.min(sheet.viewportHeight, sheet.height + overflow));
        if (newHeight !== sheet.expandedHeight) {
          const contentLimited = sheet.height + overflow < sheet.viewportHeight;
          const restingTop = sheet.drawer.getBoundingClientRect().bottom + 8 - newHeight;
          sheet.expandedHeight = newHeight;
          sheet.distance = contentLimited ? Math.max(1, newHeight - sheet.height) : Math.max(48, sheet.top - sheet.expandedTop);
          sheet.overdrag = Math.min(24, Math.max(0, contentLimited ? restingTop - sheet.safeTop - 8 : sheet.expandedTop - sheet.safeTop));
          render(sheet, 1);
        }
      }
      detail.publish?.(state());
    };
    const ResizeObserverClass = view.ResizeObserver;
    const resizeObserver = ResizeObserverClass ? new ResizeObserverClass(refresh) : null;
    const observedSizes = new Set<Element>();
    const observeSizes = () => {
      if (!resizeObserver) return;
      const next = new Set<Element>([drawer]);
      for (const element of Array.from(drawer.querySelectorAll<HTMLElement>("*"))) {
        if (!/auto|scroll/.test(view.getComputedStyle(element).overflowY)) continue;
        next.add(element);
        for (const child of Array.from(element.children)) next.add(child);
      }
      for (const element of observedSizes) if (!next.has(element)) { resizeObserver.unobserve(element); observedSizes.delete(element); }
      for (const element of next) if (!observedSizes.has(element)) { resizeObserver.observe(element); observedSizes.add(element); }
    };
    let keyboardInset = drawer.style.getPropertyValue("--bb-drawer-keyboard-inset");
    observer = new view.MutationObserver(records => {
      if (drawer.getAttribute("data-state") !== "open") { release(true); return; }
      const nextInset = drawer.style.getPropertyValue("--bb-drawer-keyboard-inset");
      const keyboardChanged = nextInset !== keyboardInset;
      if (keyboardChanged) {
        keyboardInset = nextInset;
        const sheet = sheets.get(drawer);
        if (sheet) sheet.needsMeasure = true;
      }
      // Ignore our height writes, but remeasure after the host updates its keyboard-owned layout.
      if (!keyboardChanged && records.every(record => record.type === "attributes" && record.target === drawer && record.attributeName === "style")) return;
      observeSizes(); refresh();
    });
    observer.observe(drawer, observerOptions);
    observeSizes();
    drawer.addEventListener("load", refresh, true);
    doc.fonts?.addEventListener("loadingdone", refresh);
    const removalObserver = new view.MutationObserver(() => {
      if (!drawer.isConnected) release(true);
    });
    if (drawer.parentNode) removalObserver.observe(drawer.parentNode, { childList: true });
    portals.observe(doc.body, { childList: true });
    detail.cleanup = () => { observer.disconnect(); resizeObserver?.disconnect(); observedSizes.clear(); removalObserver.disconnect(); drawer.removeEventListener("load", refresh, true); doc.fonts?.removeEventListener("loadingdone", refresh); };
    detail.controller = {
      version: 1,
      getState: state,
      toggle: () => {
        if (connections.get(drawer) !== detail || !drawer.isConnected || drawer.getAttribute("data-state") !== "open" || drawer.closest('[inert], [aria-hidden="true"]')) return;
        const existing = sheets.get(drawer);
        if (existing?.expanded) { settle(existing, false); return; }
        if (existing) clear(existing);
        const sheet = ensureSheet(drawer);
        if (sheet?.canExpand) settle(sheet, true);
        else if (sheet) clear(sheet);
      },
      disconnect: () => release(false),
    };
  };
  const down = (event: PointerEvent) => {
    if (forwardingCancel) return;
    if (drag) {
      if (event.pointerId !== drag.id && (event.target as Element | null)?.closest?.("[data-persistent-drawer-handle]") === drag.handle) {
        event.preventDefault(); event.stopPropagation();
      }
      return;
    }
    if (event.button !== 0 || event.isPrimary === false || readSidebarChrome(doc).device !== "phone") return;
    const handle = (event.target as Element | null)?.closest?.("[data-persistent-drawer-handle]");
    const drawer = handle?.parentElement;
    if (!handle || !drawer?.matches(`${PANEL}[data-state="open"]`)) return;
    if (connections.has(drawer as HTMLElement) && drawer.closest('[inert], [aria-hidden="true"]')) return;
    const existing = sheets.get(drawer as HTMLElement);
    if (existing && existing.progress === 0 && !drawer.hasAttribute(SETTLING)) clear(existing);
    const sheet = ensureSheet(drawer as HTMLElement);
    if (!sheet) return;
    view.clearTimeout(sheet.timer);
    if (sheet.drawer.hasAttribute(SETTLING)) {
      const visibleInset = Number.parseFloat(view.getComputedStyle(sheet.drawer).left);
      const visibleHeight = sheet.drawer.getBoundingClientRect().height;
      const progress = Number.isFinite(visibleInset) ? 1 - visibleInset / 8 : sheet.progress;
      const restingHeight = sheet.height + (sheet.expandedHeight - sheet.height) * progress;
      sheet.drawer.removeAttribute(SETTLING);
      render(sheet, progress, -unpull(Math.max(0, visibleHeight - restingHeight), sheet.overdrag));
    }
    sheet.drawer.removeAttribute(SETTLING);
    sheet.drawer.removeAttribute(REBOUNDING);
    drag = { sheet, handle, id: event.pointerId, y0: event.clientY,
      top0: sheet.top - sheet.distance * sheet.progress - unpull(sheet.stretch, sheet.overdrag),
      expanded: sheet.expanded, own: sheet.expanded || sheet.progress > 0,
      y: event.clientY, time: view.performance.now(), velocity: 0,
      top: sheet.top - sheet.distance * sheet.progress - unpull(sheet.stretch, sheet.overdrag),
      resizing: sheet.expanded || sheet.progress > 0, pulsed: false };
  };
  const move = (event: PointerEvent) => {
    const current = drag;
    if (!current || current.id !== event.pointerId) return;
    const now = view.performance.now();
    current.velocity = (event.clientY - current.y) / Math.max(1, now - current.time);
    current.y = event.clientY; current.time = now;
    const delta = event.clientY - current.y0;
    if (!current.own && delta < -6 && (current.sheet.canExpand || current.sheet.overdrag > 0)) { current.own = true; current.resizing = true; }
    if (!current.own && delta > 6 && connections.has(current.sheet.drawer)) current.own = true;
    if (!current.own && delta > 6 && !current.pulsed) {
      current.pulsed = true;
      postSlideHaptic(readNativeBridge(doc), "impact-light");
    }
    if (!current.own) return;
    if (!current.pulsed && Math.abs(delta) > 6 && (current.resizing || (current.content && delta > 0))) {
      current.pulsed = true;
      postSlideHaptic(readNativeBridge(doc), "impact-light");
    }
    event.preventDefault(); event.stopPropagation();
    current.top = current.top0 + event.clientY - current.y0;
    const sheet = current.sheet;
    if (!sheet.canExpand) {
      if (current.top < sheet.top && !current.pulsed) {
        current.pulsed = true;
        postSlideHaptic(readNativeBridge(doc), "impact-light");
      }
      render(sheet, 0, current.top - sheet.top);
      return;
    }
    const pastMaximum = current.top - (sheet.top - sheet.distance);
    render(sheet, (sheet.top - current.top) / sheet.distance,
      pastMaximum < 0 ? pastMaximum : Math.max(0, current.top - sheet.top));
  };
  const end = (event: PointerEvent) => {
    if (forwardingCancel) return;
    const current = drag;
    if (!current || current.id !== event.pointerId) return;
    drag = null;
    const sheet = current.sheet;
    if (!current.own) { clear(sheet); return; }
    const cancelled = event.type === "pointercancel";
    // Far enough below the collapsed stage: let the original host pointerup close it.
    if (!cancelled && current.top > sheet.top + sheet.height * 0.25) {
      const connection = connections.get(sheet.drawer);
      clear(sheet);
      if (connection) { event.preventDefault(); event.stopPropagation(); cancelNative(current); connection.onClose(); return; }
      if (current.content) doc.dispatchEvent(new view.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      return;
    }
    event.preventDefault(); event.stopPropagation();
    if (!current.content) cancelNative(current);
    const projected = current.top + current.velocity * 140;
    const aboveMaximum = current.top < sheet.top - sheet.distance;
    settle(sheet, sheet.canExpand && (cancelled ? current.expanded : aboveMaximum || projected < sheet.top - sheet.distance / 2));
  };
  const reset = () => {
    if (drag?.own && !drag.content) cancelNative(drag);
    drag = null;
    touch = null;
    const retainConnections = !shuttingDown && readSidebarChrome(doc).device === "phone";
    const restore: HTMLElement[] = [];
    for (const sheet of [...sheets.values()]) {
      if (retainConnections && connections.has(sheet.drawer) && sheet.expanded) {
        if (sheet.drawer.closest('[inert], [aria-hidden="true"]')) { sheet.needsMeasure = true; continue; }
        restore.push(sheet.drawer);
      }
      clear(sheet);
    }
    if (retainConnections) {
      for (const drawer of restore) {
        const sheet = ensureSheet(drawer);
        if (sheet?.canExpand) settle(sheet, true);
        else { if (sheet) clear(sheet); connections.get(drawer)?.publish?.({ expanded: false, canExpand: (readContentOverflow(drawer) ?? 1) > 0 }); }
      }
      doc.dispatchEvent(new view.CustomEvent("bb-frost-drawer-availability", { detail: { version: 1, available: true } }));
      return;
    }
    const previousConnections = [...connections.values()];
    connections.clear();
    for (const connection of previousConnections) { connection.cleanup?.(); connection.onDisconnect?.(); }
    if (!shuttingDown) doc.dispatchEvent(new view.CustomEvent("bb-frost-drawer-availability", { detail: { version: 1, available: true } }));
  };
  let touch: { id: number; x: number; y: number; handle: Element; drawer: HTMLElement; scrollers: HTMLElement[]; started: boolean } | null = null;
  let suppressClickUntil = 0;
  const touchStart = (event: TouchEvent) => {
    if (readSidebarChrome(doc).device !== "phone" || event.touches.length !== 1 || drag) return;
    const target = event.target as Element | null;
    if (!target?.closest || target.closest('[data-persistent-drawer-handle], input, textarea, select, [contenteditable="true"], [role="slider"]')) return;
    const drawer = target.closest<HTMLElement>(`${PANEL}[data-state="open"]`);
    const handle = drawer?.querySelector("[data-persistent-drawer-handle]");
    if (!drawer || !handle) return;
    if (hasOwnDrawerTouchGesture(target, drawer, view)) return;
    const scrollers: HTMLElement[] = [];
    for (let node: Element | null = target; node && node !== drawer.parentElement; node = node.parentElement) {
      if (!(node instanceof view.HTMLElement)) continue;
      const style = view.getComputedStyle(node);
      if (node.scrollWidth > node.clientWidth + 1 && /auto|scroll/.test(style.overflowX)) return;
      if (node.scrollHeight > node.clientHeight + 1 && /auto|scroll/.test(style.overflowY)) scrollers.push(node);
    }
    const point = event.touches[0]!;
    touch = { id: point.identifier, x: point.clientX, y: point.clientY, handle, drawer, scrollers, started: false };
  };
  const touchMove = (event: TouchEvent) => {
    const current = touch;
    if (!current || event.touches.length !== 1) { touch = null; return; }
    const point = Array.from(event.touches).find(item => item.identifier === current.id);
    if (!point) return;
    const dx = point.clientX - current.x, dy = point.clientY - current.y;
    if (!current.started) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
      if (Math.abs(dx) >= Math.abs(dy)) { touch = null; return; }
      const expanded = sheets.get(current.drawer)?.expanded === true;
      // Scroll toward the content's top before handing a downward drag to the drawer.
      const scrollingDown = dy > 0 && current.scrollers.some(scroller => scroller.scrollTop > 0);
      if (keyboardVisible(current.drawer) || (expanded && dy < 0) || scrollingDown) { touch = null; return; }
      down({ target: current.handle, button: 0, isPrimary: true, pointerId: -current.id - 1, clientY: current.y } as unknown as PointerEvent);
      if (!drag) { touch = null; return; }
      drag.content = true;
      if (dy > 0) drag.own = true;
      current.started = true;
    }
    move({ pointerId: -current.id - 1, clientY: point.clientY, preventDefault: () => event.preventDefault(), stopPropagation: () => event.stopPropagation() } as unknown as PointerEvent);
  };
  const touchEnd = (event: TouchEvent) => {
    const current = touch;
    if (!current) return;
    const point = Array.from(event.changedTouches).find(item => item.identifier === current.id);
    if (!point) return;
    touch = null;
    if (!current.started) return;
    suppressClickUntil = view.performance.now() + 120;
    // The drawer owns its geometry, but the original touch must still finish at
    // its target so other gesture controllers can clear their own state.
    end({ type: event.type === "touchcancel" ? "pointercancel" : "pointerup", pointerId: -current.id - 1, clientY: point.clientY, preventDefault: () => {}, stopPropagation: () => {} } as unknown as PointerEvent);
  };
  const suppressClick = (event: MouseEvent) => {
    if (event.detail === 0 || view.performance.now() >= suppressClickUntil || !(event.target as Element | null)?.closest?.(PANEL)) return;
    suppressClickUntil = 0; event.preventDefault(); event.stopPropagation();
  };
  doc.addEventListener("pointerdown", down, true);
  doc.addEventListener("bb-frost-drawer-connect", connect, true);
  doc.addEventListener("pointermove", move, { capture: true, passive: false });
  doc.addEventListener("pointerup", end, true);
  doc.addEventListener("pointercancel", end, true);
  doc.addEventListener("touchstart", touchStart, { capture: true, passive: true });
  doc.addEventListener("touchmove", touchMove, { capture: true, passive: false });
  doc.addEventListener("touchend", touchEnd, true);
  doc.addEventListener("touchcancel", touchEnd, true);
  doc.addEventListener("click", suppressClick, true);
  view.addEventListener(SIDEBAR_CHROME_EVENT, reset);
  view.addEventListener("resize", reset);
  view.visualViewport?.addEventListener("resize", reset);
  doc.dispatchEvent(new view.CustomEvent("bb-frost-drawer-availability", { detail: { version: 1, available: true } }));
  return Object.assign(() => {
    shuttingDown = true;
    reset(); portals.disconnect();
    doc.dispatchEvent(new view.CustomEvent("bb-frost-drawer-availability", { detail: { version: 1, available: false } }));
    safeTopProbe?.remove();
    doc.removeEventListener("pointerdown", down, true);
    doc.removeEventListener("bb-frost-drawer-connect", connect, true);
    doc.removeEventListener("pointermove", move, true);
    doc.removeEventListener("pointerup", end, true);
    doc.removeEventListener("pointercancel", end, true);
    doc.removeEventListener("touchstart", touchStart, true);
    doc.removeEventListener("touchmove", touchMove, true);
    doc.removeEventListener("touchend", touchEnd, true);
    doc.removeEventListener("touchcancel", touchEnd, true);
    doc.removeEventListener("click", suppressClick, true);
    view.removeEventListener(SIDEBAR_CHROME_EVENT, reset);
    view.removeEventListener("resize", reset);
    view.visualViewport?.removeEventListener("resize", reset);
  }, { canScroll, revealFocus });
}
