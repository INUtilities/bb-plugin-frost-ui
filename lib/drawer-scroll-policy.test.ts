import assert from "node:assert/strict";
import { it } from "node:test";
import { JSDOM } from "jsdom";
import { injectDrawerExpansion } from "./drawer-expansion.ts";
import { injectDrawerScrollGuard } from "./drawer-scroll-guard.ts";
import { writeSidebarChrome } from "./sidebar-chrome.ts";

function fixture(autoLayout = false) {
  const dom = new JSDOM(`<main id="backdrop"></main><div data-persistent-drawer-content data-state="open"><div data-persistent-drawer-handle></div><div id="list" style="overflow-y:auto"><button id="item">Item</button></div></div>`);
  const doc = dom.window.document;
  const drawer = doc.querySelector<HTMLElement>("[data-persistent-drawer-content]")!;
  const handle = drawer.firstElementChild!;
  const list = doc.querySelector<HTMLElement>("#list")!;
  const item = doc.querySelector<HTMLElement>("#item")!;
  let height = 320;
  drawer.getBoundingClientRect = () => {
    const actual = autoLayout ? Number.parseFloat(drawer.style.getPropertyValue("--bb-mobile-sheet-height")) || height : height;
    return { top: 720 - actual, bottom: 720, height: actual } as DOMRect;
  };
  Object.defineProperties(list, { clientHeight: { value: 200 }, scrollHeight: { value: 1000, configurable: true } });
  Object.assign(dom.window, { matchMedia: () => ({ matches: true }) });
  writeSidebarChrome(doc, { device: "phone", orientation: "portrait", viewport: "narrow", hitTarget: "large" });
  const expansion = injectDrawerExpansion(doc);
  const guard = injectDrawerScrollGuard(doc, expansion.canScroll, expansion.revealFocus);
  const detail: { onClose(): void; controller?: { toggle(): void } } = { onClose() {} };
  drawer.dispatchEvent(new dom.window.CustomEvent("bb-frost-drawer-connect", { bubbles: true, detail }));
  const touch = (type: string, y: number, target: Element = item) => {
    const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 1, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: /end|cancel/.test(type) ? [] : [point] }, changedTouches: { value: [point] } });
    target.dispatchEvent(event); return event;
  };
  const wheel = (dy: number, dx = 0) => {
    const event = new dom.window.WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: dy, deltaX: dx });
    item.dispatchEvent(event); return event;
  };
  const scroll = (top: number) => { list.scrollTop = top; list.dispatchEvent(new dom.window.Event("scroll")); };
  const expand = () => { detail.controller!.toggle(); if (!autoLayout) height = 720; };
  const dispose = () => { guard(); expansion(); dom.window.close(); };
  return { dom, doc, drawer, handle, list, item, detail, touch, wheel, scroll, expand, dispose, height: (next: number) => { height = next; } };
}

it("locks collapsed vertical wheel scroll and unlocks only at the measured maximum", () => {
  const f = fixture();
  assert.equal(f.wheel(60).defaultPrevented, true);
  f.detail.controller!.toggle();
  assert.equal(f.wheel(60).defaultPrevented, true, "expanded state during the height transition is not the maximum yet");
  f.height(720);
  assert.equal(f.wheel(60).defaultPrevented, false);
  f.dispose();
});

