import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectDrawerExpansion } from "./drawer-expansion.ts";
import { DRAWER_EXPANSION_CSS } from "./drawer-expansion.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

it("gives progressively under continued pull and returns a short drawer to its content height", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(drawer, { clientHeight: { value: 320 }, scrollHeight: { value: 320 } });
  Object.assign(dom.window, { innerHeight: 844, matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  };
  const height = () => Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height"));
  send("pointerdown", 410);
  send("pointermove", 380); const first = height();
  send("pointermove", 350); const second = height();
  send("pointermove", 290); const third = height();
  assert.ok(first > 320 && first < second && second < third && third < 344, `${first}, ${second}, ${third}`);
  send("pointerup", 290);
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "");
  dispose(); dom.window.close();
});

it("uses the shared spring easing when releasing beyond the height limit", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, height: 320 } as DOMRect);
  Object.defineProperties(drawer, { clientHeight: { value: 320 }, scrollHeight: { value: 320 } });
  Object.assign(dom.window, { innerHeight: 844, matchMedia: () => ({ matches: false }) });
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  };
  send("pointerdown", 410); send("pointermove", 360);
  assert.ok(Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height")) > 320);
  send("pointerup", 360);
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-rebounding"), "");
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "320px");
  assert.match(DRAWER_EXPANSION_CSS, /\[data-bb-mobile-sheet-rebounding\][^{]*\{[^}]*height 320ms cubic-bezier\(\.2,\.9,\.22,1\.25\)/s);
  dispose();
  assert.equal(drawer.hasAttribute("data-bb-mobile-sheet-rebounding"), false);
  dom.window.close();
});

for (const safeTop of [0, 20, 44, 59, 80]) {
  it(`keeps the handle below safe top ${safeTop} during overdrag and at rest`, () => {
    const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
    const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
    writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
    drawer.getBoundingClientRect = () => ({ top: 324, bottom: 836, height: 512 } as DOMRect);
    Object.assign(dom.window, { innerHeight: 844, matchMedia: () => ({ matches: true }) });
    const original = dom.window.getComputedStyle.bind(dom.window);
    dom.window.getComputedStyle = (element, pseudo) => element.hasAttribute("data-bb-mobile-safe-top-probe")
      ? { paddingTop: `${safeTop}px` } as CSSStyleDeclaration : original(element, pseudo);
    const dispose = injectDrawerExpansion(doc);
    const send = (type: string, y: number) => {
      const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
      drawer.firstElementChild!.dispatchEvent(event);
    };
    const height = () => Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height"));
    send("pointerdown", 336); send("pointermove", -200);
    assert.ok(height() > 844 - safeTop - 8 && height() <= 844 - safeTop);
    send("pointerup", -200);
    assert.equal(height(), 844 - safeTop - 8);
    dispose(); dom.window.close();
  });
}

it("keeps the safe area below the visual viewport origin", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ top: 324, bottom: 836, height: 512 } as DOMRect);
  const viewport = new dom.window.EventTarget();
  Object.assign(viewport, { offsetTop: 100, height: 744, scale: 1 });
  Object.defineProperty(dom.window, "visualViewport", { value: viewport });
  Object.assign(dom.window, { innerHeight: 844, matchMedia: () => ({ matches: true }) });
  const original = dom.window.getComputedStyle.bind(dom.window);
  dom.window.getComputedStyle = (element, pseudo) => element.hasAttribute("data-bb-mobile-safe-top-probe")
    ? { paddingTop: "59px" } as CSSStyleDeclaration : original(element, pseudo);
  const dispose = injectDrawerExpansion(doc);
  const send = (type: string, y: number) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  };
  send("pointerdown", 336); send("pointermove", -200);
  assert.ok(Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height")) > 677);
  assert.ok(Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height")) <= 685);
  send("pointerup", -200);
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "677px");
  dispose(); dom.window.close();
});

it("limits overdrag to 24px past the resting maximum, then returns to it", () => {
  const dom = new JSDOM(`<main data-thread-window></main><div data-persistent-drawer-content data-state="open" style="bottom:280px">
    <div data-persistent-drawer-handle></div></div>`);
  const doc = dom.window.document;
  const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  doc.querySelector("main")!.getBoundingClientRect = () => ({ top: 48 } as DOMRect);
  drawer.getBoundingClientRect = () => ({ top: 222, bottom: 836, height: 614 } as DOMRect);
  Object.assign(dom.window, { innerHeight: 844, matchMedia: () => ({ matches: true }) });
  const dispose = injectDrawerExpansion(doc);
  let now = 0;
  let elapsed = 200;
  Object.defineProperty(dom.window.performance, "now", { value: () => now });
  const send = (type: string, y: number) => {
    now += elapsed;
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    drawer.firstElementChild!.dispatchEvent(event);
  };
  const height = () => Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height"));
  send("pointerdown", 232);
  send("pointermove", 30);
  const first = height();
  assert.ok(first > 788 && first < 812);
  send("pointermove", -100);
  assert.ok(height() > first && height() < 812);
  assert.equal(drawer.style.getPropertyValue("--bb-mobile-sheet-offset"), "0px");
  elapsed = 1;
  send("pointermove", 30); // A fast reversal still above the maximum must not collapse the sheet.
  send("pointerup", 30);
  elapsed = 200;
  assert.equal(height(), 788); // resting top is still thread-window top + 8 = 56.
  assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  send("pointerdown", 66); send("pointermove", 10);
  assert.ok(height() > 788 && height() < 812);
  send("pointercancel", 10);
  assert.equal(height(), 788);
  assert.equal(drawer.style.bottom, "280px");
  dispose(); dom.window.close();
});
