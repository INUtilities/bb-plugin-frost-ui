import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectFrostProject, PROJECT_POPOVER_SELECTOR, DESKTOP_PICKER_DRAWER_SELECTOR, THREAD_ACTIONS_SELECTOR, SELECTION_MENU_SELECTOR, ERROR_TOAST_SELECTOR, HOST_MENU_SELECTOR, HOST_TOOLTIP_SELECTOR, DESKTOP_SQUIRCLE_MENU_SELECTOR, SMALL_SQUIRCLE_TOOLTIP_SELECTOR, FROST_LIST_ITEM_SELECTOR } from "./frost-project.ts";

it("uses one list-item rule in floating menus and listboxes across host and plugins", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay role="dialog" aria-label="Project"><div cmdk-item id="project" role="option"></div><button id="button"></button></div>
    <div data-bb-plugin="independent" data-bb-portaled-overlay role="listbox"><div role="option" id="independent-list"></div></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover"><div data-radix-collection-item role="menuitem" id="menu"></div></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover" data-bb-plugin="other"><div data-radix-collection-item role="menuitem" id="other"></div></div>
    <div data-bb-portaled-overlay data-bb-plugin="bb-thread-theme" role="listbox"><div role="option" id="plugin-option"></div></div>
    <div data-thread-filter-menu data-bb-frost-surface="popover" role="dialog"><div data-thread-filter-option="x" data-bb-frost-item id="filter-row"></div></div>
    <div data-thread-filter-menu><div data-thread-filter-option="legacy" id="legacy-row"></div></div>
    <div data-persistent-drawer-content><div role="option" id="drawer"></div><button role="menuitem" id="drawer-menu"></button></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll(FROST_LIST_ITEM_SELECTOR)].map(e => e.id), ["project", "independent-list", "menu", "other", "plugin-option", "filter-row"]);
  doc.documentElement.setAttribute("data-bb-sidebar-phone", "");
  assert.deepEqual([...doc.querySelectorAll(FROST_LIST_ITEM_SELECTOR)].map(e => e.id), ["project", "independent-list", "menu", "other", "plugin-option", "filter-row", "drawer", "drawer-menu"]);
  const dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#project")!).borderRadius, "12px");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#button")!).borderRadius, "");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#other")!).borderRadius, "12px");
  dispose(); dom.window.close();
});

it("selects desktop menus and known tooltips without including plugin-owned menus or phone drawers", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover" id="menu"></div>
    <div data-radix-menu-content role="menu" aria-label="Thread actions" id="thread"></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover" data-bb-plugin="other" id="plugin"></div>
    <div data-bb-portaled-overlay class="bg-primary" id="tip"><span role="tooltip"></span></div>
    <div id="thread-theme-detail-a" data-bb-frost-surface="tooltip" role="tooltip"></div>
    <div data-bb-plugin="vault"><button aria-label="사용법"></button><p role="tooltip" data-bb-frost-surface="tooltip" id="vault"></p></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll(DESKTOP_SQUIRCLE_MENU_SELECTOR)].map(e => e.id), ["menu", "thread"]);
  assert.deepEqual([...doc.querySelectorAll(SMALL_SQUIRCLE_TOOLTIP_SELECTOR)].map(e => e.id), ["tip", "thread-theme-detail-a", "vault"]);
  doc.documentElement.setAttribute("data-bb-sidebar-phone", "");
  assert.equal(doc.querySelectorAll(DESKTOP_SQUIRCLE_MENU_SELECTOR).length, 0);
  dom.window.close();
});

it("styles standard and explicit popup surfaces while leaving drawers and unmarked content alone", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay role="dialog" aria-label="Project" id="project"></div>
    <div data-bb-portaled-overlay role="dialog" data-bb-plugin="alpha" id="portal"></div>
    <div data-bb-frost-surface="popover" role="listbox" id="custom"></div>
    <div role="dialog" data-bb-plugin="codes" id="legacy"><div class="codes-workspace-popover-body"></div></div>
    <div data-persistent-drawer-content><div data-bb-portaled-overlay role="dialog" id="in-drawer"></div></div>
    <div data-bb-portaled-overlay role="dialog" data-persistent-drawer-content id="drawer"></div>`);
  const doc = dom.window.document, dispose = injectFrostProject(doc);
  for (const id of ["project", "portal", "custom"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "22px");
  for (const id of ["legacy", "drawer"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "");
  assert.notEqual(dom.window.getComputedStyle(doc.getElementById("in-drawer")!).borderRadius, "22px");
  dispose(); dom.window.close();
});

it("distinguishes native host menu and tooltip fallbacks from plugin-owned surfaces", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover" id="host"></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover" data-bb-plugin="codes" id="plugin"></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover" aria-label="Prompt actions" id="composer"></div>
    <div data-bb-portaled-overlay class="bg-primary" id="tooltip"><span role="tooltip"></span></div>
    <div data-bb-portaled-overlay data-bb-plugin="codes" class="bg-primary" id="plugin-tooltip"><span role="tooltip"></span></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll(HOST_MENU_SELECTOR)].map(e => e.id), ["host"]);
  assert.deepEqual([...doc.querySelectorAll(HOST_TOOLTIP_SELECTOR)].map(e => e.id), ["tooltip"]);
  dom.window.close();
});

it("rounds host and plugin menu items on desktop and phone", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover"><div role="menuitem" data-radix-collection-item id="host"></div></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" data-bb-plugin="codes" class="bg-popover"><div role="menuitem" data-radix-collection-item id="plugin"></div></div>`);
  const doc = dom.window.document; const dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#host")!).borderRadius, "12px");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#plugin")!).borderRadius, "12px");
  doc.documentElement.setAttribute("data-bb-sidebar-phone", "");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#host")!).borderRadius, "12px");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#plugin")!).borderRadius, "12px");
  dispose(); dom.window.close();
});

