import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectPhoneDrawers, PHONE_DRAWER_SELECTOR } from "./phone-drawers.ts";
import { SIDEBAR_CHROME_EVENT, writeSidebarChrome } from "./sidebar-chrome.ts";

const phone = { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" } as const;

it("marks open phone drawers so BB does not start sidebar gestures through React portals", async () => {
  const dom = new JSDOM(`<div id="drawer" data-persistent-drawer-content data-state="open"></div><div id="existing" data-persistent-drawer-content data-state="open" data-no-sidebar-swipe="owned"></div>`);
  const doc = dom.window.document, drawer = doc.querySelector("#drawer")!, existing = doc.querySelector("#existing")!;
  writeSidebarChrome(doc, phone);
  const dispose = injectPhoneDrawers(doc);
  assert.equal(drawer.hasAttribute("data-no-sidebar-swipe"), true);
  drawer.setAttribute("data-state", "closed");
  await Promise.resolve();
  assert.equal(drawer.hasAttribute("data-no-sidebar-swipe"), false);
  drawer.setAttribute("data-state", "open");
  await Promise.resolve();
  assert.equal(drawer.hasAttribute("data-no-sidebar-swipe"), true);
  writeSidebarChrome(doc, { ...phone, device: "desktop" });
  dom.window.dispatchEvent(new dom.window.Event(SIDEBAR_CHROME_EVENT));
  assert.equal(drawer.hasAttribute("data-no-sidebar-swipe"), false);
  assert.equal(existing.getAttribute("data-no-sidebar-swipe"), "owned");
  writeSidebarChrome(doc, phone);
  dom.window.dispatchEvent(new dom.window.Event(SIDEBAR_CHROME_EVENT));
  assert.equal(drawer.hasAttribute("data-no-sidebar-swipe"), true);
  dispose();
  assert.equal(drawer.hasAttribute("data-no-sidebar-swipe"), false);
  assert.equal(existing.getAttribute("data-no-sidebar-swipe"), "owned");
  dom.window.close();
});

it("keeps the collapsed phone drawer's fallback radius aligned with its expanded radius", () => {
  const dom = new JSDOM();
  writeSidebarChrome(dom.window.document, phone);
  const dispose = injectPhoneDrawers(dom.window.document);
  const css = dom.window.document.querySelector("#bb-mobile-phone-drawers")!.textContent!;
  assert.match(css, /max-height:[^;]+;\s*border:\s*0\s*!important;\s*border-radius:\s*48px\s*!important/s);
  dispose(); dom.window.close();
});

it("allows a drawer to supply its initial height cap while preserving expansion", () => {
  const dom = new JSDOM();
  writeSidebarChrome(dom.window.document, phone);
  const dispose = injectPhoneDrawers(dom.window.document);
  const css = dom.window.document.querySelector("#bb-mobile-phone-drawers")!.textContent!;
  assert.match(css, /max-height:\s*min\(calc\(92dvh - var\(--bb-drawer-keyboard-inset,\s*0px\) - 8px\),\s*var\(--bb-drawer-initial-max-height,\s*100dvh\)\)\s*!important/);
  assert.match(css, /\[data-bb-mobile-sheet-stage\][\s\S]*?max-height:\s*none\s*!important/);
  dispose(); dom.window.close();
});

it("flattens a command surface while preserving owner item spacing and selected background", () => {
  const dom = new JSDOM(`<style>.owner-choice { font-size: 16px; line-height: 24px; padding-block: 6px; background-color: rgb(12, 34, 56); }</style><div data-persistent-drawer-content><div><div id="surface" cmdk-root class="bg-popover"><div cmdk-group-items><div id="choice" class="owner-choice" cmdk-item role="option" data-selected="true"></div></div></div></div></div><div id="outside" cmdk-root class="bg-popover"></div>`);
  const doc = dom.window.document;
  writeSidebarChrome(doc, phone);
  const dispose = injectPhoneDrawers(doc);
  const css = doc.querySelector("#bb-mobile-phone-drawers")!.textContent!;
  const rule = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/([^{}]*\[cmdk-root\][^{}]*)\{\s*background:\s*transparent\s*!important;\s*\}/);
  assert.ok(rule);
  assert.deepEqual([...doc.querySelectorAll(rule[1]!.trim())].map(el => el.id), ["surface"]);
  const choice = dom.window.getComputedStyle(doc.getElementById("choice")!);
  assert.equal(choice.fontSize, "16px");
  assert.equal(choice.lineHeight, "24px");
  assert.equal(choice.getPropertyValue("padding-block"), "6px");
  assert.equal(choice.backgroundColor, "rgb(12, 34, 56)");
  dispose(); dom.window.close();
});

