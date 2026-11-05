import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: "", type: "success", visible: false });
  const timer = useRef(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type, visible: true });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(current => ({ ...current, visible: false })), 5200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        id="toast"
        className={"toast " + toast.type + (toast.visible ? "" : " hidden")}
        role="status"
        aria-live="polite"
      >
        {toast.message}
      </div>
    </ToastContext.Provider>
  );
}
