import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { DRAWER_EXPANSION_CSS } from "./drawer-expansion.ts";

it("fills expanded phone drawers through nested command groups and restores compact limits", () => {
  const dom = new JSDOM(`<style>
    [cmdk-list] { max-height: 300px; }
    .overflow-y-auto { max-height: 166px; overflow-y: auto; }
    ${DRAWER_EXPANSION_CSS}
  </style><div data-persistent-drawer-content data-state="open"><div><div cmdk-root>
    <div cmdk-list><div cmdk-list-sizer>
      <div cmdk-group><div cmdk-group-heading>Projects</div><div cmdk-group-items>
        <div class="overflow-y-auto"><div role="option">Project</div></div>
      </div></div>
      <div cmdk-group id="actions">New project</div>
    </div></div>
  </div></div></div>`);
  const doc = dom.window.document, drawer = doc.querySelector("[data-persistent-drawer-content]")!;
  doc.documentElement.setAttribute("data-bb-sidebar-phone", "");
  const list = doc.querySelector<HTMLElement>(".overflow-y-auto")!;
  const style = (element: Element) => dom.window.getComputedStyle(element);
  assert.equal(style(list).maxHeight, "166px");
  drawer.setAttribute("data-bb-mobile-sheet-stage", "expanded");
  for (const element of doc.querySelectorAll("[cmdk-list], [cmdk-list-sizer], [cmdk-group]:has(.overflow-y-auto), [cmdk-group-items], .overflow-y-auto")) {
    assert.equal(style(element).maxHeight, "none");
    assert.equal(style(element).flexGrow, "1");
    assert.equal(style(element).minHeight, "0");
  }
  assert.notEqual(style(doc.querySelector("#actions")!).flexGrow, "1", "footer actions keep their natural height");
  drawer.removeAttribute("data-bb-mobile-sheet-stage");
  assert.equal(style(list).maxHeight, "166px");
  assert.equal(style(doc.querySelector("[cmdk-list]")!).maxHeight, "300px");
  drawer.setAttribute("data-bb-mobile-sheet-stage", "expanded");
  doc.documentElement.removeAttribute("data-bb-sidebar-phone");
  assert.equal(style(list).maxHeight, "166px", "desktop keeps its list limit");
  dom.window.close();
});
