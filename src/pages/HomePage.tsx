/**
 * 首页 - 社区帖子列表
 * 显示帖子卡片流 + 筛选栏 + 发帖入口
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Music } from 'lucide-react';
import { usePostStore } from '../stores/postStore';
import PostCard from '../components/community/PostCard';
import PostFilters from '../components/community/PostFilters';
import Loading, { PostSkeleton } from '../components/ui/Loading';
import EmptyState from '../components/ui/EmptyState';

export default function HomePage() {
  const { posts, loading, loaded, loadPosts, getFilteredPosts } = usePostStore();

  useEffect(() => {
    if (!loaded) {
      loadPosts();
    }
  }, [loaded, loadPosts]);

  const filtered = getFilteredPosts();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif">
            校园乐谱社区
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            分享扒谱作品，寻找演奏伙伴
          </p>
        </div>
        <Link
          to="/new-post"
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-gold text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-gold-light transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          发布帖子
        </Link>
      </div>

      {/* 筛选栏 */}
      <div className="mb-6">
        <PostFilters />
      </div>

      {/* 帖子列表 */}
      {loading && !loaded ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Music className="w-16 h-16" />}
          title="还没有帖子"
          description="成为第一个分享扒谱作品的人吧！"
          action={
            <Link
              to="/new-post"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-navy rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors"
            >
              <Plus className="w-4 h-4" />
              发布第一个帖子
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
