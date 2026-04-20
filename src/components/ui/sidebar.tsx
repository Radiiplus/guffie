/**
* Sidebar Component
* Permanent navigation bar with fixed width and compact icon sizing.
* UPDATED: Conditional rendering based on session state.
*/
"use client";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Bell,
  Settings,
  LogIn,
  Plus,
  Sparkles,
  MessageCircle,
  VenetianMask,
} from "lucide-react";
import { useSessionUser } from "@/lib/session";
import { useNotificationState } from "@/lib/nstate";
import { api } from "@/lib/api";
import { resolveImageUrl } from "@/lib/config";
import { Avatar, AvatarImage } from "./avatar";
import { InitialsAvatarFallback } from "./initials";

const navItems = [
  { key: "home", icon: Sparkles, label: "Home", path: "/" },
  { key: "anonymous", icon: VenetianMask, label: "Anonymous", path: "/a" },
  { key: "notifications", icon: Bell, label: "Notifications", path: "/n" },
  { key: "chat", icon: MessageCircle, label: "Chat", path: "/chat" },
  { key: "settings", icon: Settings, label: "Settings", path: "/settings" },
];

const responsiveIconClass = "h-4 w-4 sm:h-5 sm:w-5 shrink-0";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useSessionUser();
  const { unreadCount, setUnreadCountFromServer } = useNotificationState();
  const [chatBadge, setChatBadge] = useState(0);
  const handleLoginRedirect = () => {
    navigate("/login");
  };

  // While loading session, we can show a neutral state or just the logo
  // Once loaded, we decide what to show in the footer and create button
  
  const isAuthenticated = !!user;
  const visibleNavItems = navItems.filter((item) => {
    if (!isAuthenticated && item.key === "notifications") return false;
    return true;
  });

  useEffect(() => {
    if (!user) {
      setUnreadCountFromServer(0);
      setChatBadge(0);
      return;
    }

    const refreshBadgeCounts = async () => {
      try {
        const [notificationUnreadCount, chatUnreadCount] = await Promise.all([
          api.getUnreadNotificationCount(),
          api.getChatUnreadCount(),
        ]);

        setUnreadCountFromServer(Math.max(0, notificationUnreadCount));
        setChatBadge(Math.max(0, chatUnreadCount));
      } catch (error) {
        console.error("Sidebar badge refresh failed:", error);
      }
    };

    refreshBadgeCounts();
    const unsubNotificationCreated = api.subscribeToNotificationCreated(() => {
      void refreshBadgeCounts();
    });
    const unsubNotificationUnread = api.subscribeToNotificationUnreadCount((count) => {
      setUnreadCountFromServer(Math.max(0, count));
    });
    const unsubChatUnreadSignal = api.subscribeToChatUnreadSignal(() => {
      void api.getChatUnreadCount()
        .then((count) => setChatBadge(Math.max(0, count)))
        .catch((error) => console.error("Failed to refresh chat badge:", error));
    });
    const interval = window.setInterval(refreshBadgeCounts, 60000);
    return () => {
      window.clearInterval(interval);
      unsubNotificationCreated();
      unsubNotificationUnread();
      unsubChatUnreadSignal();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    if (location.pathname.startsWith("/chat")) {
      api.markChatAsRead()
        .then(() => setChatBadge(0))
        .catch((error) => console.error("Failed to mark chat as read:", error));
    }
  }, [location.pathname, user]);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-14 flex-col border-r border-violet-500/20 bg-transparent">
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap");
        .font-great-vibes { font-family: "Great Vibes", cursive; font-weight: 400; }
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-gradient { animation: gradient 8s ease infinite; }
      `}</style>

      {/* Logo Area */}
      <div className="min-h-[4rem] overflow-visible flex items-center justify-center">
        <Link to="/" className="relative inline-flex items-center justify-center overflow-visible">
          <div className="relative group cursor-pointer overflow-visible">
            <div className="absolute -inset-2 rounded-xl bg-violet-600/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative flex items-center justify-center overflow-visible bg-transparent">
              <span className="font-great-vibes text-[2.1rem] p-2 text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:100%_auto] animate-gradient select-none">
                G
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-2 space-y-2 overflow-hidden">
        {visibleNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount =
            item.key === "notifications" ? unreadCount :
            item.key === "chat" ? chatBadge :
            0;
          return (
            <Link key={item.path} to={item.path} className="block w-full">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`group relative flex w-full items-center justify-center rounded-xl p-2.5 sm:p-2.5 transition-all duration-200 ${
                  isActive
                    ? "bg-violet-500/10 text-violet-400 shadow-[0_0_15px_-5px_rgba(139,92,246,0.3)] border border-violet-500/20"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent"
                }`}
                title={item.label}
              >
                <item.icon
                  className={`${responsiveIconClass} transition-colors ${
                    isActive ? "stroke-[2.5px]" : "group-hover:text-zinc-200"
                  }`}
                />
                {badgeCount > 0 && !isActive && (
                  <span className="absolute -top-1 mt-1.5 mr-0.5 -right-0 min-w-[16px] h-4 px-0.4 rounded-full bg-violet-500 text-[10px] leading-4 text-white font-semibold text-center shadow-[0_0_10px_rgba(139,92,246,0.55)]">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </motion.button>
            </Link>
          );
        })}
      </nav>

      {/* Create Post Button - ONLY visible if authenticated */}
      {isAuthenticated && (
        <div className="px-2 pb-2">
          <Link to="/create" className="block w-full">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-center rounded-lg border border-zinc-800/40 px-2.5 py-2.5 sm:px-4 sm:py-2.5 text-sm font-semibold text-white shadow-[0_0_8px_-4px_rgba(139,92,246,0.25)] transition-all hover:border-violet-500/50 hover:bg-violet-500/10"
              title="Create Post"
            >
              <Plus className={responsiveIconClass} />
            </motion.button>
          </Link>
        </div>
      )}

      {/* Footer Action: Conditional Render */}
      <div className="border-t border-zinc-800/50 p-3">
        {loading ? (
           // Optional: Show a small spinner or placeholder while checking session
           <div className="rounded-xl flex items-center justify-center w-full">
             <div className="w-4 h-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
           </div>
        ) : isAuthenticated ? (
          // Authenticated: Show User Avatar
          <Link to={`/${user.username}`} className="block w-full">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center"
              title="View Profile"
            >
                <Avatar className="h-8 w-8 border border-violet-500/20 bg-transparent after:border-transparent">
                <AvatarImage src={resolveImageUrl(user.avatarUrl)} alt={user.username} />
                <InitialsAvatarFallback 
                  className="bg-transparent text-[1rem]" 
                  initials={user.initials || "U"} 
                />
              </Avatar>
            </motion.button>
          </Link>
        ) : (
          // Not Authenticated: Show Login Icon
          <button
            onClick={handleLoginRedirect}
            className="rounded-xl p-2 sm:p-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors w-full flex items-center justify-center"
            title="Login"
          >
            <LogIn className={responsiveIconClass} />
          </button>
        )}
      </div>
    </aside>
  );
}
