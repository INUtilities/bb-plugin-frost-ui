import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectDrawerScrollHint } from "./drawer-scroll-hint.ts";
import { writeSidebarChrome, SIDEBAR_CHROME_EVENT } from "./sidebar-chrome.ts";

const phone = { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" } as const;
const tick = (w: Window) => new Promise<void>(resolve => w.requestAnimationFrame(() => resolve()));

it("fades the content of a scrolling drawer without masking its surface", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open" style="overflow-y:auto"><div data-persistent-drawer-handle></div><div id="content"></div></div>`, { pretendToBeVisual: true });
  const doc = dom.window.document, win = dom.window as unknown as Window;
  const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const content = doc.querySelector<HTMLElement>("#content")!;
  drawer.getBoundingClientRect = () => ({ top: 200, bottom: 800, left: 8, right: 382, width: 374, height: 600 } as DOMRect);
  content.getBoundingClientRect = () => ({ top: 224, bottom: 1100, left: 8, right: 382, width: 374, height: 876 } as DOMRect);
  Object.defineProperty(drawer, "clientHeight", { value: 600 });
  Object.defineProperty(drawer, "scrollHeight", { value: 900 });
  writeSidebarChrome(doc, phone);
  const dispose = injectDrawerScrollHint(doc);
  await tick(win);
  assert.equal(drawer.style.maskImage, "");
  assert.match(content.style.maskImage, /linear-gradient/);
  drawer.scrollTop = 300;
  drawer.dispatchEvent(new dom.window.Event("scroll"));
  await tick(win);
  assert.equal(content.style.maskImage, "");
  dispose(); dom.window.close();
});

it("shows a non-interactive hint only while an open phone drawer has more content below", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div id="list" style="overflow-y:auto"></div><button id="footer">Apply</button></div>`, { pretendToBeVisual: true });
  const doc = dom.window.document, win = dom.window as unknown as Window;
  const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const list = doc.querySelector<HTMLElement>("#list")!;
  drawer.getBoundingClientRect = () => ({ top: 200, bottom: 800, left: 8, right: 382, width: 374, height: 600 } as DOMRect);
  list.getBoundingClientRect = () => ({ top: 240, bottom: 730, left: 16, right: 374, width: 358, height: 490 } as DOMRect);
  Object.defineProperty(list, "clientHeight", { value: 490, configurable: true });
  Object.defineProperty(list, "scrollHeight", { value: 900, configurable: true });
  writeSidebarChrome(doc, phone);
  const dispose = injectDrawerScrollHint(doc);
  await tick(win);
  const hint = drawer.querySelector<HTMLElement>("[data-frost-drawer-scroll-hint]")!;
  assert.ok(hint);
  assert.equal(hint.getAttribute("aria-hidden"), "true");
  assert.equal(hint.style.pointerEvents, "none");
  assert.match(list.style.maskImage, /linear-gradient/);
  assert.equal(hint.style.top, "506px"); // 730 - 200 - 24: above the fixed footer
  list.scrollTop = 410;
  list.dispatchEvent(new dom.window.Event("scroll"));
  await tick(win);
  assert.equal(drawer.querySelector("[data-frost-drawer-scroll-hint]"), null);
  assert.equal(list.style.maskImage, "");
  list.scrollTop = 0;
  list.dispatchEvent(new dom.window.Event("scroll"));
  await tick(win);
  assert.ok(drawer.querySelector("[data-frost-drawer-scroll-hint]"));
  Object.defineProperty(list, "scrollHeight", { value: 490, configurable: true });
  list.dispatchEvent(new dom.window.Event("scroll"));
  await tick(win);
  assert.equal(drawer.querySelector("[data-frost-drawer-scroll-hint]"), null);
  Object.defineProperty(list, "scrollHeight", { value: 900, configurable: true });
  list.dispatchEvent(new dom.window.Event("scroll"));
  await tick(win);
  assert.ok(drawer.querySelector("[data-frost-drawer-scroll-hint]"));
  drawer.setAttribute("data-state", "closed");
  await tick(win);
  assert.equal(drawer.querySelector("[data-frost-drawer-scroll-hint]"), null);
  drawer.setAttribute("data-state", "open");
  await tick(win);
  assert.ok(drawer.querySelector("[data-frost-drawer-scroll-hint]"));
  writeSidebarChrome(doc, { ...phone, device: "desktop" });
  dom.window.dispatchEvent(new dom.window.Event(SIDEBAR_CHROME_EVENT));
  await tick(win);
  assert.equal(drawer.querySelector("[data-frost-drawer-scroll-hint]"), null);
  dispose(); dom.window.close();
});

it("keeps the hint inside clipping parents and follows a scrolling drawer", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open" style="overflow-y:auto"><div id="clip" style="overflow:hidden"><div id="list" style="overflow-y:auto"></div></div></div>`, { pretendToBeVisual: true });
  const doc = dom.window.document, win = dom.window as unknown as Window;
  const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const clip = doc.querySelector<HTMLElement>("#clip")!, list = doc.querySelector<HTMLElement>("#list")!;
  drawer.getBoundingClientRect = () => ({ top: 200, bottom: 800, left: 8, right: 382, width: 374, height: 600 } as DOMRect);
  clip.getBoundingClientRect = () => ({ top: 240, bottom: 700, left: 16, right: 374, width: 358, height: 460 } as DOMRect);
  list.getBoundingClientRect = () => ({ top: 240, bottom: 730, left: 16, right: 374, width: 358, height: 490 } as DOMRect);
  Object.defineProperty(list, "clientHeight", { value: 490 });
  Object.defineProperty(list, "scrollHeight", { value: 900 });
  writeSidebarChrome(doc, phone);
  const dispose = injectDrawerScrollHint(doc);
  await tick(win);
  assert.equal(drawer.querySelector<HTMLElement>("[data-frost-drawer-scroll-hint]")!.style.top, "476px");
  drawer.scrollTop = 70;
  drawer.dispatchEvent(new dom.window.Event("scroll"));
  await tick(win);
  assert.equal(drawer.querySelector<HTMLElement>("[data-frost-drawer-scroll-hint]")!.style.top, "546px");
  dispose(); dom.window.close();
});

