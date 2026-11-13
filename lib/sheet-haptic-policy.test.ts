import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectPhoneDrawers } from "./phone-drawers.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

for (const [name, attributes] of [
  ["commit sheet", 'data-bb-mobile-sheet-settle-haptic="off"'],
  ["ordinary sheet", ""],
] as const) {
  it(`${name} pulses once when resizing starts, not on grab or settle`, () => {
    const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open" ${attributes}>
      <div data-persistent-drawer-handle><div></div></div>
    </div>`);
    const doc = dom.window.document;
    writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
    const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
    const handle = drawer.querySelector("[data-persistent-drawer-handle]")!;
    drawer.getBoundingClientRect = () => ({ top: 400, bottom: 720, left: 8, right: 382, width: 374, height: 320 } as DOMRect);
    let now = 0;
    Object.defineProperty(dom.window.performance, "now", { value: () => now });
    Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
    const pulses: unknown[] = [];
    Object.assign(dom.window, { bb: { native: { capabilities: ["haptic"], post: (message: unknown) => pulses.push(message) } } });
    const dispose = injectPhoneDrawers(doc);
    const send = (type: string, y: number) => {
      now += 200;
      const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientY: y });
      Object.defineProperties(event, { pointerId: { value: 7 }, isPrimary: { value: true } });
      handle.dispatchEvent(event);
    };
    send("pointerdown", 410);
    assert.equal(pulses.length, 0, "no grab haptic");
    send("pointermove", 18);
    assert.equal(pulses.length, 1, "one pulse when motion starts");
    send("pointerup", 18);
    assert.equal(drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
    assert.equal(pulses.length, 1, "no extra settle haptic");
    dispose(); dom.window.close();
  });
}

it("pulses once on each newly opened phone drawer and ignores pre-existing drawers", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"></div>`);
  const doc = dom.window.document;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  const pulses: unknown[] = [];
  Object.assign(dom.window, { bb: { native: { capabilities: ["haptic"], post: (message: unknown) => pulses.push(message) } } });
  const dispose = injectPhoneDrawers(doc);
  await Promise.resolve();
  assert.equal(pulses.length, 0);
  const drawer = doc.createElement("div");
  drawer.setAttribute("data-persistent-drawer-content", "");
  drawer.setAttribute("data-state", "open");
  doc.body.append(drawer);
  await Promise.resolve();
  assert.equal(pulses.length, 1);
  drawer.setAttribute("data-state", "closed");
  await Promise.resolve();
  drawer.setAttribute("data-state", "open");
  await Promise.resolve();
  assert.equal(pulses.length, 2);
  drawer.remove();
  await Promise.resolve();
  doc.body.append(drawer);
  await Promise.resolve();
  assert.equal(pulses.length, 3);
  writeSidebarChrome(doc, { device: "desktop", orientation: "landscape", viewport: "wide", hitTarget: "small" });
  const desktopDrawer = drawer.cloneNode() as Element;
  doc.body.append(desktopDrawer);
  await Promise.resolve();
  assert.equal(pulses.length, 3);
  dispose();
  drawer.remove();
  doc.body.append(drawer);
  await Promise.resolve();
  assert.equal(pulses.length, 3);
  dom.window.close();
});

it("resets expanded disclosure controls owned by a closing drawer", async () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><button aria-expanded="true" aria-controls="details">Show less</button><div id="details"></div><button id="unrelated" aria-expanded="true" aria-controls="external">Other</button></div><div id="external"></div>`);
  const doc = dom.window.document, drawer = doc.querySelector("[data-persistent-drawer-content]")!;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  let clicks = 0, unrelated = 0;
  drawer.querySelector("button")!.addEventListener("click", () => clicks++);
  doc.querySelector("#unrelated")!.addEventListener("click", () => unrelated++);
  const dispose = injectPhoneDrawers(doc);
  drawer.setAttribute("data-state", "closed");
  await Promise.resolve();
  assert.equal(clicks, 1);
  assert.equal(unrelated, 0);
  dispose(); dom.window.close();
});
