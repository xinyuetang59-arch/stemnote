/**
 * 音符信息面板组件
 * 显示选中音符的详细信息，支持手动修正
 */
import { useTranscribeStore } from '../../stores/transcribeStore';
import type { DetectedNote } from '../../lib/audio/pitch';
import { midiToNoteName } from '../../lib/audio/pitch';

export default function NotePanel() {
  const { selectedNote, selectedNoteIndex, updateNote } = useTranscribeStore();

  if (!selectedNote) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">音符信息</h3>
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
          点击五线谱上的音符查看详情
        </p>
      </div>
    );
  }

  const handleUpdate = (field: keyof DetectedNote, value: number) => {
    updateNote(selectedNoteIndex, { [field]: value });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 animate-fade-in">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">音符信息</h3>

      <div className="space-y-4">
        {/* 音名 */}
        <div>
          <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">音名</label>
          <p className="text-2xl font-bold text-brand-navy dark:text-white font-mono">
            {selectedNote.noteName}
          </p>
        </div>

        {/* MIDI 音高修正 */}
        <div>
          <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">音高 (MIDI)</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleUpdate('pitch', selectedNote.pitch - 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              -
            </button>
            <div className="flex-1 text-center">
              <span className="text-lg font-medium text-slate-800 dark:text-slate-200 font-mono">
                {selectedNote.pitch}
              </span>
              <span className="text-xs text-slate-400 block">{midiToNoteName(selectedNote.pitch)}</span>
            </div>
            <button
              onClick={() => handleUpdate('pitch', selectedNote.pitch + 1)}
              className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* 起始时间 */}
        <div>
          <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">起始时间 (秒)</label>
          <input
            type="number"
            value={parseFloat(selectedNote.startTime.toFixed(3))}
            onChange={(e) => handleUpdate('startTime', parseFloat(e.target.value) || 0)}
            step="0.01"
            className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white"
          />
        </div>

        {/* 时长 */}
        <div>
          <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">时长 (秒)</label>
          <input
            type="number"
            value={parseFloat(selectedNote.duration.toFixed(3))}
            onChange={(e) => handleUpdate('duration', parseFloat(e.target.value) || 0.1)}
            step="0.01"
            min="0.01"
            className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-white"
          />
        </div>

        {/* 力度 */}
        <div>
          <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">
            力度: {(selectedNote.velocity * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={selectedNote.velocity}
            onChange={(e) => handleUpdate('velocity', parseFloat(e.target.value))}
            className="w-full accent-brand-gold"
          />
        </div>

        {/* 频率 */}
        <div>
          <label className="text-xs text-slate-400 dark:text-slate-500 block mb-1">频率</label>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {selectedNote.frequency.toFixed(2)} Hz
          </p>
        </div>
      </div>
    </div>
  );
}
