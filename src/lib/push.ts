import { config } from "./config";

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const pushClient = {
  isSupported: () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    window.isSecureContext,

  requestPermission: async () => {
    if (!pushClient.isSupported()) return "denied" as NotificationPermission;
    return Notification.requestPermission();
  },

  registerServiceWorker: async () => {
    if (!pushClient.isSupported()) return null;
    const existing = await navigator.serviceWorker.getRegistration("/");
    if (existing) return existing;
    return navigator.serviceWorker.register("/sw.js", { scope: "/" });
  },

  subscribe: async () => {
    if (!pushClient.isSupported()) {
      throw new Error("Push notifications require a secure context (HTTPS or localhost) and service worker support.");
    }
    if (!config.vapidPublicKey) throw new Error("Missing VAPID public key.");

    await pushClient.registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;
    if (!registration) throw new Error("Unable to activate service worker.");

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
      });
    }
    return subscription;
  },

  unsubscribe: async () => {
    if (!pushClient.isSupported()) return null;
    const registration = await navigator.serviceWorker.ready.catch(() => null);
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return null;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    return endpoint;
  },
};
