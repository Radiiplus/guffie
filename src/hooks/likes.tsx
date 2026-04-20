/**
 * Hook: useEntityLikes
 * Production-ready optimistic like/unlike management for Posts, Comments, and Replies.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { useSessionUser } from "@/lib/session";

export type EntityType = "post" | "comment" | "reply";

interface UseEntityLikesReturn {
  likesCount: number;
  hasLiked: boolean;
  isPending: boolean;
  toggleLike: () => Promise<void>;
  error: string | null;
}

export function useEntityLikes(
  initialLikes: number,
  id: string,
  type: EntityType,
  initialHasLiked: boolean = false
): UseEntityLikesReturn {
  const { user } = useSessionUser();

  // State initialized with SERVER data
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateRef = useRef({
    hasLiked,
    likesCount,
    isPending,
    id,
    type,
  });

  // Sync refs with state whenever they change
  useEffect(() => {
    stateRef.current = { hasLiked, likesCount, isPending, id, type };
  }, [hasLiked, likesCount, isPending, id, type]);

  // Keep local state aligned when parent-provided values change.
  useEffect(() => {
    setLikesCount(initialLikes);
    setHasLiked(initialHasLiked);
  }, [id, type, initialLikes, initialHasLiked]);

  // Real-time post like count updates for all viewers.
  useEffect(() => {
    if (type !== "post" || !id) return;
    const unsubscribe = api.subscribeToPostLikes(id, (update) => {
      setLikesCount(update.likesCount);
    });
    return () => unsubscribe();
  }, [type, id]);

  const toggleLike = useCallback(async () => {
    if (!user) {
      setError("You must be logged in to like this.");
      return;
    }

    const currentState = stateRef.current;

    if (currentState.isPending) return;

    const targetState = !currentState.hasLiked;

    // Optimistic Update
    setIsPending(true);
    setHasLiked(targetState);
    setLikesCount((prev) => (targetState ? prev + 1 : Math.max(0, prev - 1)));
    setError(null);

    try {
      // Dynamic API call based on entity type
      if (currentState.type === "post") {
        const result = await api.toggleLike(currentState.id, targetState);
        // Keep UI authoritative to server-applied toggle state.
        setHasLiked(result.userHasLiked);
        setLikesCount(result.likesCount);
      } else if (currentState.type === "comment") {
        const result = await api.toggleCommentLike(currentState.id, targetState);
        setHasLiked(result.userHasLiked);
        setLikesCount(result.likesCount);
      } else if (currentState.type === "reply") {
        const result = await api.toggleReplyLike(currentState.id, targetState);
        setHasLiked(result.userHasLiked);
        setLikesCount(result.likesCount);
      }
    } catch (err) {
      console.error("Failed to toggle like:", err);

      // Rollback
      setHasLiked(currentState.hasLiked);
      setLikesCount(currentState.likesCount);

      const errorMessage = err instanceof Error ? err.message : "Failed to update like.";
      setError(errorMessage);
    } finally {
      setIsPending(false);
    }
  }, [user]);

  return {
    likesCount,
    hasLiked,
    isPending,
    toggleLike,
    error,
  };
}

// Backward-compatible post-only hook used by PostCard.
export function usePostLikes(
  initialLikes: number,
  postId: string,
  initialHasLiked: boolean = false
): UseEntityLikesReturn {
  return useEntityLikes(initialLikes, postId, "post", initialHasLiked);
}