it("leaves owner close controls visible instead of hiding them through component-specific paths", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content>
    <div class="codes-git-detail" data-placement="sheet"><div data-codes-sheet-scroll><div><div>
      <button id="commit-close" aria-label="Close"></button>
    </div></div><div><button id="item-close" aria-label="Close item"></button></div></div></div>
  </div><div data-persistent-drawer-content>
    <div class="codes-git-detail" data-placement="sheet"><section aria-label="Working tree details" data-codes-sheet-scroll><div>
      <button id="worktree-close" aria-label="Close"></button>
    </div><div><button id="attachment" aria-label="Close"></button><input id="input"></div></section></div>
  </div><div data-persistent-drawer-content class="thread-filter-sheet"><div data-thread-filter-menu data-device="phone"><div class="thread-filter-heading"><div class="thread-filter-heading-actions"><button id="view-close" class="thread-filter-close" aria-label="Close view settings"></button></div></div><button id="view-item" aria-label="Close item"></button></div></div>
  <div role="dialog"><button id="dialog-close" aria-label="Close"></button></div>`);
  const doc = dom.window.document;
  writeSidebarChrome(doc, phone);
  const dispose = injectPhoneDrawers(doc);
  for (const id of ["commit-close", "worktree-close", "view-close", "item-close", "attachment", "view-item", "dialog-close"]) {
    const button = doc.getElementById(id)!;
    const style = dom.window.getComputedStyle(button);
    assert.notEqual(style.width, "1px", `${id} is not clipped by Frost`);
    assert.notEqual(style.clipPath, "inset(50%)");
    assert.equal(button.hasAttribute("aria-hidden"), false);
  }
  (doc.querySelector("#commit-close") as HTMLButtonElement).focus();
  assert.equal(doc.activeElement, doc.querySelector("#commit-close"));
  assert.ok(doc.querySelector("#input"));
  dispose(); dom.window.close();
});

it("includes shared native drawers and preserves Chat UI's own sheets and unrelated overlays", () => {
  const dom = new JSDOM(`<div id="menu" data-persistent-drawer-content></div>
    <div id="plugin" data-persistent-drawer-content data-bb-plugin="example"></div>
    <div id="composer" data-persistent-drawer-content data-bb-plugin="bb--composer"></div>
    <div data-persistent-drawer-content data-bb-chat-ui-model-menu></div>
    <div data-persistent-drawer-content data-bb-chat-ui-pr-menu></div>
    <div data-persistent-drawer-content data-bb-chat-ui-option-menu></div>
    <div data-persistent-drawer-content><div aria-label="Prompt actions"></div></div>
    <div role="dialog"></div><div data-vaul-drawer-direction="left"></div>
    <div data-testid="secondary-panel-shelf"></div><div data-bb-chat-ui-card></div>`);
  const doc = dom.window.document;
  doc.documentElement.setAttribute("data-bb-chat-ui-root-device", "phone");
  assert.deepEqual([...doc.querySelectorAll(PHONE_DRAWER_SELECTOR)].map(n => n.id), ["menu", "plugin"]);
  doc.documentElement.removeAttribute("data-bb-chat-ui-root-device");
  assert.equal(doc.querySelectorAll(PHONE_DRAWER_SELECTOR).length, 7);
  dom.window.close();
});

it("follows device changes in both orientations and disposes without changing native DOM or styles", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open" role="dialog"
    style="bottom: 280px; transform: translate3d(0, 35px, 0); transition: none">
    <div data-persistent-drawer-handle><div></div></div><input value="draft">
  </div>`);
  const doc = dom.window.document;
  const original = doc.body.innerHTML;
  const dispose = injectPhoneDrawers(doc);
  assert.equal(doc.querySelector("#bb-mobile-phone-drawers"), null);
  const change = (device: "phone" | "desktop" | "tablet", orientation: "portrait" | "landscape" = "portrait") => {
    writeSidebarChrome(doc, { ...phone, device, orientation });
    dom.window.dispatchEvent(new dom.window.Event(SIDEBAR_CHROME_EVENT));
  };
  change("phone");
  assert.ok(doc.querySelector("#bb-mobile-phone-drawers"));
  change("phone", "landscape");
  assert.equal(doc.querySelectorAll("#bb-mobile-phone-drawers").length, 1);
  change("tablet");
  assert.equal(doc.querySelector("#bb-mobile-phone-drawers"), null);
  change("desktop");
  assert.equal(doc.querySelector("#bb-mobile-phone-drawers"), null);
  change("phone");
  dispose();
  dispose();
  change("phone");
  assert.equal(doc.querySelector("#bb-mobile-phone-drawers"), null);
  assert.equal(doc.body.innerHTML, original);
  dom.window.close();
});

