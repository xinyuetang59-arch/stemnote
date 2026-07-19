/**
 * 音频分析器 - 封装完整的分析流水线
 * 解码 → 音高检测 → 音符提取
 */
import { detectPitches, extractNotes, type DetectedNote } from './pitch';

/** 分析阶段 */
export type AnalysisStage = 'idle' | 'decoding' | 'separating' | 'detecting' | 'generating' | 'done' | 'error';

/** 分析进度回调 */
export interface AnalysisCallbacks {
  onStageChange: (stage: AnalysisStage, message: string) => void;
  onProgress: (percent: number) => void;
  onComplete: (notes: DetectedNote[]) => void;
  onError: (error: string) => void;
}

/**
 * 执行完整的音频分析流水线
 * @param file - 音频文件
 * @param callbacks - 进度回调
 */
export async function analyzeAudio(file: File, callbacks: AnalysisCallbacks): Promise<void> {
  const { onStageChange, onProgress, onComplete, onError } = callbacks;

  try {
    // 阶段1：解码音频
    onStageChange('decoding', '正在解码音频文件...');
    onProgress(5);

    const audioContext = new AudioContext();
    const arrayBuffer = await file.arrayBuffer();
    onProgress(10);

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch {
      // 某些格式可能需要用户交互后才能解码
      // 尝试使用离线上下文
      throw new Error('不支持的音频格式，请尝试 MP3 或 WAV 格式');
    }
    onProgress(20);
    await audioContext.close();

    // 阶段2：模拟音轨分离（实际不做分离，仅展示进度）
    onStageChange('separating', '正在分析音频结构...');
    onProgress(25);

    // 模拟分离过程的延迟，让用户看到进度
    await sleep(300);
    onProgress(40);

    // 阶段3：音高检测
    onStageChange('detecting', '正在识别音符...');
    onProgress(45);

    // 在下一帧执行，避免阻塞 UI
    const pitches = await new Promise<Float32Array>((resolve) => {
      setTimeout(() => {
        const result = detectPitches(audioBuffer);
        resolve(result);
      }, 50);
    });
    onProgress(65);

    if (pitches.length === 0) {
      onError('未能检测到有效音符，请尝试其他音频文件');
      return;
    }

    // 阶段4：生成乐谱
    onStageChange('generating', '正在生成乐谱...');
    onProgress(70);

    const notes = await new Promise<DetectedNote[]>((resolve) => {
      setTimeout(() => {
        const result = extractNotes(audioBuffer, pitches);
        resolve(result);
      }, 50);
    });
    onProgress(90);

    if (notes.length === 0) {
      onError('未能从音频中提取到音符，扒谱结果仅供参考');
      return;
    }

    // 完成
    onStageChange('done', '分析完成！');
    onProgress(100);

    // 短暂延迟后显示结果
    await sleep(200);
    onComplete(notes);
  } catch (error) {
    const message = error instanceof Error ? error.message : '音频分析失败，请重试';
    onError(message);
  }
}

/** 辅助函数：延迟 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 重新量化音符（用于手动修正后的处理） */
export function quantizeNotes(notes: DetectedNote[], bpm: number = 120): DetectedNote[] {
  const beatDuration = 60 / bpm;
  // 最小音符时长（十六分音符）
  const minDuration = beatDuration / 4;

  return notes.map((note) => {
    // 量化开始时间到最近的十六分音符
    const quantizedStart = Math.round(note.startTime / minDuration) * minDuration;
    // 量化时长到最近的十六分音符，至少为一个十六分音符
    const quantizedDuration = Math.max(
      minDuration,
      Math.round(note.duration / minDuration) * minDuration
    );
    return {
      ...note,
      startTime: quantizedStart,
      duration: quantizedDuration,
    };
  });
}
