"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessageCircle, FlipVertical2, MoreHorizontal, Send, TextCursor, Trash, TriangleAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { LazyLoad } from "@/components/ui/lazy";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { api, type FeedPost, type Comment, type Reply } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { useEntityLikes } from "@/hooks/likes";
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils/format";
import { resolveImageUrl } from "@/lib/config";

type CommentVM = Comment & {
  replies?: Reply[];
  repliesLoaded?: boolean;
  repliesOffset?: number;
  hasMoreReplies?: boolean;
  loadingReplies?: boolean;
};
const loadChevronDownIcon = () =>
  import("lucide-react").then((module) => ({ default: module.ChevronDown }));
const loadChevronUpIcon = () =>
  import("lucide-react").then((module) => ({ default: module.ChevronUp }));

function AnonymousMaskIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 text-violet-300"
      aria-hidden="true"
    >
      <path d="M3 10c0-4 3.6-7 9-7s9 3 9 7-3.6 9-9 9-9-5-9-9Z" />
      <path d="M9 11.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
      <path d="M8.5 15.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2" />
    </svg>
  );
}

const resolveAvatarSrc = (value?: string | null): string | undefined => resolveImageUrl(value);
const postMutationsApi = api as typeof api & {
  editPost: (pid: string, content: string, images?: string[]) => Promise<FeedPost>;
  deletePost: (pid: string) => Promise<{ success: boolean; message: string }>;
  editComment: (cid: string, content: string) => Promise<Comment>;
  deleteComment: (cid: string) => Promise<{ success: boolean; message: string }>;
};

interface PostDetailProps {
  anonymousMode?: boolean;
}

