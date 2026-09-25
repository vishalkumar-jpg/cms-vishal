import * as React from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";
import { invokeEditorSelectionClear } from "@/views/builder/editorSelectionBridge";
import { useEditorUiStore } from "@/views/builder/store/editorUiStore";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface AlertOptions {
  title: string;
  description?: string;
  okLabel?: string;
}

export interface PromptOptions {
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

type DialogState =
  | (ConfirmOptions & { open: true; kind: "confirm" })
  | (AlertOptions & { open: true; kind: "alert" })
  | (PromptOptions & { open: true; kind: "prompt" });

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

let modalDialogLockCount = 0;

export type ModalDialogChromeOptions = {
  /** Clear Craft selection + events (confirm/alert). Off for dialogs that need the current node. */
  clearSelection?: boolean;
};

export const lockModalDialogChrome = (options: ModalDialogChromeOptions = {}): void => {
  modalDialogLockCount += 1;
  if (options.clearSelection !== false) {
    invokeEditorSelectionClear();
  }
  useEditorUiStore.getState().setModalDialogOpen(true);
  document.body.setAttribute("data-ob-modal-dialog", "");
};

export const unlockModalDialogChrome = (): void => {
  modalDialogLockCount = Math.max(0, modalDialogLockCount - 1);
  if (modalDialogLockCount > 0) return;
  useEditorUiStore.getState().setModalDialogOpen(false);
  document.body.removeAttribute("data-ob-modal-dialog");
};

const openModalDialog = (): void => {
  lockModalDialogChrome();
};

const closeModalDialog = (): void => {
  unlockModalDialogChrome();
};

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<DialogState | null>(null);
  const [promptValue, setPromptValue] = React.useState("");
  const resolveRef = React.useRef<((value: boolean) => void) | null>(null);
  const promptResolveRef = React.useRef<((value: string | null) => void) | null>(null);
  const kindRef = React.useRef<DialogState["kind"] | undefined>(undefined);

  const settle = React.useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    kindRef.current = undefined;
    setState(null);
    closeModalDialog();
  }, []);

  const settlePrompt = React.useCallback((value: string | null) => {
    promptResolveRef.current?.(value);
    promptResolveRef.current = null;
    kindRef.current = undefined;
    setPromptValue("");
    setState(null);
    closeModalDialog();
  }, []);

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      openModalDialog();
      resolveRef.current = resolve;
      kindRef.current = "confirm";
      setState({ open: true, kind: "confirm", ...options });
    });
  }, []);

  const alert = React.useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      openModalDialog();
      resolveRef.current = () => resolve();
      kindRef.current = "alert";
      setState({ open: true, kind: "alert", ...options });
    });
  }, []);

  const prompt = React.useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      openModalDialog();
      promptResolveRef.current = resolve;
      kindRef.current = "prompt";
      setPromptValue(options.defaultValue ?? "");
      setState({ open: true, kind: "prompt", ...options });
    });
  }, []);

  const value = React.useMemo(() => ({ confirm, alert, prompt }), [alert, confirm, prompt]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={state?.open ?? false}
        onOpenChange={(open) => {
          if (open) return;
          if (kindRef.current === "prompt") settlePrompt(null);
          else settle(kindRef.current === "alert");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{state?.title ?? "Confirm"}</DialogTitle>
            {state?.description ? (
              <DialogDescription>{state.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {state?.kind === "prompt" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ob-prompt-input" className="sr-only">
                {state.title}
              </Label>
              <Input
                id="ob-prompt-input"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={state.placeholder}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") settlePrompt(promptValue.trim() || null);
                }}
              />
            </div>
          ) : null}
          <DialogFooter>
            {state?.kind === "alert" ? (
              <Button type="button" onClick={() => settle(true)}>
                {state.okLabel ?? "OK"}
              </Button>
            ) : state?.kind === "prompt" ? (
              <>
                <Button type="button" variant="outline" onClick={() => settlePrompt(null)}>
                  {state?.cancelLabel ?? "Cancel"}
                </Button>
                <Button type="button" onClick={() => settlePrompt(promptValue.trim() || null)}>
                  {state?.confirmLabel ?? "OK"}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => settle(false)}>
                  {state?.cancelLabel ?? "Cancel"}
                </Button>
                <Button
                  type="button"
                  variant={state?.destructive ? "destructive" : "default"}
                  onClick={() => settle(true)}
                >
                  {state?.confirmLabel ?? "Continue"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
};

/** App-styled confirm dialog (replaces `window.confirm`). */
export const useConfirm = (): ConfirmContextValue["confirm"] => {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx.confirm;
};

/** App-styled alert dialog (replaces `window.alert`). */
export const useAlert = (): ConfirmContextValue["alert"] => {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useAlert must be used within ConfirmProvider");
  }
  return ctx.alert;
};

/** App-styled prompt dialog (replaces `window.prompt`). */
export const usePrompt = (): ConfirmContextValue["prompt"] => {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("usePrompt must be used within ConfirmProvider");
  }
  return ctx.prompt;
};

/** True while a confirm/alert/prompt dialog is visible (hide editor selection chrome). */
export const useConfirmOpen = (): boolean =>
  useEditorUiStore((s) => s.modalDialogOpen);
