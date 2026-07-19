/**
 * 帖子详情页
 * 显示完整帖子内容 + 评论区
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2, Download, User, Calendar } from 'lucide-react';
import { usePostStore } from '../stores/postStore';
import { useUserStore } from '../stores/userStore';
import { useUIStore } from '../stores/uiStore';
import { POST_TYPE_LABELS } from '../lib/db';
import { formatDate, formatFileSize } from '../lib/utils';
import CommentSection from '../components/community/CommentSection';
import Loading from '../components/ui/Loading';

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentPost, comments, loading, loadPost, removePost } = usePostStore();
  const profile = useUserStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (id) {
      loadPost(Number(id));
    }
  }, [id, loadPost]);

  const handleDelete = async () => {
    if (!currentPost?.id || !confirm('确定要删除这篇帖子吗？此操作不可撤销。')) return;
    try {
      await removePost(currentPost.id);
      addToast('帖子已删除', 'success');
      navigate('/');
    } catch {
      addToast('删除失败，请重试', 'error');
    }
  };

  const handleDownloadAttachment = (att: { name: string; data: Blob; type: string }) => {
    const url = URL.createObjectURL(att.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Loading fullPage text="加载帖子详情..." />;
  }

  if (!currentPost) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-2">帖子不存在</h2>
        <p className="text-slate-500 mb-4">该帖子可能已被删除</p>
        <Link to="/" className="text-brand-gold hover:underline">
          返回社区首页
        </Link>
      </div>
    );
  }

  const isAuthor = profile?.id === currentPost.authorId;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* 返回按钮 */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        返回社区
      </Link>

      {/* 帖子内容 */}
      <article className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        {/* 类型标签 + 作者操作 */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold">
            {POST_TYPE_LABELS[currentPost.type] || currentPost.type}
          </span>
          {isAuthor && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="编辑"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                aria-label="删除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* 标题 */}
        <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
          {currentPost.title}
        </h1>

        {/* 内容 */}
        <div className="prose prose-sm max-w-none text-slate-700 dark:text-slate-300 mb-6 whitespace-pre-wrap leading-relaxed">
          {currentPost.content}
        </div>

        {/* 附件 */}
        {currentPost.attachments && currentPost.attachments.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-700 pt-4 mb-4">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">附件</h4>
            <div className="flex flex-wrap gap-2">
              {currentPost.attachments.map((att, i) => (
                <button
                  key={i}
                  onClick={() => handleDownloadAttachment(att)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <Download className="w-4 h-4 text-brand-gold" />
                  <span>{att.name}</span>
                  <span className="text-xs text-slate-400">{formatFileSize(att.size)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 作者信息 */}
        <div className="flex items-center gap-4 text-sm text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-4">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {currentPost.author}
          </span>
          <span>{currentPost.school}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(currentPost.createdAt)}
          </span>
        </div>
      </article>

      {/* 评论区 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <CommentSection postId={currentPost.id!} comments={comments} />
      </div>
    </div>
  );
}
