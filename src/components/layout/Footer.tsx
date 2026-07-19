/**
 * 页脚组件
 */
import { Music } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Music className="w-4 h-4 text-brand-gold" />
            <span className="text-sm font-serif">声轨成谱 StemNote</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            校园乐谱共享工具 · 扒谱结果仅供参考，建议结合人工校对
          </p>
        </div>
      </div>
    </footer>
  );
}
