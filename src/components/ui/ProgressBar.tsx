/**
 * 进度条组件 - 带动画
 */
interface ProgressBarProps {
  percent: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'gold' | 'blue' | 'green';
}

export default function ProgressBar({ percent, label, size = 'md', color = 'gold' }: ProgressBarProps) {
  const heightClasses = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
  const colorClasses = {
    gold: 'bg-brand-gold',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  };

  return (
    <div className="w-full">
      {(label || percent > 0) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>}
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{Math.round(percent)}%</span>
        </div>
      )}
      <div className={`w-full ${heightClasses[size]} bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden`}>
        <div
          className={`${heightClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