it("follows only the topmost open drawer and never decorates the page", async () => {
  const dom = new JSDOM(`<div id="page" style="overflow-y:auto"></div><div id="one" data-persistent-drawer-content data-state="open"><div class="list" style="overflow-y:auto"></div></div><div id="two" data-persistent-drawer-content data-state="open"><div class="list" style="overflow-y:auto"></div></div>`, { pretendToBeVisual: true });
  const doc = dom.window.document, win = dom.window as unknown as Window;
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("#page, #one, #two, .list"))) {
    el.getBoundingClientRect = () => ({ top: 200, bottom: 800, left: 8, right: 382, width: 374, height: 600 } as DOMRect);
    Object.defineProperty(el, "clientHeight", { value: 600 });
    Object.defineProperty(el, "scrollHeight", { value: 900 });
  }
  writeSidebarChrome(doc, phone);
  const dispose = injectDrawerScrollHint(doc);
  await tick(win);
  assert.equal(doc.querySelectorAll("#page [data-frost-drawer-scroll-hint], #one [data-frost-drawer-scroll-hint]").length, 0);
  assert.equal(doc.querySelectorAll("#two [data-frost-drawer-scroll-hint]").length, 1);
  doc.querySelector("#two")!.setAttribute("data-state", "closed");
  await tick(win);
  assert.equal(doc.querySelectorAll("#one [data-frost-drawer-scroll-hint]").length, 1);
  assert.equal(doc.querySelectorAll("#two [data-frost-drawer-scroll-hint]").length, 0);
  dispose();
  assert.equal(doc.querySelectorAll("[data-frost-drawer-scroll-hint]").length, 0);
  dom.window.close();
});
