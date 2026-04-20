import { useEffect, useState } from "react";
import { Sidebar } from "@/components/ui/sidebar";
import { Header } from "@/components/ui/header";
import { PostCard } from "@/components/feed/pcard";
import { api, type FeedPost } from "@/lib/api";
import { useSessionUser } from "@/lib/session";

export default function AnonymousFeed() {
  const { user } = useSessionUser();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 10;

  const fetchPosts = async (currentOffset: number) => {
    try {
      setLoading(true);
      const result = await api.getPosts(currentOffset, LIMIT);
      const anonymousOnly = result.posts.filter((p) => p.anon);

      setPosts((prev) => {
        const newPosts = anonymousOnly.filter(
          (newPost) => !prev.some((existing) => existing.id === newPost.id)
        );
        return [...prev, ...newPosts];
      });

      setHasMore(result.hasMore);
      setOffset(result.nextOffset ?? currentOffset + LIMIT);
    } catch (error) {
      console.error("Failed to fetch anonymous posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(0);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200 && !loading && hasMore) {
      fetchPosts(offset);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-black text-white flex">
      <Sidebar />
      <main className="ml-14 flex h-screen flex-1 flex-col bg-black">
        <Header />
        <div className="custom-scrollbar flex-1 min-h-0 overflow-y-auto" onScroll={handleScroll}>
          <div className="max-w-7xl mx-auto w-full p-4 md:p-6">
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
              {loading && posts.length === 0 && (
                <>
                  {[...Array(8)].map((_, i) => (
                    <PostCard
                      key={`anon-skeleton-${i}`}
                      id=""
                      author={{
                        id: "",
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
                </>
              )}
              {posts.map((post) => {
                if (!post || !post.author) return null;
                return (
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
                  />
                );
              })}
            </div>

            {loading && posts.length > 0 && (
              <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
                {[...Array(4)].map((_, i) => (
                  <PostCard
                    key={`anon-skeleton-more-${i}`}
                    id=""
                    author={{
                      id: "",
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
            )}

            {!loading && posts.length === 0 && !user && (
              <div className="py-8 text-center text-zinc-500 text-sm col-span-full">
                You're all caught up! ✨
              </div>
            )}

            {!hasMore && !loading && posts.length === 0 && user && (
              <div className="py-8 text-center text-zinc-500 text-sm col-span-full">
                You're all caught up! ✨
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
