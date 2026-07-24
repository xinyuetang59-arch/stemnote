/**
 * 扒谱工作台页面
 * 上传音频 → 分析进度 → 乐谱展示 → 导出
 * 支持扒谱历史：分析完成后自动保存，刷新不丢失
 */
import { useEffect } from 'react';
import { AlertCircle, RefreshCw, Clock, Trash2, Loader2 } from 'lucide-react';
import { useTranscribeStore } from '../stores/transcribeStore';
import AudioUploader from '../components/transcribe/AudioUploader';
import SheetViewer from '../components/transcribe/SheetViewer';
import NotePanel from '../components/transcribe/NotePanel';
import InstrumentList from '../components/transcribe/InstrumentList';
import ExportBar from '../components/transcribe/ExportBar';
import ProgressBar from '../components/ui/ProgressBar';
import { formatDate } from '../lib/utils';

export default function TranscribePage() {
  const {
    stage, progress, stageMessage, notes, error, audioFileName,
    history, loadHistory, loadFromHistory, removeHistory, reset,
  } = useTranscribeStore();

  const isAnalyzing = stage !== 'idle' && stage !== 'done' && stage !== 'error';
  const isDone = stage === 'done';
  const hasError = stage === 'error';
  const isIdle = stage === 'idle';

  // 加载扒谱历史
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* 页面标题 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-serif">
          扒谱工作台
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          上传音频文件，AI 自动识别音符并生成五线谱
        </p>
      </div>

      {/* 上传区域（完成前始终显示） */}
      {!isDone && (
        <div className="max-w-xl mx-auto mb-8">
          <AudioUploader />
        </div>
      )}

      {/* 分析进度 */}
      {isAnalyzing && (
        <div className="max-w-xl mx-auto mb-8 animate-fade-in">
          <ProgressBar percent={progress} label={stageMessage} size="md" color="gold" />

          <div className="mt-6 space-y-3">
            {[
              { key: 'decoding', label: '正在解码音频文件...', match: ['decoding', 'separating', 'detecting', 'generating', 'done'] },
              { key: 'separating', label: '正在分析音频结构...', match: ['separating', 'detecting', 'generating', 'done'] },
              { key: 'detecting', label: '正在识别音符...', match: ['detecting', 'generating', 'done'] },
              { key: 'generating', label: '正在生成乐谱...', match: ['generating', 'done'] },
            ].map((step) => {
              const isActive = step.match.includes(stage);
              const isComplete = step.match.indexOf(stage) > 0 && stage !== step.key;
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-3 text-sm ${
                    isComplete
                      ? 'text-green-600 dark:text-green-400'
                      : isActive
                      ? 'text-brand-gold font-medium'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                      isComplete
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                        : isActive
                        ? 'bg-brand-gold/20 text-brand-gold animate-pulse'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isComplete ? '✓' : isActive ? '●' : '○'}
                  </div>
                  {step.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {hasError && (
        <div className="max-w-xl mx-auto mb-8 animate-fade-in">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
            <p className="text-red-700 dark:text-red-300 font-medium mb-1">分析失败</p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/40 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              重新上传
            </button>
          </div>
        </div>
      )}

      {/* 结果展示 */}
      {isDone && (
        <div className="animate-fade-in">
          {/* 完成状态操作栏 */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                扒谱结果
              </h2>
              <span className="text-sm text-slate-400">
                {audioFileName} · {notes.length} 个音符
              </span>
            </div>
            <div className="flex items-center gap-3">
              <ExportBar />
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                重新上传
              </button>
            </div>
          </div>

          {/* 免责声明 */}
          <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                扒谱结果仅供参考
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                本工具的扒谱结果仅供参考，建议结合人工校对使用。如需高精度专业扒谱，推荐使用桌面端软件如 Melodyne。
                点击五线谱上的音符可手动调整音高和时值。
              </p>
            </div>
          </div>

          {/* 三栏布局 */}
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-6">
            <div className="hidden lg:block">
              <InstrumentList />
            </div>
            <div>
              <SheetViewer />
            </div>
            <div>
              <NotePanel />
            </div>
          </div>
        </div>
      )}

      {/* 初始空闲状态引导 */}
      {isIdle && (
        <div className="max-w-2xl mx-auto mt-4 text-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 mb-12">
            {[
              { step: '1', title: '上传音频', desc: '拖拽 MP3/WAV 文件到上传区域' },
              { step: '2', title: 'AI 分析', desc: '自动识别音符，生成五线谱' },
              { step: '3', title: '导出分享', desc: '导出 MIDI/PDF，分享到社区' },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700"
              >
                <div className="w-8 h-8 rounded-full bg-brand-gold/20 text-brand-gold flex items-center justify-center font-bold text-sm mb-3 mx-auto">
                  {item.step}
                </div>
                <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-1">{item.title}</h3>
                <p className="text-xs text-slate-400">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* 扒谱历史 */}
          {history.length > 0 && (
            <div className="text-left">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  扒谱历史
                </h3>
                <span className="text-xs text-slate-400">（共 {history.length} 条，刷新不丢失）</span>
              </div>
              <div className="space-y-2">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg px-4 py-3 border border-slate-100 dark:border-slate-700 hover:border-brand-gold/30 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {record.fileName}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(record.createdAt)} · {record.noteCount} 个音符
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => loadFromHistory(record)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-brand-gold bg-brand-gold/10 rounded-lg hover:bg-brand-gold/20 transition-colors"
                      >
                        <Loader2 className="w-3 h-3" />
                        加载
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('确定删除这条扒谱记录吗？')) {
                            removeHistory(record.id!);
                          }
                        }}
                        className="p-1.5 text-xs text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
