import { PHONE_DRAWER_SELECTOR } from "./phone-drawers.ts";

// The portal is the surface contract; the plugin id and its children are not.
export const GENERIC_FLOATING_SELECTOR = ':is([data-bb-portaled-overlay], [data-radix-popper-content-wrapper] > *, [data-bb-frost-surface="popover"]):is([role="dialog"], [role="menu"], [role="listbox"]):not([data-persistent-drawer-content]):not([data-bb-frost-surface="none"])';
export const GENERIC_TOOLTIP_SELECTOR = ':is([data-bb-portaled-overlay], [data-radix-popper-content-wrapper] > *):has(> [role="tooltip"]):not([data-bb-frost-surface="none"])';
const DIRECT_TOOLTIP_SELECTOR = '[data-bb-frost-surface="tooltip"][role="tooltip"]';
const FROST_CONTENT_SELECTOR = `:is(${GENERIC_FLOATING_SELECTOR}, [data-persistent-drawer-content]:not([data-bb-frost-surface="none"])) [data-bb-frost-content]`;

// Native picker/menu labels describe host behavior; plugin surfaces use the common contract.
export const PROJECT_POPOVER_SELECTOR = '[data-bb-portaled-overlay][role="dialog"]:is([aria-label="Project"], [aria-label="Machine"]):not([data-bb-plugin]):not([data-bb-frost-surface="none"])';
export const THREAD_ACTIONS_SELECTOR = '[role="menu"][aria-label="Thread actions"][data-radix-menu-content]:not([data-bb-frost-surface="none"])';
export const SELECTION_MENU_SELECTOR = '[data-bb-portaled-overlay][role="dialog"].pointer-events-auto.w-auto.items-center[class~="p-0.5"]:has(> div > button > svg[data-icon="MessageSquarePlus"]):not([data-bb-frost-surface="none"])';
export const ERROR_TOAST_SELECTOR = '[data-sonner-toast][data-styled="true"][data-type="error"]:not([data-rich-colors="true"]):not([data-bb-frost-surface="none"])';
export const HOST_MENU_SELECTOR = '[data-bb-portaled-overlay][role="menu"][data-radix-menu-content].bg-popover:not([data-bb-plugin]):not([data-bb-plugin] *):not([aria-label="Prompt actions"]):not([data-bb-frost-surface="none"])';
export const HOST_TOOLTIP_SELECTOR = '[data-bb-portaled-overlay].bg-primary:not([data-bb-plugin]):not([data-bb-plugin] *):has(> [role="tooltip"]):not([data-bb-frost-surface="none"])';
export const LARGE_SQUIRCLE_SELECTOR = `:is(${PROJECT_POPOVER_SELECTOR}):not([data-persistent-drawer-content]):not([data-persistent-drawer-content] *):not([data-bb-frost-surface="none"])`;
export const DESKTOP_SQUIRCLE_MENU_SELECTOR = `html:not([data-bb-sidebar-phone]) :is(${HOST_MENU_SELECTOR}, ${THREAD_ACTIONS_SELECTOR})`;
export const SMALL_SQUIRCLE_TOOLTIP_SELECTOR = `:is(${DIRECT_TOOLTIP_SELECTOR}, html:not([data-bb-sidebar-phone]) ${HOST_TOOLTIP_SELECTOR}):not([data-bb-frost-surface="none"])`;
const POPOVER_SHAPE_SELECTOR = `:is(${GENERIC_FLOATING_SELECTOR}, ${LARGE_SQUIRCLE_SELECTOR}, ${DESKTOP_SQUIRCLE_MENU_SELECTOR}):not([data-persistent-drawer-content] *):not(:has(> [role="tooltip"])):not([data-bb-frost-surface="none"])`;
const MENU_WITH_SUBMENU = `${GENERIC_FLOATING_SELECTOR}[role="menu"].overflow-hidden:not(.overflow-y-auto):has(> [data-radix-popper-content-wrapper] > ${GENERIC_FLOATING_SELECTOR}[data-state="open"])`;
const PICKER_DRAWER = '[data-persistent-drawer-content]:not([data-bb-plugin]):has(> :is([aria-label="Project"], [aria-label="Machine"])):not([data-bb-frost-surface="none"])';
export const DESKTOP_PICKER_DRAWER_SELECTOR = `html:not([data-bb-sidebar-phone]) ${PICKER_DRAWER}`;
const DESKTOP_PORTALED_LIST_SELECTOR = 'html:not([data-bb-sidebar-phone]) [data-bb-portaled-overlay]:is([role="listbox"], [role="menu"][data-radix-menu-content]):not([data-bb-frost-surface="none"])';
export const FROST_LIST_ITEM_SELECTOR = `:is(${GENERIC_FLOATING_SELECTOR}, ${LARGE_SQUIRCLE_SELECTOR}, ${DESKTOP_SQUIRCLE_MENU_SELECTOR}, ${DESKTOP_PORTALED_LIST_SELECTOR}, ${DESKTOP_PICKER_DRAWER_SELECTOR}, html[data-bb-sidebar-phone] ${PHONE_DRAWER_SELECTOR}) :is([cmdk-item], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], [data-bb-frost-item]), html[data-bb-sidebar-phone] ${PHONE_DRAWER_SELECTOR} button[aria-pressed]`;