it("allows an open nested popup to escape a frosted host menu without changing scrollable menus", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover overflow-hidden" id="parent"><div data-radix-popper-content-wrapper><div data-bb-portaled-overlay role="menu" data-state="open"></div></div></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover overflow-hidden overflow-y-auto" id="scroll"><div data-radix-popper-content-wrapper><div data-bb-portaled-overlay role="menu" data-state="open"></div></div></div>
    <div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover overflow-hidden" id="closed"><div data-radix-popper-content-wrapper><div data-bb-portaled-overlay role="menu" data-state="closed"></div></div></div>`);
  const doc = dom.window.document; const dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#parent")!).overflow, "visible");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#scroll")!).overflow, "");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#closed")!).overflow, "");
  dispose(); dom.window.close();
});

it("places the parent frost on a separate layer while a submenu is open", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay data-radix-menu-content role="menu" class="bg-popover overflow-hidden" id="parent"><div data-radix-popper-content-wrapper><div data-bb-portaled-overlay role="menu" data-state="open"></div></div></div>`);
  const doc = dom.window.document; const dispose = injectFrostProject(doc);
  const parent = doc.querySelector("#parent")!;
  assert.equal(dom.window.getComputedStyle(parent).position, "relative");
  const css = doc.querySelector("#bb-frost-project")!.textContent!;
  assert.match(css, /backdrop-filter:\s*none\s*!important/);
  assert.match(css, /::before\s*\{[^}]*backdrop-filter:\s*blur\(14px\) saturate\(1\.25\)/s);
  dispose(); dom.window.close();
});

it("selects styled error notifications without changing success or custom notifications", () => {
  const dom = new JSDOM(`<li data-sonner-toast data-styled="true" data-type="error" id="error"></li>
    <li data-sonner-toast data-styled="true" data-type="success" id="success"></li>
    <li data-sonner-toast data-styled="false" data-type="error" id="custom"></li>
    <li data-sonner-toast data-styled="true" data-type="error" data-rich-colors="true" id="rich"></li>`);
  assert.deepEqual([...dom.window.document.querySelectorAll(ERROR_TOAST_SELECTOR)].map(e => e.id), ["error"]);
  dom.window.close();
});

it("frosts marked direct tooltips without relying on component ids", () => {
  const dom = new JSDOM(`<div data-bb-frost-surface="tooltip" id="marked" role="tooltip"></div><div id="thread-theme-detail-legacy" role="tooltip"></div><div id="other" role="tooltip"></div>`);
  const doc = dom.window.document, dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.getElementById("marked")!).borderRadius, "18px");
  for (const id of ["thread-theme-detail-legacy", "other"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "");
  dispose(); dom.window.close();
});

it("matches the BB text-selection menu without affecting other dialogs", () => {
  const dom = new JSDOM(`<div data-bb-portaled-overlay role="dialog" class="pointer-events-auto w-auto items-center p-0.5" id="selection"><div><button><svg data-icon="MessageSquarePlus"></svg></button></div></div>
    <div data-bb-portaled-overlay role="dialog" id="other"><div><button><svg data-icon="MessageSquarePlus"></svg></button></div></div>
    <div data-bb-portaled-overlay role="dialog" class="pointer-events-auto w-auto items-center p-0.5" id="unrelated"><div><button><svg data-icon="Other"></svg></button></div></div>`);
  assert.deepEqual([...dom.window.document.querySelectorAll(SELECTION_MENU_SELECTOR)].map(e => e.id), ["selection"]);
  dom.window.close();
});

it("limits the selection menu to the phone viewport and allows horizontal scrolling", () => {
  const dom = new JSDOM(`<html data-bb-sidebar-phone><head></head><body><div data-bb-portaled-overlay role="dialog" class="pointer-events-auto w-auto items-center p-0.5"><div><button><svg data-icon="MessageSquarePlus"></svg></button></div></div></body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  const style = dom.window.getComputedStyle(doc.querySelector(SELECTION_MENU_SELECTOR)!);
  assert.equal(style.maxWidth, "calc(100vw - 16px)");
  assert.equal(style.overflowX, "auto");
  assert.equal(style.overscrollBehaviorX, "contain");
  assert.equal(style.scrollbarWidth, "none");
  doc.documentElement.removeAttribute("data-bb-sidebar-phone");
  const desktopStyle = dom.window.getComputedStyle(doc.querySelector(SELECTION_MENU_SELECTOR)!);
  assert.equal(desktopStyle.maxWidth, "");
  assert.equal(desktopStyle.overflowX, "");
  dispose();
  dom.window.close();
});

