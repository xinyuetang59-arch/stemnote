/**
 * 帖子筛选组件
 * 按学校和帖子类型筛选，显示筛选结果数量
 */
import { Filter, X } from 'lucide-react';
import { usePostStore } from '../../stores/postStore';
import { POST_TYPE_LABELS, type PostType } from '../../lib/db';
import { SCHOOLS } from '../../lib/utils';

export default function PostFilters() {
  const { posts, filters, setFilter, clearFilters } = usePostStore();

  const hasFilters = Boolean(filters.school || filters.type);
  const filteredCount = usePostStore.getState().getFilteredPosts().length;
  const totalCount = posts.length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />

        {/* 学校筛选 */}
        <select
          value={filters.school}
          onChange={(e) => setFilter({ school: e.target.value })}
          className={`text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition-colors ${
            filters.school
              ? 'border-brand-gold bg-brand-gold/5'
              : 'border-slate-200 dark:border-slate-600'
          }`}
        >
          <option value="">全部学校</option>
          {SCHOOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* 类型筛选 */}
        <select
          value={filters.type}
          onChange={(e) => setFilter({ type: e.target.value as PostType | '' })}
          className={`text-sm border rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition-colors ${
            filters.type
              ? 'border-brand-gold bg-brand-gold/5'
              : 'border-slate-200 dark:border-slate-600'
          }`}
        >
          <option value="">全部类型</option>
          {(Object.entries(POST_TYPE_LABELS) as [PostType, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* 清除筛选 */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-3 h-3" />
            清除筛选
          </button>
        )}

        {/* 筛选结果计数 */}
        {hasFilters && (
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
            显示 {filteredCount}/{totalCount} 篇帖子
          </span>
        )}
      </div>
    </div>
  );
}
