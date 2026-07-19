/**
 * 音频分析器 - 使用 Web Worker 执行所有重计算
 * 解码在主线程 → 降采样+音高检测+音符提取在 Worker
 * 保证 UI 始终响应，不会卡住
 */
import type { DetectedNote } from './pitch';

/** 分析阶段 */
export type AnalysisStage = 'idle' | 'decoding' | 'separating' | 'detecting' | 'generating' | 'done' | 'error';

/** 分析进度回调 */
export interface AnalysisCallbacks {
  onStageChange: (stage: AnalysisStage, message: string) => void;
  onProgress: (percent: number) => void;
  onComplete: (notes: DetectedNote[]) => void;
  onError: (error: string) => void;
}

// 缓存的 Worker 实例（复用）
let workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('./worker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

/**
 * 执行完整的音频分析流水线
 * 解码在主线程，重计算在 Web Worker 中执行
 */
export async function analyzeAudio(file: File, callbacks: AnalysisCallbacks): Promise<void> {
  const { onStageChange, onProgress, onComplete, onError } = callbacks;

  // 生成唯一 ID 避免多请求冲突
  const requestId = `analyze-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // 阶段1：解码音频（主线程，Web Audio API 本身是异步的）
    onStageChange('decoding', '正在解码音频文件...');
    onProgress(5);

    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    onProgress(15);

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch {
      throw new Error('不支持的音频格式，请尝试 MP3 或 WAV 格式');
    }
    onProgress(25);

    // 获取单声道数据
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    await audioContext.close();

    // 阶段2：分析音频结构（UI 过渡动画）
    onStageChange('separating', '正在分析音频结构...');
    onProgress(35);
    await sleep(200);
    onProgress(45);

    // 阶段3+4：在 Web Worker 中执行重计算
    onStageChange('detecting', '正在识别音符...');
    onProgress(50);

    const worker = getWorker();

    // 监听 Worker 消息
    const handleMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data.id !== requestId) return; // 忽略旧请求的消息

      switch (data.type) {
        case 'progress':
          onStageChange(data.stage as AnalysisStage, data.message);
          onProgress(data.progress);
          break;

        case 'complete': {
          worker.removeEventListener('message', handleMessage);
          const notes = data.notes as DetectedNote[];
          onStageChange('done', '分析完成！');
          onProgress(100);

          // 短暂延迟后显示结果，让用户看到 100%
          setTimeout(() => {
            onComplete(notes);
          }, 300);
          break;
        }

        case 'error': {
          worker.removeEventListener('message', handleMessage);
          onError(data.message);
          break;
        }
      }
    };

    worker.addEventListener('message', handleMessage);

    // 发送数据到 Worker 处理
    // 注意：Float32Array 的 buffer 会被 transfer，主线程中不可再用
    // 我们传一份副本
    const channelCopy = new Float32Array(channelData.length);
    channelCopy.set(channelData);

    worker.postMessage(
      {
        id: requestId,
        channelData: channelCopy,
        sampleRate,
      },
      // Transfer channelCopy 的所有权给 Worker，避免复制开销
      [channelCopy.buffer]
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '音频分析失败，请重试';
    onError(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 重新量化音符（用于手动修正后的处理） */
export function quantizeNotes(notes: DetectedNote[], bpm: number = 120): DetectedNote[] {
  const beatDuration = 60 / bpm;
  const minDuration = beatDuration / 4;

  return notes.map((note) => ({
    ...note,
    startTime: Math.round(note.startTime / minDuration) * minDuration,
    duration: Math.max(minDuration, Math.round(note.duration / minDuration) * minDuration),
  }));
}
