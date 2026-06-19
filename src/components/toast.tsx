"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
};

type ToastInput = Omit<ToastItem, "id"> & {
  durationMs?: number;
};

type ToastContextValue = {
  pushToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete timersRef.current[id];
    }
  }, []);

  const pushToast = useCallback(
    ({ durationMs = 4500, ...toast }: ToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setToasts((current) => [...current, { id, ...toast }].slice(-3));
      timersRef.current[id] = setTimeout(() => {
        removeToast(id);
      }, durationMs);
    },
    [removeToast],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const value = useMemo(() => ({ pushToast }), [pushToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[80] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-[1.1rem] border px-4 py-3 shadow-[var(--shadow-strong)] backdrop-blur-xl",
              toast.tone === "success"
                ? "border-primary/22 bg-background/96 text-primary"
                : toast.tone === "error"
                  ? "border-destructive/24 bg-background/96 text-destructive"
                  : "border-primary/16 bg-background/96 text-muted-foreground",
            )}
            role="status"
            aria-live="polite"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-80">{toast.title}</div>
            <div className="mt-1 text-sm">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
