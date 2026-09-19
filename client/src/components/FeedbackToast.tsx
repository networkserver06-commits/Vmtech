import { useEffect } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";

type ToastTone = "success" | "error" | "info" | "warning";

type FeedbackToastProps = {
  message: string;
  tone?: ToastTone;
  onDismiss: () => void;
  duration?: number;
};

export default function FeedbackToast({ message, tone = "success", onDismiss, duration = 5600 }: FeedbackToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(timer);
  }, [message, duration, onDismiss]);
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : CircleAlert;
  return <div className={`feedback-toast feedback-toast-${tone}`} role={tone === "error" ? "alert" : "status"} aria-live={tone === "error" ? "assertive" : "polite"}><Icon size={18} aria-hidden="true" /><span className="feedback-toast-message">{message}</span><button type="button" className="feedback-toast-close" onClick={onDismiss} aria-label="Dismiss notification"><X size={16} /></button><span className="feedback-toast-progress" aria-hidden="true" /></div>;
}
