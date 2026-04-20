/**
* Post Card Component
* Compact design optimized for Masonry Grid layout.
* UPDATED: Uses generic useEntityLikes hook.
*/
"use client";
import type { MouseEvent } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { LazyLoad } from "@/components/ui/lazy";
import { MessageCircle, TextCursor, Trash, TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useEntityLikes } from "@/hooks/likes";
import { formatCompactNumber, formatRelativeTime } from "@/lib/utils/format";
import { resolveImageUrl } from "@/lib/config";
import { api } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PostAuthor {
  id?: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
  initials: string;
}

interface PostProps {
  id: string;
  author: PostAuthor;
  content: string;
  images?: string[] | null;
  imagePreviews?: Array<{
    imgid: string;
    width: number;
    height: number;
    aspectRatio: number;
  }> | null;
  likesCount: number;
  userHasLiked: boolean;
  commentsCount: number;
  timestamp: string;
  anon?: boolean;
  skeleton?: boolean;
  onPostDeleted?: (postId: string) => void;
}

const resolveAvatarSrc = (value?: string | null): string | undefined => resolveImageUrl(value);
const postMutationsApi = api as typeof api & {
  editPost: (pid: string, content: string, images?: string[]) => Promise<{ content: string }>;
  deletePost: (pid: string) => Promise<{ success: boolean; message: string }>;
};
const loadStarIcon = () =>
  import("lucide-react").then((module) => ({ default: module.Star }));

function AnonymousMaskIcon({ className = "h-4 w-4 text-violet-300" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10c0-4 3.6-7 9-7s9 3 9 7-3.6 9-9 9-9-5-9-9Z" />
      <path d="M9 11.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
      <path d="M8.5 15.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2" />
    </svg>
  );
}