it("does not send haptics on handle or content press", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open">
    <div data-persistent-drawer-handle><div id="grab"></div></div><button id="content">item</button>
  </div>`);
  const doc = dom.window.document;
  const messages: unknown[] = [];
  const native = { capabilities: ["haptic"], post: (message: unknown) => messages.push(message) };
  Object.assign(dom.window, { bb: { native } });
  writeSidebarChrome(doc, phone);
  const dispose = injectPhoneDrawers(doc);
  const press = (selector = "#grab", primary = true) => {
    const event = new dom.window.MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true });
    Object.defineProperty(event, "isPrimary", { value: primary });
    doc.querySelector(selector)!.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  };
  press("#content");
  press("#grab", false);
  assert.equal(messages.length, 0);
  press();
  press();
  assert.deepEqual(messages, []);
  press();
  assert.equal(messages.length, 0);
  doc.documentElement.setAttribute("data-bb-chat-ui-root-device", "phone");
  doc.querySelector("[data-persistent-drawer-content]")!.setAttribute("data-bb-plugin", "bb--composer");
  press();
  assert.equal(messages.length, 0);
  doc.documentElement.removeAttribute("data-bb-chat-ui-root-device");
  native.capabilities = [];
  press();
  assert.equal(messages.length, 0);
  native.capabilities = ["haptic"];
  writeSidebarChrome(doc, { ...phone, device: "desktop" });
  press();
  assert.equal(messages.length, 0);
  writeSidebarChrome(doc, phone);
  doc.querySelector("[data-persistent-drawer-content]")!.setAttribute("data-state", "closed");
  press();
  assert.equal(messages.length, 0);
  dispose();
  doc.querySelector("[data-persistent-drawer-content]")!.setAttribute("data-state", "open");
  press();
  assert.equal(messages.length, 0);
  dom.window.close();
});

it("shows press feedback until a list touch moves, ends, or is cancelled", () => {
  const dom = new JSDOM(`<div data-persistent-drawer-content data-state="open"><button id="row" aria-pressed="false">Row</button></div>`);
  const doc = dom.window.document, row = doc.querySelector("#row")!;
  writeSidebarChrome(doc, phone);
  const dispose = injectPhoneDrawers(doc);
  const send = (type: string, x: number, y: number) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: x, clientY: y };
    Object.defineProperties(event, { touches: { value: type === "touchend" || type === "touchcancel" ? [] : [point] }, changedTouches: { value: [point] } });
    row.dispatchEvent(event);
  };
  send("touchstart", 100, 100);
  assert.equal(row.hasAttribute("data-bb-mobile-pressed"), true);
  send("touchmove", 100, 120);
  assert.equal(row.hasAttribute("data-bb-mobile-pressed"), false);
  send("touchend", 100, 120);
  send("touchstart", 100, 100);
  send("touchcancel", 100, 100);
  assert.equal(row.hasAttribute("data-bb-mobile-pressed"), false);
  dispose(); dom.window.close();
});

it("does not impose a height from an obsolete plugin test id", () => {
  const dom = new JSDOM(`<style>.own-height { max-height: 321px; }</style><div data-bb-plugin="vault"><div data-testid="vault-properties-sheet" class="own-height" id="sheet"></div></div>`);
  const doc = dom.window.document;
  writeSidebarChrome(doc, phone);
  const dispose = injectPhoneDrawers(doc);
  assert.equal(dom.window.getComputedStyle(doc.getElementById("sheet")!).maxHeight, "321px");
  dispose(); dom.window.close();
});
