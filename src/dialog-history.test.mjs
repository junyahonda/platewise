import test from "node:test";
import assert from "node:assert/strict";
import { createDialogHistory } from "./dialog-history.mjs";

function browser(url = "https://food.junyahonda.com/#discover") {
  const entries = [{ url: "https://example.com/", state: null }, { url, state: { existing: true } }];
  let index = 1, pending = 0, dialog = null;
  const history = {
    get state() { return entries[index].state; },
    get url() { return entries[index].url; },
    get length() { return entries.length; },
    pushState(state, _, url = history.url) {
      entries.splice(++index, entries.length, { url, state });
    },
    replaceState(state, _, url = history.url) { entries[index] = { url, state }; },
    back() { pending--; },
    forward() { pending++; },
  };
  const onChange = value => { dialog = value; };
  const controller = createDialogHistory(history, onChange);
  return {
    history, controller, onChange,
    get dialog() { return dialog; },
    flush() {
      index = Math.max(0, Math.min(entries.length - 1, index + pending));
      pending = 0;
      controller.sync();
    },
  };
}

test("Back closes Filters before it can leave the site; Forward restores it", () => {
  const b = browser();
  b.controller.open("filters");
  assert.equal(b.history.length, 3);
  assert.equal(b.dialog, "filters");
  assert.equal(b.history.state.existing, true);
  b.history.back();
  b.flush();
  assert.equal(b.dialog, null);
  assert.equal(b.history.url, "https://food.junyahonda.com/#discover");
  b.history.forward();
  b.flush();
  assert.equal(b.dialog, "filters");
  b.history.back();
  b.flush();
  b.history.back();
  b.flush();
  assert.equal(b.history.url, "https://example.com/");
});

test("explicit and native-cancel dismissal consume one entry, including repeated taps", () => {
  for (const name of ["filters", "method", "privacy", "install"]) {
    const b = browser();
    b.controller.open(name);
    b.controller.close();
    b.controller.close();
    b.flush();
    assert.equal(b.dialog, null);
    assert.equal(b.history.url, "https://food.junyahonda.com/#discover");
    b.history.back();
    b.flush();
    assert.equal(b.history.url, "https://example.com/", "no dead modal entry remains");
  }
});

test("closing About dialogs leaves the underlying tab unchanged and tab history intact", () => {
  const b = browser();
  b.history.pushState(null, "", "https://food.junyahonda.com/#about");
  b.controller.open("method");
  b.history.back();
  b.flush();
  assert.equal(b.dialog, null);
  assert.equal(b.history.url, "https://food.junyahonda.com/#about");
  b.history.back();
  b.flush();
  assert.equal(b.history.url, "https://food.junyahonda.com/#discover");
  assert.equal(b.dialog, null);
});

test("switching dialogs replaces the current modal entry, without stacking invisible modals", () => {
  const b = browser();
  b.controller.open("method");
  b.controller.open("privacy");
  assert.equal(b.dialog, "privacy");
  assert.equal(b.history.length, 3);
  b.history.back();
  b.flush();
  assert.equal(b.dialog, null);
});

test("reload restores an open modal without pushing another entry", () => {
  const b = browser();
  b.controller.open("privacy");
  const restored = createDialogHistory(b.history, b.onChange);
  assert.equal(restored.sync(), "privacy");
  assert.equal(b.history.length, 3);
  restored.close();
  b.flush();
  assert.equal(b.dialog, null);
});

test("opening a direct privacy link has an in-app Back destination", () => {
  const b = browser("https://food.junyahonda.com/?view=privacy");
  b.controller.open("privacy");
  b.history.back();
  b.flush();
  assert.equal(b.dialog, null);
  assert.equal(b.history.url, "https://food.junyahonda.com/?view=privacy");
});
