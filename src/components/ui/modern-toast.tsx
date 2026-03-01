"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Loader2 } from "lucide-react";

type ToastVariant = "default" | "success" | "error" | "warning" | "info" | "loading";

interface ToastProps {
  id: string;
  title?: string;
  description: string | React.ReactNode;
  variant?: ToastVariant;
  icon?: React.ReactNode;
  duration?: number;
  onDismiss?: () => void;
}

interface ToastContextValue {
  toasts: ToastProps[];
  addToast: (toast: Omit<ToastProps, "id">) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, toast: Partial<Omit<ToastProps, "id">>) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

const variantStyles: Record<ToastVariant, string> = {
  default: "bg-card border-border",
  success: "bg-card border-emerald-500/50",
  error: "bg-card border-red-500/50",
  warning: "bg-card border-amber-500/50",
  info: "bg-card border-blue-500/50",
  loading: "bg-card border-blue-500/50",
};

const iconColors: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-emerald-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
  loading: "text-blue-500",
};

const titleColors: Record<ToastVariant, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  error: "text-red-600 dark:text-red-400",
  warning: "text-amber-600 dark:text-amber-400",
  info: "text-blue-600 dark:text-blue-400",
  loading: "text-blue-600 dark:text-blue-400",
};

const defaultIcons: Record<ToastVariant, React.ReactNode> = {
  default: <Info className="h-5 w-5" />,
  success: <CheckCircle className="h-5 w-5" />,
  error: <AlertCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
  loading: <Loader2 className="h-5 w-5 animate-spin" />,
};

