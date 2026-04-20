"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Bot,
  Users,
  UserCheck,
  Heart,
  FileText,
  Loader2,
  X,
  Circle,
} from "lucide-react";

// Components
import { Sidebar } from "@/components/ui/sidebar";
import { PostCard } from "@/components/feed/pcard";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { InitialsAvatarFallback } from "@/components/ui/initials";
import { Button } from "@/components/ui/button";
import { useSessionUser } from "@/lib/session";
import { api, type FeedPost, type FollowUser } from "@/lib/api";
import { resolveImageUrl } from "@/lib/config";

// Utils
import { formatCompactNumber } from "@/lib/utils/format";

// Types
interface UserProfileData {
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
  role?: string;
}

interface UserStats {
  totalPosts: number;
  totalComments: number;
  totalLikes: number;
  totalFollowers: number;
  totalFollowing: number;
}

type ProfilePostView = "posts" | "anonymous";

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user: sessionUser } = useSessionUser();

  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  // Modal States
  const [showFollowModal, setShowFollowModal] = useState<{
    type: "followers" | "following";
    open: boolean;
    users: FollowUser[];
    loading: boolean;
    nextOffset: number | null;
  }>({ type: "followers", open: false, users: [], loading: false, nextOffset: null });

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowPending, setIsFollowPending] = useState(false);
  const [activePostView, setActivePostView] = useState<ProfilePostView>("posts");
  const [isOnline, setIsOnline] = useState(false);

  const LIMIT_BIO = 100;

  // Country Name Helper (Simple map for now, expand as needed)
  const getCountryName = (code: string) => {
    // In a real app, import your countries.json here
    return code || "Unknown";
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

  // Fetch Profile Data
  useEffect(() => {
    if (!username) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [profileRes, statsRes] = await Promise.all([
          api.getProfile(username),
          api.getUserStats(username),
        ]);

        setProfile(profileRes);
        setStats(statsRes);

        if (sessionUser && !profileRes.isOwner) {
          try {
            const followingStatus = await api.isFollowing(profileRes.username);
            setIsFollowing(followingStatus);
          } catch {
            setIsFollowing(false);
          }
        } else {
          setIsFollowing(false);
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        // Optional: Navigate to 404
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [username, sessionUser]);

  useEffect(() => {
    if (!profile?.username) return;
    let mounted = true;

    const refreshPresence = async () => {
      try {
        const online = await api.isUserOnline(profile.username);
        if (mounted) setIsOnline(online);
      } catch (error) {
        if (mounted) setIsOnline(false);
      }
    };

    refreshPresence();
    const id = window.setInterval(refreshPresence, 8000);

    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [profile?.username]);

  // Fetch Posts
  const fetchPosts = async (currentOffset: number, append = false) => {
    if (!username) return;
    setPostsLoading(true);
    try {
      const result = await api.getUserPosts(username, currentOffset, LIMIT);
      
      if (append) {
        setPosts((prev) => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }
      
      setHasMore(result.hasMore);
      setOffset(currentOffset + LIMIT);
    } catch (error) {
      console.error("Failed to load posts:", error);
    } finally {
      setPostsLoading(false);
    }
  };

  useEffect(() => {
    if (profile && !loading) {
      fetchPosts(0, false);
    }
  }, [profile, loading]);

  // Handlers
  const handleFollowToggle = async () => {
    if (!profile || !sessionUser || isFollowPending) return;

    setIsFollowPending(true);
    try {
      const res = await api.toggleFollow(profile.username);
      setIsFollowing(res.isFollowing);

      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, followersCount: res.followersCount };
      });

      if (stats) {
        setStats({
          ...stats,
          totalFollowers: res.followersCount,
        });
      }
    } catch (error) {
      console.error("Follow toggle failed:", error);
    } finally {
      setIsFollowPending(false);
    }
  };

  const openFollowModal = async (type: "followers" | "following") => {
    if (!profile) return;
    setShowFollowModal({ ...showFollowModal, type, open: true, loading: true });
    try {
      const method = type === "followers" ? api.getFollowers : api.getFollowing;
      const result = await method(profile.username, 0, 20);
      setShowFollowModal({
        type,
        open: true,
        users: result.users,
        loading: false,
        nextOffset: result.nextOffset,
      });
    } catch (error) {
      console.error("Failed to load list:", error);
      setShowFollowModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const loadMoreFollowList = async () => {
    if (!profile || showFollowModal.nextOffset === null) return;
    setShowFollowModal((prev) => ({ ...prev, loading: true }));
    try {
      const method = showFollowModal.type === "followers" ? api.getFollowers : api.getFollowing;
      const result = await method(profile.username, showFollowModal.nextOffset, 20);
      
      setShowFollowModal((prev) => ({
        ...prev,
        users: [...prev.users, ...result.users],
        nextOffset: result.nextOffset,
        loading: false,
      }));
    } catch (error) {
      setShowFollowModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const totalPublicLikesFromLoadedPosts = useMemo(
    () => posts.filter((post) => !post.anon).reduce((sum, post) => sum + (post.likesCount || 0), 0),
    [posts]
  );
  const totalLikesDisplay = hasMore ? (stats?.totalLikes ?? 0) : totalPublicLikesFromLoadedPosts;

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-14 lg:ml-14 min-h-screen bg-black">
            <div className="relative">
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-1/2 relative min-h-[40vh] lg:min-h-[40vh] flex items-center justify-center py-8 lg:py-12">
                  <div className="w-64 h-64 lg:w-80 lg:h-80 rounded-3xl border border-violet-500/10 bg-zinc-900/30 animate-pulse" />
                </div>
                <div className="lg:w-1/2 relative min-h-[40vh] lg:min-h-[50vh] bg-black flex flex-col justify-between p-6 lg:p-8">
                  <div className="space-y-3">
                    <div className="h-10 w-2/3 bg-zinc-800 rounded-lg animate-pulse mx-auto lg:mx-0" />
                    <div className="h-5 w-1/3 bg-zinc-800 rounded animate-pulse mx-auto lg:mx-0" />
                    <div className="h-4 w-1/4 bg-zinc-800 rounded animate-pulse mx-auto lg:mx-0 mt-4" />
                  </div>
                  <div className="space-y-2 py-4">
                    <div className="h-4 w-full bg-zinc-800 rounded animate-pulse" />
                    <div className="h-4 w-5/6 bg-zinc-800 rounded animate-pulse mx-auto" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                    {[...Array(4)].map((_, i) => (
                      <div key={`profile-stat-skeleton-${i}`} className="text-center space-y-2">
                        <div className="h-4 w-4 bg-zinc-800 rounded mx-auto animate-pulse" />
                        <div className="h-5 w-10 bg-zinc-800 rounded mx-auto animate-pulse" />
                        <div className="h-3 w-12 bg-zinc-800 rounded mx-auto animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/5 py-3">
              <div className="flex items-center justify-center px-4">
                <div className="h-9 w-56 rounded-full border border-white/10 bg-zinc-900/30 animate-pulse" />
              </div>
            </div>
            <div className="w-full p-4 md:p-6 pb-20">
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {[...Array(8)].map((_, i) => (
                  <PostCard
                    key={`profile-skeleton-${i}`}
                    id=""
                    author={{
                      fullName: "",
                      username: "",
                      avatarUrl: null,
                      initials: "",
                    }}
                    content=""
                    images={null}
                    likesCount={0}
                    userHasLiked={false}
                    commentsCount={0}
                    timestamp=""
                    skeleton
                  />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
        <p className="text-gray-400 mb-6">The profile you are looking for doesn't exist.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const displayName = profile.fullName;
  const handle = profile.username;
  const isOwner = profile.isOwner;
  const visiblePosts = posts.filter((post) => {
    if (activePostView === "anonymous") return isOwner && post.anon;
    return !post.anon;
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 ml-14 lg:ml-14 min-h-screen bg-black">
          
          {/* Profile Header Split Layout */}
          <div className="relative">
            <div className="flex flex-col lg:flex-row">
              
              {/* Left Section - Avatar (Large Centered on Mobile, Left on Desktop) */}
              <div className="lg:w-1/2 relative min-h-[40vh] lg:min-h-[40vh] flex items-center justify-center py-8 lg:py-12">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <Avatar
                    className="w-64 h-64 lg:w-80 lg:h-80 rounded-3xl border border-violet-500/10 bg-violet-500/[0.03] flex items-center justify-center overflow-hidden shadow-xl shadow-violet-500/[0.05]"
                  >
                    <AvatarImage
                      src={resolveImageUrl(profile.avatarUrl)}
                      alt={displayName}
                      className="w-full h-full object-cover rounded-3xl"
                    />
                    <InitialsAvatarFallback
                      initials={displayName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase()}
                      className="text-8xl bg-transparent lg:text-8xl rounded-5xl"
                    />
                  </Avatar>
                </motion.div>
              </div>

              {/* Right Section - Info & Stats */}
              <div className="lg:w-1/2 relative min-h-[40vh] lg:min-h-[50vh] bg-black flex flex-col justify-between p-6 lg:p-8">
                
                {/* Top: Name, Handle, Action */}
                <div className="text-center lg:text-left">
                  <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-4">
                    <div>
                      <h1 className="text-3xl lg:text-4xl font-bold text-white tracking-tight">
                        {displayName}
                      </h1>
                      <p className="text-gray-400 flex justify-center text-lg mt-1">@{handle}</p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
                        <Circle className={`w-2.5 h-2.5 ${isOnline ? "text-green-400 fill-green-400" : "text-zinc-600"}`} />
                        {isOnline ? "Online" : "Offline"}
                      </p>
                      
                      {profile.role === "bot" ? (
                        <p className="text-xs text-fuchsia-400 mt-2 flex items-center justify-center lg:justify-center gap-1">
                          <Bot className="w-3 h-3" /> Bot
                        </p>
                      ) : profile.country ? (
                        <p className="text-xs text-gray-500 mt-2 flex items-center justify-center lg:justify-center gap-1">
                          <MapPin className="w-3 h-3" /> {getCountryName(profile.country)}
                        </p>
                      ) : null}
                    </div>

                    {!isOwner && sessionUser && (
                      isFollowPending ? (
                        <div
                          aria-hidden="true"
                          className={`rounded-full px-6 py-2 border text-sm font-medium ${
                            isFollowing
                              ? "bg-white/[0.05] border-white/10"
                              : "bg-violet-500/30 border-transparent"
                          }`}
                        >
                          <span className="inline-block h-4 w-20 rounded bg-white/30 animate-pulse" />
                        </div>
                      ) : (
                        <Button
                          onClick={handleFollowToggle}
                          disabled={isFollowPending}
                          variant={isFollowing ? "outline" : "default"}
                          className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${
                            isFollowing
                              ? "bg-white/[0.05] text-white border border-white/10 hover:border-red-400 hover:text-red-400"
                              : "bg-violet-500 text-white hover:bg-violet-600 border-transparent"
                          }`}
                        >
                          {isFollowing ? "Following" : "Follow"}
                        </Button>
                      )
                    )}
                  </div>
                </div>

                {/* Middle: Bio */}
                <div className="text-center py-2">
                  <div className="w-full">
                    {profile.bio ? (
                      <p className="font-dancing-script text-gray-300 text-lg sm:text-2xl leading-relaxed whitespace-pre-wrap break-words text-center">
                        {profile.bio.slice(0, LIMIT_BIO)}
                      </p>
                    ) : (
                      <p className="text-gray-500 text-sm italic text-center">No bio yet</p>
                    )}
                  </div>
                </div>

                {/* Bottom: Stats Grid */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm">
                  {/* Posts */}
                  <div className="text-center group cursor-default">
                    <div className="flex items-center justify-center gap-1.5 text-violet-400 mb-1">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="text-base sm:text-lg font-bold text-white">
                      {formatCompactNumber(stats?.totalPosts || profile.postsCount)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Posts</div>
                  </div>

                  {/* Followers */}
                  <button 
                    onClick={() => openFollowModal("followers")}
                    className="text-center hover:opacity-80 transition-opacity focus:outline-none"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-fuchsia-400 mb-1">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-base sm:text-lg font-bold text-white">
                      {formatCompactNumber(stats?.totalFollowers || profile.followersCount)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Followers</div>
                  </button>

                  {/* Following */}
                  <button 
                    onClick={() => openFollowModal("following")}
                    className="text-center hover:opacity-80 transition-opacity focus:outline-none"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-pink-400 mb-1">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="text-base sm:text-lg font-bold text-white">
                      {formatCompactNumber(stats?.totalFollowing || profile.followingCount)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Following</div>
                  </button>

                  {/* Likes */}
                  <div className="text-center group cursor-default">
                    <div className="flex items-center justify-center gap-1.5 text-rose-400 mb-1">
                      <Heart className="w-4 h-4" />
                    </div>
                  <div className="text-base sm:text-lg font-bold text-white">
                      {formatCompactNumber(totalLikesDisplay)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">Likes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs (Visual Only for now) */}
          <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/5 py-3">
            <div className="flex items-center justify-center px-4">
              <div className="inline-flex items-center justify-center px-1 py-1 rounded-full border border-white/10 bg-white/[0.02]">
                <button
                  onClick={() => setActivePostView("posts")}
                  className={`py-1.5 px-6 rounded-full font-medium text-sm transition-colors border ${
                    activePostView === "posts"
                      ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                      : "text-gray-400 border-transparent hover:text-white"
                  }`}
                >
                  Posts
                </button>
                {isOwner && (
                  <button
                    onClick={() => setActivePostView("anonymous")}
                    className={`py-1.5 px-6 rounded-full font-medium text-sm transition-colors border ${
                      activePostView === "anonymous"
                        ? "bg-violet-500/10 text-violet-400 border-violet-500/20"
                        : "text-gray-400 border-transparent hover:text-white"
                    }`}
                  >
                    Anonymous
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Posts Grid */}
          <div className="w-full p-4 md:p-6 pb-20">
            {postsLoading && visiblePosts.length === 0 ? (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {[...Array(8)].map((_, i) => (
                  <PostCard
                    key={`profile-posts-skeleton-${i}`}
                    id=""
                    author={{
                      fullName: "",
                      username: "",
                      avatarUrl: null,
                      initials: "",
                    }}
                    content=""
                    images={null}
                    likesCount={0}
                    userHasLiked={false}
                    commentsCount={0}
                    timestamp=""
                    skeleton
                  />
                ))}
              </div>
            ) : visiblePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-500 text-sm font-medium">
                  {activePostView === "anonymous" ? "No anonymous posts yet" : "No posts yet"}
                </p>
                {isOwner && (
                  <button 
                    onClick={() => navigate("/create")}
                    className="mt-4 text-violet-400 text-sm hover:text-violet-300"
                  >
                    Create your first post
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                  {visiblePosts.map((post) => (
                    <PostCard
                      key={post.id}
                      id={post.id}
                      author={post.author}
                      content={post.content}
                      images={post.images}
                      imagePreviews={post.imagePreviews}
                      likesCount={post.likesCount}
                      userHasLiked={post.userHasLiked}
                      commentsCount={post.commentsCount}
                      timestamp={post.timestamp}
                      anon={post.anon}
                      onPostDeleted={(deletedId) => {
                        setPosts((prev) => prev.filter((p) => p.id !== deletedId));
                      }}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-10">
                    <Button
                      variant="outline"
                      onClick={() => fetchPosts(offset, true)}
                      disabled={postsLoading}
                      className="bg-white/[0.05] hover:bg-white/[0.08] border-white/10 text-white rounded-xl px-8 py-3"
                    >
                      {postsLoading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Follow Modal */}
      <AnimatePresence>
        {showFollowModal.open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFollowModal((prev) => ({ ...prev, open: false }))}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-black border-l border-violet-500/20 z-50 flex flex-col shadow-xl"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-violet-500/20">
                <h3 className="text-sm font-semibold text-white capitalize">
                  {showFollowModal.type}
                </h3>
                <button
                  onClick={() => setShowFollowModal((prev) => ({ ...prev, open: false }))}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {showFollowModal.loading && showFollowModal.users.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
                  </div>
                ) : showFollowModal.users.length === 0 ? (
                  <div className="text-center text-gray-500 py-10">
                    No {showFollowModal.type} found.
                  </div>
                ) : (
                  <>
                    {showFollowModal.users.map((u) => (
                      <div
                        key={u.username}
                        onClick={() => {
                          setShowFollowModal((prev) => ({ ...prev, open: false }));
                          navigate(`/${u.username}`);
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:border-white/10 hover:bg-white/[0.05] transition-all cursor-pointer group"
                      >
                        <Avatar size="lg" className="border border-violet-500/20 bg-transparent">
                          <AvatarImage src={resolveImageUrl(u.avatarUrl)} alt={u.fullName} />
                          
                          <InitialsAvatarFallback
                            initials={getInitialsFromName(u.fullName)}
                            className="bg-violet-500/20 text-[1rem] bg-transparent text-violet-300"
                          />
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate group-hover:text-violet-300 transition-colors">
                            {u.fullName}
                          </div>
                          <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                        </div>
                      </div>
                    ))}
                    {showFollowModal.nextOffset !== null && (
                      <button
                        onClick={loadMoreFollowList}
                        disabled={showFollowModal.loading}
                        className="w-full py-3 text-sm text-gray-400 hover:text-white disabled:opacity-50"
                      >
                        {showFollowModal.loading ? "Loading..." : "Load More"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
