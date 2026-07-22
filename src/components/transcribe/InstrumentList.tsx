/**
 * 乐器列表侧边栏组件
 * 每个乐器维护独立的音符音轨，可切换查看和编辑
 */
import { Music, Mic, Guitar, Disc, Drum, Copy } from 'lucide-react';
import { useTranscribeStore } from '../../stores/transcribeStore';

const INSTRUMENTS = [
  { id: 'piano', name: '钢琴', icon: Music, color: 'text-blue-500' },
  { id: 'guitar', name: '吉他', icon: Guitar, color: 'text-green-500' },
  { id: 'bass', name: '贝斯', icon: Disc, color: 'text-purple-500' },
  { id: 'vocal', name: '人声', icon: Mic, color: 'text-pink-500' },
  { id: 'drums', name: '鼓', icon: Drum, color: 'text-orange-500' },
  { id: 'other', name: '其他', icon: Music, color: 'text-slate-500' },
];

export default function InstrumentList() {
  const { instrument, setInstrument, tracks, copyTrackTo } = useTranscribeStore();

  const currentNotes = tracks[instrument] || [];
  const hasAnyNotes = Object.values(tracks).some((t) => t.length > 0);

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">乐器音轨</h3>
      </div>
      <div className="p-2">
        {INSTRUMENTS.map((inst) => {
          const count = (tracks[inst.id] || []).length;
          const isActive = instrument === inst.id;

          return (
            <button
              key={inst.id}
              onClick={() => setInstrument(inst.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-gold/10 text-brand-gold font-medium'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
              }`}
            >
              <inst.icon className={`w-4 h-4 ${inst.color}`} />
              <span>{inst.name}</span>
              {hasAnyNotes && (
                <span className="ml-auto text-xs text-slate-400">
                  {count > 0 ? count : '空'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 操作区 */}
      {hasAnyNotes && currentNotes.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-700">
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">
            将当前音轨复制到：
          </p>
          <div className="flex flex-wrap gap-1.5">
            {INSTRUMENTS.filter((i) => i.id !== instrument).map((inst) => (
              <button
                key={inst.id}
                onClick={(e) => {
                  e.stopPropagation();
                  copyTrackTo(inst.id);
                }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                title={`复制到${inst.name}`}
              >
                <Copy className="w-3 h-3" />
                {inst.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          分析完成后音符分配到当前选中乐器。可将音轨复制到其他乐器后再独立编辑。
        </p>
      </div>
    </div>
  );
}
