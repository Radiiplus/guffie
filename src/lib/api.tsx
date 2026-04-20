/**
 * API Client
 * Handles GraphQL communication with the backend including Queries, Mutations, and Subscriptions.
 * UPDATED: Added Profile Update endpoint for Bio/Name editing.
 */
import { getGraphqlWsClient, graphqlRequest } from "./graphql-client";
import { runWithInputRateLimit } from "./ratelimit";

// --- Types ---

export interface SessionUser {
  id: string;
  fullName: string;
  username: string;
  country: string | null;
  createdAt: string;
  pk: string;
}

export interface SessionUserPublic {
  fullName: string;
  username: string;
  country: string | null;
  createdAt: string;
  avatarUrl: string | null;
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

export interface PostLikeUpdate {
  postId: string;
  likesCount: number;
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

// --- Profile & Follow Types ---

export interface UserProfile {
  id: string;
  fullName: string;
  username: string;
  country: string | null;
  showCountryPreview: boolean;
  pushNotificationsEnabled: boolean;
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
  id: string;
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

// --- NEW: Notification Types ---

export type NotificationType = "like" | "comment" | "reply" | "follow" | "mention" | "share" | "system";

export interface Notification {
  id: string;
  actorName: string | null;
  actorUsername: string | null;
  type: NotificationType;
  postId: string | null;
  cid: string | null;
  content: string;
  repeatCount: number;
  read: boolean;
  timestamp: string;
  // Optional enriched fields for UI
  postImage?: string | null;
  postTitle?: string | null;
}

export interface UploadImagePayload {
  fileBase64: string;
  width: number;
  height: number;
  exif: string;
}

export interface UploadImageResponse {
  id: string;
  imgid: string;
  ext: string;
  width: number;
  height: number;
  size: number;
  uploadedAt: string;
}

export interface ActivityMetricInput {
  key: string;
  count: number;
  totalMs: number;
}

export interface ActivityAggregateInput {
  startedAt: string;
  endedAt: string;
  spanMs: number;
  metrics: ActivityMetricInput[];
}

// --- GraphQL Client Setup ---
const wsClient = getGraphqlWsClient();

const postLikeSubscriptionRegistry = new Map<
  string,
  {
    listeners: Set<(update: PostLikeUpdate) => void>;
    unsubscribe: (() => void) | null;
  }
>();

// --- API Methods ---

export const api = {
  // --- Auth ---
  login: async (username: string, password: string) => {
    return runWithInputRateLimit(
      `login:${username.toLowerCase()}`,
      { max: 8, windowMs: 5 * 60 * 1000, minIntervalMs: 1200 },
      async () => {
        const mutation = `
      mutation Login($input: LoginInput!) {
        login(input: $input) {
          token
          user { fullName username country createdAt pk }
        }
      }
    `;
        const result = await graphqlRequest<{ login: { token: string; user: SessionUser } }>(mutation, {
          input: { username, password },
        });
        return result.login;
      },
      "Too many login attempts. Please wait and try again."
    );
  },

  register: async (input: {
    fullName: string;
    username: string;
    country: string;
    password: string;
    confirmPassword: string;
    termsAccepted: boolean;
  }) => {
    return runWithInputRateLimit(
      `register:${input.username.toLowerCase()}`,
      { max: 5, windowMs: 10 * 60 * 1000, minIntervalMs: 1500 },
      async () => {
        const mutation = `
      mutation Register($input: RegisterInput!) {
        register(input: $input) {
          token
          user { fullName username country createdAt pk }
        }
      }
    `;
        const result = await graphqlRequest<{ register: { token: string; user: SessionUser } }>(mutation, { input });
        return result.register;
      },
      "Too many registration attempts. Please wait before trying again."
    );
  },

  resetPassword: async (username: string, privateKey: string, newPassword: string) => {
    return runWithInputRateLimit(
      `reset-password:${username.toLowerCase()}`,
      { max: 4, windowMs: 10 * 60 * 1000, minIntervalMs: 2000 },
      async () => {
        const mutation = `
      mutation ResetPassword($input: ResetPasswordInput!) {
        resetPassword(input: $input) {
          success
          message
        }
      }
    `;
        const result = await graphqlRequest<{
          resetPassword: { success: boolean; message: string };
        }>(mutation, { input: { username, privateKey, newPassword } });
        return result.resetPassword;
      },
      "Too many reset attempts. Please wait before trying again."
    );
  },

  checkUsername: async (username: string) => {
    return runWithInputRateLimit(
      "check-username",
      { max: 30, windowMs: 60 * 1000, minIntervalMs: 250 },
      async () => {
        const query = `
      query CheckUsername($username: String!) {
        checkUsername(username: $username) {
          available
          message
        }
      }
    `;
        const result = await graphqlRequest<{ checkUsername: { available: boolean; message?: string } }>(query, { username });
        return result.checkUsername;
      },
      "You're checking usernames too fast. Please slow down."
    );
  },

  validateSession: async () => {
    const query = `
      query ValidateSession {
        validateSession {
          valid
          user { fullName username country createdAt avatarUrl }
          message
        }
      }
    `;
    try {
      const result = await graphqlRequest<{ validateSession: { valid: boolean; user: SessionUserPublic | null; message?: string } }>(query);
      return result.validateSession;
    } catch {
      return { valid: false, user: null };
    }
  },

  // --- Posts ---
  getPosts: async (offset: number, limit: number) => {
    const query = `
      query GetPosts($offset: Int, $limit: Int) {
        getPosts(offset: $offset, limit: $limit) {
          posts {
            id author { fullName username avatarUrl initials }
            content timestamp likesCount userHasLiked commentsCount
            images imagePreviews { imgid width height aspectRatio } anon
          }
          nextOffset hasMore
        }
      }
    `;
    const result = await graphqlRequest<{ getPosts: { posts: FeedPost[]; nextOffset: number | null; hasMore: boolean } }>(query, { offset, limit });
    return result.getPosts;
  },

  getUserPosts: async (username: string, offset: number, limit: number) => {
    const query = `
      query GetUserPosts($username: String!, $offset: Int, $limit: Int) {
        getUserPosts(username: $username, offset: $offset, limit: $limit) {
          posts {
            id author { fullName username avatarUrl initials }
            content timestamp likesCount userHasLiked commentsCount
            images imagePreviews { imgid width height aspectRatio } anon
          }
          nextOffset hasMore
        }
      }
    `;
    const result = await graphqlRequest<{ getUserPosts: { posts: FeedPost[]; nextOffset: number | null; hasMore: boolean } }>(query, { username, offset, limit });
    return result.getUserPosts;
  },

  getPostById: async (postId: string) => {
    const query = `
      query GetPostById($postId: ID!) {
        getPostById(postId: $postId) {
          id
          author { fullName username avatarUrl initials }
          content
          timestamp
          likesCount
          userHasLiked
          commentsCount
          images
          imagePreviews { imgid width height aspectRatio }
          anon
        }
      }
    `;
    const result = await graphqlRequest<{ getPostById: FeedPost | null }>(query, { postId });
    return result.getPostById;
  },

  createPost: async (input: { content: string; images?: string[]; anon?: boolean }) => {
    return runWithInputRateLimit(
      "create-post",
      { max: 15, windowMs: 60 * 1000, minIntervalMs: 900 },
      async () => {
        const mutation = `
      mutation CreatePost($content: String!, $images: [String!], $anon: Boolean) {
        createPost(content: $content, images: $images, anon: $anon) {
          id author { fullName username avatarUrl initials }
          content timestamp likesCount userHasLiked commentsCount
          images imagePreviews { imgid width height aspectRatio } anon
        }
      }
    `;
        const result = await graphqlRequest<{ createPost: FeedPost }>(mutation, input);
        return result.createPost;
      },
      "You're posting too quickly. Please wait briefly."
    );
  },

  uploadImage: async (input: UploadImagePayload): Promise<UploadImageResponse> => {
    const mutation = `
      mutation UploadImage($input: UploadImageInput!) {
        uploadImage(input: $input) {
          id
          imgid
          ext
          width
          height
          size
          uploadedAt
        }
      }
    `;
    const result = await graphqlRequest<{ uploadImage: UploadImageResponse }>(mutation, { input });
    return result.uploadImage;
  },

  linkImageToPost: async (imgid: string, postId: string): Promise<boolean> => {
    const mutation = `
      mutation LinkImageToPost($imgid: String!, $postId: ID!) {
        linkImageToPost(imgid: $imgid, postId: $postId)
      }
    `;
    const result = await graphqlRequest<{ linkImageToPost: boolean }>(mutation, { imgid, postId });
    return result.linkImageToPost;
  },

  toggleLike: async (postId: string, value: boolean) => {
    const mutation = `
      mutation ToggleLike($postId: ID!, $value: Boolean!) {
        toggleLike(postId: $postId, value: $value) {
          id likesCount userHasLiked
        }
      }
    `;
    const result = await graphqlRequest<{ toggleLike: { id: string; likesCount: number; userHasLiked: boolean } }>(mutation, { postId, value });
    return result.toggleLike;
  },

  // --- Comments & Replies ---
  getComments: async (postId: string, offset: number, limit: number) => {
    const query = `
      query GetComments($postId: ID!, $offset: Int, $limit: Int) {
        getComments(postId: $postId, offset: $offset, limit: $limit) {
          comments {
            id postId author { fullName username avatarUrl initials }
            content timestamp likesCount userHasLiked repliesCount
          }
          nextOffset hasMore
        }
      }
    `;
    const result = await graphqlRequest<{ getComments: { comments: Comment[]; nextOffset: number | null; hasMore: boolean } }>(query, { postId, offset, limit });
    return result.getComments;
  },

  createComment: async (postId: string, content: string) => {
    return runWithInputRateLimit(
      "create-comment",
      { max: 25, windowMs: 60 * 1000, minIntervalMs: 500 },
      async () => {
        const mutation = `
      mutation CreateComment($postId: ID!, $content: String!) {
        createComment(postId: $postId, content: $content) {
          id postId author { fullName username avatarUrl initials }
          content timestamp likesCount userHasLiked repliesCount
        }
      }
    `;
        const result = await graphqlRequest<{ createComment: Comment }>(mutation, { postId, content });
        return result.createComment;
      },
      "You're commenting too quickly. Please wait briefly."
    );
  },

  toggleCommentLike: async (cid: string, value: boolean) => {
    const mutation = `
      mutation ToggleCommentLike($cid: ID!, $value: Boolean!) {
        toggleCommentLike(cid: $cid, value: $value) {
          id likesCount userHasLiked
        }
      }
    `;
    const result = await graphqlRequest<{ toggleCommentLike: { id: string; likesCount: number; userHasLiked: boolean } }>(mutation, { cid, value });
    return result.toggleCommentLike;
  },

  getReplies: async (commentId: string, offset: number, limit: number) => {
    const query = `
      query GetReplies($commentId: ID!, $offset: Int, $limit: Int) {
        getReplies(commentId: $commentId, offset: $offset, limit: $limit) {
          replies {
            id commentId author { fullName username avatarUrl initials }
            content timestamp likesCount userHasLiked
          }
          nextOffset hasMore
        }
      }
    `;
    const result = await graphqlRequest<{ getReplies: { replies: Reply[]; nextOffset: number | null; hasMore: boolean } }>(query, { commentId, offset, limit });
    return result.getReplies;
  },

  createReply: async (commentId: string, content: string) => {
    return runWithInputRateLimit(
      "create-reply",
      { max: 30, windowMs: 60 * 1000, minIntervalMs: 450 },
      async () => {
        const mutation = `
      mutation CreateReply($commentId: ID!, $content: String!) {
        createReply(commentId: $commentId, content: $content) {
          id commentId author { fullName username avatarUrl initials }
          content timestamp likesCount userHasLiked
        }
      }
    `;
        const result = await graphqlRequest<{ createReply: Reply }>(mutation, { commentId, content });
        return result.createReply;
      },
      "You're replying too quickly. Please wait briefly."
    );
  },

  toggleReplyLike: async (crid: string, value: boolean) => {
    const mutation = `
      mutation ToggleReplyLike($crid: ID!, $value: Boolean!) {
        toggleReplyLike(crid: $crid, value: $value) {
          id likesCount userHasLiked
        }
      }
    `;
    const result = await graphqlRequest<{ toggleReplyLike: { id: string; likesCount: number; userHasLiked: boolean } }>(
      mutation,
      { crid, value }
    );
    return result.toggleReplyLike;
  },

  // --- Chat ---
  getChatMessages: async (offset: number, limit: number) => {
    const query = `
      query GetChatMessages($offset: Int, $limit: Int) {
        getChatMessages(offset: $offset, limit: $limit) {
          messages {
            id author { fullName username avatarUrl initials }
            content timestamp replyTo { messageId username content }
            likesCount userHasLiked
          }
          nextOffset hasMore
        }
      }
    `;
    const result = await graphqlRequest<{ getChatMessages: { messages: ChatMessage[]; nextOffset: number | null; hasMore: boolean } }>(query, { offset, limit });
    return result.getChatMessages;
  },

  getChatMessageCount: async (): Promise<number> => {
    const query = `
      query GetChatMessageCount {
        getChatMessageCount {
          count
        }
      }
    `;
    const result = await graphqlRequest<{ getChatMessageCount: { count: number } }>(query);
    return result.getChatMessageCount.count;
  },

  getChatUnreadCount: async (): Promise<number> => {
    const query = `
      query GetChatUnreadCount {
        getChatUnreadCount {
          count
        }
      }
    `;
    const result = await graphqlRequest<{ getChatUnreadCount: { count: number } }>(query);
    return result.getChatUnreadCount.count;
  },

  sendChatMessage: async (content: string, replyToId?: string) => {
    return runWithInputRateLimit(
      "send-chat-message",
      { max: 40, windowMs: 60 * 1000, minIntervalMs: 350 },
      async () => {
        const mutation = `
      mutation SendChatMessage($content: String!, $replyToId: ID) {
        sendChatMessage(content: $content, replyToId: $replyToId) {
          id author { fullName username avatarUrl initials }
          content timestamp replyTo { messageId username content }
          likesCount userHasLiked
        }
      }
    `;
        const result = await graphqlRequest<{ sendChatMessage: ChatMessage }>(mutation, { content, replyToId });
        return result.sendChatMessage;
      },
      "You're sending messages too quickly. Please wait briefly."
    );
  },

  toggleChatMessageLike: async (mid: string, value: boolean) => {
    const mutation = `
      mutation ToggleChatMessageLike($mid: ID!, $value: Boolean!) {
        toggleChatMessageLike(mid: $mid, value: $value) {
          id likesCount userHasLiked
        }
      }
    `;
    const result = await graphqlRequest<{ toggleChatMessageLike: { id: string; likesCount: number; userHasLiked: boolean } }>(mutation, { mid, value });
    return result.toggleChatMessageLike;
  },

  markChatAsRead: async (): Promise<boolean> => {
    const mutation = `
      mutation MarkChatAsRead {
        markChatAsRead {
          success
        }
      }
    `;
    const result = await graphqlRequest<{ markChatAsRead: { success: boolean } }>(mutation);
    return result.markChatAsRead.success;
  },

  subscribeToChatMessages: (onMessage: (incoming: ChatMessage) => void) => {
    const unsubscribe = wsClient.subscribe(
      {
        query: `
          subscription {
            chatMessageCreated {
              id author { fullName username avatarUrl initials }
              content timestamp replyTo { messageId username content }
              likesCount userHasLiked
            }
          }
        `,
      },
      {
        next: (data) => {
          const incoming = (data as any)?.data?.chatMessageCreated as ChatMessage | undefined;
          if (incoming) onMessage(incoming);
        },
        error: (err) => console.error("Chat subscription error:", err),
        complete: () => {},
      }
    );
    return () => unsubscribe();
  },

  subscribeToPostLikes: (postId: string, onUpdate: (update: PostLikeUpdate) => void) => {
    const existing = postLikeSubscriptionRegistry.get(postId);
    if (existing) {
      existing.listeners.add(onUpdate);
      return () => {
        const current = postLikeSubscriptionRegistry.get(postId);
        if (!current) return;
        current.listeners.delete(onUpdate);
        if (current.listeners.size === 0) {
          current.unsubscribe?.();
          postLikeSubscriptionRegistry.delete(postId);
        }
      };
    }

    const listeners = new Set<(update: PostLikeUpdate) => void>();
    listeners.add(onUpdate);

    const unsubscribe = wsClient.subscribe(
      {
        query: `
          subscription PostLikeUpdated($postId: ID!) {
            postLikeUpdated(postId: $postId) {
              postId
              likesCount
            }
          }
        `,
        variables: { postId },
      },
      {
        next: (data) => {
          const update = (data as any)?.data?.postLikeUpdated as PostLikeUpdate | undefined;
          if (!update) return;
          const entry = postLikeSubscriptionRegistry.get(postId);
          if (!entry) return;
          entry.listeners.forEach((listener) => listener(update));
        },
        error: (err) => console.error("Post like subscription error:", err),
        complete: () => {},
      }
    );

    postLikeSubscriptionRegistry.set(postId, { listeners, unsubscribe });

    return () => {
      const current = postLikeSubscriptionRegistry.get(postId);
      if (!current) return;
      current.listeners.delete(onUpdate);
      if (current.listeners.size === 0) {
        current.unsubscribe?.();
        postLikeSubscriptionRegistry.delete(postId);
      }
    };
  },

  subscribeToChatUnreadSignal: (onSignal: () => void) => {
    const unsubscribe = wsClient.subscribe(
      {
        query: `
          subscription {
            chatUnreadSignal
          }
        `,
      },
      {
        next: () => onSignal(),
        error: (err) => console.error("Chat unread signal subscription error:", err),
        complete: () => {},
      }
    );
    return () => unsubscribe();
  },

  // --- Profile & Follow System ---

  getProfile: async (username: string): Promise<UserProfile> => {
    const query = `
      query GetProfile($username: String!) {
        getProfile(username: $username) {
          fullName username country showCountryPreview pushNotificationsEnabled createdAt bio avatarUrl
          followersCount followingCount postsCount isOwner isProfileOwner
        }
      }
    `;
    const result = await graphqlRequest<{ getProfile: UserProfile }>(query, { username });
    return result.getProfile;
  },

  getUserStats: async (username: string): Promise<UserStats> => {
    const query = `
      query GetUserStats($username: String!) {
        getUserStats(username: $username) {
          totalPosts totalComments totalLikes totalFollowers totalFollowing
        }
      }
    `;
    const result = await graphqlRequest<{ getUserStats: UserStats }>(query, { username });
    return result.getUserStats;
  },

  // Update profile and avatar.
  updateProfile: async (input: {
    fullName?: string;
    bio?: string;
    username?: string;
    avatarImgId?: string;
    clearAvatar?: boolean;
    showCountryPreview?: boolean;
    pushNotificationsEnabled?: boolean;
  }) => {
    return runWithInputRateLimit(
      "update-profile",
      { max: 10, windowMs: 10 * 60 * 1000, minIntervalMs: 1200 },
      async () => {
        const mutation = `
      mutation UpdateProfile($input: UpdateProfileInput!) {
        updateProfile(input: $input) {
          success
          message
          user {
            fullName username bio avatarUrl showCountryPreview pushNotificationsEnabled
          }
        }
      }
    `;
    const result = await graphqlRequest<{ 
      updateProfile: { 
        success: boolean; 
        message: string; 
        user: {
          fullName: string;
          username: string;
          bio: string;
          avatarUrl: string | null;
          showCountryPreview: boolean;
          pushNotificationsEnabled: boolean;
        } | null
      } 
    }>(mutation, { input });
        return result.updateProfile;
      },
      "Too many profile update attempts. Please wait before trying again."
    );
  },

  toggleFollow: async (username: string): Promise<FollowResult> => {
    const mutation = `
      mutation ToggleFollow($username: String!) {
        toggleFollow(username: $username) {
          success isFollowing followersCount followingCount
        }
      }
    `;
    const result = await graphqlRequest<{ toggleFollow: FollowResult }>(mutation, { username });
    return result.toggleFollow;
  },

  getFollowers: async (username: string, offset: number, limit: number): Promise<GetFollowersResult> => {
    const query = `
      query GetFollowers($username: String!, $offset: Int, $limit: Int) {
        getFollowers(username: $username, offset: $offset, limit: $limit) {
          users {
            fullName username avatarUrl followersCount followingCount isFollowing followedAt
          }
          nextOffset hasMore totalCount
        }
      }
    `;
    const result = await graphqlRequest<{ getFollowers: GetFollowersResult }>(query, { username, offset, limit });
    return result.getFollowers;
  },

  getFollowing: async (username: string, offset: number, limit: number): Promise<GetFollowersResult> => {
    const query = `
      query GetFollowing($username: String!, $offset: Int, $limit: Int) {
        getFollowing(username: $username, offset: $offset, limit: $limit) {
          users {
            fullName username avatarUrl followersCount followingCount isFollowing followedAt
          }
          nextOffset hasMore totalCount
        }
      }
    `;
    const result = await graphqlRequest<{ getFollowing: GetFollowersResult }>(query, { username, offset, limit });
    return result.getFollowing;
  },

  isFollowing: async (username: string): Promise<boolean> => {
    const query = `
      query IsFollowing($username: String!) {
        isFollowing(username: $username)
      }
    `;
    const result = await graphqlRequest<{ isFollowing: boolean }>(query, { username });
    return result.isFollowing;
  },

  isUserOnline: async (username: string): Promise<boolean> => {
    const query = `
      query IsUserOnline($username: String!) {
        isUserOnline(username: $username)
      }
    `;
    const result = await graphqlRequest<{ isUserOnline: boolean }>(query, { username });
    return result.isUserOnline;
  },

  heartbeatPresence: async (): Promise<boolean> => {
    const mutation = `
      mutation HeartbeatPresence {
        heartbeatPresence {
          success
          message
        }
      }
    `;
    const result = await graphqlRequest<{ heartbeatPresence: { success: boolean; message: string } }>(mutation);
    return result.heartbeatPresence.success;
  },

  submitActivityAggregate: async (input: ActivityAggregateInput): Promise<{ success: boolean; message: string }> => {
    const mutation = `
      mutation SubmitActivityAggregate($input: ActivityAggregateInput!) {
        submitActivityAggregate(input: $input) {
          success
          message
        }
      }
    `;
    const result = await graphqlRequest<{ submitActivityAggregate: { success: boolean; message: string } }>(mutation, { input });
    return result.submitActivityAggregate;
  },

  // --- NEW: Notifications ---

  getNotifications: async (username: string, limit: number = 20, offset: number = 0, unreadOnly: boolean = false) => {
    const query = `
      query GetNotifications($username: String!, $limit: Int, $offset: Int, $unreadOnly: Boolean) {
        getNotifications(username: $username, limit: $limit, offset: $offset, unreadOnly: $unreadOnly) {
          id
          actorName
          actorUsername
          type
          postId
          cid
          content
          repeatCount
          read
          createdAt
        }
      }
    `;
    const result = await graphqlRequest<{
      getNotifications: Array<{
        id: string;
        actorName: string | null;
        actorUsername: string | null;
        type: NotificationType;
        postId: string | null;
        cid: string | null;
        content: string;
        repeatCount: number;
        read: boolean;
        createdAt?: string | null;
      }>;
    }>(query, { username, limit, offset, unreadOnly });

    return result.getNotifications.map((n) => ({
      id: n.id,
      actorName: n.actorName,
      actorUsername: n.actorUsername,
      type: n.type,
      postId: n.postId,
      cid: n.cid,
      content: n.content,
      repeatCount: n.repeatCount ?? 1,
      read: n.read,
      timestamp: n.createdAt || new Date().toISOString(),
      postImage: null,
      postTitle: null,
    }));
  },

  subscribeToNotificationCreated: (onNotification: (notification: Notification) => void) => {
    const unsubscribe = wsClient.subscribe(
      {
        query: `
          subscription {
            notificationCreated {
              id
              actorName
              actorUsername
              type
              postId
              cid
              content
              repeatCount
              read
              createdAt
            }
          }
        `,
      },
      {
        next: (data) => {
          const incoming = (data as any)?.data?.notificationCreated;
          if (!incoming) return;
          onNotification({
            id: incoming.id,
            actorName: incoming.actorName ?? null,
            actorUsername: incoming.actorUsername ?? null,
            type: incoming.type,
            postId: incoming.postId ?? null,
            cid: incoming.cid ?? null,
            content: incoming.content,
            repeatCount: incoming.repeatCount ?? 1,
            read: Boolean(incoming.read),
            timestamp: incoming.createdAt || new Date().toISOString(),
            postImage: null,
            postTitle: null,
          });
        },
        error: (err) => console.error("Notification subscription error:", err),
        complete: () => {},
      }
    );
    return () => unsubscribe();
  },

  subscribeToNotificationUnreadCount: (onCount: (count: number) => void) => {
    const unsubscribe = wsClient.subscribe(
      {
        query: `
          subscription {
            notificationUnreadCountUpdated {
              count
            }
          }
        `,
      },
      {
        next: (data) => {
          const count = (data as any)?.data?.notificationUnreadCountUpdated?.count;
          if (typeof count === "number") onCount(count);
        },
        error: (err) => console.error("Notification unread count subscription error:", err),
        complete: () => {},
      }
    );
    return () => unsubscribe();
  },

  markNotificationAsRead: async (notificationId: string) => {
    const mutation = `
      mutation MarkNotificationAsRead($notificationId: ID!) {
        markNotificationAsRead(notificationId: $notificationId) {
          id
          read
        }
      }
    `;
    const result = await graphqlRequest<{ markNotificationAsRead: { id: string; read: boolean } }>(mutation, { notificationId });
    return result.markNotificationAsRead.read;
  },

  markAllNotificationsAsRead: async (username: string) => {
    const mutation = `
      mutation MarkAllNotificationsAsRead($username: String!) {
        markAllNotificationsAsRead(username: $username) {
          success
        }
      }
    `;
    const result = await graphqlRequest<{ markAllNotificationsAsRead: { success: boolean } }>(mutation, { username });
    return result.markAllNotificationsAsRead.success;
  },

  registerPushSubscription: async (input: {
    endpoint: string;
    auth: string;
    p256dh: string;
    userAgent?: string;
  }) => {
    const mutation = `
      mutation RegisterPushSubscription($input: PushSubscriptionInput!) {
        registerPushSubscription(input: $input) {
          success
          message
        }
      }
    `;
    const result = await graphqlRequest<{ registerPushSubscription: { success: boolean; message: string } }>(
      mutation,
      { input },
    );
    return result.registerPushSubscription;
  },

  unregisterPushSubscription: async (endpoint: string) => {
    const mutation = `
      mutation UnregisterPushSubscription($endpoint: String!) {
        unregisterPushSubscription(endpoint: $endpoint) {
          success
          message
        }
      }
    `;
    const result = await graphqlRequest<{ unregisterPushSubscription: { success: boolean; message: string } }>(
      mutation,
      { endpoint },
    );
    return result.unregisterPushSubscription;
  },

  clearAllNotifications: async (userId: string) => {
    const mutation = `
      mutation ClearAllNotifications($userId: String!) {
        clearAllNotifications(userId: $userId) {
          success
        }
      }
    `;
    const result = await graphqlRequest<{ clearAllNotifications: { success: boolean } }>(mutation, { userId });
    return result.clearAllNotifications.success;
  },

  getUnreadNotificationCount: async (): Promise<number> => {
    const query = `
      query GetUnreadNotificationCount {
        getUnreadNotificationCount {
          count
        }
      }
    `;
    const result = await graphqlRequest<{ getUnreadNotificationCount: { count: number } }>(query);
    return result.getUnreadNotificationCount.count;
  },
};