// Keep each arm's specificity; a shared :is() would make the 18px base beat tooltip overrides.
const FROST_SURFACE_SELECTORS = [
  GENERIC_FLOATING_SELECTOR, GENERIC_TOOLTIP_SELECTOR, DIRECT_TOOLTIP_SELECTOR,
  PROJECT_POPOVER_SELECTOR,
  THREAD_ACTIONS_SELECTOR, SELECTION_MENU_SELECTOR,
  DESKTOP_PICKER_DRAWER_SELECTOR,
  `html:not([data-bb-sidebar-phone]) ${HOST_MENU_SELECTOR}`,
  `html:not([data-bb-sidebar-phone]) ${HOST_TOOLTIP_SELECTOR}`,
];

export function injectFrostProject(doc: Document): () => void {
  const style = doc.createElement("style");
  style.id = "bb-frost-project";
  style.textContent = `
${FROST_SURFACE_SELECTORS.join(", ")} {
  background: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.68) !important;
  border-color: color-mix(in oklab, var(--popover) 35%, transparent) !important;
  border-radius: 18px !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
${FROST_CONTENT_SELECTOR}, ${GENERIC_FLOATING_SELECTOR} > [cmdk-root].bg-popover { background: transparent !important; }
${GENERIC_TOOLTIP_SELECTOR} { color: var(--foreground) !important; }
${DIRECT_TOOLTIP_SELECTOR} { backdrop-filter: blur(14px) saturate(1.25) !important; -webkit-backdrop-filter: blur(14px) saturate(1.25) !important; }
${POPOVER_SHAPE_SELECTOR} { border-radius: 22px !important; }
@supports (corner-shape: squircle) {
  ${POPOVER_SHAPE_SELECTOR} { border-radius: 22px !important; corner-shape: squircle; }
  ${GENERIC_TOOLTIP_SELECTOR} { border-radius: 38px !important; corner-shape: squircle; }
  ${SMALL_SQUIRCLE_TOOLTIP_SELECTOR} { corner-shape: squircle; }
  ${FROST_LIST_ITEM_SELECTOR} { corner-shape: round; }
  html:not([data-bb-sidebar-phone]) ${MENU_WITH_SUBMENU}::before { corner-shape: inherit; }
}
html:not([data-bb-sidebar-phone]) ${HOST_TOOLTIP_SELECTOR}:not([data-bb-frost-surface="none"]) { color: var(--foreground) !important; }
${FROST_LIST_ITEM_SELECTOR} { border-radius: 12px !important; }
/* A nested Radix portal is fixed inside the blurred menu; do not clip it. */
html:not([data-bb-sidebar-phone]) ${MENU_WITH_SUBMENU} {
  overflow: visible;
  position: relative;
  isolation: isolate;
  background: transparent !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
html:not([data-bb-sidebar-phone]) ${MENU_WITH_SUBMENU}::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
  background: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.68);
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
html.dark:not([data-bb-sidebar-phone]) ${MENU_WITH_SUBMENU}::before {
  background: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.76);
}
html[data-bb-sidebar-phone] ${SELECTION_MENU_SELECTOR} {
  max-width: calc(100vw - 16px);
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
html[data-bb-sidebar-phone] ${SELECTION_MENU_SELECTOR}::-webkit-scrollbar { display: none; }
html[data-bb-sidebar-phone] ${SELECTION_MENU_SELECTOR} > div { flex-shrink: 0; }
${ERROR_TOAST_SELECTOR} {
  background: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.68) !important;
  border-radius: 18px !important;
  backdrop-filter: blur(14px) saturate(1.25);
  -webkit-backdrop-filter: blur(14px) saturate(1.25);
}
${ERROR_TOAST_SELECTOR} { color: var(--foreground) !important; }
html.dark ${ERROR_TOAST_SELECTOR} { background: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.76) !important; }
${PROJECT_POPOVER_SELECTOR} > [cmdk-root].bg-popover,
[data-persistent-drawer-content]:not([data-bb-plugin]) > :is([aria-label="Project"], [aria-label="Machine"]) > [cmdk-root].bg-popover {
  background: transparent !important;
}
${FROST_SURFACE_SELECTORS.map(selector => `html.dark ${selector}`).join(", ")} {
  background: oklch(from var(--background) min(1, calc(l + 0.075)) c h / 0.76) !important;
  border-color: color-mix(in oklab, var(--foreground) 8%, transparent) !important;
}`;
  doc.head.append(style);
  return () => style.remove();
}
