import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { DRAWER_EXPANSION_CSS, injectDrawerExpansion } from "./drawer-expansion.ts";
import { writeSidebarChrome, SIDEBAR_CHROME_EVENT } from "./sidebar-chrome.ts";

it("provides an explicit opt-in controller shared by pointer and keyboard", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle role="button"></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const handle = drawer.firstElementChild!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const states: { expanded: boolean; canExpand: boolean }[] = [];
  const detail: { onClose(): void; onState(state: { expanded: boolean; canExpand: boolean }): void; controller?: { version: number; toggle(): void; getState(): { expanded: boolean; canExpand: boolean } } } = { onClose() {}, onState: state => states.push(state) };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.equal(detail.controller?.version, 1);
  assert.equal(detail.controller?.getState().canExpand, true);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    handle.dispatchEvent(event);
  };
  send("pointerdown", 410); send("pointermove", 20); send("pointerup", 20);
  assert.equal(detail.controller?.getState().expanded, true);
  assert.equal(states.at(-1)?.expanded, true);
  detail.controller?.toggle();
  assert.equal(detail.controller?.getState().expanded, false);
  assert.equal(states.at(-1)?.expanded, false);
  dispose(); dom.window.close();
});

it("does not offer the controller to desktop or covered drawers", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const dispose = injectDrawerExpansion(doc);
  const query = () => { const detail = { onClose() {}, controller: undefined }; drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail })); return detail.controller; };
  writeSidebarChrome(doc, { device: "desktop", orientation: "landscape", viewport: "wide", hitTarget: "small" });
  assert.equal(query(), undefined);
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.setAttribute("inert", ""); assert.equal(query(), undefined);
  drawer.removeAttribute("inert"); assert.ok(query());
  dispose(); dom.window.close();
});

it("cancels an earlier settle timer when keyboard toggles quickly", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  let next = 0; const pending = new Set<number>();
  Object.assign(dom.window, { matchMedia: () => ({ matches: false }), setTimeout: () => { pending.add(++next); return next; }, clearTimeout: (id: number) => pending.delete(id) });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle(); detail.controller!.toggle();
  assert.equal(pending.size, 1);
  dispose(); dom.window.close();
});

it("delegates collapsed downward close only after an explicit connection", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div style="overflow-y:auto" id="list"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const handle = drawer.firstElementChild!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  let closed = 0;
  const detail: { onClose(): void; controller?: unknown } = { onClose: () => closed++ };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.ok(detail.controller);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    handle.dispatchEvent(event);
  };
  send("pointerdown", 410); send("pointermove", 570); send("pointerup", 570);
  assert.equal(closed, 1);
  dispose(); dom.window.close();
});

it("reports dynamic overflow and disconnects on disposal", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  let scrollHeight = 200, disconnected = 0;
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { get: () => scrollHeight } });
  const states: { expanded: boolean; canExpand: boolean }[] = [];
  const dispose = injectDrawerExpansion(doc);
  const detail = { onClose() {}, onDisconnect() { disconnected++; }, onState(state: { expanded: boolean; canExpand: boolean }) { states.push(state); }, controller: undefined as undefined | { getState(): { expanded: boolean; canExpand: boolean } } };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.deepEqual(detail.controller?.getState(), { expanded: false, canExpand: false });
  list.append(doc.createElement("div")); await Promise.resolve();
  assert.equal(states.length, 0, "unchanged content must not emit redundant state");
  scrollHeight = 600; list.append(doc.createElement("div"));
  await Promise.resolve();
  assert.deepEqual(states.at(-1), { expanded: false, canExpand: true });
  scrollHeight = 200; list.firstElementChild!.setAttribute("style", "height: 1px");
  await Promise.resolve();
  assert.deepEqual(states.at(-1), { expanded: false, canExpand: false });
  dispose();
  assert.equal(disconnected, 1);
  dom.window.close();
});

it("stops observing removed list items", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"><div id="row"></div></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, row = doc.querySelector("#row")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  const observed = new Set<Element>();
  Object.assign(dom.window, { ResizeObserver: class { observe(element: Element) { observed.add(element); } unobserve(element: Element) { observed.delete(element); } disconnect() { observed.clear(); } } });
  const dispose = injectDrawerExpansion(doc);
  const detail = { onClose() {}, controller: undefined };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.equal(observed.has(row), true);
  row.remove(); await Promise.resolve();
  assert.equal(observed.has(row), false);
  dispose(); assert.equal(observed.size, 0); dom.window.close();
});

