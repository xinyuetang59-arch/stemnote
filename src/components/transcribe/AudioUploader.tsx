/**
 * 音频上传组件
 * 支持拖拽或点击上传音频文件 (MP3/WAV/FLAC/M4A)
 */
import { useState, useRef } from 'react';
import { Upload, Music, AlertCircle } from 'lucide-react';
import { useTranscribeStore } from '../../stores/transcribeStore';
import { isAudioFile, formatFileSize, MAX_AUDIO_SIZE } from '../../lib/utils';

export default function AudioUploader() {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { startAnalysis, stage, audioFileName } = useTranscribeStore();

  const isProcessing = stage !== 'idle' && stage !== 'done' && stage !== 'error';

  const handleFile = async (file: File) => {
    setError(null);

    if (!isAudioFile(file)) {
      setError('不支持的音频格式，请上传 MP3 / WAV / FLAC / M4A 文件');
      return;
    }

    if (file.size > MAX_AUDIO_SIZE) {
      setError(`文件过大（${formatFileSize(file.size)}），请上传 ≤ 50MB 的音频文件`);
      return;
    }

    try {
      await startAnalysis(file);
    } catch {
      setError('音频分析启动失败，请重试');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isProcessing
            ? 'border-brand-gold/50 bg-brand-gold/5 cursor-not-allowed'
            : dragging
            ? 'border-brand-gold bg-brand-gold/5 scale-[1.02]'
            : 'border-slate-300 dark:border-slate-600 hover:border-brand-gold/50 hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/wav,audio/flac,audio/mp4,audio/x-m4a,audio/ogg,.mp3,.wav,.flac,.m4a,.ogg"
          onChange={handleChange}
          className="hidden"
          disabled={isProcessing}
        />

        {isProcessing ? (
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-gold/20 flex items-center justify-center animate-pulse-gold">
              <Music className="w-8 h-8 text-brand-gold" />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              正在处理: {audioFileName}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-brand-gold/10 flex items-center justify-center">
              <Upload className="w-8 h-8 text-brand-gold" />
            </div>
            <div>
              <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                拖拽音频文件到此处，或点击上传
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                支持 MP3 / WAV / FLAC / M4A，大小 ≤ 50MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
    </div>
  );
}
