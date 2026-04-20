import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SessionUserProvider } from "@/lib/session";
import { useSessionUser } from "@/lib/session";
import { NotificationStateProvider } from "@/lib/nstate";
import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { endpoints } from "@/lib/config";
import { useActivityTracker } from "@/lib/activity";
import { GlobalBanner } from "@/components/ui/banner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const Home = lazy(() => import("@/pages/home"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const ResetPassword = lazy(() => import("@/pages/reset"));
const CreatePost = lazy(() => import("@/pages/create"));
const PostDetail = lazy(() => import("@/pages/posts"));
const AnonymousFeed = lazy(() => import("@/pages/anonymous"));
const AnonymousPostDetail = lazy(() => import("@/pages/ap"));
const Chat = lazy(() => import("@/pages/chat"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const TermsPage = lazy(() => import("@/pages/terms"));
const PrivacyPage = lazy(() => import("@/pages/privacy"));

function PresenceHeartbeat() {
  const { user } = useSessionUser();

  useEffect(() => {
    if (!user) return;

    const signalOffline = () => {
      const url = endpoints.presenceOffline;
      try {
        void fetch(url, {
          method: "POST",
          credentials: "include",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "pagehide" }),
        });
      } catch {
      }
      try {
        navigator.sendBeacon(url, JSON.stringify({ reason: "pagehide" }));
      } catch {
      }
    };

    const beat = () => {
      api.heartbeatPresence().catch((error) => {
        console.error("Presence heartbeat failed:", error);
      });
    };

    beat();
    const intervalId = window.setInterval(beat, 25000);
    const onFocus = () => beat();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") beat();
    };
    const onPageHide = () => signalOffline();
    const onBeforeUnload = () => signalOffline();

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [user]);

  return null;
}

function ActivityHeartbeat() {
  const { user } = useSessionUser();
  useActivityTracker(Boolean(user));
  return null;
}

function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  const isStandalone = useCallback(() => {
    const displayModeStandalone =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = typeof navigator !== "undefined" && "standalone" in navigator && (navigator as any).standalone;
    return Boolean(displayModeStandalone || iosStandalone);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isStandalone]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setVisible(false);
  };

  if (!visible || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[120] max-w-xs rounded-xl border border-violet-500/30 bg-black/90 p-3 shadow-xl backdrop-blur-sm">
      <p className="text-sm text-white">Install Guffi for faster access and app-like usage.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleInstall}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <SessionUserProvider>
      <NotificationStateProvider>
        <PresenceHeartbeat />
        <GlobalBanner />
        <BrowserRouter>
          <ActivityHeartbeat />
          <PwaInstallPrompt />
          <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/reset" element={<ResetPassword />} />
              <Route path="/create" element={<CreatePost />} />
              <Route path="/a" element={<AnonymousFeed />} />
              <Route path="/p/:postId" element={<PostDetail />} />
              <Route path="/p/:postId/c/:commentId" element={<PostDetail />} />
              <Route path="/p/:postId/c/:commentId/r/:replyId" element={<PostDetail />} />
              <Route path="/a/:postId" element={<AnonymousPostDetail />} />
              <Route path="/a/:postId/c/:commentId" element={<AnonymousPostDetail />} />
              <Route path="/a/:postId/c/:commentId/r/:replyId" element={<AnonymousPostDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/:username" element={<ProfilePage />} />
              <Route path="/n" element={<NotificationsPage />} />
              <Route path="/n/:id" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </NotificationStateProvider>
    </SessionUserProvider>
  );
}
