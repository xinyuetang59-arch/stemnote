/**
 * 发帖页面
 */
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PostForm from '../components/community/PostForm';

export default function NewPostPage() {
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

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif mb-6">
        发布帖子
      </h1>

      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <PostForm />
      </div>
    </div>
  );
}
