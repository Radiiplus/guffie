/**
 * Chat Page Component
 * Real-time global chat using GraphQL subscriptions with Redis-only storage.
 * Features: Virtual scrolling, optimistic likes, @mention highlighting, reply previews.
 */
"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Send, Heart, CornerUpLeft, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Components
import { Sidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { Button } from "@/components/ui/button";

// API & Hooks
import { api, type ChatMessage as APIChatMessage } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { resolveImageUrl } from "@/lib/config";
import { formatRelativeTime } from "@/lib/utils/format";

// --- Types ---
interface ChatMessage extends APIChatMessage {
  // Extended for UI state
  isOptimistic?: boolean;
  isPending?: boolean;
}

interface ReplyPreview {
  messageId: string;
  username: string;
  content: string;
}

// --- Constants ---
const INITIAL_CHAT_BATCH = 10;
const CHAT_LIKE_COOLDOWN = 400;
const CHAT_WS_ESCAPE_SEQ = "\u001F";
const CHAT_NL_ESCAPE_SEQ = "\u001E";
const LEGACY_WS_ESCAPE_SEQ = "â£";

// --- Helper Functions ---
const escapeHTML = (str: string): string => {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
};

const highlightMentions = (
  content: string,
  currentUser: { username: string } | null
): string => {
  const escaped = escapeHTML(content);
  if (!currentUser) {
    return escaped.replace(
      /@(\w+)/g,
      '<span class="text-violet-400 font-medium">$1</span>'
    );
  }
  const selfUsername = currentUser.username.toLowerCase();
  return escaped.replace(/@(\w+)/g, (_match, username) => {
    if (username.toLowerCase() === selfUsername) {
      return `<span class="text-amber-400 font-semibold bg-amber-400/10 px-1 rounded">${username}</span>`;
    }
    return `<span class="text-violet-400 font-medium">${username}</span>`;
  });
};

const decodeChatEscapes = (value: string): string => {
  if (!value) return "";
  return value
    .split(CHAT_NL_ESCAPE_SEQ).join("\n")
    .split(CHAT_WS_ESCAPE_SEQ).join(" ")
    .split(LEGACY_WS_ESCAPE_SEQ).join(" ");
};

const decodeChatMessage = <T extends ChatMessage | APIChatMessage>(message: T): T => {
  const reply = message.replyTo
    ? { ...message.replyTo, content: decodeChatEscapes(message.replyTo.content) }
    : message.replyTo;
  return {
    ...message,
    content: decodeChatEscapes(message.content),
    replyTo: reply,
  };
};

const resolveAvatarSrc = (value?: string | null): string | undefined => resolveImageUrl(value);

const dedupeMessagesById = (messages: ChatMessage[]): ChatMessage[] => {
  const byId = new Map<string, ChatMessage>();
  for (const msg of messages) {
    const existing = byId.get(msg.id);
    if (!existing) {
      byId.set(msg.id, msg);
      continue;
    }
    // Prefer server-confirmed message over optimistic duplicate.
    if (existing.isOptimistic && !msg.isOptimistic) {
      byId.set(msg.id, msg);
    }
  }
  return Array.from(byId.values());
};

// --- Chat Message Card Component ---
function ChatMessageCard({
  msg,
  currentUser,
  onLike,
  onReply,
  onUserClick,
  isLiked,
}: {
  msg: ChatMessage;
  currentUser: { username: string; fullName: string; initials: string; avatarUrl: string | null } | null;
  onLike: (id: string) => void;
  onReply: (id: string, username: string, content: string) => void;
  onUserClick: (username: string) => void;
  isLiked: boolean;
}) {
  const isReplyToMe = currentUser && msg.author.username === currentUser.username;
  const hasReply = msg.replyTo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="chat-card py-2 border-b border-white/[0.04] animate-fade-in"
      data-message-id={msg.id}
    >
      <div className="flex gap-2 items-center min-w-0">
        {/* Avatar */}
        <div className="flex-shrink-0 self-center">
          <button
            onClick={() => onUserClick(msg.author.username)}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Avatar className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-transparent border border-violet-500/20">
              <AvatarImage src={resolveAvatarSrc(msg.author.avatarUrl)} alt={msg.author.fullName} />
              <InitialsAvatarFallback
                className="bg-transparent text-[1rem] leading-none"
                initials={msg.author.initials}
              />
            </Avatar>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between mb-1 min-w-0">
            <div className="min-w-0">
              <button
                onClick={() => onUserClick(msg.author.username)}
                className="block text-[10px] font-medium text-gray-500 truncate tracking-wide hover:underline cursor-pointer text-left"
              >
                @{msg.author.username}
              </button>
            </div>
            <span className="text-[10px] text-gray-600 ml-2 flex-shrink-0">
              {formatRelativeTime(msg.timestamp)}
            </span>
          </div>

          {/* Reply Preview */}
          {hasReply && (
            <div className={`mb-2 flex items-center gap-2 bg-white/[0.03] border ${
              isReplyToMe ? "border-violet-400/30 bg-violet-400/[0.05]" : "border-white/[0.08]"
            } rounded-lg px-2.5 py-2`}>
              <div className={`w-0.5 h-5 ${isReplyToMe ? "bg-fuchsia-400" : "bg-violet-400"} rounded-full flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className={`text-[10px] font-medium ${isReplyToMe ? "text-fuchsia-400" : "text-violet-400"} truncate`}>
                  {isReplyToMe ? "You" : (
                    <button
                      onClick={() => onUserClick(msg.replyTo!.username)}
                      className="hover:underline"
                    >
                      @{msg.replyTo!.username}
                    </button>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  {escapeHTML(msg.replyTo!.content)}
                </div>
              </div>
            </div>
          )}

          {/* Message Bubble */}
          <div className="max-w-full rounded-xl overflow-hidden">
            <div className="bg-white/[0.03] rounded-lg px-2 py-2">
              <p
                className="text-sm text-gray-400 leading-relaxed break-words"
                style={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}
                dangerouslySetInnerHTML={{
                  __html: highlightMentions(msg.content, currentUser),
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 mt-1.5">
            <button
              onClick={() => onLike(msg.id)}
              disabled={!currentUser}
              className={`flex items-center gap-1 text-[10px] transition-colors flex-shrink-0 ${
                isLiked
                  ? "text-pink-400"
                  : "text-gray-600 hover:text-gray-400"
              } ${!currentUser ? "cursor-not-allowed opacity-50" : ""}`}
              title={!currentUser ? "Login to like" : undefined}
            >
              <Heart className="w-3 h-3" fill={isLiked ? "currentColor" : "none"} />
              <span className="like-count">{msg.likesCount ?? 0}</span>
            </button>
            <button
              onClick={() => onReply(msg.id, msg.author.username, msg.content)}
              disabled={!currentUser}
              className={`flex items-center gap-1 text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex-shrink-0 ${
                !currentUser ? "cursor-not-allowed opacity-50" : ""
              }`}
              title={!currentUser ? "Login to reply" : undefined}
            >
              <CornerUpLeft className="w-3 h-3" />
              <span>Reply</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ChatMessageShadow() {
  return (
    <div className="chat-card py-2 border-b border-white/[0.04] animate-pulse">
      <div className="flex gap-3 items-center min-w-0">
        <div className="w-7 h-7 rounded-full bg-zinc-800 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2 min-w-0">
            <div className="h-2.5 w-20 rounded bg-zinc-800" />
            <div className="h-2.5 w-12 rounded bg-zinc-800 ml-2" />
          </div>
          <div className="rounded-lg bg-white/[0.03] px-2 py-2 space-y-1.5">
            <div className="h-3 w-full rounded bg-zinc-800" />
            <div className="h-3 w-5/6 rounded bg-zinc-800" />
          </div>
          <div className="flex items-center justify-end gap-3 mt-2">
            <div className="h-2.5 w-8 rounded bg-zinc-800" />
            <div className="h-2.5 w-10 rounded bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Chat Page ---
export default function Chat() {
  const navigate = useNavigate();
  const { user } = useSessionUser();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyPreview | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [likeCooldowns, setLikeCooldowns] = useState<Map<string, number>>(new Map());
  const [likePending, setLikePending] = useState<Set<string>>(new Set());

  // Derived
  const currentUser = user
    ? { username: user.username, fullName: user.fullName, initials: user.initials, avatarUrl: user.avatarUrl ?? null }
    : null;

  const adjustChatTextareaHeight = useCallback(() => {
    const textarea = chatTextareaRef.current;
    if (!textarea) return;
    const maxHeight = 120;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    adjustChatTextareaHeight();
  }, [inputValue, adjustChatTextareaHeight]);

  // Fetch initial messages
  const fetchMessages = useCallback(async (currentOffset: number, append = false) => {
    try {
      setLoading(true);
      const result = await api.getChatMessages(currentOffset, INITIAL_CHAT_BATCH);

      setMessages((prev) => {
        const newMsgs = result.messages.map((m) => ({ ...decodeChatMessage(m), isOptimistic: false }));
        if (!append) return dedupeMessagesById([...newMsgs].reverse());
        // Prepend older messages and normalize duplicates.
        const olderChunk: ChatMessage[] = [...newMsgs].reverse();
        return dedupeMessagesById([...olderChunk, ...prev]);
      });

      setHasMore(result.hasMore);
      setOffset(result.nextOffset ?? currentOffset + INITIAL_CHAT_BATCH);
    } catch (error) {
      console.error("Failed to fetch chat messages:", error);
    } finally {
      setLoading(false);
      setConnectionStatus("connected");
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMessages(0, false).finally(() => {
      requestAnimationFrame(() => {
        scrollToBottom("auto");
      });
    });
  }, [fetchMessages, scrollToBottom]);

  useEffect(() => {
    if (!currentUser) return;
    api.markChatAsRead().catch((error) =>
      console.error("Failed to mark chat as read on open:", error)
    );
  }, [currentUser]);

  useEffect(() => {
    setConnectionStatus((prev) => (prev === "connected" ? prev : "connecting"));
    const unsubscribe = api.subscribeToChatMessages((incoming) => {
      const newMessage: ChatMessage = {
        ...decodeChatMessage(incoming),
        isOptimistic: false,
      };

      setMessages((prev) => {
        return dedupeMessagesById([...prev, newMessage]);
      });
      if (stickToBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom());
      }
      if (currentUser) {
        api.markChatAsRead().catch((error) =>
          console.error("Failed to mark chat as read on message:", error)
        );
      }
      setConnectionStatus("connected");
    });

    // Mark active subscription as connected even before the first incoming message.
    setConnectionStatus("connected");

    return () => {
      unsubscribe();
    };
  }, [scrollToBottom, currentUser]);

  // Virtual scroll: load older messages when near top
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const remaining = scrollHeight - scrollTop - clientHeight;
      stickToBottomRef.current = remaining < 120;
      if (scrollTop < 100 && !loading && hasMore) {
        fetchMessages(offset, true);
      }
    },
    [loading, hasMore, offset, fetchMessages]
  );

  // Send message
  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !currentUser || isSending) return;

    const content = inputValue.trim();
    setIsSending(true);

    try {
      // Optimistic add
      const tempId = `temp-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: tempId,
        author: {
          id: user!.username,
          fullName: user!.fullName,
          username: user!.username,
          avatarUrl: user!.avatarUrl ?? null,
          initials: user!.initials,
        },
        content,
        timestamp: new Date().toISOString(),
        likesCount: 0,
        userHasLiked: false,
        replyTo: replyTarget
          ? { messageId: replyTarget.messageId, username: replyTarget.username, content: replyTarget.content }
          : undefined,
        isOptimistic: true,
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      requestAnimationFrame(() => scrollToBottom());
      setInputValue("");
      setReplyTarget(null);

      // Actual send
      const result = await api.sendChatMessage(content, replyTarget?.messageId);

      // Replace optimistic with real message
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        const realMessage: ChatMessage = { ...decodeChatMessage(result), isOptimistic: false };
        return dedupeMessagesById([...withoutTemp, realMessage]);
      });
      await api.markChatAsRead();
    } catch (error) {
      console.error("Failed to send message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => !m.isOptimistic));
    } finally {
      setIsSending(false);
    }
  }, [inputValue, currentUser, isSending, replyTarget, user]);

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape" && replyTarget) {
        setReplyTarget(null);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [replyTarget, handleSend]
  );

  // Toggle like with cooldown
  const handleLike = useCallback(
    async (messageId: string) => {
      if (!currentUser) return;

      const now = Date.now();
      const lastClick = likeCooldowns.get(messageId) || 0;
      if (now - lastClick < CHAT_LIKE_COOLDOWN) return;
      if (likePending.has(messageId)) return;

      setLikeCooldowns((prev) => new Map(prev).set(messageId, now));
      setLikePending((prev) => new Set(prev).add(messageId));

      let targetBefore: ChatMessage | undefined;
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          targetBefore = m;
          const nextLiked = !m.userHasLiked;
          return {
            ...m,
            userHasLiked: nextLiked,
            likesCount: nextLiked ? m.likesCount + 1 : Math.max(0, m.likesCount - 1),
          };
        })
      );

      try {
        const nextValue = !(targetBefore?.userHasLiked ?? false);
        const result = await api.toggleChatMessageLike(messageId, nextValue);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, likesCount: result.likesCount, userHasLiked: result.userHasLiked }
              : m
          )
        );
      } catch (error) {
        console.error("Failed to toggle chat like:", error);
        if (targetBefore) {
          setMessages((prev) =>
            prev.map((m) => (m.id === messageId ? targetBefore! : m))
          );
        }
      } finally {
        setLikePending((prev) => {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        });
      }
    },
    [currentUser, likeCooldowns, likePending]
  );

  // Set reply target
  const handleReply = useCallback((messageId: string, username: string, content: string) => {
    if (!currentUser) return;
    setReplyTarget({ messageId, username, content });
    const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
    input?.focus();
  }, [currentUser]);

  const handleUserClick = useCallback(
    (username: string) => {
      if (!username || username.toLowerCase() === "anonymous") return;
      navigate(`/${username}`);
    },
    [navigate]
  );

  // Cancel reply
  const cancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  // Connection status display
  const connectionDot = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "bg-green-400";
      case "connecting":
        return "bg-yellow-400 animate-pulse";
      default:
        return "bg-red-400";
    }
  }, [connectionStatus]);

  const connectionLabel = useMemo(() => {
    if (connectionStatus === "connected") return "● Connected";
    if (connectionStatus === "disconnected") return "○ Disconnected";
    return "○ Connecting...";
  }, [connectionStatus]);

  // Render
  return (
    <div className="h-screen bg-black text-white overflow-hidden">
      <div className="flex h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
      <main className="ml-14 flex h-screen flex-1 flex-col overflow-hidden bg-black">
          {/* Header */}
          <header className="sticky top-0 z-10 border-b border-violet-500/20 bg-black/80 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => currentUser && handleUserClick(currentUser.username)}
                  className="hover:opacity-80 transition-opacity"
                >
                  <Avatar className="h-8 w-8 border border-violet-500/20 bg-transparent after:border-transparent">
                    <AvatarImage src={resolveAvatarSrc(currentUser?.avatarUrl)} alt={currentUser?.fullName ?? "User"} />
                    <InitialsAvatarFallback className="bg-transparent text-[1rem]" initials={currentUser?.initials ?? "GC"} />
                  </Avatar>
                </button>
                <div>
                  <h1 className="text-base font-semibold text-white">Global Chat</h1>
                  <p className="text-xs text-gray-400" id="chat-connection-status">
                    {connectionLabel}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.05]">
                  <div className={`w-2 h-2 rounded-full ${connectionDot}`} id="chat-online-dot" />
                  <span className="text-xs text-gray-400" id="chat-online-count">Real-time</span>
                </div>
              </div>
            </div>
          </header>

          {/* Messages Container */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-3 sm:px-6 lg:px-8 custom-scrollbar"
            onScroll={handleScroll}
          >
            <div className="masonry-chat max-w-3xl mx-auto" id="message-container">
              {loading && messages.length === 0 ? (
                <div className="py-4">
                  {[...Array(6)].map((_, i) => (
                    <ChatMessageShadow key={`chat-shadow-initial-${i}`} />
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                <>
                  {messages.map((msg) => {
                    const isLiked = msg.userHasLiked;

                    return (
                      <ChatMessageCard
                        key={msg.id}
                        msg={msg}
                        currentUser={currentUser}
                        onLike={handleLike}
                        onReply={handleReply}
                        onUserClick={handleUserClick}
                        isLiked={isLiked}
                      />
                    );
                  })}
                  {loading && hasMore && (
                    <div className="py-2">
                      {[...Array(2)].map((_, i) => (
                        <ChatMessageShadow key={`chat-shadow-more-${i}`} />
                      ))}
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Input Footer */}
          <div className="border-t border-violet-500/20 bg-black/95 backdrop-blur-sm px-2 sm:px-6 lg:px-4 flex justify-center py-2 z-20 flex-shrink-0">
            <div className="max-w-3xl w-full">
              {currentUser ? (
                <>
                  {/* Reply Preview */}
                  <AnimatePresence>
                    {replyTarget && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2 bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2 flex items-center gap-3 overflow-hidden"
                        id="reply-preview-bar"
                      >
                        <div className="w-0.5 h-8 bg-violet-400 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-medium text-violet-400 truncate">
                            <button
                              onClick={() => handleUserClick(replyTarget.username)}
                              className="hover:underline"
                            >
                              Replying to @{replyTarget.username}
                            </button>
                          </div>
                          <div className="text-[10px] text-gray-500 truncate">
                            {escapeHTML(replyTarget.content)}
                          </div>
                        </div>
                        <button
                          onClick={cancelReply}
                          className="flex-shrink-0 p-1 hover:bg-white/[0.08] rounded-lg transition-colors text-gray-400 hover:text-white"
                          title="Cancel reply"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Input */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={chatTextareaRef}
                        id="chat-input"
                        value={inputValue}
                        onChange={(e) => {
                          setInputValue(e.target.value);
                          adjustChatTextareaHeight();
                        }}
                        onKeyDown={handleKeyPress}
                        rows={2}
                        placeholder="Type a message..."
                        maxLength={500}
                        disabled={isSending}
                        className="w-full bg-white/[0.05] rounded-2xl px-4 py-2.5 pr-16 text-sm text-white placeholder-gray-500 focus:outline-none focus:bg-white/[0.08] transition-all resize-none overflow-hidden disabled:opacity-50"
                        style={{ maxHeight: "120px" }}
                      />
                      <div className="absolute right-3 bottom-2.5 text-xs text-gray-600 pointer-events-none">
                        <span id="char-count">{inputValue.length}</span>/500
                      </div>
                    </div>
                    <Button
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isSending}
                      className="w-10 h-10 rounded-full border border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.05] text-gray-400 hover:text-white transition-all duration-200 flex items-center justify-center flex-shrink-0 mb-1.5 disabled:opacity-50"
                      size="icon"
                      variant="ghost"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" style={{ marginLeft: "1px", marginTop: "1px" }} />
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-500 text-center py-2">Login to send messages</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

