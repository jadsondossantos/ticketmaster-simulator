import { useEffect, useState } from "react";

type ToastState = { message: string; detail?: string } | null;

let pushToast: ((t: ToastState) => void) | null = null;

export function toast(message: string, detail?: string) {
  pushToast?.({ message, detail });
}

export function ToastHost() {
  const [t, setT] = useState<ToastState>(null);

  useEffect(() => {
    pushToast = setT;
    return () => {
      pushToast = null;
    };
  }, []);

  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(() => setT(null), 3200);
    return () => window.clearTimeout(id);
  }, [t]);

  if (!t) return null;

  return (
    <div className="toast show">
      {t.message}
      {t.detail ? <div className="muted">{t.detail}</div> : null}
    </div>
  );
}