it("shrinks an expanded drawer by dragging its scrolling body down from the top", () => {
  const f = fixture(true); f.expand();
  try {
    f.touch("touchstart", 200);
    assert.equal(f.touch("touchmove", 440).defaultPrevented, true);
    const draggedHeight = Number.parseFloat(f.drawer.style.getPropertyValue("--bb-mobile-sheet-height"));
    assert.ok(draggedHeight < 720 && draggedHeight > 320, "the body drag must move the drawer before release");
    f.touch("touchend", 440);
    assert.equal(f.drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
    assert.equal(f.list.scrollTop, 0);
    assert.equal(f.wheel(60).defaultPrevented, true, "shrinking must relock content scrolling");
  } finally { f.dispose(); }
});

it("scrolls content before shrinking while the list is away from the top", () => {
  const f = fixture(true); f.expand(); f.scroll(240);
  try {
    f.touch("touchstart", 200);
    assert.equal(f.touch("touchmove", 440).defaultPrevented, false);
    f.touch("touchend", 440);
    assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
    assert.equal(f.drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "720px");
    f.scroll(0);
    f.touch("touchstart", 200);
    assert.equal(f.touch("touchmove", 440).defaultPrevented, true);
    f.touch("touchend", 440);
    assert.equal(f.drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  } finally { f.dispose(); }
});

it("keeps upward body gestures scrolling after expansion", () => {
  const f = fixture(true); f.expand();
  try {
    f.touch("touchstart", 440);
    assert.equal(f.touch("touchmove", 200).defaultPrevented, false);
    f.touch("touchend", 200);
    assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  } finally { f.dispose(); }
});

it("waits for all nested scrolling ancestors to reach the top before shrinking", () => {
  const f = fixture(true); f.expand();
  const nested = f.doc.createElement("div"); nested.style.overflowY = "auto";
  f.list.append(nested); nested.append(f.item);
  Object.defineProperties(nested, { clientHeight: { value: 100 }, scrollHeight: { value: 300 } });
  try {
    for (const [innerTop, outerTop] of [[40, 0], [0, 80]]) {
      nested.scrollTop = innerTop!; f.scroll(outerTop!);
      f.touch("touchstart", 200);
      assert.equal(f.touch("touchmove", 440).defaultPrevented, false);
      f.touch("touchend", 440);
      assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
    }
    nested.scrollTop = 0; f.scroll(0);
    f.touch("touchstart", 200);
    assert.equal(f.touch("touchmove", 440).defaultPrevented, true);
    f.touch("touchend", 440);
    assert.equal(f.drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  } finally { f.dispose(); }
});

it("keeps an expanded drawer's own nonzero scroll position in charge of downward gestures", () => {
  const f = fixture(true); f.drawer.style.overflowY = "auto";
  Object.defineProperties(f.drawer, { clientHeight: { value: 720 }, scrollHeight: { value: 1000 } });
  f.expand(); f.drawer.scrollTop = 120;
  try {
    f.touch("touchstart", 200);
    assert.equal(f.touch("touchmove", 440).defaultPrevented, false);
    f.touch("touchend", 440);
    assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  } finally { f.dispose(); }
});

it("relocks after handle collapse even when the list was already scrolled", () => {
  const f = fixture(); f.expand(); f.scroll(240);
  f.detail.controller!.toggle(); f.height(320);
  assert.equal(f.wheel(60).defaultPrevented, true);
  f.scroll(300); assert.equal(f.list.scrollTop, 240);
  f.scroll(180); assert.equal(f.list.scrollTop, 240);
  f.expand(); assert.equal(f.wheel(60).defaultPrevented, false);
  f.dispose();
});

it("uses an upward body drag to expand before scrolling even at a retained nonzero scroll position", () => {
  const f = fixture(); f.expand(); f.scroll(240); f.detail.controller!.toggle(); f.height(320);
  f.touch("touchstart", 500); assert.equal(f.touch("touchmove", 100).defaultPrevented, true); f.touch("touchend", 100);
  assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  f.dispose();
});

it("allows scroll while keyboard inset reduces the drawer without resizing from its body", () => {
  const f = fixture();
  f.drawer.style.setProperty("--bb-drawer-keyboard-inset", "280px");
  assert.equal(f.wheel(60).defaultPrevented, false);
  f.scroll(240); assert.equal(f.list.scrollTop, 240);
  f.touch("touchstart", 200); assert.equal(f.touch("touchmove", 140).defaultPrevented, false); f.touch("touchend", 140);
  assert.equal(f.drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  f.drawer.style.removeProperty("--bb-drawer-keyboard-inset");
  assert.equal(f.wheel(60).defaultPrevented, true);
  f.scroll(300); assert.equal(f.list.scrollTop, 240);
  f.dispose();
});

it("resets persistent drawer scroll on a real close and reopen, not when a nested drawer covers it", async () => {
  const f = fixture(); f.expand(); f.scroll(240);
  f.drawer.setAttribute("inert", ""); await Promise.resolve();
  f.drawer.removeAttribute("inert"); await Promise.resolve();
  assert.equal(f.list.scrollTop, 240);
  f.drawer.setAttribute("data-state", "closed"); await Promise.resolve();
  f.drawer.setAttribute("data-state", "open"); await Promise.resolve();
  assert.equal(f.list.scrollTop, 0);
  f.dispose();
});

it("keeps horizontal content scroll and backdrop taps available while collapsed", () => {
  const f = fixture();
  f.list.style.overflowX = "auto";
  Object.defineProperties(f.list, { scrollWidth: { value: 800 }, clientWidth: { value: 200 } });
  assert.equal(f.wheel(0, 40).defaultPrevented, false);
  const click = new f.dom.window.MouseEvent("click", { bubbles: true, cancelable: true });
  f.doc.querySelector("#backdrop")!.dispatchEvent(click); assert.equal(click.defaultPrevented, false);
  f.dispose();
});

it("preserves desktop scrolling and removes all scroll locking on disposal", () => {
  const f = fixture();
  writeSidebarChrome(f.doc, { device: "desktop", orientation: "landscape", viewport: "wide", hitTarget: "small" });
  assert.equal(f.wheel(60).defaultPrevented, false);
  f.scroll(240); assert.equal(f.list.scrollTop, 240);
  f.dispose();
});

it("locks immediately while dragging the handle below maximum before pointerup", () => {
  const f = fixture(); f.expand(); f.scroll(240);
  const send = (type: string, y: number) => {
    const event = new f.dom.window.MouseEvent(type, { bubbles: true, cancelable: true, clientY: y });
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } });
    f.handle.dispatchEvent(event);
  };
  send("pointerdown", 10); send("pointermove", 150);
  assert.equal(f.wheel(60).defaultPrevented, true);
  f.scroll(300); assert.equal(f.list.scrollTop, 240);
  send("pointercancel", 150);
  f.dispose();
});

it("does not change retained scroll on viewport keyboard resize and return", async () => {
  const f = fixture(); f.expand(); f.scroll(240);
  f.drawer.style.setProperty("--bb-drawer-keyboard-inset", "280px");
  f.dom.window.dispatchEvent(new f.dom.window.Event("resize"));
  await Promise.resolve();
  assert.equal(f.list.scrollTop, 240);
  f.drawer.style.removeProperty("--bb-drawer-keyboard-inset");
  f.dom.window.dispatchEvent(new f.dom.window.Event("resize"));
  await Promise.resolve();
  assert.equal(f.list.scrollTop, 240);
  f.dispose();
});

it("remeasures shortened content before an upward drag after collapsed scroll was blocked", () => {
  const f = fixture(); assert.equal(f.wheel(60).defaultPrevented, true);
  Object.defineProperty(f.list, "scrollHeight", { value: 200 });
  f.touch("touchstart", 500); f.touch("touchmove", 100); f.touch("touchend", 100);
  assert.notEqual(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  f.dispose();
});

it("unlocks at a CSS-constrained maximum while keeping the compact stage locked", () => {
  const f = fixture(); f.drawer.style.maxHeight = "680px"; f.drawer.style.boxSizing = "border-box";
  assert.equal(f.wheel(60).defaultPrevented, true);
  f.detail.controller!.toggle(); f.height(680);
  assert.equal(f.wheel(60).defaultPrevented, false);
  f.detail.controller!.toggle(); f.height(320);
  assert.equal(f.wheel(60).defaultPrevented, true);
  f.dispose();
});

it("expands before revealing a keyboard focus target outside the compact scroll viewport", () => {
  const f = fixture(true);
  f.list.getBoundingClientRect = () => ({ top: 420, bottom: 700, height: 280 } as DOMRect);
  f.item.getBoundingClientRect = () => ({ top: 900, bottom: 930, height: 30 } as DOMRect);
  let revealed = 0;
  f.item.scrollIntoView = () => {
    assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
    f.scroll(240); revealed++;
  };
  f.item.focus();
  assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  assert.equal(f.list.scrollTop, 240);
  assert.equal(revealed, 1);
  f.dispose();
});

it("does not expand for an already visible focus target or while a keyboard inset allows scrolling", () => {
  const f = fixture(true);
  f.list.getBoundingClientRect = () => ({ top: 420, bottom: 700, height: 280 } as DOMRect);
  f.item.getBoundingClientRect = () => ({ top: 450, bottom: 480, height: 30 } as DOMRect);
  f.item.focus(); assert.equal(f.drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  f.item.blur(); f.drawer.style.setProperty("--bb-drawer-keyboard-inset", "280px");
  f.item.getBoundingClientRect = () => ({ top: 900, bottom: 930, height: 30 } as DOMRect);
  f.item.focus(); assert.equal(f.drawer.hasAttribute("data-bb-mobile-sheet-stage"), false);
  f.dispose();
});

it("reveals the active descendant after a command list attempts to scroll a compact drawer", () => {
  const f = fixture(true);
  const input = f.doc.createElement("input"); f.drawer.append(input);
  f.item.id = "option";
  f.list.getBoundingClientRect = () => ({ top: 420, bottom: 700, height: 280 } as DOMRect);
  f.item.getBoundingClientRect = () => ({ top: 900, bottom: 930, height: 30 } as DOMRect);
  let revealed = false; f.item.scrollIntoView = () => { revealed = true; f.scroll(240); };
  input.focus(); input.setAttribute("aria-activedescendant", "option");
  f.scroll(240);
  assert.equal(f.drawer.getAttribute("data-bb-mobile-sheet-stage"), "expanded");
  assert.equal(revealed, true); assert.equal(f.list.scrollTop, 240);
  f.dispose();
});

it("waits for expansion to settle and does not reveal a focus target that has moved away", () => {
  const f = fixture(true);
  let finish: (() => void) | undefined;
  Object.assign(f.dom.window, { matchMedia: () => ({ matches: false }), setTimeout: (callback: () => void) => { finish = callback; return 1; }, clearTimeout() {} });
  f.list.getBoundingClientRect = () => ({ top: 420, bottom: 700, height: 280 } as DOMRect);
  f.item.getBoundingClientRect = () => ({ top: 900, bottom: 930, height: 30 } as DOMRect);
  let revealed = 0; f.item.scrollIntoView = () => { revealed++; };
  f.item.focus(); assert.equal(revealed, 0); assert.ok(finish);
  f.item.blur(); finish(); assert.equal(revealed, 0);
  f.dispose();
});

for (const transform of ["matrix(1, 0, 0, 1, 0, 562.65625)", "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 562.65625, 0, 1)"]) {
  it(`measures the resting drawer during its opening translation (${transform.startsWith("matrix3d") ? "3d" : "2d"})`, () => {
    const f = fixture(); Object.assign(f.dom.window, { innerHeight: 844 });
    f.drawer.getBoundingClientRect = () => ({ top: 836, bottom: 1398.65625, height: 562.65625 } as DOMRect);
    const computed = f.dom.window.getComputedStyle.bind(f.dom.window);
    f.dom.window.getComputedStyle = (element, pseudo) => {
      const style = computed(element, pseudo);
      if (element === f.drawer) Object.defineProperty(style, "transform", { value: transform });
      return style;
    };
    f.wheel(60); f.detail.controller!.toggle();
    assert.equal(f.drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "836px");
    f.dispose();
  });
}

it("caps expansion at the visible viewport even when a transient box extends below it", () => {
  const f = fixture(); Object.assign(f.dom.window, { innerHeight: 844 });
  f.drawer.getBoundingClientRect = () => ({ top: 700, bottom: 1020, height: 320 } as DOMRect);
  f.detail.controller!.toggle();
  assert.equal(f.drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "836px");
  f.dispose();
});

it("remeasures content that grew after a compact scroll check before revealing focus", () => {
  const f = fixture(true);
  Object.defineProperty(f.list, "scrollHeight", { value: 500, configurable: true });
  f.wheel(60);
  Object.defineProperty(f.list, "scrollHeight", { value: 1000, configurable: true });
  f.list.getBoundingClientRect = () => ({ top: 420, bottom: 700, height: 280 } as DOMRect);
  f.item.getBoundingClientRect = () => ({ top: 900, bottom: 930, height: 30 } as DOMRect);
  f.item.scrollIntoView = () => {};
  f.item.focus();
  assert.equal(f.drawer.style.getPropertyValue("--bb-mobile-sheet-height"), "720px");
  f.dispose();
});
