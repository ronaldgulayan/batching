import React, { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export type SnackbarType = "success" | "error" | "info" | "warning";

export type SnackbarItem = {
  id: string;
  type: SnackbarType;
  message: string;
  title?: string;
  duration?: number;
};

type SnackbarContextType = {
  showSnackbar: (item: Omit<SnackbarItem, "id">) => void;
  showSuccess: (message: string, title?: string) => void;
  showError: (message: string, title?: string) => void;
  showInfo: (message: string, title?: string) => void;
  showWarning: (message: string, title?: string) => void;
  removeSnackbar: (id: string) => void;
};

const SnackbarContext = createContext<SnackbarContextType | null>(null);

let globalShowSnackbar: ((item: Omit<SnackbarItem, "id">) => void) | null = null;

export const showSuccessNotification = (message: string, title?: string) => {
  globalShowSnackbar?.({ type: "success", message, title });
};

export const showErrorNotification = (message: string, title?: string) => {
  globalShowSnackbar?.({ type: "error", message, title });
};

export const showInfoNotification = (message: string, title?: string) => {
  globalShowSnackbar?.({ type: "info", message, title });
};

export const showWarningNotification = (message: string, title?: string) => {
  globalShowSnackbar?.({ type: "warning", message, title });
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [snackbars, setSnackbars] = useState<SnackbarItem[]>([]);

  const removeSnackbar = useCallback((id: string) => {
    setSnackbars((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showSnackbar = useCallback(
    (item: Omit<SnackbarItem, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = item.duration ?? 4000;
      const newItem: SnackbarItem = { ...item, id, duration };

      setSnackbars((prev) => [...prev.slice(-4), newItem]); // keep at most 5 snackbars

      if (duration > 0) {
        setTimeout(() => {
          removeSnackbar(id);
        }, duration);
      }
    },
    [removeSnackbar]
  );

  globalShowSnackbar = showSnackbar;

  const showSuccess = useCallback(
    (message: string, title?: string) => showSnackbar({ type: "success", message, title: title || "Success" }),
    [showSnackbar]
  );

  const showError = useCallback(
    (message: string, title?: string) => showSnackbar({ type: "error", message, title: title || "Error" }),
    [showSnackbar]
  );

  const showInfo = useCallback(
    (message: string, title?: string) => showSnackbar({ type: "info", message, title }),
    [showSnackbar]
  );

  const showWarning = useCallback(
    (message: string, title?: string) => showSnackbar({ type: "warning", message, title: title || "Warning" }),
    [showSnackbar]
  );

  return (
    <SnackbarContext.Provider
      value={{ showSnackbar, showSuccess, showError, showInfo, showWarning, removeSnackbar }}
    >
      {children}
      <SnackbarContainer snackbars={snackbars} onRemove={removeSnackbar} />
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

function SnackbarContainer({
  snackbars,
  onRemove,
}: {
  snackbars: SnackbarItem[];
  onRemove: (id: string) => void;
}) {
  if (snackbars.length === 0) return null;

  return (
    <div className="snackbar-portal-container" aria-live="polite">
      {snackbars.map((item) => (
        <SnackbarToast key={item.id} item={item} onDismiss={() => onRemove(item.id)} />
      ))}
    </div>
  );
}

function SnackbarToast({
  item,
  onDismiss,
}: {
  item: SnackbarItem;
  onDismiss: () => void;
}) {
  const getIcon = () => {
    switch (item.type) {
      case "success":
        return <CheckCircle2 size={20} className="snackbar-icon success" />;
      case "error":
        return <AlertCircle size={20} className="snackbar-icon error" />;
      case "warning":
        return <AlertTriangle size={20} className="snackbar-icon warning" />;
      case "info":
      default:
        return <Info size={20} className="snackbar-icon info" />;
    }
  };

  return (
    <div className={`snackbar-toast snackbar-toast-${item.type}`} role="alert">
      <div className="snackbar-icon-wrap">{getIcon()}</div>
      <div className="snackbar-content">
        {item.title && <div className="snackbar-title">{item.title}</div>}
        <div className="snackbar-message">{item.message}</div>
      </div>
      <button
        type="button"
        className="snackbar-close-btn"
        onClick={onDismiss}
        aria-label="Close notification"
      >
        <X size={15} />
      </button>
    </div>
  );
}
