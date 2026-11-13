import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectDrawerScrollGuard } from "./drawer-scroll-guard.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

it("does not prevent a drawer's own touch-action none drag control", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><button id="reorder"><svg id="icon"></svg></button></div>`);
  const doc = dom.window.document, reorder = doc.querySelector("#reorder")!, icon = doc.querySelector("#icon")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  const nativeStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.getComputedStyle = (element, pseudo) => { const style = nativeStyle(element, pseudo); if (element === reorder) Object.defineProperty(style, "touchAction", { value: "none" }); return style; };
  const dispose = injectDrawerScrollGuard(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: [{ identifier: 1, clientX: 100, clientY: y }] });
    icon.dispatchEvent(event); return event;
  };
  send("touchstart", 300);
  assert.equal(send("touchmove", 200).defaultPrevented, false);
  dispose(); dom.window.close();
});

it("contains phone drawer scroll at its edges without blocking content or backdrop taps", () => {
  const dom = new JSDOM(`<main id="background"></main><div data-persistent-drawer-content data-state="open"><div id="scroll" style="overflow-y:auto"><button id="item">Item</button></div></div>`);
  const doc = dom.window.document, scroller = doc.querySelector<HTMLElement>("#scroll")!, item = doc.querySelector("#item")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  Object.defineProperties(scroller, { scrollHeight: { value: 800 }, clientHeight: { value: 200 } });
  const dispose = injectDrawerScrollGuard(doc);
  const touch = (target: Element, type: string, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" ? [] : [point] }, changedTouches: { value: [point] } });
    target.dispatchEvent(event); return event;
  };
  scroller.scrollTop = 300;
  touch(item, "touchstart", 200);
  assert.equal(touch(item, "touchmove", 150).defaultPrevented, false);
  touch(item, "touchend", 150);
  scroller.scrollTop = 600;
  touch(item, "touchstart", 200);
  assert.equal(touch(item, "touchmove", 150).defaultPrevented, true);
  touch(item, "touchend", 150);
  const wheelAtEdge = new dom.window.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
  item.dispatchEvent(wheelAtEdge);
  assert.equal(wheelAtEdge.defaultPrevented, true);
  scroller.scrollTop = 300;
  const wheelInside = new dom.window.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 80 });
  item.dispatchEvent(wheelInside);
  assert.equal(wheelInside.defaultPrevented, false);
  touch(doc.querySelector("#background")!, "touchstart", 200);
  assert.equal(touch(doc.querySelector("#background")!, "touchmove", 150).defaultPrevented, true);
  touch(doc.querySelector("#background")!, "touchend", 150);
  writeSidebarChrome(doc, { device: "desktop", orientation: "landscape", viewport: "wide", hitTarget: "small" });
  touch(item, "touchstart", 200);
  assert.equal(touch(item, "touchmove", 150).defaultPrevented, false);
  dispose(); dom.window.close();
});
