export type ToastType = "success" | "error" | "info";

export function showToast(message: string, type: ToastType = "info"): void {
  if (typeof window === "undefined") return;

  const id = "guffi-global-toast-container";
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement("div");
    container.id = id;
    container.style.position = "fixed";
    container.style.top = "16px";
    container.style.right = "16px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.pointerEvents = "auto";
  toast.style.padding = "10px 12px";
  toast.style.borderRadius = "10px";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "600";
  toast.style.color = "#fff";
  toast.style.backdropFilter = "blur(6px)";
  toast.style.border = "1px solid rgba(255,255,255,0.14)";
  toast.style.boxShadow = "0 8px 30px rgba(0,0,0,0.35)";
  toast.style.maxWidth = "320px";

  if (type === "success") {
    toast.style.background = "rgba(16, 185, 129, 0.22)";
  } else if (type === "error") {
    toast.style.background = "rgba(239, 68, 68, 0.22)";
  } else {
    toast.style.background = "rgba(59, 130, 246, 0.22)";
  }

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-4px)";
    toast.style.transition = "opacity 160ms ease, transform 160ms ease";
    window.setTimeout(() => {
      toast.remove();
      if (container && container.childElementCount === 0) {
        container.remove();
      }
    }, 180);
  }, 2200);
}
