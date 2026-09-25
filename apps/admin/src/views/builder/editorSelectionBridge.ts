/** Optional Craft editor hook — registered while the page builder is mounted. */
let clearEditorSelection: (() => void) | null = null;

export const registerEditorSelectionClear = (fn: (() => void) | null): void => {
  clearEditorSelection = fn;
};

export const invokeEditorSelectionClear = (): void => {
  clearEditorSelection?.();
};
