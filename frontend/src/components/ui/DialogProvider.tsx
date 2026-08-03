import React, { createContext, useContext, useState } from "react";
import { AlertTriangleIcon, HelpCircleIcon, XIcon } from "lucide-react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive" | "warning";
}

export interface PromptOptions {
  title?: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirmation state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  // Prompt state
  const [promptState, setPromptState] = useState<{
    open: boolean;
    options: PromptOptions;
    value: string;
    resolve: (val: string | null) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions | string): Promise<boolean> => {
    const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        options: opts,
        resolve,
      });
    });
  };

  const prompt = (options: PromptOptions | string): Promise<string | null> => {
    const opts: PromptOptions = typeof options === "string" ? { message: options } : options;
    return new Promise<string | null>((resolve) => {
      setPromptState({
        open: true,
        options: opts,
        value: opts.defaultValue || "",
        resolve,
      });
    });
  };

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  const handlePromptClose = (result: string | null) => {
    if (promptState) {
      promptState.resolve(result);
      setPromptState(null);
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}

      {/* Confirmation Modal */}
      {confirmState?.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl shrink-0 ${
                    confirmState.options.variant === "destructive"
                      ? "bg-rose-500/10 text-rose-500"
                      : confirmState.options.variant === "warning"
                      ? "bg-amber-500/10 text-amber-500"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <AlertTriangleIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {confirmState.options.title || "Please Confirm"}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => handleConfirmClose(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {confirmState.options.message}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition"
              >
                {confirmState.options.cancelText || "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition ${
                  confirmState.options.variant === "destructive"
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-primary hover:opacity-90 text-primary-foreground"
                }`}
              >
                {confirmState.options.confirmText || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Modal */}
      {promptState?.open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 text-foreground">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <HelpCircleIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">
                    {promptState.options.title || "Input Required"}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => handlePromptClose(null)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            {promptState.options.message && (
              <p className="text-sm text-muted-foreground">
                {promptState.options.message}
              </p>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePromptClose(promptState.value);
              }}
            >
              <input
                type="text"
                value={promptState.value}
                onChange={(e) =>
                  setPromptState({ ...promptState, value: e.target.value })
                }
                placeholder={promptState.options.placeholder || "Enter value..."}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />

              <div className="flex items-center justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => handlePromptClose(null)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-background hover:bg-muted transition"
                >
                  {promptState.options.cancelText || "Cancel"}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary hover:opacity-90 text-primary-foreground transition"
                >
                  {promptState.options.confirmText || "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useConfirm must be used within a DialogProvider");
  }
  return context.confirm;
};

export const usePrompt = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("usePrompt must be used within a DialogProvider");
  }
  return context.prompt;
};
