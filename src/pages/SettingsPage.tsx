/**
 * 用户设置页面
 * 昵称和学校设置 + 数据管理
 */
import { useState } from 'react';
import { Save, User, School, Download, Upload, AlertCircle } from 'lucide-react';
import { useUserStore } from '../stores/userStore';
import { useUIStore } from '../stores/uiStore';
import { SCHOOLS } from '../lib/utils';
import { exportAllData, importData } from '../lib/db';
import { usePostStore } from '../stores/postStore';

export default function SettingsPage() {
  const { profile, setProfile } = useUserStore();
  const addToast = useUIStore((s) => s.addToast);
  const loadPosts = usePostStore((s) => s.loadPosts);

  const [nickname, setNickname] = useState(profile?.nickname || '');
  const [school, setSchool] = useState(profile?.school || '');
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!nickname.trim()) {
      addToast('请输入昵称', 'warning');
      return;
    }
    if (!school) {
      addToast('请选择学校', 'warning');
      return;
    }

    setSaving(true);
    try {
      setProfile(nickname.trim(), school);
      addToast('设置已保存', 'success');
    } catch {
      addToast('保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportData = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stemnote-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast('数据导出成功', 'success');
    } catch {
      addToast('导出失败', 'error');
    }
  };

  const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await importData(text);
      await loadPosts();
      addToast('数据导入成功', 'success');
    } catch {
      addToast('导入失败，请检查文件格式', 'error');
    }

    // 重置 input
    e.target.value = '';
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif mb-6">
        用户设置
      </h1>

      {/* 用户信息 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 mb-6">
        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-brand-gold" />
          个人信息
        </h2>

        <div className="space-y-4">
          {/* 用户 ID（只读） */}
          {profile && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                用户 ID
              </label>
              <p className="text-sm text-slate-400 font-mono">{profile.id}</p>
            </div>
          )}

          {/* 昵称 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              昵称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="输入你的昵称（≤20字符）"
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition-colors"
            />
          </div>

          {/* 学校 */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              学校 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <School className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-gold/30 transition-colors appearance-none"
              >
                <option value="">请选择学校</option>
                {SCHOOLS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-navy rounded-xl text-sm font-semibold hover:bg-brand-gold-light disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      {/* 数据管理 */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
        <h2 className="text-base font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Download className="w-4 h-4 text-brand-gold" />
          数据管理
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              导出所有帖子和评论数据为 JSON 文件，用于备份或迁移
            </p>
            <button
              onClick={handleExportData}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出数据 (JSON)
            </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              从 JSON 备份文件导入数据（会合并到现有数据中）
            </p>
            <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              导入数据
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-start gap-2 text-xs text-slate-400 dark:text-slate-500 mt-4">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            所有数据存储在浏览器本地（IndexedDB），清除浏览器数据会导致数据丢失。建议定期导出备份。
          </div>
        </div>
      </div>
    </div>
  );
}
