/**
 * 我的帖子页面
 * 显示当前用户发布的所有帖子
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, User } from 'lucide-react';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { getPostsByAuthor, type Post } from '../lib/db';
import PostCard from '../components/community/PostCard';
import Loading from '../components/ui/Loading';
import EmptyState from '../components/ui/EmptyState';

export default function MyPostsPage() {
  const profile = useUserStore((s) => s.profile);
  const { posts: allPosts, loaded } = usePostStore();
  const [myPosts, setMyPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (profile) {
      getPostsByAuthor(profile.id).then(setMyPosts);
    }
  }, [profile, allPosts]);

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <User className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">
          请先设置用户信息
        </h2>
        <p className="text-slate-500 mb-4">设置昵称和学校后即可查看您的帖子</p>
        <Link
          to="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-navy rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors"
        >
          去设置
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif">
          我的帖子
        </h1>
        <Link
          to="/new-post"
          className="flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-gold-light transition-colors"
        >
          <Plus className="w-4 h-4" />
          发布新帖
        </Link>
      </div>

      {!loaded ? (
        <Loading text="加载中..." />
      ) : myPosts.length === 0 ? (
        <EmptyState
          icon={<User className="w-16 h-16" />}
          title="还没有帖子"
          description="您还没有发布过帖子，快去分享您的扒谱作品吧"
          action={
            <Link
              to="/new-post"
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-gold text-brand-navy rounded-lg text-sm font-medium hover:bg-brand-gold-light transition-colors"
            >
              <Plus className="w-4 h-4" />
              发布第一条帖子
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {myPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
