/**
 * 音频分析 Web Worker
 * 将所有重计算（降采样 + 音高检测 + 音符提取）移出主线程
 * 避免阻塞 UI，保持页面响应
 */

// Worker 中导入 pitchfinder 进行音高检测
import Pitchfinder from 'pitchfinder';

/** 音符名称映射 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 频率转 MIDI 音高 */
function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 0;
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

/** MIDI 音高转音名 */
function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/** 将 pitchfinder 返回结果转为 Float32Array */
function normalizePitchResult(result: unknown): Float32Array {
  if (result instanceof Float32Array) return result;
  if (Array.isArray(result)) {
    const arr = new Float32Array(result.length);
    for (let i = 0; i < result.length; i++) {
      const val = result[i];
      arr[i] = typeof val === 'number' ? val : 0;
    }
    return arr;
  }
  if (result && typeof result === 'object' && 'length' in result) {
    const obj = result as { length: number; [index: number]: number };
    const arr = new Float32Array(obj.length);
    for (let i = 0; i < obj.length; i++) {
      const val = obj[i];
      arr[i] = typeof val === 'number' ? val : 0;
    }
    return arr;
  }
  return new Float32Array(0);
}

/** 降采样：将高采样率音频降到目标采样率 */
function downsample(channelData: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const newLength = Math.floor(channelData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    // 线性插值取平均
    const srcIndex = i * ratio;
    const srcFloor = Math.floor(srcIndex);
    const srcCeil = Math.min(srcFloor + 1, channelData.length - 1);
    const frac = srcIndex - srcFloor;
    result[i] = channelData[srcFloor] * (1 - frac) + channelData[srcCeil] * frac;
  }
  return result;
}

/** 降采样后检测音高 */
function detectPitchesDownsampled(
  channelData: Float32Array,
  originalSampleRate: number
): { pitches: Float32Array; workingSampleRate: number } {
  // 降到 11025Hz 进行音高检测（对 C8=4186Hz 足够，Nyquist=5512Hz）
  const workingSampleRate = Math.min(11025, originalSampleRate);
  let data = channelData;

  if (originalSampleRate > workingSampleRate) {
    data = downsample(channelData, originalSampleRate, workingSampleRate);
  }

  try {
    const detector = Pitchfinder.YIN({ sampleRate: workingSampleRate });
    const raw: unknown = detector(data);
    return { pitches: normalizePitchResult(raw), workingSampleRate };
  } catch {
    try {
      const detector = Pitchfinder.AMDF({ sampleRate: workingSampleRate });
      const raw: unknown = detector(data);
      return { pitches: normalizePitchResult(raw), workingSampleRate };
    } catch {
      return { pitches: new Float32Array(0), workingSampleRate };
    }
  }
}

/** 快速 RMS 能量计算 (使用降采样数据) */
function computeRMS(channelData: Float32Array, sampleRate: number, hopSize: number): Float32Array {
  const rmsWindow = Math.floor(sampleRate * 0.025);
  const numFrames = Math.floor(channelData.length / hopSize);
  const rms = new Float32Array(numFrames);

  // 使用滑动窗口优化，避免 O(n*m)
  let sum = 0;
  // 初始化第一个窗口
  const winEnd = Math.min(rmsWindow, channelData.length);
  for (let j = 0; j < winEnd; j++) {
    sum += channelData[j] * channelData[j];
  }
  rms[0] = Math.sqrt(sum / winEnd);

  // 滑动窗口
  for (let i = 1; i < numFrames; i++) {
    const oldStart = (i - 1) * hopSize;
    const newEnd = Math.min(oldStart + rmsWindow, channelData.length);
    // 移除旧的，添加新的
    for (let j = oldStart; j < oldStart + hopSize && j < channelData.length; j++) {
      sum -= channelData[j] * channelData[j];
    }
    for (let j = Math.max(0, newEnd - hopSize); j < newEnd; j++) {
      sum += channelData[j] * channelData[j];
    }
    const windowLen = Math.min(rmsWindow, channelData.length - i * hopSize);
    rms[i] = windowLen > 0 ? Math.sqrt(Math.max(0, sum) / windowLen) : 0;
  }

  return rms;
}