it("does not let an inert covered drawer consume gestures or commands", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void } } = { onClose() { assert.fail("covered drawer closed"); } };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.ok(detail.controller);
  drawer.setAttribute("inert", "");
  detail.controller.toggle();
  for (const [type, y] of [["pointerdown", 410], ["pointermove", 20], ["pointerup", 20]] as const) {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  }
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  dispose(); dom.window.close();
});

it("makes a disconnected controller harmless", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void; disconnect(): void } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.ok(detail.controller);
  detail.controller.disconnect(); detail.controller.toggle();
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  dispose(); dom.window.close();
});

it("announces availability after resize without disconnecting an open phone drawer", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  let disconnected = 0, connected = 0, announcements = 0;
  const detail = () => ({ onClose() {}, onDisconnect() { disconnected++; }, controller: undefined });
  const reconnect = () => {
    const d = detail(); drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail: d }));
    if (d.controller) connected++;
  };
  const dispose = injectDrawerExpansion(doc);
  doc.addEventListener("bb-frost-drawer-availability", () => { announcements++; reconnect(); });
  reconnect();
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  assert.equal(disconnected, 0);
  assert.equal(connected, 1);
  assert.equal(announcements, 1);
  dispose(); dom.window.close();
});

it("preserves an expanded connected drawer during phone viewport resize", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  let disconnected = 0;
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; onDisconnect(): void; controller?: { toggle(): void; getState(): { expanded: boolean } } } = { onClose() {}, onDisconnect() { disconnected++; } };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle();
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  assert.equal(disconnected, 0);
  assert.equal(detail.controller!.getState().expanded, true);
  dispose(); dom.window.close();
});

it("remeasures an expanded drawer after the owner clears its keyboard inset after resize", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  let bottom = 720;
  drawer.getBoundingClientRect = () => ({ top: bottom - 320, bottom, height: 320 } as DOMRect);
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 600 } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void; getState(): { expanded: boolean } } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle();
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "720px");
  bottom = 440;
  drawer.style.setProperty("--bb-drawer-keyboard-inset", "280px");
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  await Promise.resolve();
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "440px");
  // The host updates its keyboard-owned bottom in its own frame after resize.
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  bottom = 720;
  drawer.style.removeProperty("--bb-drawer-keyboard-inset");
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "720px");
  assert.equal(detail.controller!.getState().expanded, true);
  detail.controller!.toggle();
  assert.equal(detail.controller!.getState().expanded, false);
  dispose(); dom.window.close();
});

