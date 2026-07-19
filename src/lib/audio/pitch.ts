/**
 * 音高检测模块
 * 封装 pitchfinder 库，使用 YIN 算法检测音高
 * 接受原始 Float32Array 数据 + 采样率
 */

import Pitchfinder from 'pitchfinder';

/** 音符信息 */
export interface DetectedNote {
  pitch: number;       // MIDI 音高编号 (0-127)
  frequency: number;   // 频率 (Hz)
  startTime: number;   // 开始时间 (秒)
  duration: number;    // 持续时间 (秒)
  velocity: number;    // 力度 (0-1)
  noteName: string;    // 音名 (如 C4, A#3)
}

/** 音符名称映射 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** MIDI 音高转音名 */
export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/** 频率转 MIDI 音高 */
export function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 0;
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

/**
 * 分析音频数据的音高序列
 * @param data - 单声道 Float32Array 音频数据
 * @param sampleRate - 采样率
 * @returns 音高检测结果 (0 = 未检测到音高)
 */
export function detectPitches(data: Float32Array, sampleRate: number): Float32Array {
  try {
    const detector = Pitchfinder.YIN({ sampleRate });
    const rawResult: unknown = detector(data);
    return normalizePitchResult(rawResult);
  } catch (error) {
    console.warn('[pitch] YIN 检测失败，尝试 AMDF:', error);
    try {
      const detector = Pitchfinder.AMDF({ sampleRate });
      const rawResult: unknown = detector(data);
      return normalizePitchResult(rawResult);
    } catch {
      console.error('[pitch] 所有算法均失败');
      return new Float32Array(0);
    }
  }
}

/** 将 pitchfinder 返回结果统一转换为 Float32Array (null → 0) */
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

/**
 * 从音高序列和原始音频数据中提取音符段落
 * @param audioData - 单声道 Float32Array 音频数据
 * @param sampleRate - 采样率
 * @param pitches - 音高检测结果
 * @returns 检测到的音符列表
 */
export function extractNotes(
  audioData: Float32Array,
  sampleRate: number,
  pitches: Float32Array
): DetectedNote[] {
  const hopSize = 128; // 降采样后使用更小的 hop
  const notes: DetectedNote[] = [];

  if (pitches.length === 0) return notes;

  // 计算 RMS 能量（滑动窗口优化版，O(n)）
  const rmsValues = computeRMS(audioData, sampleRate, hopSize);
  const pitchLen = Math.min(pitches.length, rmsValues.length);

  if (pitchLen === 0) return notes;

  // 阈值计算
  let sumRMS = 0;
  for (let i = 0; i < pitchLen; i++) sumRMS += rmsValues[i];
  const avgRMS = sumRMS / pitchLen;
  const threshold = Math.max(avgRMS * 1.3, 0.015);

  // 状态机检测音符
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
      emitNote(notes, noteStart, i, hopSize, sampleRate, notePitches, noteVelocities, threshold);
    }
  }
  if (inNote) {
    emitNote(notes, noteStart, pitchLen, hopSize, sampleRate, notePitches, noteVelocities, threshold);
  }

  // 合并去重
  return mergeNotes(notes);
}

/** 滑动窗口 RMS 计算 */
function computeRMS(data: Float32Array, sampleRate: number, hopSize: number): Float32Array {
  const rmsWindow = Math.floor(sampleRate * 0.025);
  const numFrames = Math.floor(data.length / hopSize);
  const rms = new Float32Array(numFrames);

  if (numFrames === 0) return rms;

  // 初始化第一个窗口
  let sum = 0;
  const firstWin = Math.min(rmsWindow, data.length);
  for (let j = 0; j < firstWin; j++) {
    sum += data[j] * data[j];
  }
  rms[0] = Math.sqrt(sum / firstWin);

  // 滑动窗口
  for (let i = 1; i < numFrames; i++) {
    const oldStart = (i - 1) * hopSize;
    const oldEnd = oldStart + hopSize;
    const newEnd = oldStart + rmsWindow;

    // 移除退出窗口的样本
    for (let j = oldStart; j < oldEnd && j < data.length; j++) {
      sum -= data[j] * data[j];
    }
    // 添加进入窗口的样本
    for (let j = Math.max(0, newEnd - hopSize); j < newEnd && j < data.length; j++) {
      sum += data[j] * data[j];
    }

    const winLen = Math.min(rmsWindow, data.length - i * hopSize);
    rms[i] = winLen > 0 ? Math.sqrt(Math.max(0, sum) / winLen) : 0;
  }

  return rms;
}

/** 从暂存数据生成一个音符 */
function emitNote(
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

  if (duration < 0.04) return; // 过滤 <40ms

  const sorted = [...pitches].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const midi = frequencyToMidi(median);

  if (midi < 21 || midi > 108) return; // 钢琴范围外

  const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const velocity = Math.min(1, avgVel / Math.max(threshold * 4, 0.01));

  notes.push({
    pitch: midi,
    frequency: median,
    startTime,
    duration,
    velocity,
    noteName: midiToNoteName(midi),
  });
}

/** 合并连续的相同音高 */
function mergeNotes(notes: DetectedNote[]): DetectedNote[] {
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