function Toast({ id, title, description, variant = "default", icon, onDismiss }: ToastProps) {
  const displayIcon = icon || defaultIcons[variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative flex w-full max-w-md items-start gap-3 rounded-xl border-2 p-4 shadow-lg backdrop-blur-sm",
        variantStyles[variant]
      )}
    >
      <div className={cn("mt-0.5 flex-shrink-0", iconColors[variant])}>
        {displayIcon}
      </div>

      <div className="flex-1 space-y-1 min-w-0">
        {title && (
          <h3 className={cn("text-sm font-semibold leading-none", titleColors[variant])}>
            {title}
          </h3>
        )}
        <div className="text-sm text-muted-foreground leading-relaxed break-words">
          {description}
        </div>
      </div>

      {variant !== "loading" && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-full p-1 hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Bildirimi kapat"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Loading toast'lar otomatik kapanmaz
    if (toast.variant !== "loading") {
      const duration = toast.duration || 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const updateToast = React.useCallback((id: string, updates: Partial<Omit<ToastProps, "id">>) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, ...updates } : toast
      )
    );

    // Eğer loading'den başka bir variant'a güncellendiyse, otomatik kapat
    if (updates.variant && updates.variant !== "loading") {
      const duration = updates.duration || 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast
                {...toast}
                onDismiss={() => {
                  removeToast(toast.id);
                  toast.onDismiss?.();
                }}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Sonner API uyumlu global toast fonksiyonu
let globalAddToast: ((toast: Omit<ToastProps, "id">) => string) | null = null;
let globalRemoveToast: ((id: string) => void) | null = null;
let globalUpdateToast: ((id: string, toast: Partial<Omit<ToastProps, "id">>) => void) | null = null;

export function ToastProviderWithGlobal({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastProps[]>([]);

  const addToast = React.useCallback((toast: Omit<ToastProps, "id"> & { id?: string }) => {
    const id = toast.id || Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };

    setToasts((prev) => {
      // Aynı ID varsa güncelle, yoksa ekle
      const exists = prev.some((t) => t.id === id);
      if (exists) {
        return prev.map((t) => (t.id === id ? newToast : t));
      }
      return [...prev, newToast];
    });

    if (toast.variant !== "loading") {
      const duration = toast.duration || 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const updateToast = React.useCallback((id: string, updates: Partial<Omit<ToastProps, "id">>) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, ...updates } : toast
      )
    );

    if (updates.variant && updates.variant !== "loading") {
      const duration = updates.duration || 4000;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  React.useEffect(() => {
    globalAddToast = addToast;
    globalRemoveToast = removeToast;
    globalUpdateToast = updateToast;
    return () => {
      globalAddToast = null;
      globalRemoveToast = null;
      globalUpdateToast = null;
    };
  }, [addToast, removeToast, updateToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, updateToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <Toast
                {...toast}
                onDismiss={() => {
                  removeToast(toast.id);
                  toast.onDismiss?.();
                }}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Sonner uyumlu API - JSX, string ve obje formatlarini destekler
type ToastMessage = string | React.ReactNode | { title?: string; description?: string };
type ToastOptions = { duration?: number; id?: string; description?: string };

function normalizeMessage(message: ToastMessage, options?: ToastOptions): { title?: string; description: string | React.ReactNode } {
  // Options'da description varsa, message title olur
  if (options?.description) {
    return {
      title: typeof message === "string" ? message : undefined,
      description: options.description,
    };
  }

  // String ise dogrudan description
  if (typeof message === "string") {
    return { description: message };
  }

  // Obje ise { title, description } formati
  if (message && typeof message === "object" && "description" in message) {
    const obj = message as { title?: string; description?: string };
    return {
      title: obj.title,
      description: obj.description || "",
    };
  }

  // JSX element ise description olarak kullan
  return { description: message as React.ReactNode };
}

// ID ile toast ekleme/guncelleme icin map
const toastTimeouts = new Map<string, NodeJS.Timeout>();
const activeToastIds = new Set<string>();

function addToastWithId(
  toastData: Omit<ToastProps, "id">,
  customId?: string
): string {
  if (!globalAddToast) return "";

  // Custom ID varsa
  if (customId) {
    // Onceki timeout'u temizle
    const existingTimeout = toastTimeouts.get(customId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      toastTimeouts.delete(customId);
    }

    // Toast zaten varsa guncelle, yoksa ekle
    if (activeToastIds.has(customId) && globalUpdateToast) {
      globalUpdateToast(customId, toastData);
    } else {
      // Yeni toast ekle (custom ID ile)
      const newToast = { ...toastData, id: customId };
      globalAddToast(newToast as Omit<ToastProps, "id">);
      activeToastIds.add(customId);
    }

    // Yeni timeout ayarla
    if (toastData.variant !== "loading") {
      const duration = toastData.duration || 4000;
      const timeout = setTimeout(() => {
        globalRemoveToast?.(customId);
        toastTimeouts.delete(customId);
        activeToastIds.delete(customId);
      }, duration);
      toastTimeouts.set(customId, timeout);
    }

    return customId;
  }

  return globalAddToast(toastData);
}

export const toast = Object.assign(
  (message: ToastMessage, options?: ToastOptions) => {
    if (!globalAddToast) return "";
    const { title, description } = normalizeMessage(message, options);
    return addToastWithId(
      { title, description: description as string, variant: "default", duration: options?.duration },
      options?.id
    );
  },
  {
    success: (message: ToastMessage, options?: ToastOptions) => {
      if (!globalAddToast) return "";
      const { title, description } = normalizeMessage(message, options);
      return addToastWithId({
        title: title || (typeof description === "string" && description.length < 50 ? undefined : "Basarili"),
        description: description as string,
        variant: "success",
        duration: options?.duration
      }, options?.id);
    },
    error: (message: ToastMessage, options?: ToastOptions) => {
      if (!globalAddToast) return "";
      const { title, description } = normalizeMessage(message, options);
      return addToastWithId({
        title: title || (typeof description === "string" && description.length < 50 ? undefined : "Hata"),
        description: description as string,
        variant: "error",
        duration: options?.duration
      }, options?.id);
    },
    warning: (message: ToastMessage, options?: ToastOptions) => {
      if (!globalAddToast) return "";
      const { title, description } = normalizeMessage(message, options);
      return addToastWithId({
        title: title || (typeof description === "string" && description.length < 50 ? undefined : "Uyari"),
        description: description as string,
        variant: "warning",
        duration: options?.duration
      }, options?.id);
    },
    info: (message: ToastMessage, options?: ToastOptions) => {
      if (!globalAddToast) return "";
      const { title, description } = normalizeMessage(message, options);
      return addToastWithId({
        title: title || (typeof description === "string" && description.length < 50 ? undefined : "Bilgi"),
        description: description as string,
        variant: "info",
        duration: options?.duration
      }, options?.id);
    },
    loading: (message: ToastMessage, options?: { id?: string }) => {
      if (!globalAddToast) return "";
      const { title, description } = normalizeMessage(message);
      return addToastWithId({
        title: title || (typeof description === "string" && description.length < 50 ? undefined : "Yukleniyor"),
        description: description as string,
        variant: "loading"
      }, options?.id);
    },
    dismiss: (id?: string) => {
      if (!globalRemoveToast || !id) return;
      const timeout = toastTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        toastTimeouts.delete(id);
      }
      activeToastIds.delete(id);
      globalRemoveToast(id);
    },
    promise: async <T,>(
      promise: Promise<T>,
      options: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((err: unknown) => string);
      }
    ): Promise<T> => {
      const id = toast.loading(options.loading);
      try {
        const result = await promise;
        if (globalUpdateToast && id) {
          const successMsg = typeof options.success === "function"
            ? options.success(result)
            : options.success;
          globalUpdateToast(id, {
            title: "Basarili",
            description: successMsg,
            variant: "success"
          });
        }
        return result;
      } catch (err) {
        if (globalUpdateToast && id) {
          const errorMsg = typeof options.error === "function"
            ? options.error(err)
            : options.error;
          globalUpdateToast(id, {
            title: "Hata",
            description: errorMsg,
            variant: "error"
          });
        }
        throw err;
      }
    },
  }
);

export { Toast };
export type { ToastProps, ToastVariant };
