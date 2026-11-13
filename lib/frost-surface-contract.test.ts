import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectFrostProject } from "./frost-project.ts";

it("opts custom popovers into the common face and clears only their marked content", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>
    .solid { background: rgb(24, 35, 46); }
    [aria-selected="true"], input { background: rgb(12, 34, 56); }
  </style></head><body>
    <div data-bb-frost-surface="popover" role="dialog" id="popup">
      <div data-bb-frost-content class="solid" id="content"><input id="input"><div aria-selected="true" id="selected"></div></div>
      <div class="solid" id="other"></div>
    </div>
    <div data-bb-frost-surface="popover" id="plain"></div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  const style = (id: string) => dom.window.getComputedStyle(doc.getElementById(id)!);
  assert.equal(style("popup").borderRadius, "22px");
  assert.equal(style("content").backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(style("input").backgroundColor, "rgb(12, 34, 56)");
  assert.equal(style("selected").backgroundColor, "rgb(12, 34, 56)");
  assert.equal(style("other").backgroundColor, "rgb(24, 35, 46)");
  assert.equal(style("plain").borderRadius, "");
  dispose(); dom.window.close();
});

it("opts out the marked surface while allowing an independent child popup", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>
    .original { border-radius: 6px; background: rgb(24, 35, 46); }
  </style></head><body>
    <div data-bb-portaled-overlay role="menu" data-radix-menu-content class="bg-popover original" data-bb-frost-surface="none" id="host">
      <div data-bb-frost-surface="popover" role="listbox" id="child"><div role="option" id="choice"></div></div><div role="menuitem" class="original" id="own-choice"></div>
    </div>
    <div data-bb-portaled-overlay data-bb-plugin="issues" role="dialog" data-bb-frost-surface="none" class="original" id="plugin"><input aria-label="Search issues"></div>
    <div data-bb-plugin="vault"><button aria-label="사용법"></button><p role="tooltip" data-bb-frost-surface="none" class="original" id="tip"></p></div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  for (const id of ["host", "plugin", "tip", "own-choice"]) {
    const style = dom.window.getComputedStyle(doc.getElementById(id)!);
    assert.equal(style.borderRadius, "6px", `${id} retains its own face`);
    assert.equal(style.backgroundColor, "rgb(24, 35, 46)");
  }
  assert.equal(dom.window.getComputedStyle(doc.getElementById("child")!).borderRadius, "22px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("choice")!).borderRadius, "12px");
  dispose(); dom.window.close();
});

it("recognizes direct tooltip surfaces without turning ordinary tooltip text into a surface", () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <p data-bb-frost-surface="tooltip" role="tooltip" id="direct">Help</p>
    <div data-bb-portaled-overlay id="wrapper"><span role="tooltip" id="text">Help</span></div>
    <p role="tooltip" id="plain">Other text</p>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  assert.equal(dom.window.getComputedStyle(doc.getElementById("direct")!).borderRadius, "18px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("wrapper")!).borderRadius, "18px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("text")!).borderRadius, "");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("plain")!).borderRadius, "");
  const css = doc.querySelector("#bb-frost-project")!.textContent!;
  assert.match(css, /\[data-bb-frost-surface="tooltip"\]\[role="tooltip"\]/);
  assert.match(css, /border-radius:\s*38px\s*!important;\s*corner-shape:\s*squircle/);
  dispose(); dom.window.close();
});

it("opts confirmed action rows in without changing native button semantics or state backgrounds", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>
    [aria-pressed="true"] { background: rgb(12, 34, 56); }
    button:disabled { background: rgb(23, 45, 67); }
    input { border-radius: 4px; background: rgb(34, 56, 78); }
  </style></head><body>
    <div data-bb-frost-surface="popover" role="dialog">
      <button data-bb-frost-item aria-pressed="true" id="action">Action</button>
      <button data-bb-frost-item disabled id="disabled">Disabled</button>
      <button id="ordinary">Other</button><input id="input">
    </div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  const action = doc.getElementById("action")!;
  assert.equal(dom.window.getComputedStyle(action).borderRadius, "12px");
  assert.equal(dom.window.getComputedStyle(action).backgroundColor, "rgb(12, 34, 56)");
  assert.equal(action.hasAttribute("role"), false);
  assert.equal(action.hasAttribute("tabindex"), false);
  assert.equal(dom.window.getComputedStyle(doc.getElementById("disabled")!).borderRadius, "12px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("disabled")!).backgroundColor, "rgb(23, 45, 67)");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("ordinary")!).borderRadius, "");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("input")!).borderRadius, "4px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("input")!).backgroundColor, "rgb(34, 56, 78)");
  dispose(); dom.window.close();
});

it("lets plugin-owned nested menus escape the parent blur without affecting scrollable menus", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>
    .overflow-hidden { overflow: hidden; }
  </style></head><body>
    <div data-bb-portaled-overlay data-bb-plugin="alpha" role="menu" class="overflow-hidden" id="parent">
      <div data-radix-popper-content-wrapper><div data-bb-portaled-overlay data-bb-plugin="alpha" role="menu" data-state="open" id="child"><div role="menuitem" id="choice"></div></div></div>
    </div>
    <div data-bb-portaled-overlay data-bb-plugin="alpha" role="menu" class="overflow-hidden overflow-y-auto" id="scroll">
      <div data-radix-popper-content-wrapper><div data-bb-portaled-overlay role="menu" data-state="open"></div></div>
    </div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  const parent = dom.window.getComputedStyle(doc.getElementById("parent")!);
  assert.equal(parent.overflow, "visible");
  assert.equal(parent.backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(parent.borderRadius, "22px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("child")!).borderRadius, "22px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("choice")!).borderRadius, "12px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("scroll")!).overflow, "hidden");
  dispose(); dom.window.close();
});

it("scopes marked container rows to popup or phone drawer surfaces without selecting their inner buttons", () => {
  const dom = new JSDOM(`<!doctype html><html data-bb-sidebar-phone><head></head><body>
    <div data-bb-frost-surface="popover" role="dialog"><div data-bb-frost-item id="row"><button id="drag">Reorder</button><label><input type="checkbox">Visible</label></div></div>
    <div data-persistent-drawer-content><div data-bb-frost-item id="drawer-row"></div></div>
    <div data-bb-frost-item id="outside"></div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  for (const id of ["row", "drawer-row"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "12px");
  for (const id of ["drag", "outside"]) assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "");
  assert.equal(doc.getElementById("row")!.hasAttribute("role"), false);
  assert.equal(doc.querySelector("input")!.type, "checkbox");
  dispose(); dom.window.close();
});
