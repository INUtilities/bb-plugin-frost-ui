import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectDrawerExpansion } from "./drawer-expansion.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

it("bounces a short drawer without expanding it and keeps native close", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><h2 class="sr-only" style="overflow:hidden">Title</h2><div id="content" style="overflow-y:auto">Content</div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, content = doc.querySelector<HTMLElement>("#content")!, handle = drawer.firstElementChild!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(drawer, { clientHeight: { value: 320 }, scrollHeight: { value: 320 } });
  Object.defineProperties(doc.querySelector("h2")!, { clientHeight: { value: 1 }, scrollHeight: { value: 24 } });
  let contentHeight = 250;
  Object.defineProperties(content, { clientHeight: { value: 250 }, scrollHeight: { get: () => contentHeight } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const pulses: unknown[] = [];
  Object.assign(dom.window, { bb: { native: { capabilities: ["haptic"], post: (message: unknown) => pulses.push(message) } } });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    handle.dispatchEvent(event); return event;
  };
  send("pointerdown", 410); send("pointermove", 100); send("pointerup", 100);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  assert.equal(pulses.length, 1);
  send("pointerdown", 410);
  assert.equal(pulses.length, 1, "touching the handle alone stays quiet");
  send("pointermove", 413);
  assert.equal(pulses.length, 1, "movement below the threshold stays quiet");
  assert.equal(send("pointermove", 520).defaultPrevented, false);
  assert.equal(pulses.length, 2, "downward native drag gets one pulse");
  send("pointermove", 530);
  assert.equal(pulses.length, 2, "continued dragging does not pulse again");
  assert.equal(send("pointerup", 520).defaultPrevented, false);
  contentHeight = 500;
  send("pointerdown", 410); send("pointermove", 406);
  assert.equal(pulses.length, 2, "no pulse before the drag threshold");
  send("pointermove", 200); send("pointermove", 100);
  assert.equal(pulses.length, 3, "one pulse when resizing starts");
  send("pointerup", 100);
  assert.equal(pulses.length, 3, "no pulse on release");
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  send("pointerdown", 100); send("pointermove", 250); send("pointermove", 300);
  assert.equal(pulses.length, 4, "one pulse when collapsing begins");
  send("pointerup", 300);
  assert.equal(pulses.length, 4);
  dispose(); dom.window.close();
});

it("limits a short drawer after reversing an initially downward content drag", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="content">Content</div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, content = doc.querySelector<HTMLElement>("#content")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(drawer, { clientHeight: { value: 320 }, scrollHeight: { value: 320 } });
  Object.defineProperties(content, { clientHeight: { value: 250 }, scrollHeight: { value: 250 } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] }, changedTouches: { value: [point] } });
    content.dispatchEvent(event);
  };
  send("touchstart", 410); send("touchmove", 460); send("touchmove", 100);
  assert.ok(Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height")) <= 344);
  send("touchend", 100);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  dispose(); dom.window.close();
});

it("pulses once when a content drag starts downward", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="content">Content</div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, content = doc.querySelector("#content")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  const pulses: unknown[] = [];
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }), bb: { native: { capabilities: ["haptic"], post: (message: unknown) => pulses.push(message) } } });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] }, changedTouches: { value: [point] } });
    content.dispatchEvent(event);
  };
  send("touchstart", 410); send("touchmove", 413);
  assert.equal(pulses.length, 0);
  send("touchmove", 430); send("touchmove", 450);
  assert.equal(pulses.length, 1);
  send("touchend", 450);
  assert.equal(pulses.length, 1);
  dispose(); dom.window.close();
});

it("caps the resting expansion at the amount needed to show clipped content", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="content" style="overflow-y:auto"></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, content = doc.querySelector<HTMLElement>("#content")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(drawer, { clientHeight: { value: 320 }, scrollHeight: { value: 320 } });
  Object.defineProperties(content, { clientHeight: { value: 250 }, scrollHeight: { value: 350 } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  };
  send("pointerdown", 410); send("pointermove", 0);
  assert.ok(Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height")) <= 444);
  send("pointerup", 0);
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "420px");
  dispose(); dom.window.close();
});
