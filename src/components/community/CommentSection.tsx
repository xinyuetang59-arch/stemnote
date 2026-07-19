/**
 * 评论区组件
 * 支持一级评论 + 回复（最多嵌套2层）
 */
import { useState } from 'react';
import { MessageCircle, Trash2, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { usePostStore } from '../../stores/postStore';
import { useUserStore } from '../../stores/userStore';
import { useUIStore } from '../../stores/uiStore';
import type { Comment } from '../../lib/db';
import { formatDate } from '../../lib/utils';

interface CommentSectionProps {
  postId: number;
  comments: Comment[];
}

export default function CommentSection({ postId, comments }: CommentSectionProps) {
  const { addComment, removeComment, loadComments } = usePostStore();
  const profile = useUserStore((s) => s.profile);
  const addToast = useUIStore((s) => s.addToast);

  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<number>>(new Set());

  // 一级评论
  const topLevel = comments.filter((c) => !c.parentId);
  // 子回复
  const getReplies = (parentId: number) => comments.filter((c) => c.parentId === parentId);

  const handleAddComment = async (parentId: number | null, content: string, clearFn: () => void) => {
    if (!profile) {
      addToast('请先设置昵称后再评论', 'warning');
      return;
    }
    if (!content.trim()) {
      addToast('请输入评论内容', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await addComment(postId, content.trim(), parentId);
      clearFn();
      addToast('评论发表成功', 'success');
      await loadComments(postId);
    } catch (error) {
      addToast('评论失败，请重试', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('确定删除这条评论吗？')) return;
    try {
      await removeComment(commentId);
      addToast('评论已删除', 'success');
      await loadComments(postId);
    } catch {
      addToast('删除失败', 'error');
    }
  };

  const toggleReplies = (commentId: number) => {
    const next = new Set(expandedReplies);
    if (next.has(commentId)) {
      next.delete(commentId);
    } else {
      next.add(commentId);
    }
    setExpandedReplies(next);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-brand-gold" />
        评论 ({comments.length})
      </h3>

      {/* 发表评论 */}
      <div className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={profile ? '写下你的评论...' : '请先在设置中填写昵称'}
          rows={3}
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 resize-none"
        />
        <button
          onClick={() => handleAddComment(null, newComment, () => setNewComment(''))}
          disabled={submitting || !newComment.trim()}
          className="px-4 py-2 bg-brand-gold text-brand-navy rounded-lg text-sm font-medium hover:bg-brand-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '发表中...' : '发表评论'}
        </button>
      </div>

      {/* 评论列表 */}
      <div className="space-y-4">
        {topLevel.map((comment) => {
          const replies = getReplies(comment.id!);
          const isExpanded = expandedReplies.has(comment.id!);

          return (
            <div key={comment.id} className="space-y-2">
              {/* 一级评论 */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {comment.author}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  {profile?.id === comment.authorId && (
                    <button
                      onClick={() => handleDelete(comment.id!)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      aria-label="删除评论"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {comment.content}
                </p>
                <button
                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id!)}
                  className="flex items-center gap-1 mt-2 text-xs text-slate-400 hover:text-brand-gold transition-colors"
                >
                  <Reply className="w-3 h-3" />
                  回复
                </button>

                {/* 回复输入框 */}
                {replyTo === comment.id && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={`回复 @${comment.author}...`}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddComment(comment.id!, replyContent, () => {
                          setReplyContent('');
                          setReplyTo(null);
                        })}
                        disabled={submitting || !replyContent.trim()}
                        className="px-3 py-1 bg-brand-gold text-brand-navy rounded text-xs font-medium hover:bg-brand-gold-light disabled:opacity-50"
                      >
                        回复
                      </button>
                      <button
                        onClick={() => { setReplyTo(null); setReplyContent(''); }}
                        className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 回复列表 */}
              {replies.length > 0 && (
                <div className="ml-6 space-y-2">
                  <button
                    onClick={() => toggleReplies(comment.id!)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-brand-gold transition-colors"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? '收起' : `展开 ${replies.length} 条回复`}
                  </button>

                  {isExpanded && replies.map((reply) => (
                    <div key={reply.id} className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border-l-2 border-brand-gold/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                            {reply.author}
                          </span>
                          <span className="text-xs text-slate-400">
                            {formatDate(reply.createdAt)}
                          </span>
                        </div>
                        {profile?.id === reply.authorId && (
                          <button
                            onClick={() => handleDelete(reply.id!)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        {reply.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {topLevel.length === 0 && (
          <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm">
            暂无评论，来发表第一条评论吧
          </p>
        )}
      </div>
    </div>
  );
}
