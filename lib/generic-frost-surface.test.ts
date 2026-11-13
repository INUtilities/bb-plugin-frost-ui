import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { FROST_LIST_ITEM_SELECTOR, GENERIC_TOOLTIP_SELECTOR, injectFrostProject } from "./frost-project.ts";

it("frosts common portal surfaces regardless of plugin and preserves meaningful inner backgrounds", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>
    [data-bb-frost-content], [cmdk-root], .other-panel { background: rgb(240, 240, 240); }
    input, [aria-selected="true"] { background: rgb(12, 34, 56); }
  </style></head><body>
    <div data-bb-portaled-overlay role="dialog" data-bb-plugin="alpha" id="dialog"><div data-bb-frost-content id="body"><input id="input"><div aria-selected="true" id="selected"></div></div></div>
    <div data-bb-portaled-overlay role="menu" data-bb-plugin="beta" id="menu"></div>
    <div data-bb-portaled-overlay role="dialog" data-bb-plugin="gamma"><div cmdk-root class="bg-popover" id="command"></div><div class="other-panel" id="other-panel"></div></div>
    <div data-bb-portaled-overlay role="listbox" id="list"></div>
    <div data-bb-portaled-overlay id="tooltip"><span role="tooltip"></span></div>
    <div data-radix-popper-content-wrapper><div role="dialog" id="radix-dialog"></div></div>
    <div data-radix-popper-content-wrapper><div id="radix-tooltip"><span role="tooltip"></span></div></div>
    <div data-bb-portaled-overlay role="dialog" data-persistent-drawer-content id="drawer"></div>
    <div id="plain" role="dialog"></div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  const rules = Array.from((doc.querySelector("#bb-frost-project") as HTMLStyleElement).sheet!.cssRules);
  const tooltipRule = rules.find((rule) => "selectorText" in rule && rule.selectorText === GENERIC_TOOLTIP_SELECTOR) as CSSStyleRule | undefined;
  assert.equal(tooltipRule?.style.getPropertyValue("color"), "var(--foreground)", "frost tooltip text stays readable");
  for (const id of ["dialog", "menu", "list", "radix-dialog"]) {
    const style = dom.window.getComputedStyle(doc.getElementById(id)!);
    assert.equal(style.borderRadius, "22px", `${id} gets the shared popover shape`);
  }
  for (const id of ["tooltip", "radix-tooltip"]) {
    assert.equal(dom.window.getComputedStyle(doc.getElementById(id)!).borderRadius, "18px", `${id} keeps its existing fallback shape`);
  }
  assert.notEqual(dom.window.getComputedStyle(doc.getElementById("drawer")!).borderRadius, "18px");
  assert.notEqual(dom.window.getComputedStyle(doc.getElementById("plain")!).borderRadius, "18px");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("body")!).backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("command")!).backgroundColor, "rgba(0, 0, 0, 0)");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("other-panel")!).backgroundColor, "rgb(240, 240, 240)");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("input")!).backgroundColor, "rgb(12, 34, 56)");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("selected")!).backgroundColor, "rgb(12, 34, 56)");
  dispose(); dom.window.close();
});

it("rounds items in generic floating surfaces without changing their state backgrounds", () => {
  const dom = new JSDOM(`<!doctype html><html><head><style>
    [aria-selected="true"] { background: rgb(12, 34, 56); }
  </style></head><body>
    <div data-radix-popper-content-wrapper><div role="listbox">
      <div role="option" aria-selected="true" id="option"></div>
    </div></div>
    <div data-bb-portaled-overlay role="menu"><div role="menuitemcheckbox" id="menuitem"></div></div>
    <div role="option" id="outside"></div>
  </body></html>`);
  const doc = dom.window.document;
  const dispose = injectFrostProject(doc);
  assert.ok(doc.querySelector("#bb-frost-project")!.textContent!.includes(`${FROST_LIST_ITEM_SELECTOR} { corner-shape: round; }`), "menu items use a rounder curve");
  const matched = Array.from(doc.querySelectorAll(FROST_LIST_ITEM_SELECTOR), (element) => element.id);
  assert.ok(matched.includes("option"), "Radix listbox options use the common item shape");
  assert.ok(matched.includes("menuitem"), "portal menu items use the common item shape");
  assert.ok(!matched.includes("outside"), "ordinary content is not styled as a menu item");
  assert.equal(dom.window.getComputedStyle(doc.getElementById("option")!).backgroundColor, "rgb(12, 34, 56)");
  dispose(); dom.window.close();
});

it('keeps parent and submenu at 22px while preserving tooltip and item rules', () => {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div data-bb-portaled-overlay role="menu" data-radix-menu-content class="bg-popover overflow-hidden" id="parent">
      <div role="menuitem" id="item">Option</div>
    </div>
    <div data-bb-portaled-overlay id="tooltip"><span role="tooltip">Help</span></div>
  </body></html>`);
  const doc = dom.window.document, dispose = injectFrostProject(doc);
  const parent=doc.getElementById('parent')!, tooltip=doc.getElementById('tooltip')!, item=doc.getElementById('item')!;
  assert.equal(dom.window.getComputedStyle(parent).borderRadius, '22px');
  assert.equal(dom.window.getComputedStyle(tooltip).borderRadius, '18px');
  assert.equal(dom.window.getComputedStyle(item).borderRadius, '12px');
  const wrapper=doc.createElement('div');wrapper.setAttribute('data-radix-popper-content-wrapper','');
  wrapper.innerHTML='<div data-bb-portaled-overlay role="menu" data-state="open" id="submenu"></div>';parent.append(wrapper);
  assert.equal(dom.window.getComputedStyle(parent).borderRadius, '22px');
  assert.equal(dom.window.getComputedStyle(doc.getElementById('submenu')!).borderRadius, '22px');
  const css=doc.querySelector('#bb-frost-project')!.textContent!;
  assert.match(css, /border-radius:\s*22px\s*!important;\s*corner-shape:\s*squircle/);
  assert.match(css, /border-radius:\s*38px\s*!important;\s*corner-shape:\s*squircle/);
  dispose();dom.window.close();
});
