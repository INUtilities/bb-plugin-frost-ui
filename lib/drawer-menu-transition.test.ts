import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectDrawerMenuTransition } from "./drawer-menu-transition.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

it("animates menu depth changes without replacing the host drawer or handling its close", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div id="menu"><button role="menuitem" id="forward">More<svg data-icon="ChevronRight"></svg></button></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, menu = doc.querySelector("#menu")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  drawer.getBoundingClientRect = () => ({ left: 8, top: 400, width: 374, height: 400 } as DOMRect);
  const animated: Element[] = [];
  dom.window.Element.prototype.animate = function () { animated.push(this); return { finished: Promise.resolve(), cancel() {} } as unknown as Animation; };
  const dispose = injectDrawerMenuTransition(doc);
  menu.addEventListener("click", event => {
    const target = event.target as Element;
    if (target.closest("#forward")) menu.innerHTML = '<button id="back" role="menuitem"><svg data-icon="ChevronLeft"></svg>Back</button><button role="menuitem">Choice</button>';
    else if (target.closest("#back")) menu.innerHTML = '<button id="forward" role="menuitem">More<svg data-icon="ChevronRight"></svg></button>';
  });
  doc.querySelector<HTMLElement>("#forward")!.click();
  await new Promise(resolve => dom.window.setTimeout(resolve, 30));
  assert.equal(animated.length, 2);
  assert.equal(doc.querySelectorAll('[data-persistent-drawer-content][data-state="open"]').length, 1);
  doc.querySelector<HTMLElement>("#back")!.click();
  await new Promise(resolve => dom.window.setTimeout(resolve, 30));
  assert.equal(animated.length, 4);
  assert.equal(doc.querySelectorAll("[data-bb-drawer-transition-snapshot]").length, 0);
  dispose(); dom.window.close();
});

it("cleans up when the drawer closes during a transition and ignores desktop", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><div id="menu"><button id="forward" role="menuitem"><svg data-icon="ChevronRight"></svg></button></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!, menu = doc.querySelector("#menu")!;
  const style = doc.createElement("style");
  style.textContent = '[data-persistent-drawer-content] { clip-path: inset(2px); }';
  doc.head.append(style);
  const chrome = { device: "phone" as const, orientation: "portrait" as const, viewport: "narrow" as const, hitTarget: "large" as const };
  writeSidebarChrome(doc, chrome);
  let canceled = 0;
  dom.window.Element.prototype.animate = () => ({ finished: new Promise(() => {}), cancel() { canceled++; } } as unknown as Animation);
  const dispose = injectDrawerMenuTransition(doc);
  menu.addEventListener("click", () => { menu.innerHTML = '<button role="menuitem"><svg data-icon="ChevronLeft"></svg>Back</button>'; });
  doc.querySelector<HTMLElement>("#forward")!.click();
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));
  assert.equal(doc.querySelectorAll("[data-bb-drawer-transition-snapshot]").length, 1);
  assert.equal(doc.querySelector<HTMLElement>("[data-bb-drawer-transition-snapshot]")!.style.clipPath, "inset(2px)");
  drawer.setAttribute("data-state", "closed");
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(doc.querySelectorAll("[data-bb-drawer-transition-snapshot]").length, 0);
  assert.equal(canceled, 2);
  drawer.setAttribute("data-state", "open");
  menu.innerHTML = '<button id="forward" role="menuitem"><svg data-icon="ChevronRight"></svg></button>';
  writeSidebarChrome(doc, { ...chrome, device: "desktop" });
  doc.querySelector<HTMLElement>("#forward")!.click();
  await new Promise(resolve => dom.window.setTimeout(resolve, 20));
  assert.equal(doc.querySelectorAll("[data-bb-drawer-transition-snapshot]").length, 0);
  dispose(); dom.window.close();
});
