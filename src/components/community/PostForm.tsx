/**
 * 帖子表单组件
 * 用于创建和编辑帖子
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Save } from 'lucide-react';
import { usePostStore } from '../../stores/postStore';
import { useUIStore } from '../../stores/uiStore';
import { useUserStore } from '../../stores/userStore';
import { POST_TYPE_LABELS, type PostType, type Attachment } from '../../lib/db';
import { SCHOOLS } from '../../lib/utils';
import AttachmentUpload from './AttachmentUpload';

interface PostFormProps {
  /** 编辑模式：传入已有帖子数据进行编辑 */
  editPost?: {
    id: number;
    title: string;
    content: string;
    type: PostType;
    attachments: Attachment[];
  };
  onCancel?: () => void;
}

export default function PostForm({ editPost, onCancel }: PostFormProps) {
  const navigate = useNavigate();
  const addPost = usePostStore((s) => s.addPost);
  const editPostAction = usePostStore((s) => s.editPost);
  const addToast = useUIStore((s) => s.addToast);
  const profile = useUserStore((s) => s.profile);

  const [title, setTitle] = useState(editPost?.title || '');
  const [content, setContent] = useState(editPost?.content || '');
  const [type, setType] = useState<PostType>(editPost?.type || 'transcription');
  const [attachments, setAttachments] = useState<Attachment[]>(editPost?.attachments || []);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile) {
      addToast('请先在设置页面填写昵称和学校', 'warning');
      navigate('/settings');
      return;
    }

    if (!title.trim()) {
      addToast('请输入帖子标题', 'warning');
      return;
    }

    if (!content.trim()) {
      addToast('请输入帖子内容', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editPost) {
        await editPostAction(editPost.id, {
          title: title.trim(),
          content: content.trim(),
          type,
          attachments,
        });
        addToast('帖子已更新', 'success');
        onCancel?.();
      } else {
        const id = await addPost(title.trim(), content.trim(), type, attachments);
        addToast('帖子发布成功！', 'success');
        navigate(`/post/${id}`);
      }
    } catch (error) {
      addToast('操作失败，请重试', 'error');
      console.error('提交帖子失败:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 标题 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          标题 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="请输入帖子标题（≤100字符）"
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold transition-colors"
        />
        <p className="text-xs text-slate-400 mt-1">{title.length}/100</p>
      </div>

      {/* 内容 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="支持 Markdown 语法。分享你的扒谱作品、寻求帮助或寻找演奏伙伴..."
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 focus:border-brand-gold transition-colors resize-y min-h-[200px]"
        />
      </div>

      {/* 帖子类型 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          帖子类型
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(POST_TYPE_LABELS) as [PostType, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setType(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                type === key
                  ? 'bg-brand-gold text-brand-navy'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 所属学校（只读显示） */}
      {profile && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            所属学校
          </label>
          <p className="text-sm text-slate-500 dark:text-slate-400">{profile.school}</p>
        </div>
      )}

      {/* 附件上传 */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          附件（可选）
        </label>
        <AttachmentUpload attachments={attachments} onAttachmentsChange={setAttachments} />
      </div>

      {/* 提交按钮 */}
      <div className="flex gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            取消
          </button>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-gold-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>处理中...</>
          ) : editPost ? (
            <><Save className="w-4 h-4" /> 保存修改</>
          ) : (
            <><Send className="w-4 h-4" /> 发布帖子</>
          )}
        </button>
      </div>
    </form>
  );
}