export function PostCard({
  author,
  content,
  images,
  imagePreviews,
  likesCount: initialLikes,
  userHasLiked,
  commentsCount,
  timestamp,
  anon,
  id,
  skeleton,
  onPostDeleted,
}: PostProps) {
  const navigate = useNavigate();
  const { user } = useSessionUser();
  void imagePreviews;

  if (skeleton) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 break-inside-avoid rounded-xl border border-zinc-800/50 bg-zinc-900/20 overflow-hidden"
      >
        <div className="relative w-full aspect-video bg-zinc-800 animate-pulse" />
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-full bg-zinc-800 animate-pulse flex-shrink-0" />
              <div className="flex flex-col gap-1 flex-1">
                <div className="h-4 bg-zinc-800 rounded animate-pulse w-24" />
                <div className="h-3 bg-zinc-800 rounded animate-pulse w-32" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-zinc-800 rounded animate-pulse" />
            <div className="h-3 bg-zinc-800 rounded animate-pulse w-5/6" />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/50">
            <div className="h-7 bg-zinc-800 rounded animate-pulse w-16" />
            <div className="h-7 bg-zinc-800 rounded animate-pulse w-16" />
          </div>
        </div>
      </motion.div>
    );
  }

  const hidePostIdentity = Boolean(anon);
  const displayName = hidePostIdentity ? "Anonymous" : author.fullName;
  const displayHandle = hidePostIdentity ? "anonymous" : author.username;
  const isOwner = Boolean(user && !hidePostIdentity && user.username === displayHandle);
  const [localContent, setLocalContent] = useState(content);
  const [localDeleted, setLocalDeleted] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const initials = author.initials || displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  // Use generic hook with type "post"
  const { likesCount, hasLiked, isPending, toggleLike } = useEntityLikes(
    initialLikes,
    id,
    "post",
    userHasLiked
  );

  const formattedLikes = formatCompactNumber(likesCount);
  const formattedComments = formatCompactNumber(commentsCount);
  const formattedTime = formatRelativeTime(timestamp);

  const getImageUrl = (imgId: string) => resolveImageUrl(imgId) || "";
  const handleProfileNavigate = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (hidePostIdentity) return;
    navigate(`/${displayHandle}`);
  };

  const handleEdit = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isOwner || isMutating) return;
    const next = window.prompt("Edit post", localContent);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === localContent) return;
    setIsMutating(true);
    try {
      const updated = await postMutationsApi.editPost(id, trimmed, images || undefined);
      setLocalContent(updated.content);
    } catch (error) {
      console.error("Failed to edit post", error);
    } finally {
      setIsMutating(false);
    }
  };

  const openDeleteModal = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isOwner || isMutating) return;
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!isOwner || isMutating) return;
    setIsMutating(true);
    try {
      await postMutationsApi.deletePost(id);
      setLocalDeleted(true);
      setDeleteModalOpen(false);
      onPostDeleted?.(id);
    } catch (error) {
      console.error("Failed to delete post", error);
    } finally {
      setIsMutating(false);
    }
  };

  if (localDeleted) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      data-post-id={id}
      onClick={() => navigate(hidePostIdentity ? `/a/${id}` : `/p/${id}`)}
      className="mb-4 break-inside-avoid rounded-xl border border-zinc-800/50 bg-zinc-900/20 overflow-hidden hover:border-violet-500/30 transition-colors cursor-pointer group"
    >
      {/* Image Section */}
      {!hidePostIdentity && images && images.length > 0 && (
        <div className="relative w-full overflow-hidden bg-black">
          {images.length === 1 ? (
            <div className="relative w-full">
              <img src={getImageUrl(images[0])} alt="Post attachment" className="w-full h-auto object-cover max-h-[600px]" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0.5">
              {images.slice(0, 4).map((imgId, idx) => (
                <div key={`${id}-img-${idx}`} className="relative aspect-square overflow-hidden">
                  <img src={getImageUrl(imgId)} alt={`Attachment ${idx + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                </div>
              ))}
              {images.length > 4 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white font-bold text-xl">+{images.length - 4}</div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-4 flex flex-col gap-3">
        {/* Author Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {hidePostIdentity ? (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-400 to-fuchsia-400 p-[1.5px] flex-shrink-0">
                <div className="w-full h-full rounded-lg bg-zinc-900 flex items-center justify-center">
                  <AnonymousMaskIcon />
                </div>
              </div>
            ) : (
              <button type="button" onClick={handleProfileNavigate} className="hover:opacity-80 transition-opacity">
                <Avatar className="h-8 w-8 border border-violet-500/20 bg-transparent">
                  <AvatarImage src={resolveAvatarSrc(author.avatarUrl)} alt={displayName} />
                  <InitialsAvatarFallback className="bg-transparent text-[1rem] leading-none" initials={initials} />
                </Avatar>
              </button>
            )}
            <div className="flex flex-col truncate">
              <button
                type="button"
                onClick={handleProfileNavigate}
                className={`text-left text-md font-bold text-white mb-1 truncate leading-none ${
                  hidePostIdentity ? "cursor-default" : "hover:underline"
                }`}
              >
                {displayName}
              </button>
              {!hidePostIdentity && (
                <div className="text-xs text-zinc-500 truncate leading-none">
                  <button type="button" onClick={handleProfileNavigate} className="hover:underline">
                    @{displayHandle}
                  </button>{" "}
                  - {formattedTime}
                </div>
              )}
            </div>
          </div>
          {isOwner && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleEdit}
                disabled={isMutating}
                className="text-[11px] text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Edit post"
                title="Edit post"
              >
                <TextCursor className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={openDeleteModal}
                disabled={isMutating}
                className="text-[11px] text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                aria-label="Delete post"
                title="Delete post"
              >
                <Trash className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">{localContent}</p>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/50">
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(); }}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-200 ${
              hasLiked
                ? "text-pink-400 bg-pink-500/10 border-pink-500/20"
                : "text-zinc-400 hover:text-pink-400 hover:bg-pink-500/10 border border-transparent"
            } disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            <LazyLoad
              width={16}
              height={16}
              loader={loadStarIcon}
              onLoad={() => undefined}
              className="inline-flex items-center justify-center"
              componentProps={{
                className: `h-4 w-4 transition-transform ${hasLiked ? "fill-current" : ""}`,
              }}
            />
            <span className="text-xs font-medium tabular-nums">{formattedLikes}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(hidePostIdentity ? `/a/${id}` : `/p/${id}`);
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs font-medium tabular-nums">{formattedComments}</span>
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
              disabled={isMutating}
              className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isMutating}
              className="bg-red-500/90 text-white hover:bg-red-500"
            >
              {isMutating ? "Deleting..." : "Delete Forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
