import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectPhoneDrawers } from "./phone-drawers.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

it("uses the common phone maximum only for bottom Vaul drawers and leaves named content heights alone", () => {
  const dom = new JSDOM(`<div data-bb-plugin="alpha" data-vaul-drawer data-vaul-drawer-direction="bottom" id="bottom"></div>
    <div data-bb-plugin="beta" data-vaul-drawer data-vaul-drawer-direction="bottom" id="other-bottom"></div>
    <div data-bb-plugin="other" data-vaul-drawer data-vaul-drawer-direction="left" id="side"></div>
    <div data-bb-plugin="vault"><div data-testid="vault-properties-sheet" id="vault"></div></div>
    <div data-testid="vault-properties-sheet" id="unowned"></div>`);
  const doc = dom.window.document;
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  doc.documentElement.setAttribute("data-bb-sidebar-phone", "");
  const dispose = injectPhoneDrawers(doc);
  const css = dom.window.getComputedStyle.bind(dom.window);
  assert.match(css(doc.querySelector("#bottom")!).maxHeight, /100dvh/);
  assert.equal(css(doc.querySelector("#bottom")!).maxHeight, css(doc.querySelector("#other-bottom")!).maxHeight);
  assert.equal(css(doc.querySelector("#vault")!).maxHeight, "");
  assert.equal(css(doc.querySelector("#side")!).maxHeight, "");
  assert.equal(css(doc.querySelector("#unowned")!).maxHeight, "");
  doc.documentElement.removeAttribute("data-bb-sidebar-phone");
  assert.equal(css(doc.querySelector("#bottom")!).maxHeight, "");
  assert.equal(css(doc.querySelector("#vault")!).maxHeight, "");
  dispose(); dom.window.close();
});
