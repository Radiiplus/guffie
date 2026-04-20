/**
 * Frontend Configuration & API Client
 * Handles environment variables, type definitions, and GraphQL communication.
 */

const defaultApiOrigin = (() => {
  const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL as string | undefined;
  if (graphqlUrl) {
    try {
      return new URL(graphqlUrl).origin;
    } catch {
      // Fall back below.
    }
  }
  return "http://localhost:4000";
})();

// --- Environment Configuration ---
export const config = {
  backendUrl: import.meta.env.VITE_API_URL || defaultApiOrigin,
  apiBaseUrl: import.meta.env.VITE_API_URL || defaultApiOrigin,
  graphqlUrl: import.meta.env.VITE_GRAPHQL_URL || "http://localhost:4000/graphql",
  wsUrl: import.meta.env.VITE_WS_URL || "ws://localhost:4000/graphql",
  imageBaseUrl: import.meta.env.VITE_IMAGE_URL || "http://localhost:4000/img",
  vapidPublicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY || "",
  legal: {
    lastUpdated: "April 20, 2026",
    supportEmail: "support@guffi.web.app",
    privacyEmail: "privacy@guffi.web.app",
  },
};

export const endpoints = {
  backend: config.backendUrl,
  graphql: config.graphqlUrl,
  ws: config.wsUrl,
  imageBase: config.imageBaseUrl,
  presenceOffline: `${config.backendUrl}/presence/offline`,
  activeBanner: `${config.backendUrl}/banner/active`,
} as const;

export const resolveImageUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `${endpoints.imageBase}/${value}`;
};

export const SITE_CONFIG = {
  name: "Guffi",
  theme: {
    fontFamily: "\"Great Vibes\", cursive",
  },
} as const;

// --- Types (Shared with API for convenience, though ideally imported from api.tsx) ---

export interface SessionUser {
  fullName: string;
  username: string;
  country: string | null;
  createdAt: string;
  pk: string;
}

export interface FeedPost {
  id: string;
  author: {
    id?: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    initials: string;
  };
  content: string;
  images: string[] | null;
  imagePreviews: { imgid: string; width: number; height: number; aspectRatio: number }[] | null;
  likesCount: number;
  userHasLiked: boolean;
  commentsCount: number;
  timestamp: string;
  anon: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  author: {
    id?: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    initials: string;
  };
  content: string;
  timestamp: string;
  likesCount: number;
  userHasLiked: boolean;
  repliesCount: number;
}

export interface Reply {
  id: string;
  commentId: string;
  author: {
    id?: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    initials: string;
  };
  content: string;
  timestamp: string;
  likesCount: number;
  userHasLiked: boolean;
}

export interface ChatMessage {
  id: string;
  author: {
    id?: string;
    fullName: string;
    username: string;
    avatarUrl: string | null;
    initials: string;
  };
  content: string;
  timestamp: string;
  replyTo?: {
    messageId: string;
    username: string;
    content: string;
  } | null;
  likesCount: number;
  userHasLiked: boolean;
}

export interface UserProfile {
  fullName: string;
  username: string;
  country: string | null;
  createdAt: string;
  bio: string;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isOwner: boolean;
  isProfileOwner: boolean;
}

export interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  totalFollowers: number;
  totalFollowing: number;
}

export interface FollowUser {
  fullName: string;
  username: string;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  followedAt: string;
}

export interface GetFollowersResult {
  users: FollowUser[];
  nextOffset: number | null;
  hasMore: boolean;
  totalCount: number;
}

export interface FollowResult {
  success: boolean;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

// Note: Actual API logic is now in src/lib/api.tsx to avoid circular dependencies 
// and keep config purely for constants.
