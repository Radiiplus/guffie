"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Heart,
  MessageCircle,
  UserPlus,
  CornerUpRight,
  Shield,
  Wrench,
  Gift,
  Megaphone,
  X,
  CheckCheck,
} from "lucide-react";

// Components
import { Sidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { Button } from "@/components/ui/button";
import { api, type Notification as APINotification } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { useNotificationState } from "@/lib/nstate";
import { formatRelativeTime } from "@/lib/utils/format";

const notificationsApi = api as typeof api & {
  getNotificationContext: (
    postId?: string | null,
    cid?: string | null
  ) => Promise<{ kind: string; content: string }>;
};

// Types
type NotificationType = "like" | "comment" | "reply" | "follow" | "all";

interface NotificationCardProps {
  notif: APINotification;
  onClick: () => void;
  onMarkRead: (id: string) => void;
}

type NotificationAction = {
  label: string;
  path: string | null;
};

const getInitialsFromName = (name?: string | null): string => {
  const source = (name || "").trim();
  if (!source) return "U";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
};

const toSnippet = (text: string | null | undefined, max = 120): string | null => {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}...`;
};

function getNotificationAction(notif: APINotification): NotificationAction {
  if (notif.type === "follow" && notif.actorUsername) {
    return { label: "View Profile", path: `/${notif.actorUsername}` };
  }

  if (notif.postId && notif.cid) {
    const label = notif.type === "reply" ? "View Reply" : "View Comment";
    return { label, path: `/p/${notif.postId}/c/${notif.cid}` };
  }

  if (notif.postId) {
    return { label: "View Post", path: `/p/${notif.postId}` };
  }

  if (notif.actorUsername) {
    return { label: "View Profile", path: `/${notif.actorUsername}` };
  }

  return { label: "Close", path: null };
}

const getSystemVisual = (content: string) => {
  const text = content.toLowerCase();

  if (text.includes("welcome") || text.includes("on board")) {
    return { icon: Gift, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  }
  if (text.includes("security") || text.includes("password") || text.includes("suspicious")) {
    return { icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" };
  }
  if (text.includes("maintenance") || text.includes("downtime") || text.includes("service")) {
    return { icon: Wrench, color: "text-orange-400", bg: "bg-orange-500/10" };
  }
  if (text.includes("update") || text.includes("new feature") || text.includes("announcement")) {
    return { icon: Megaphone, color: "text-sky-400", bg: "bg-sky-500/10" };
  }
  return { icon: Bell, color: "text-gray-400", bg: "bg-gray-500/10" };
};

function NotificationCard({ notif, onClick, onMarkRead }: NotificationCardProps) {
  const navigate = useNavigate();
  const isSystem = notif.type === "system" || !notif.actorUsername;
  const action = useMemo(() => getNotificationAction(notif), [notif]);
  
  // Determine Icon and Color based on type
  const config = useMemo(() => {
    if (notif.type === "system") return getSystemVisual(notif.content);
    switch (notif.type) {
      case "like": return { icon: Heart, color: "text-pink-500", bg: "bg-pink-500/10" };
      case "comment": return { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" };
      case "reply": return { icon: CornerUpRight, color: "text-green-500", bg: "bg-green-500/10" };
      case "follow": return { icon: UserPlus, color: "text-violet-500", bg: "bg-violet-500/10" };
      default: return { icon: Bell, color: "text-gray-400", bg: "bg-gray-500/10" };
    }
  }, [notif.type, notif.content]);

  const Icon = config.icon;

  const handleUserClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!notif.actorUsername) return;
    navigate(`/${notif.actorUsername}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`group break-inside-avoid mb-4 rounded-xl border p-4 cursor-pointer transition-all duration-200
        ${!notif.read 
          ? "border-violet-500/30 bg-white/[0.03]" 
          : "border-zinc-800/50 bg-white/[0.01] hover:border-zinc-700"
        }`}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        {!isSystem && (
          <div className="flex-shrink-0 pt-1">
            <button onClick={handleUserClick} className="hover:opacity-80 transition-opacity">
                <Avatar size="lg" className="border border-violet-500/20 bg-transparent">
                <AvatarImage src={undefined} alt={notif.actorName ?? "User"} />
                <InitialsAvatarFallback
                  initials={getInitialsFromName(notif.actorName || notif.actorUsername || "U")}
                  className="bg-violet-500/20 bg-transparent text-[1rem] font-bold text-violet-300"
                />
              </Avatar>
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header: Actor & Time */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex flex-col">
              {isSystem ? (
                <span className="text-sm font-semibold text-white text-left truncate max-w-[200px]">System</span>
              ) : (
                <>
                  <button
                    onClick={handleUserClick}
                    className="text-sm font-semibold text-white hover:underline text-left truncate max-w-[200px]"
                  >
                    {notif.actorName ?? `@${notif.actorUsername}`}
                  </button>
                  <span className="text-xs text-zinc-500">@{notif.actorUsername}</span>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600">{formatRelativeTime(notif.timestamp)}</span>
              {notif.repeatCount > 1 && !notif.read && (
                <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
                  Rev x{notif.repeatCount}
                </span>
              )}
              {!notif.read && (
                <div className="w-2 h-2 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,0.6)]" />
              )}
            </div>
          </div>

          {/* Message Body */}
          <div className="flex items-start gap-2 mb-3">
            <div className={`mt-0.5 p-1.5 rounded-md ${config.bg}`}>
              <Icon className={`w-4 h-4 ${config.color}`} />
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed break-words">
              {notif.content}
            </p>
          </div>

          {/* Optional: Post/Image Preview */}
          {notif.postImage && (
            <div className="mt-2 rounded-lg overflow-hidden border border-zinc-800 relative group-hover:border-zinc-700 transition-colors">
              <img 
                src={notif.postImage} 
                alt="Post content" 
                className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
              />
              {notif.postTitle && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-3 py-1.5">
                  <p className="text-xs text-zinc-300 truncate">{notif.postTitle}</p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {action.path && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-zinc-400 hover:text-white hover:bg-white/5 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notif.id);
                  const path = action.path;
                  if (!path) return;
                  navigate(path);
                }}
              >
                {action.label}
                <CornerUpRight className="ml-1.5 w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function NotificationsPage() {
  const { id: notificationId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const {
    locallyReadIds,
    markAsReadLocal,
    markAllAsReadLocal,
    clearLocalRead,
    setUnreadCountFromServer,
  } = useNotificationState();
  
  const [filter, setFilter] = useState<NotificationType>("all");
  const [notifications, setNotifications] = useState<APINotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotif, setSelectedNotif] = useState<APINotification | null>(null);
  const [selectedContextSnippet, setSelectedContextSnippet] = useState<string | null>(null);
  const selectedIsSystem = !!selectedNotif && (selectedNotif.type === "system" || !selectedNotif.actorUsername);
  const selectedAction = useMemo(
    () => (selectedNotif ? getNotificationAction(selectedNotif) : null),
    [selectedNotif]
  );
  const selectedConfig = useMemo(() => {
    if (!selectedNotif) return null;
    if (selectedNotif.type === "system") return getSystemVisual(selectedNotif.content);
    switch (selectedNotif.type) {
      case "like": return { icon: Heart, color: "text-pink-500", bg: "bg-pink-500/10" };
      case "comment": return { icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-500/10" };
      case "reply": return { icon: CornerUpRight, color: "text-green-500", bg: "bg-green-500/10" };
      case "follow": return { icon: UserPlus, color: "text-violet-500", bg: "bg-violet-500/10" };
      default: return { icon: Bell, color: "text-gray-400", bg: "bg-gray-500/10" };
    }
  }, [selectedNotif]);

  const closeModal = () => {
    setSelectedNotif(null);
    navigate("/n", { replace: true });
  };

  const openNotificationTarget = (path: string | null) => {
    if (!path) return;
    setSelectedNotif(null);
    navigate(path);
  };

  const markNotificationLocallyAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setSelectedNotif((prev) => (prev && prev.id === id ? { ...prev, read: true } : prev));
    markAsReadLocal(id);
  };

  const markNotificationAsRead = async (id: string) => {
    markNotificationLocallyAsRead(id);
    try {
      await api.markNotificationAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  // Fetch Notifications (do not refetch on route-id changes to avoid stomping optimistic read state)
  useEffect(() => {
    const fetchNotifs = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const data = await api.getNotifications(user.username, 50, 0, false);
        const normalized = data.map((n) =>
          locallyReadIds.has(n.id) ? { ...n, read: true } : n
        );
        setNotifications(normalized);
        setUnreadCountFromServer(normalized.filter((n) => !n.read).length);
      } catch (error) {
        console.error("Failed to fetch notifications", error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifs();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = api.subscribeToNotificationCreated((incoming) => {
      if (!incoming.read) {
        clearLocalRead(incoming.id);
      }
      setNotifications((prev) => {
        const existingIndex = prev.findIndex((n) => n.id === incoming.id);
        if (existingIndex === -1) {
          return [incoming, ...prev];
        }
        const updated = [...prev];
        updated.splice(existingIndex, 1);
        return [incoming, ...updated];
      });
      if (notificationId === incoming.id) {
        setSelectedNotif(incoming);
      }
    });
    return () => unsubscribe();
  }, [user, notificationId]);

  useEffect(() => {
    if (!notificationId) {
      setSelectedNotif(null);
      setSelectedContextSnippet(null);
      return;
    }
    const target = notifications.find((n) => n.id === notificationId) || null;
    if (target) {
      setSelectedNotif(target);
    }
  }, [notificationId, notifications]);

  useEffect(() => {
    let cancelled = false;
    const hydrateContextSnippet = async () => {
      if (!selectedNotif?.postId && !selectedNotif?.cid) {
        setSelectedContextSnippet(null);
        return;
      }
      try {
        const context = await notificationsApi.getNotificationContext(
          selectedNotif?.postId ?? null,
          selectedNotif?.cid ?? null
        );
        if (cancelled) return;
        setSelectedContextSnippet(toSnippet(context?.content, 140));
      } catch {
        if (cancelled) return;
        setSelectedContextSnippet(null);
      }
    };
    void hydrateContextSnippet();
    return () => {
      cancelled = true;
    };
  }, [selectedNotif?.id, selectedNotif?.postId, selectedNotif?.cid]);

  // Handle Mark as Read when opening modal
  useEffect(() => {
    if (selectedNotif && !selectedNotif.read) {
      void markNotificationAsRead(selectedNotif.id);
    }
  }, [selectedNotif]);

  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = notifications.filter((n) => !n.read && !locallyReadIds.has(n.id)).length;

  const handleMarkAllRead = async () => {
    if (!user) return;
    await api.markAllNotificationsAsRead(user.username);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markAllAsReadLocal();
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar />
      
      <main className="flex-1 ml-14 lg:ml-14 min-h-screen bg-black flex flex-col relative min-h-0">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-violet-500/20 px-4 sm:px-6 py-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Notifications</h1>
              <p className="text-sm text-zinc-500 mt-1">
                {unreadCount > 0 
                  ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` 
                  : "You're all caught up!"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0}
                className="border-zinc-800 text-zinc-400 bg-transparent hover:text-white hover:bg-white/5"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="border-b border-violet-500/10 bg-black/50 backdrop-blur-sm px-4 sm:px-6 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto scrollbar-hide">
            {(["all", "like", "comment", "reply", "follow"] as NotificationType[]).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                  ${filter === type 
                    ? "bg-violet-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]" 
                    : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                  }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          {loading ? (
            <div className="max-w-5xl mx-auto columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="break-inside-avoid mb-4 rounded-xl border border-zinc-800/50 bg-white/[0.02] p-4 h-48 animate-pulse" />
              ))}
            </div>
          ) : filteredNotifications.length > 0 ? (
            <div className="max-w-5xl mx-auto columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {filteredNotifications.map((notif) => (
                <NotificationCard 
                  key={notif.id} 
                  notif={notif} 
                  onMarkRead={markNotificationAsRead}
                  onClick={() => {
                    void markNotificationAsRead(notif.id);
                    navigate(`/n/${notif.id}`);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="max-w-5xl mx-auto flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-zinc-600" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">No notifications</h3>
              <p className="text-sm text-zinc-500 max-w-xs">
                {filter !== "all" 
                  ? `No ${filter} notifications found.` 
                  : "When someone likes, comments, or follows you, they'll appear here."}
              </p>
            </div>
          )}
        </div>

        {/* Notification Detail Modal (Full Screen /n/:id) */}
        <AnimatePresence mode="wait">
          {selectedNotif && (
            <>
              <motion.div
                key={`notif-overlay-${selectedNotif.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeModal}
                className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                key={`notif-modal-${selectedNotif.id}`}
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-lg bg-zinc-950 border border-violet-500/20 rounded-3xl shadow-2xl pointer-events-auto overflow-hidden flex flex-col max-h-[90vh]"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/30 bg-zinc-900/50">
                    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Details </h3>
                    <button 
                      onClick={closeModal}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="space-y-3">
                      {/* Actor Info */}
                      <div className="flex items-center gap-3">
                        {!selectedIsSystem && (
                          <button
                            onClick={() => {
                              if (!selectedNotif.actorUsername) return;
                              openNotificationTarget(`/${selectedNotif.actorUsername}`);
                            }}
                            className="hover:opacity-80 transition-opacity"
                          >
                            <Avatar size="lg" className="border bg-transparent border-violet-500/20">
                              <InitialsAvatarFallback
                                initials={getInitialsFromName(selectedNotif.actorName || selectedNotif.actorUsername || "U")}
                                className="bg-violet-500/20 text-[1rem] bg-transparent text-violet-300"
                              />
                            </Avatar>
                          </button>
                        )}
                        <div>
                          {selectedIsSystem ? (
                            <h4 className="text-lg font-bold text-white">System</h4>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  if (!selectedNotif.actorUsername) return;
                                  openNotificationTarget(`/${selectedNotif.actorUsername}`);
                                }}
                                className="text-left text-lg font-bold text-white hover:underline"
                              >
                                {selectedNotif.actorName}
                              </button>
                              <button
                                onClick={() => {
                                  if (!selectedNotif.actorUsername) return;
                                  openNotificationTarget(`/${selectedNotif.actorUsername}`);
                                }}
                                className="block text-sm text-zinc-500 hover:underline"
                              >
                                @{selectedNotif.actorUsername}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Action Description */}
                      <div className="bg-white/[0.02] rounded-xl p-4">
                        {selectedNotif && selectedConfig && (
                          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-zinc-900/70 px-2.5 py-1">
                            <span className={`inline-flex items-center justify-center rounded-md p-1 ${selectedConfig.bg}`}>
                              <selectedConfig.icon className={`w-3.5 h-3.5 ${selectedConfig.color}`} />
                            </span>
                            <span className="text-xs font-medium text-zinc-300 capitalize">{selectedNotif.type}</span>
                          </div>
                        )}
                        <p className="text-zinc-300 leading-relaxed">{selectedNotif.content}</p>
                        {selectedNotif.repeatCount > 1 && (
                          <p className="mt-2 text-xs text-violet-300">
                            Rev {selectedNotif.repeatCount}
                          </p>
                        )}
                        <p className="text-xs text-zinc-600 mt-2">{formatRelativeTime(selectedNotif.timestamp)}</p>
                      </div>

                      {/* Context (Post/Comment) */}
                      {selectedNotif.postId && (
                        <div className="rounded-xl overflow-hidden bg-black">
                          {selectedNotif.postImage && (
                            <img src={selectedNotif.postImage} alt="Context" className="w-full h-48 object-cover opacity-80" />
                          )}
                          <div className="p-4 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-white">
                                {selectedNotif.cid ? "Comment Reply" : "Original Post"}
                              </p>
                              <p className="text-xs text-zinc-500 truncate max-w-[200px]">
                                {selectedContextSnippet || selectedNotif.postTitle || "Open related content"}
                              </p>
                            </div>
                            <Button 
                              variant="secondary" 
                              size="sm"
                              onClick={() => {
                                const action = getNotificationAction(selectedNotif);
                                openNotificationTarget(action.path);
                              }}
                            >
                              {selectedAction?.label ?? "Open"} <CornerUpRight className="ml-1 w-2 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Modal Footer
                  <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/30 flex justify-end">
                     <div className="w-full flex flex-col sm:flex-row gap-2 sm:justify-end">
                     {selectedAction?.path && (
                       <Button
                         variant="secondary"
                         className="w-full sm:w-auto"
                         onClick={() => {
                           openNotificationTarget(selectedAction?.path ?? null);
                         }}
                       >
                         {selectedAction.label}
                         <CornerUpRight className="ml-1.5 w-3.5 h-3.5" />
                       </Button>
                     )}
                     </div>
                  </div>
                   */}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
