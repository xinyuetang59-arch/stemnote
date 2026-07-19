/**
 * 帖子卡片组件
 * 用于社区列表中展示帖子摘要
 */
import { Link } from 'react-router-dom';
import { MessageCircle, Music, User, Download } from 'lucide-react';
import type { Post } from '../../lib/db';
import { POST_TYPE_LABELS } from '../../lib/db';
import { formatDate, truncateText } from '../../lib/utils';

interface PostCardProps {
  post: Post;
  commentCount?: number;
}

export default function PostCard({ post, commentCount = 0 }: PostCardProps) {
  const typeLabel = POST_TYPE_LABELS[post.type] || post.type;

  return (
    <Link
      to={`/post/${post.id}`}
      className="block bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md hover:border-brand-gold/30 transition-all animate-fade-in"
    >
      {/* 顶部：类型标签 + 时间 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold">
          {typeLabel}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {formatDate(post.createdAt)}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-2 line-clamp-2">
        {post.title}
      </h3>

      {/* 内容摘要 */}
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 line-clamp-2">
        {truncateText(post.content, 150)}
      </p>

      {/* 底部：作者 + 学校 + 评论数 + 附件 */}
      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {post.author}
          </span>
          <span>{post.school}</span>
        </div>
        <div className="flex items-center gap-3">
          {post.attachments && post.attachments.length > 0 && (
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" />
              {post.attachments.length}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {commentCount}
          </span>
        </div>
      </div>
    </Link>
  );
}