/** 从音高中提取音符 */
function extractNotesFromPitches(
  audioData: Float32Array,
  sampleRate: number,
  pitches: Float32Array
): DetectedNote[] {
  const hopSize = 128; // 降采样后使用更小的 hop
  const notes: DetectedNote[] = [];

  if (pitches.length === 0) return notes;

  // 计算 RMS
  const rmsValues = computeRMS(audioData, sampleRate, hopSize);
  const pitchLen = Math.min(pitches.length, rmsValues.length);

  // 阈值
  let sumRMS = 0;
  for (let i = 0; i < pitchLen; i++) sumRMS += rmsValues[i];
  const avgRMS = sumRMS / pitchLen;
  const threshold = Math.max(avgRMS * 1.3, 0.015);

  // 状态机
  let inNote = false;
  let noteStart = 0;
  let notePitches: number[] = [];
  let noteVelocities: number[] = [];

  for (let i = 0; i < pitchLen; i++) {
    const pitch = pitches[i];
    const rms = rmsValues[i];
    const isVoiced = pitch > 0 && rms > threshold;

    if (isVoiced && !inNote) {
      inNote = true;
      noteStart = i;
      notePitches = [pitch];
      noteVelocities = [rms];
    } else if (isVoiced && inNote) {
      notePitches.push(pitch);
      noteVelocities.push(rms);
    } else if (!isVoiced && inNote) {
      inNote = false;
      addNote(notes, noteStart, i, hopSize, sampleRate, notePitches, noteVelocities, threshold);
    }
  }
  if (inNote) {
    addNote(notes, noteStart, pitchLen, hopSize, sampleRate, notePitches, noteVelocities, threshold);
  }

  // 合并去重
  const merged: DetectedNote[] = [];
  for (const note of notes) {
    const last = merged[merged.length - 1];
    if (last && last.pitch === note.pitch && note.startTime - (last.startTime + last.duration) < 0.08) {
      last.duration = note.startTime + note.duration - last.startTime;
    } else {
      merged.push({ ...note });
    }
  }
  return merged;
}

function addNote(
  notes: DetectedNote[],
  start: number,
  end: number,
  hopSize: number,
  sampleRate: number,
  pitches: number[],
  velocities: number[],
  threshold: number
) {
  const startTime = (start * hopSize) / sampleRate;
  const endTime = (end * hopSize) / sampleRate;
  const duration = endTime - startTime;

  if (duration > 0.04) {
    const sorted = [...pitches].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const midi = frequencyToMidi(median);
    const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    const velocity = Math.min(1, avgVel / Math.max(threshold * 4, 0.01));

    if (midi >= 21 && midi <= 108) {
      notes.push({ pitch: midi, frequency: median, startTime, duration, velocity, noteName: midiToNoteName(midi) });
    }
  }
}

export interface DetectedNote {
  pitch: number;
  frequency: number;
  startTime: number;
  duration: number;
  velocity: number;
  noteName: string;
}

// ===== Worker 消息处理 =====

interface WorkerRequest {
  id: string;
  channelData: Float32Array;
  sampleRate: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, channelData, sampleRate } = e.data;

  try {
    // 阶段1：降采样 + 音高检测（最重的计算）
    self.postMessage({ id, type: 'progress', stage: 'detecting', progress: 50, message: '正在识别音符...' });

    const { pitches, workingSampleRate } = detectPitchesDownsampled(channelData, sampleRate);

    if (pitches.length === 0) {
      self.postMessage({ id, type: 'error', message: '未能检测到有效音符，请尝试其他音频文件' });
      return;
    }

    // 阶段2：提取音符
    self.postMessage({ id, type: 'progress', stage: 'generating', progress: 70, message: '正在生成乐谱...' });

    const audioData = sampleRate > workingSampleRate
      ? downsample(channelData, sampleRate, workingSampleRate)
      : channelData;

    const notes = extractNotesFromPitches(audioData, workingSampleRate, pitches);

    if (notes.length === 0) {
      self.postMessage({ id, type: 'error', message: '未能从音频中提取到音符，扒谱结果仅供参考' });
      return;
    }

    // 完成
    self.postMessage({ id, type: 'progress', stage: 'done', progress: 100, message: '分析完成！' });
    // 将数据通过 transferable 传回主线程（避免复制）
    self.postMessage({ id, type: 'complete', notes }, { /* notes is plain array, no transfer needed */ });
  } catch (err) {
    const message = err instanceof Error ? err.message : '音频分析失败';
    self.postMessage({ id, type: 'error', message });
  }
};
