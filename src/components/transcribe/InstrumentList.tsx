/**
 * 乐器列表侧边栏组件
 * 显示可切换的乐器音轨
 */
import { Music, Mic, Guitar, Disc, Drum } from 'lucide-react';
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
  const { instrument, setInstrument, notes } = useTranscribeStore();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">乐器音轨</h3>
      </div>
      <div className="p-2">
        {INSTRUMENTS.map((inst) => (
          <button
            key={inst.id}
            onClick={() => setInstrument(inst.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              instrument === inst.id
                ? 'bg-brand-gold/10 text-brand-gold font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }`}
          >
            <inst.icon className={`w-4 h-4 ${inst.color}`} />
            <span>{inst.name}</span>
            {notes.length > 0 && (
              <span className="ml-auto text-xs text-slate-400">
                {instrument === inst.id ? notes.length : '-'}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 提示信息 */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          当前版本不支持多乐器分离，所有乐器显示相同的检测结果。
        </p>
      </div>
    </div>
  );
}
