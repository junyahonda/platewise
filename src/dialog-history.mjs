const DIALOG_KEY = "platewiseDialog";
const DIALOGS = new Set(["filters", "method", "privacy", "install"]);

// A modal gets its own same-URL entry, so Back dismisses it before
// traversing tabs or leaving the app. All dismissal paths consume that entry.
export function createDialogHistory(history, onChange) {
  let closing = false;
  const current = () => {
    const name = history.state?.[DIALOG_KEY];
    return DIALOGS.has(name) ? name : null;
  };
  return {
    open(name) {
      if (!DIALOGS.has(name)) throw new Error("Unknown dialog");
      if (closing) return;
      const state = { ...history.state, [DIALOG_KEY]: name };
      if (current()) history.replaceState(state, "");
      else history.pushState(state, "");
      onChange(name);
    },
    close() {
      if (closing) return;
      if (current()) {
        closing = true;
        history.back();
      } else onChange(null);
    },
    sync() {
      closing = false;
      const name = current();
      onChange(name);
      return name;
    },
  };
}