it("disconnects and invalidates a controller when its drawer is removed", async () => {
  const dom = new JSDOM(`<div id="portal"><div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  let disconnected = 0;
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; onDisconnect(): void; controller?: { toggle(): void } } = { onClose() {}, onDisconnect() { disconnected++; } };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.ok(detail.controller);
  drawer.remove(); await Promise.resolve();
  assert.equal(disconnected, 1);
  detail.controller.toggle();
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  dispose(); dom.window.close();
});

it("rejects synchronous reconnection while frost is being disposed", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  let reconnected = false;
  const dispose = injectDrawerExpansion(doc);
  const detail = { onClose() {}, onDisconnect() {
    const next = { onClose() {}, controller: undefined };
    drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail: next }));
    reconnected = Boolean(next.controller);
  }, controller: undefined };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.ok(detail.controller); dispose();
  assert.equal(reconnected, false);
  dom.window.close();
});

it("disconnects when an open drawer closes without being removed", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  let disconnected = 0;
  const dispose = injectDrawerExpansion(doc);
  const detail = { onClose() {}, onDisconnect() { disconnected++; }, controller: undefined };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  assert.ok(detail.controller);
  drawer.setAttribute("data-state", "closed"); await Promise.resolve();
  assert.equal(disconnected, 1);
  dispose(); dom.window.close();
});

it("collapses and updates state when expanded content becomes short", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  let scrollHeight = 600;
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { get: () => scrollHeight } });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void; getState(): { expanded: boolean; canExpand: boolean } } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle(); assert.equal(detail.controller!.getState().expanded, true);
  scrollHeight = 200; list.append(doc.createElement("div")); await Promise.resolve();
  assert.deepEqual(detail.controller!.getState(), { expanded: false, canExpand: false });
  dispose(); dom.window.close();
});

it("does not mistake the expanded shell height for remaining content overflow", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  let scrollHeight = 600, shellHeight = 320;
  Object.defineProperties(drawer, { clientHeight: { get: () => shellHeight }, scrollHeight: { get: () => shellHeight } });
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { get: () => scrollHeight } });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void; getState(): { expanded: boolean } } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle(); shellHeight = 720; scrollHeight = 200;
  list.append(doc.createElement("div")); await Promise.resolve();
  assert.equal(detail.controller!.getState().expanded, false);
  dispose(); dom.window.close();
});

it("does not mistake flex-stretched list height for content after rows are removed", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  let contentHeight = 600, expanded = false;
  list.style.setProperty("max-height", "900px", "important");
  list.style.setProperty("min-height", "10px", "important");
  Object.defineProperties(list, {
    clientHeight: { get: () => list.style.maxHeight === "200px" ? 200 : expanded ? 400 : 200 },
    scrollHeight: { get: () => Math.max(list.style.maxHeight === "200px" ? 200 : expanded ? 400 : 200, contentHeight) },
  });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void; getState(): { expanded: boolean } } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle(); expanded = true; contentHeight = 72;
  list.append(doc.createElement("div")); await Promise.resolve();
  assert.equal(detail.controller!.getState().expanded, false);
  assert.equal(list.style.maxHeight, "900px", "measurement must restore the original inline style");
  assert.equal(list.style.minHeight, "10px");
  assert.equal(list.style.getPropertyPriority("max-height"), "important");
  assert.equal(list.style.getPropertyPriority("min-height"), "important");
  dispose(); dom.window.close();
});

it("preserves the parent expansion while a nested drawer covers it", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  let scrollHeight = 600;
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { get: () => scrollHeight } });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void; getState(): { expanded: boolean } } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle(); assert.equal(detail.controller!.getState().expanded, true);
  drawer.setAttribute("inert", ""); scrollHeight = 0; list.append(doc.createElement("div")); await Promise.resolve();
  dom.window.dispatchEvent(new dom.window.Event("resize"));
  assert.equal(detail.controller!.getState().expanded, true);
  scrollHeight = 600; drawer.removeAttribute("inert"); await Promise.resolve();
  assert.equal(detail.controller!.getState().expanded, true);
  dispose(); dom.window.close();
});

it("grows an expanded drawer when its content grows", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, list = doc.querySelector<HTMLElement>("#list")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  let scrollHeight = 300;
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { get: () => scrollHeight } });
  const dispose = injectDrawerExpansion(doc);
  const detail: { onClose(): void; controller?: { toggle(): void } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  detail.controller!.toggle();
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "420px");
  scrollHeight = 500; list.append(doc.createElement("div")); await Promise.resolve();
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "620px");
  dispose(); dom.window.close();
});

it("keeps phone drawer corners rounded even when expanded", () => {
  assert.match(DRAWER_EXPANSION_CSS, /@supports\s*\(corner-shape:\s*squircle\)/);
  assert.match(DRAWER_EXPANSION_CSS, /border-radius:\s*48px\s*!important/);
  assert.match(DRAWER_EXPANSION_CSS, /:not\(#bb-mobile-sheet-squircle\)\s*\{\s*border-radius:\s*48px\s*!important/s);
  assert.doesNotMatch(DRAWER_EXPANSION_CSS, /var\(--bb-mobile-sheet-radius\)/);
});

it("uses the chosen curve on phone whether or not corner-shape is supported", () => {
  assert.doesNotMatch(DRAWER_EXPANSION_CSS, /@supports\s+not\s*\(corner-shape:\s*squircle\)/);
  assert.match(DRAWER_EXPANSION_CSS, /@supports\s*\(clip-path:\s*shape\(/);
  assert.match(DRAWER_EXPANSION_CSS, /from min\(48px, 50%\) 0/);
  assert.match(DRAWER_EXPANSION_CSS, /min\(14px, 12%\)/);
  assert.match(DRAWER_EXPANSION_CSS, /html\[data-bb-sidebar-phone\][^{]*\[data-persistent-drawer-content\]\[data-state="open"\][^{]*\{[^}]*clip-path:\s*shape\(/s);
});

it("lets a direct scrolling body use the expanded height without changing the header", () => {
  assert.match(DRAWER_EXPANSION_CSS, /\[data-bb-mobile-sheet-stage="expanded"\]\s*>\s*\.overflow-y-auto\s*\{[^}]*max-height:\s*none\s*!important[^}]*flex:\s*1\s+1\s+auto/s);
});

it("expands from content, preserves taps, and keeps expanded height on a downward body drag", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><button id="row">Row</button><input id="input"></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, width: 374, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const send = (target: Element, type: string, x: number, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const touch = { identifier: 3, clientX: x, clientY: y, target };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [touch] }, changedTouches: { value: [touch] } });
    target.dispatchEvent(event); return event;
  };
  const row = doc.querySelector("#row")!, input = doc.querySelector("#input")!;
  send(row, "touchstart", 100, 410); send(row, "touchend", 100, 410);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  send(input, "touchstart", 100, 410); send(input, "touchmove", 100, 150); send(input, "touchend", 100, 150);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  send(row, "touchstart", 100, 410);
  assert.equal(send(row, "touchmove", 100, 100).defaultPrevented, true);
  send(row, "touchend", 100, 100);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  let escape = 0; doc.addEventListener("keydown", event => { if (event.key === "Escape") escape++; });
  send(row, "touchstart", 100, 100); send(row, "touchmove", 100, 620); send(row, "touchend", 100, 620);
  assert.equal(escape, 0);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  dispose(); dom.window.close();
});

it("delivers the real touch end to the content after a drawer-owned drag", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="content">Content</div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, content = doc.querySelector("#content")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const events: string[] = [];
  content.addEventListener("touchend", () => events.push("end"));
  const send = (type: string, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] }, changedTouches: { value: [point] } });
    content.dispatchEvent(event); return event;
  };
  send("touchstart", 410); send("touchmove", 180);
  const end = send("touchend", 180);
  assert.deepEqual(events, ["end"]);
  assert.equal(end.defaultPrevented, false);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  const click = new dom.window.MouseEvent("click", { bubbles: true, cancelable: true, detail: 1 });
  content.dispatchEvent(click);
  assert.equal(click.defaultPrevented, true, "a drag must not activate the tapped row");
  dispose(); dom.window.close();
});

it("keeps horizontal gestures and scrolled content with their native owner", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="scroll" style="overflow-y:auto"><button id="row">Row</button></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, scroll = doc.querySelector<HTMLElement>("#scroll")!, row = doc.querySelector("#row")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, width: 374, height: 320 } as DOMRect);
  Object.defineProperties(scroll, { scrollHeight: { value: 800 }, clientHeight: { value: 300 } });
  scroll.scrollTop = 80;
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, x: number, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 2, clientX: x, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] }, changedTouches: { value: [point] } });
    row.dispatchEvent(event); return event;
  };
  send("touchstart", 100, 100);
  assert.equal(send("touchmove", 100, 180).defaultPrevented, false);
  send("touchend", 100, 180);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  send("touchstart", 100, 100);
  assert.equal(send("touchmove", 180, 105).defaultPrevented, false);
  send("touchend", 180, 105);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  dispose(); dom.window.close();
});

it("leaves touch-action none drag handles to their own controller", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><button id="reorder"><svg id="icon"></svg></button><button id="row">Row</button></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, reorder = doc.querySelector("#reorder")!, icon = doc.querySelector("#icon")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  const nativeStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.getComputedStyle = (element, pseudo) => { const style = nativeStyle(element, pseudo); if (element === reorder) Object.defineProperty(style, "touchAction", { value: "none" }); return style; };
  const dispose = injectDrawerExpansion(doc);
  const send = (target: Element, type: string, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] }, changedTouches: { value: [point] } });
    target.dispatchEvent(event); return event;
  };
  send(icon, "touchstart", 410);
  assert.equal(send(icon, "touchmove", 150).defaultPrevented, false);
  send(icon, "touchend", 150);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  send(doc.querySelector("#row")!, "touchstart", 410);
  assert.equal(send(doc.querySelector("#row")!, "touchmove", 150).defaultPrevented, true);
  dispose(); dom.window.close();
});

it("widens continuously on drag-up, settles expanded, collapses on drag-down and preserves native close", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open" style="bottom:280px;transform:translate3d(0,0,0)">
    <div data-persistent-drawer-handle><div id="grab"></div></div><input value="draft">
  </div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, left: 8, right: 382, width: 374, height: 320 } as DOMRect);
  let now = 0;
  Object.defineProperty(dom.window.performance, "now", { value: () => now });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const pulses: unknown[] = [];
  Object.assign(dom.window, { bb: { native: { capabilities: ["haptic"], post: (message: unknown) => pulses.push(message) } } });
  const dispose = injectDrawerExpansion(doc);
  let cancels = 0;
  drawer.addEventListener("pointercancel", () => cancels++);
  const send = (type: string, y: number, target: Element = doc.querySelector("#grab")!) => {
    now += 200;
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientY: y, clientX: 195 });
    Object.defineProperties(event, { pointerId: { value: 7 }, isPrimary: { value: true } });
    target.dispatchEvent(event);
    return event;
  };
  send("pointerdown", 410);
  const second = new dom.window.MouseEvent("pointerdown", { bubbles: true, cancelable: true });
  Object.defineProperties(second, { pointerId: { value: 8 }, isPrimary: { value: false } });
  doc.querySelector("#grab")!.dispatchEvent(second);
  assert.equal(second.defaultPrevented, true);
  send("pointermove", 210);
  const middle = Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-inset"));
  assert.ok(middle > 0 && middle < 8);
  send("pointermove", 18);
  send("pointerup", 18);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-inset"), "0px");
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "720px");
  assert.equal(cancels, 1);
  assert.deepEqual(pulses, [{ type: "haptic", kind: "impact-light" }]);
  // Native layout is still the same node with the same input and keyboard-owned bottom.
  assert.equal(drawer.style.bottom, "280px");
  assert.equal(doc.querySelector("input")!.value, "draft");
  send("pointerdown", 18);
  send("pointermove", 390);
  send("pointerup", 390);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), null);
  assert.equal(cancels, 2);
  assert.equal(pulses.length, 2);
  send("pointerdown", 410);
  assert.equal(send("pointermove", 530).defaultPrevented, false);
  assert.equal(send("pointerup", 530).defaultPrevented, false);
  dispose();
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "");
  dom.window.close();
});

it("still widens gradually when a landscape drawer has no extra vertical room", () => {
  const dom = new JSDOM(`<main data-thread-window></main><div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document;
  writeSidebarChrome(doc, { device: "phone", orientation: "landscape", viewport: "narrow", hitTarget: "large" });
  const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  drawer.getBoundingClientRect = () => ({ top: 32, bottom: 382, height: 350 } as DOMRect);
  doc.querySelector("main")!.getBoundingClientRect = () => ({ top: 48 } as DOMRect);
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  };
  send("pointerdown", 42); send("pointermove", 18);
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-inset"), "4px");
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "354px");
  send("pointercancel", 18);
  dispose(); dom.window.close();
});

it("restores geometry on pointer cancellation, device change, native close and disposal", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const handle = drawer.firstElementChild!;
  const chrome = { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" } as const;
  writeSidebarChrome(doc, chrome);
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, left: 8, right: 382, width: 374, height: 320 } as DOMRect);
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    handle.dispatchEvent(event);
  };
  send("pointerdown", 410); send("pointermove", 20); send("pointercancel", 20);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), null);
  send("pointerdown", 410); send("pointermove", 20); send("pointerup", 20);
  drawer.setAttribute("data-state", "closed");
  await Promise.resolve();
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), null);
  drawer.setAttribute("data-state", "open");
  send("pointerdown", 410); send("pointermove", 20); send("pointerup", 20);
  writeSidebarChrome(doc, { ...chrome, device: "desktop" });
  dom.window.dispatchEvent(new dom.window.Event(SIDEBAR_CHROME_EVENT));
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), null);
  dispose(); dispose();
  dom.window.close();
});