export default function PostDetail({ anonymousMode = false }: PostDetailProps) {
  const { postId, commentId, replyId } = useParams();
  const navigate = useNavigate();
  const { user } = useSessionUser();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<CommentVM[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [hasMoreComments, setHasMoreComments] = useState(true);
  const [commentOffset, setCommentOffset] = useState(0);
  const [newCommentText, setNewCommentText] = useState("");
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [showCommentsPanel, setShowCommentsPanel] = useState(Boolean(commentId));

  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const openedAtRef = useRef<number>(Date.now());
  const commentLimit = 10;
  const replyLimit = 10;

  const adjustCommentTextareaHeight = () => {
    const textarea = commentTextareaRef.current;
    if (!textarea) return;
    const maxHeight = 120;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  const toInitials = (name: string) =>
    name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const scrollToComment = (cid: string) => {
    const el = document.getElementById(`comment-${cid}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-violet-500/10");
    setTimeout(() => el.classList.remove("bg-violet-500/10"), 1800);
  };

  const scrollToReply = (rid: string) => {
    const el = document.getElementById(`reply-${rid}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bg-violet-500/10");
    setTimeout(() => el.classList.remove("bg-violet-500/10"), 1800);
  };

  const handleUserClick = (username: string) => {
    if (!username || username.toLowerCase() === "anonymous") return;
    navigate(`/${username}`);
  };

  const fetchPost = async (id: string) => {
    setLoadingPost(true);
    try {
      const fetchedPost = await api.getPostById(id);
      setPost(fetchedPost);
    } catch (error) {
      console.error("Failed to fetch post", error);
      setPost(null);
    } finally {
      setLoadingPost(false);
    }
  };

  const fetchComments = async (id: string, offset: number, append = false) => {
    if (loadingComments) return;
    setLoadingComments(true);
    try {
      const result = await api.getComments(id, offset, commentLimit);
      setComments((prev) => {
        if (!append) {
          return result.comments.map((c) => ({
            ...c,
            replies: [],
            repliesLoaded: false,
            repliesOffset: 0,
            hasMoreReplies: c.repliesCount > 0,
            loadingReplies: false,
          }));
        }
        const existing = new Set(prev.map((c) => c.id));
        const next = result.comments
          .filter((c) => !existing.has(c.id))
          .map((c) => ({
            ...c,
            replies: [],
            repliesLoaded: false,
            repliesOffset: 0,
            hasMoreReplies: c.repliesCount > 0,
            loadingReplies: false,
          }));
        return [...prev, ...next];
      });
      setHasMoreComments(result.hasMore);
      setCommentOffset(result.nextOffset ?? offset + commentLimit);
    } catch (error) {
      console.error("Failed to fetch comments", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const fetchReplies = async (cid: string, offset: number, append = false) => {
    setComments((prev) =>
      prev.map((c) => (c.id === cid ? { ...c, loadingReplies: true } : c))
    );
    try {
      const result = await api.getReplies(cid, offset, replyLimit);
      setComments((prev) =>
        prev.map((c) => {
          if (c.id !== cid) return c;
          const existing = append ? c.replies || [] : [];
          const existingIds = new Set(existing.map((r) => r.id));
          const merged = [...existing, ...result.replies.filter((r) => !existingIds.has(r.id))];
          return {
            ...c,
            replies: merged,
            repliesLoaded: true,
            loadingReplies: false,
            hasMoreReplies: result.hasMore,
            repliesOffset: result.nextOffset ?? offset + replyLimit,
          };
        })
      );
    } catch (error) {
      console.error("Failed to fetch replies", error);
      setComments((prev) =>
        prev.map((c) => (c.id === cid ? { ...c, loadingReplies: false } : c))
      );
    }
  };

  const toggleReplies = (cid: string) => {
    setExpandedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) {
        next.delete(cid);
      } else {
        next.add(cid);
        const target = comments.find((c) => c.id === cid);
        if (target && !target.repliesLoaded) fetchReplies(cid, 0, false);
      }
      return next;
    });
  };

  const loadMoreReplies = (cid: string) => {
    const target = comments.find((c) => c.id === cid);
    if (!target || target.loadingReplies || !target.hasMoreReplies) return;
    fetchReplies(cid, target.repliesOffset ?? 0, true);
  };

  useEffect(() => {
    if (!postId) return;
    openedAtRef.current = Date.now();
    fetchPost(postId);
    fetchComments(postId, 0, false);
  }, [postId]);

  const handleBackdropClose = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (Date.now() - openedAtRef.current < 280) return;
    navigate(-1);
  };

  useEffect(() => {
    if (!commentId) return;
    setTimeout(() => scrollToComment(commentId), 120);
    setShowCommentsPanel(true);
  }, [commentId, comments.length]);

  useEffect(() => {
    if (!replyId || !commentId) return;
    setExpandedReplies((prev) => new Set(prev).add(commentId));
    fetchReplies(commentId, 0, false).finally(() => {
      setTimeout(() => scrollToReply(replyId), 220);
    });
  }, [replyId, commentId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!postId) return;
        if (entries[0].isIntersecting && hasMoreComments && !loadingComments) {
          fetchComments(postId, commentOffset, true);
        }
      },
      { rootMargin: "220px" }
    );
    if (commentsEndRef.current) observer.observe(commentsEndRef.current);
    return () => observer.disconnect();
  }, [postId, hasMoreComments, loadingComments, commentOffset]);

  useEffect(() => {
    adjustCommentTextareaHeight();
  }, [newCommentText]);

  const handlePostComment = async () => {
    if (!postId || !user || !newCommentText.trim()) return;
    const body = newCommentText.trim();
    const tempId = `temp-${Date.now()}`;

    const optimistic: CommentVM = {
      id: tempId,
      postId,
      author: {
        id: user.username,
        fullName: user.fullName,
        username: user.username,
        avatarUrl: null,
        initials: toInitials(user.fullName),
      },
      content: body,
      timestamp: new Date().toISOString(),
      likesCount: 0,
      userHasLiked: false,
      repliesCount: 0,
      repliesLoaded: true,
      repliesOffset: 0,
      hasMoreReplies: false,
      loadingReplies: false,
      replies: [],
    };

    setComments((prev) => [optimistic, ...prev]);
    setNewCommentText("");

    try {
      const saved = await api.createComment(postId, body);
      setComments((prev) =>
        prev.map((c) =>
          c.id === tempId
            ? {
                ...saved,
                replies: [],
                repliesLoaded: false,
                repliesOffset: 0,
                hasMoreReplies: saved.repliesCount > 0,
                loadingReplies: false,
              }
            : c
        )
      );
    } catch (error) {
      console.error("Failed to post comment", error);
      setComments((prev) => prev.filter((c) => c.id !== tempId));
    }
  };

  const handlePostReply = async (cid: string, text: string) => {
    if (!user || !text.trim()) return;
    const body = text.trim();
    const tempId = `temp-r-${Date.now()}`;
    const optimistic: Reply = {
      id: tempId,
      commentId: cid,
      author: {
        id: user.username,
        fullName: user.fullName,
        username: user.username,
        avatarUrl: null,
        initials: toInitials(user.fullName),
      },
      content: body,
      timestamp: new Date().toISOString(),
      likesCount: 0,
      userHasLiked: false,
    };

    setComments((prev) =>
      prev.map((c) =>
        c.id === cid
          ? {
              ...c,
              repliesLoaded: true,
              loadingReplies: false,
              repliesCount: c.repliesCount + 1,
              hasMoreReplies: false,
              replies: [optimistic, ...(c.replies || [])],
            }
          : c
      )
    );

    try {
      const saved = await api.createReply(cid, body);
      setComments((prev) =>
        prev.map((c) =>
          c.id === cid
            ? {
                ...c,
                replies: (c.replies || []).map((r) => (r.id === tempId ? saved : r)),
              }
            : c
        )
      );
    } catch (error) {
      console.error("Failed to post reply", error);
      setComments((prev) =>
        prev.map((c) =>
          c.id === cid
            ? {
                ...c,
                repliesCount: Math.max(0, c.repliesCount - 1),
                replies: (c.replies || []).filter((r) => r.id !== tempId),
              }
            : c
        )
      );
    }
  };

  const handleEditPost = async (content: string) => {
    if (!post) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const updated = await postMutationsApi.editPost(post.id, trimmed, post.images || undefined);
    setPost(updated);
  };

  const handleDeletePost = async () => {
    if (!post) return;
    await postMutationsApi.deletePost(post.id);
    navigate("/");
  };

  const handleEditComment = async (cid: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const updated = await postMutationsApi.editComment(cid, trimmed);
    setComments((prev) =>
      prev.map((c) =>
        c.id === cid
          ? {
              ...c,
              ...updated,
              replies: c.replies,
              repliesLoaded: c.repliesLoaded,
              repliesOffset: c.repliesOffset,
              hasMoreReplies: c.hasMoreReplies,
              loadingReplies: c.loadingReplies,
            }
          : c
      )
    );
  };

  const handleDeleteComment = async (cid: string) => {
    await postMutationsApi.deleteComment(cid);
    setComments((prev) => prev.filter((c) => c.id !== cid));
  };

  if (loadingPost) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="fixed inset-0 z-40 bg-transparent" onClick={handleBackdropClose} />
        <div className="fixed inset-0 z-50 p-2 md:p-2">
          <div className="mx-auto h-full max-w-3xl overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between px-2 py-2">
              <button
                onClick={() => navigate(-1)}
                className="rounded-lg p-1.5 text-violet-300 transition-colors hover:bg-white/[0.05] hover:text-violet-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="h-[calc(100%-3.1rem)] overflow-hidden px-2 pb-2 pt-2">
              <div className="flex h-full flex-col gap-0 overflow-hidden sm:flex-row">
                <div className="h-full w-full min-h-0 flex-col flex sm:w-1/2">
                  <div className="my-auto flex flex-col gap-2 sm:my-0 sm:flex-1 sm:gap-0">
                    <div className="h-auto overflow-hidden rounded-xl border border-violet-500/20 bg-black sm:h-full flex flex-col min-h-0">
                      <div className="p-4 border-b border-violet-500/20">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 animate-pulse" />
                          <div className="flex-1">
                            <div className="h-4 bg-zinc-800 rounded animate-pulse mb-2 w-24" />
                            <div className="h-3 bg-zinc-800 rounded animate-pulse w-32" />
                          </div>
                          <div className="w-4 h-4 bg-zinc-800 rounded animate-pulse" />
                        </div>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-4">
                        <div className="mb-4 h-56 bg-zinc-800 rounded-lg animate-pulse" />
                        <div className="space-y-2">
                          <div className="h-4 bg-zinc-800 rounded animate-pulse" />
                          <div className="h-4 bg-zinc-800 rounded animate-pulse w-5/6" />
                          <div className="h-4 bg-zinc-800 rounded animate-pulse w-4/6" />
                        </div>
                      </div>
                      <div className="border-t border-violet-500/20 bg-black p-3">
                        <div className="h-6 bg-zinc-800 rounded animate-pulse w-20" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-zinc-300 mb-3">Post not found.</p>
          <Button onClick={() => navigate("/")}>Back Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 z-40 bg-transparent" onClick={handleBackdropClose} />

      <div className="fixed inset-0 z-50 p-2 md:p-2">
        <div className="mx-auto h-full max-w-3xl overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between px-2 py-2">
            <button
              onClick={() => navigate(-1)}
              className="rounded-lg p-1.5 text-violet-300 transition-colors hover:bg-white/[0.05] hover:text-violet-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="h-[calc(100%-3.1rem)] overflow-hidden px-2 pb-2 pt-2">
            <div className="flex h-full flex-col gap-0 overflow-hidden sm:flex-row">
              <div className={`h-full w-full min-h-0 flex-col ${showCommentsPanel ? "hidden sm:flex" : "flex"} sm:w-1/2`}>
                <div className="my-auto flex flex-col gap-2 sm:my-0 sm:flex-1 sm:gap-0">
                  <div className="flex items-center justify-end sm:hidden">
                    <button
                      onClick={() => setShowCommentsPanel(true)}
                      className="rounded-lg border border-violet-500/20 bg-transparent p-1.5 text-violet-300 transition-colors hover:bg-white/[0.05] hover:text-violet-500"
                    >
                      <FlipVertical2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="h-auto overflow-hidden rounded-xl border border-violet-500/20 bg-black sm:h-full flex flex-col min-h-0">
                    <PostPanel
                      post={post}
                      anonymousMode={anonymousMode}
                      onUserClick={handleUserClick}
                      onEditPost={handleEditPost}
                      onDeletePost={handleDeletePost}
                    />
                  </div>
                </div>
              </div>

              <div className={`h-full w-full min-h-0 flex-col ${showCommentsPanel ? "flex" : "hidden sm:flex"} sm:w-1/2`}>
                <div className="mb-2 flex items-center justify-end sm:hidden">
                  <button
                    onClick={() => setShowCommentsPanel(false)}
                    className="rounded-lg p-1.5 text-violet-300 transition-colors hover:bg-white/[0.05] hover:text-violet-500"
                  >
                    <FlipVertical2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-violet-500/20 bg-black sm:rounded-l-xl sm:border-l-0 flex flex-col">

                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pt-6">
                    {comments.length === 0 && !loadingComments && (
                      <div className="py-10 text-center text-sm text-gray-500">No comments yet. Be the first.</div>
                    )}

                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        isExpanded={expandedReplies.has(comment.id)}
                        onToggleReplies={() => toggleReplies(comment.id)}
                        onLoadMoreReplies={() => loadMoreReplies(comment.id)}
                        onPostReply={handlePostReply}
                        onEditComment={handleEditComment}
                        onDeleteComment={handleDeleteComment}
                        currentUsername={user?.username || null}
                        onUserClick={handleUserClick}
                        highlight={comment.id === commentId}
                        highlightedReplyId={replyId}
                      />
                    ))}

                    {loadingComments && (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="flex gap-3 p-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse flex-shrink-0" />
                            <div className="flex-1">
                              <div className="h-4 bg-zinc-800 rounded animate-pulse mb-2 w-32" />
                              <div className="h-3 bg-zinc-800 rounded animate-pulse mb-2" />
                              <div className="h-3 bg-zinc-800 rounded animate-pulse w-5/6" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div ref={commentsEndRef} className="h-4" />
                  </div>

                  {user ? (
                    <div className="sticky bottom-0 max-h-36 overflow-hidden flex-shrink-0 border-t border-violet-500/20 bg-black p-0">
                      <div className="flex items-start gap-0">
                        <div className="relative flex-1">
                          <textarea
                            ref={commentTextareaRef}
                            value={newCommentText}
                            onChange={(e) => {
                              setNewCommentText(e.target.value);
                              adjustCommentTextareaHeight();
                            }}
                            placeholder="Write a comment..."
                            rows={2}
                            className="w-full resize-none rounded-none border-0 bg-transparent px-3 py-3 text-sm text-white placeholder-gray-500 transition-colors focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handlePostComment();
                              }
                            }}
                          />
                          <button
                            onClick={handlePostComment}
                            className="absolute right-2 top-1/2 -translate-y-1/2 pb-2 pr-2 text-gray-400 transition-colors hover:text-violet-400"
                            disabled={!newCommentText.trim()}
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="sticky bottom-0 max-h-24 overflow-y-auto flex-shrink-0 border-t border-violet-500/20 bg-black p-4">
                      <p className="text-center text-xs text-gray-500">Login to comment</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostPanel({
  post,
  anonymousMode = false,
  onUserClick,
  onEditPost,
  onDeletePost,
}: {
  post: FeedPost;
  anonymousMode?: boolean;
  onUserClick: (username: string) => void;
  onEditPost: (content: string) => Promise<void>;
  onDeletePost: () => Promise<void>;
}) {
  const { user } = useSessionUser();
  const { likesCount, hasLiked, toggleLike, isPending } = useEntityLikes(
    post.likesCount,
    post.id,
    "post",
    post.userHasLiked
  );

  const formattedTime = useMemo(() => formatRelativeTime(post.timestamp), [post.timestamp]);
  const isAnonymous = anonymousMode || post.anon;
  const displayName = isAnonymous ? "Anonymous" : post.author.fullName;
  const displayHandle = isAnonymous ? "anonymous" : post.author.username;
  const isOwner = !!user && !isAnonymous && user.username === post.author.username;
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(post.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  useEffect(() => {
    setEditingText(post.content);
  }, [post.content]);

  const saveEdit = async () => {
    const trimmed = editingText.trim();
    if (!trimmed || trimmed === post.content || isSavingEdit) {
      setIsEditing(false);
      return;
    }
    setIsSavingEdit(true);
    try {
      await onEditPost(trimmed);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to edit post", error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDeletePost = async () => {
    if (isDeletingPost) return;
    setIsDeletingPost(true);
    try {
      await onDeletePost();
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Failed to delete post", error);
    } finally {
      setIsDeletingPost(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-post-id={post.id}>
      <div className="p-4 border-b border-violet-500/20 flex-shrink-0">
        <div className="flex items-center gap-3">
          {isAnonymous ? (
            <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 p-[2px]">
              <div className="w-full h-full rounded-lg bg-zinc-900 flex items-center justify-center">
                <AnonymousMaskIcon />
              </div>
            </div>
          ) : (
            <button onClick={() => onUserClick(post.author.username)} className="hover:opacity-80 transition-opacity">
              <Avatar className="h-10 w-10 border border-violet-500/20 bg-transparent">
                <AvatarImage src={resolveAvatarSrc(post.author.avatarUrl)} alt={displayName} />
                <InitialsAvatarFallback initials={post.author.initials} className="bg-transparent text-[1rem]" />
              </Avatar>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white truncate">{displayName}</div>
            {!isAnonymous && <div className="text-gray-500 text-xs">@{displayHandle} - {formattedTime}</div>}
          </div>
          {isOwner ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  if (isEditing) {
                    setIsEditing(false);
                    setEditingText(post.content);
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="text-xs text-zinc-400 hover:text-white transition-colors"
                aria-label={isEditing ? "Cancel edit post" : "Edit post"}
                title={isEditing ? "Cancel edit post" : "Edit post"}
              >
                {isEditing ? "Cancel" : <TextCursor className="h-3 w-3" />}
              </button>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                aria-label="Delete post"
                title="Delete post"
              >
                <Trash className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button className="text-zinc-500 hover:text-white transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {!isAnonymous && post.images && post.images.length > 0 && (
          <div className="relative overflow-hidden mb-4 rounded-lg">
            <img src={resolveImageUrl(post.images[0])} alt="Post image" className="w-full h-auto object-cover" loading="lazy" />
          </div>
        )}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              className="w-full min-h-28 resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/40"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditingText(post.content);
                }}
                className="text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => void saveEdit()}
                disabled={isSavingEdit}
                className="rounded-md bg-violet-500/20 px-3 py-1 text-xs text-violet-200 hover:bg-violet-500/30 disabled:opacity-50"
              >
                {isSavingEdit ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{post.content}</p>
        )}
      </div>

      <div className="sticky bottom-0 max-h-24 overflow-y-auto border-t border-violet-500/20 bg-black p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleLike}
            disabled={isPending || !user}
            className={`flex items-center gap-1.5 px-3 h-[26px] py-1.5 rounded-lg transition-colors ${
              hasLiked ? "text-pink-400 bg-pink-400/[0.08]" : "text-gray-400 hover:text-pink-400 hover:bg-pink-400/[0.08]"
            } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="18" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="text-xs">{formatCompactNumber(likesCount)}</span>
          </button>
        </div>
      </div>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md border border-red-500/30 bg-zinc-950 p-0 text-white ring-0"
        >
          <DialogHeader className="p-5 pb-3">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-300">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold text-white">Delete Post?</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              This action cannot be undone. The post and its engagement will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-zinc-800 bg-zinc-950/90 p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeletingPost}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmDeletePost()}
              disabled={isDeletingPost}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              {isDeletingPost ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CommentItemProps {
  comment: CommentVM;
  isExpanded: boolean;
  onToggleReplies: () => void;
  onLoadMoreReplies: () => void;
  onPostReply: (cid: string, text: string) => void;
  onEditComment: (cid: string, content: string) => Promise<void>;
  onDeleteComment: (cid: string) => Promise<void>;
  currentUsername: string | null;
  onUserClick: (username: string) => void;
  highlightedReplyId?: string;
  highlight?: boolean;
}

function CommentItem({
  comment,
  isExpanded,
  onToggleReplies,
  onLoadMoreReplies,
  onPostReply,
  onEditComment,
  onDeleteComment,
  currentUsername,
  onUserClick,
  highlightedReplyId,
  highlight,
}: CommentItemProps) {
  const { user } = useSessionUser();
  const { likesCount, hasLiked, toggleLike, isPending } = useEntityLikes(comment.likesCount, comment.id, "comment", comment.userHasLiked);
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState(comment.content);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(false);
  const isOwner = !!currentUsername && currentUsername === comment.author.username;

  useEffect(() => {
    setEditingText(comment.content);
  }, [comment.content]);

  const sendReply = () => {
    if (!replyText.trim()) return;
    onPostReply(comment.id, replyText);
    setReplyText("");
    setShowReplyInput(false);
  };

  const saveEdit = async () => {
    const trimmed = editingText.trim();
    if (!trimmed || trimmed === comment.content || isSavingEdit) {
      setIsEditing(false);
      return;
    }
    setIsSavingEdit(true);
    try {
      await onEditComment(comment.id, trimmed);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to edit comment", error);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const confirmDeleteComment = async () => {
    if (isDeletingComment) return;
    setIsDeletingComment(true);
    try {
      await onDeleteComment(comment.id);
      setDeleteModalOpen(false);
    } catch (error) {
      console.error("Failed to delete comment", error);
    } finally {
      setIsDeletingComment(false);
    }
  };

  return (
    <div id={`comment-${comment.id}`} data-comment-id={comment.id} className={`comment-thread ${highlight ? "bg-violet-500/10 rounded-lg border border-violet-500/20 p-2 -mx-2" : ""}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onUserClick(comment.author.username)} className="hover:opacity-80 transition-opacity flex-shrink-0 self-start">
          <Avatar className="rounded-md h-8 w-8 border border-violet-500/20 bg-transparent flex-shrink-0">
            <AvatarImage src={resolveAvatarSrc(comment.author.avatarUrl)} />
            <InitialsAvatarFallback className="bg-transparent text-[1rem] leading-none" initials={comment.author.initials} />
          </Avatar>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{comment.author.fullName}</span>
            <span className="text-xs text-gray-500">{formatRelativeTime(comment.timestamp)}</span>
          </div>
          {isEditing ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="w-full min-h-5 rounded-xl bg-zinc-800/30 px-3 py-2 text-sm text-white focus:outline-none focus:bg-zinc-800/40"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditingText(comment.content);
                  }}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void saveEdit()}
                  disabled={isSavingEdit}
                  className="rounded-md bg-violet-500/20 px-3 py-1 text-xs text-violet-200 hover:bg-violet-500/30 disabled:opacity-50"
                >
                  {isSavingEdit ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-300 mt-0.5 whitespace-pre-wrap break-words">{comment.content}</p>
          )}

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={toggleLike}
              disabled={isPending || !user}
              className={`flex items-center gap-1 text-xs transition-colors ${
                hasLiked ? "text-pink-400" : "text-gray-500 hover:text-pink-400"
              } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
              <span>{formatCompactNumber(likesCount)}</span>
            </button>

            <button onClick={() => setShowReplyInput((v) => !v)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Reply</span>
            </button>

            {isOwner && (
              <>
                <button
                  onClick={() => setIsEditing((v) => !v)}
                  className="text-xs text-zinc-500 hover:text-white transition-colors"
                  aria-label={isEditing ? "Cancel edit comment" : "Edit comment"}
                  title={isEditing ? "Cancel edit comment" : "Edit comment"}
                >
                  {isEditing ? "Cancel" : <TextCursor className="h-3 w-3" />}
                </button>
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  aria-label="Delete comment"
                  title="Delete comment"
                >
                  <Trash className="h-3 w-3" />
                </button>
              </>
            )}

            {comment.repliesCount > 0 && (
              <button onClick={onToggleReplies} className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-400 transition-colors">
                <LazyLoad
                  width={14}
                  height={14}
                  loader={isExpanded ? loadChevronUpIcon : loadChevronDownIcon}
                  className="inline-flex items-center justify-center"
                  componentProps={{ className: "h-3.5 w-3.5" }}
                />
                <span>{comment.repliesCount} {comment.repliesCount === 1 ? "reply" : "replies"}</span>
              </button>
            )}
          </div>

          {showReplyInput && user && (
            <div className="mt-3 flex gap-1">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendReply();
                }}
                placeholder="Write a reply..."
                className="flex-1 bg-white/[0.03] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/[0.12]"
              />
              <Button variant="ghost" onClick={sendReply} disabled={!replyText.trim()} className="h-8 w-8 p-0 text-violet-400">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <AnimatePresence>
            {isExpanded && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2">
                {comment.loadingReplies && (comment.replies || []).length === 0 && (
                  <div className="space-y-2">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="flex gap-2 ml-6 mt-2">
                        <div className="w-7 h-7 rounded-md bg-zinc-800 animate-pulse flex-shrink-0" />
                        <div className="flex-1 mt-1">
                          <div className="h-3 bg-zinc-800 rounded animate-pulse mb-1 w-28" />
                          <div className="h-3 bg-zinc-800 rounded animate-pulse mb-1" />
                          <div className="h-3 bg-zinc-800 rounded animate-pulse w-5/6" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(comment.replies || []).length > 0 ? (
                  (comment.replies || []).map((reply) => (
                    <ReplyItem
                      key={reply.id}
                      reply={reply}
                      highlight={reply.id === highlightedReplyId}
                      onUserClick={onUserClick}
                    />
                  ))
                ) : !comment.loadingReplies ? (
                  <div className="text-xs text-gray-500 italic">No replies yet.</div>
                ) : null}

                {comment.hasMoreReplies && (
                  <button
                    onClick={onLoadMoreReplies}
                    disabled={comment.loadingReplies}
                    className="ml-6 text-[11px] text-violet-400 hover:text-violet-300 disabled:opacity-50 transition-colors"
                  >
                    {comment.loadingReplies ? "Loading replies..." : "Load more replies"}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-w-md border border-red-500/30 bg-zinc-950 p-0 text-white ring-0"
        >
          <DialogHeader className="p-5 pb-3">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-300">
              <TriangleAlert className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-semibold text-white">Delete Comment?</DialogTitle>
            <DialogDescription className="text-sm text-zinc-400">
              This action cannot be undone. The comment will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-zinc-800 bg-zinc-950/90 p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteModalOpen(false)}
              disabled={isDeletingComment}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void confirmDeleteComment()}
              disabled={isDeletingComment}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              {isDeletingComment ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReplyItem({
  reply,
  highlight,
  onUserClick,
}: {
  reply: Reply;
  highlight?: boolean;
  onUserClick: (username: string) => void;
}) {
  const { user } = useSessionUser();
  const { likesCount, hasLiked, toggleLike, isPending } = useEntityLikes(reply.likesCount, reply.id, "reply", reply.userHasLiked);

  return (
    <div className="relative ml-6">
      {/* Modern thread connector */}
      <div className="absolute -left-4 top-2 w-3 h-6 border-l border-b border-white/[0.12] rounded-bl-md" aria-hidden="true" />
      
      <div
        id={`reply-${reply.id}`}
        className={`flex gap-2 mt-2 transition-colors ${highlight ? "opacity-100" : "opacity-90"}`}
      >
        <button onClick={() => onUserClick(reply.author.username)} className="hover:opacity-80 transition-opacity">
          <Avatar className="mt-1 h-7 w-7 rounded-md border border-violet-400/20 bg-transparent flex-shrink-0">
            <AvatarImage src={resolveAvatarSrc(reply.author.avatarUrl)} />
            <InitialsAvatarFallback initials={reply.author.initials} className="bg-transparent text-[1rem] leading-none" />
          </Avatar>
        </button>
        <div className="flex-1 mt-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white">{reply.author.fullName}</span>
            <span className="text-[10px] text-gray-500">{formatRelativeTime(reply.timestamp)}</span>
          </div>
          <p className="text-xs text-gray-300 mt-0.5 whitespace-pre-wrap break-words">{reply.content}</p>
          <button
            onClick={toggleLike}
            disabled={isPending || !user}
            className={`flex items-center gap-1 mt-1 text-[10px] transition-colors ${
              hasLiked ? "text-pink-400" : "text-gray-500 hover:text-pink-400"
            } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
            </svg>
            <span>{formatCompactNumber(likesCount)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