it("matches the named thread actions menu but not other menus", () => {
  const dom = new JSDOM(`<div role="menu" aria-label="Thread actions" data-radix-menu-content id="thread"></div>
    <div role="menu" aria-label="Other" data-radix-menu-content id="other"></div>`);
  assert.deepEqual([...dom.window.document.querySelectorAll(THREAD_ACTIONS_SELECTOR)].map(e => e.id), ["thread"]);
  dom.window.close();
});

it("selects the host picker drawer on narrow desktop without selecting plugin drawers", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content id="host"><div aria-label="Project"><div cmdk-root class="bg-popover"></div></div></div>
    <div data-bb-plugin="other" data-persistent-drawer-content id="plugin"><div aria-label="Project"></div></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll(DESKTOP_PICKER_DRAWER_SELECTOR)].map(e => e.id), ["host"]);
  doc.documentElement.setAttribute("data-bb-sidebar-phone", "");
  assert.equal(doc.querySelectorAll(DESKTOP_PICKER_DRAWER_SELECTOR).length, 0);
  dom.window.close();
});

it("requires a common tooltip contract rather than a plugin or trigger label", () => {
  const dom = new JSDOM(`<div data-bb-plugin="vault"><button aria-label="사용법"></button><p role="tooltip" id="legacy"></p></div>
    <div data-bb-plugin="other"><button aria-label="사용법"></button><p role="tooltip" data-bb-frost-surface="tooltip" id="marked"></p></div>`);
  const doc = dom.window.document, dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.getElementById("legacy")!).borderRadius, "");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("marked")!).borderRadius, "18px");
  dispose(); dom.window.close();
});

it("ignores plugin-specific inputs and classes when no popup contract is declared", () => {
  const dom = new JSDOM(`<div data-bb-plugin="codes" role="dialog" id="workspace"><div class="codes-workspace-popover-body"></div></div>
    <div data-bb-plugin="issues" role="dialog" id="filter"><input aria-label="Search issues"></div>
    <div data-bb-plugin="issues" role="dialog" data-bb-frost-surface="popover" id="custom"><input aria-label="Issue title"></div>
    <div role="dialog" data-bb-portaled-overlay id="standard"></div>`);
  const doc = dom.window.document, dispose = injectFrostProject(doc);
  for (const id of ["workspace", "filter"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "");
  for (const id of ["custom", "standard"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "22px");
  dispose(); dom.window.close();
});

it("preserves the native picker content contract and removes styles on disposal", () => {
  const dom = new JSDOM(`<style>.bg-popover { background: rgb(30, 30, 46) }</style><div data-bb-portaled-overlay role="dialog" aria-label="Project" id="project"><div cmdk-root class="bg-popover" id="wrapper"><div class="bg-popover" id="nested"></div></div></div>
    <div data-bb-portaled-overlay role="dialog" aria-label="Project" data-bb-plugin="other" id="plugin"></div>
    <div data-bb-portaled-overlay role="dialog" aria-label="Machine" id="machine"></div>
    <div data-bb-portaled-overlay role="dialog" aria-label="Model" id="model"></div>
    <div data-bb-portaled-overlay role="menu" aria-label="Project" id="menu"></div>`);
  const doc = dom.window.document;
  assert.deepEqual([...doc.querySelectorAll(PROJECT_POPOVER_SELECTOR)].map(e => e.id), ["project", "machine"]);
  const dispose = injectFrostProject(doc);
  assert.match(doc.querySelector("#bb-frost-project")!.textContent!, /backdrop-filter:\s*blur\(14px\) saturate\(1\.25\)/);
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#wrapper")!).backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#nested")!).backgroundColor, "rgb(30, 30, 46)");
  dispose();
  assert.equal(doc.querySelector("#bb-frost-project"), null);
  dom.window.close();
});

it("clears the known Project drawer wrapper without clearing nested state surfaces", () => {
  const dom = new JSDOM(`<html data-bb-sidebar-phone><head><style>.bg-popover { background: rgb(30, 30, 46) }</style></head><body>
    <div data-persistent-drawer-content><div aria-label="Project"><div cmdk-root class="bg-popover" id="wrapper"><div class="bg-popover" id="nested"></div></div></div></div>
    <div data-persistent-drawer-content data-bb-plugin="other"><div aria-label="Project"><div cmdk-root class="bg-popover" id="plugin"></div></div></div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#wrapper")!).backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#nested")!).backgroundColor, "rgb(30, 30, 46)");
  assert.equal(dom.window.getComputedStyle(doc.querySelector("#plugin")!).backgroundColor, "rgb(30, 30, 46)");
  dispose(); dom.window.close();
});
