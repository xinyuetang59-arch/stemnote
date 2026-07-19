/**
 * 音高检测模块
 * 封装 pitchfinder 库，使用 YIN 算法检测音高
 */

// pitchfinder 返回 (number | null)[] — null 表示未检测到音高
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
 * 分析音频缓冲区的音高序列
 * @param audioBuffer - 解码后的音频数据
 * @returns 音高检测结果数组 (Float32Array, 0 = 未检测到)
 */
export function detectPitches(audioBuffer: AudioBuffer): Float32Array {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;

  // 获取单声道数据（混合所有声道）
  const channelData = audioBuffer.getChannelData(0);
  let monoData = channelData;
  if (numChannels > 1) {
    monoData = new Float32Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += audioBuffer.getChannelData(ch)[i] || 0;
      }
      monoData[i] = sum / numChannels;
    }
  }

  try {
    // 使用 YIN 算法进行音高检测
    const detector = Pitchfinder.YIN({ sampleRate });
    const rawResult: unknown = detector(monoData);

    // pitchfinder 可能返回 Float32Array 或 number[]
    return normalizePitchResult(rawResult);
  } catch (error) {
    console.warn('音高检测失败，尝试使用备用检测器:', error);
    // 备用：使用 AMDF 算法
    try {
      const detector = Pitchfinder.AMDF({ sampleRate });
      const rawResult: unknown = detector(monoData);
      return normalizePitchResult(rawResult);
    } catch {
      console.error('所有音高检测算法均失败');
      return new Float32Array(0);
    }
  }
}

/** 将 pitchfinder 的返回结果统一转换为 Float32Array (null → 0) */
function normalizePitchResult(result: unknown): Float32Array {
  if (result instanceof Float32Array) {
    return result;
  }
  // 处理普通数组 (可能包含 null)
  if (Array.isArray(result)) {
    const arr = new Float32Array(result.length);
    for (let i = 0; i < result.length; i++) {
      const val = result[i];
      arr[i] = typeof val === 'number' ? val : 0;
    }
    return arr;
  }
  // 处理 Float64Array 或其他类数组
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
 * 从音高序列中提取音符段落
 * 使用基于振幅的 onset detection
 * @param audioBuffer - 解码后的音频数据
 * @param pitches - 音高检测结果
 * @returns 检测到的音符列表
 */
export function extractNotes(audioBuffer: AudioBuffer, pitches: Float32Array): DetectedNote[] {
  const sampleRate = audioBuffer.sampleRate;
  const hopSize = 256; // pitchfinder 默认 hop size
  const channelData = audioBuffer.getChannelData(0);
  const notes: DetectedNote[] = [];

  if (pitches.length === 0) return notes;

  // 计算 RMS 能量用于 onset detection
  const rmsWindow = Math.floor(sampleRate * 0.025); // 25ms window
  const rmsValues: number[] = [];
  for (let i = 0; i < channelData.length; i += hopSize) {
    let sum = 0;
    const end = Math.min(i + rmsWindow, channelData.length);
    for (let j = i; j < end; j++) {
      sum += channelData[j] * channelData[j];
    }
    rmsValues.push(Math.sqrt(sum / (end - i)));
  }

  // 计算阈值（RMS 中位数的 1.5 倍作为 onset 阈值）
  const sortedRMS = [...rmsValues].sort((a, b) => a - b);
  const medianRMS = sortedRMS[Math.floor(sortedRMS.length / 2)] || 0.01;
  const threshold = Math.max(medianRMS * 1.5, 0.02);

  // 状态机检测音符段落
  let inNote = false;
  let noteStart = 0;
  let notePitches: number[] = [];
  let noteVelocities: number[] = [];

  for (let i = 0; i < pitches.length; i++) {
    const pitch = pitches[i];
    const rms = rmsValues[i] || 0;
    const isVoiced = pitch > 0 && rms > threshold;

    if (isVoiced && !inNote) {
      // Note onset
      inNote = true;
      noteStart = i;
      notePitches = [pitch];
      noteVelocities = [rms];
    } else if (isVoiced && inNote) {
      // Note continues
      notePitches.push(pitch);
      noteVelocities.push(rms);
    } else if (!isVoiced && inNote) {
      // Note offset
      inNote = false;
      const startTime = (noteStart * hopSize) / sampleRate;
      const endTime = (i * hopSize) / sampleRate;
      const duration = endTime - startTime;

      // 过滤过短的音符（< 50ms 可能是噪声）
      if (duration > 0.05) {
        // 取中位数作为该音符的音高
        const sortedPitches = [...notePitches].sort((a, b) => a - b);
        const medianPitch = sortedPitches[Math.floor(sortedPitches.length / 2)];
        const midiNote = frequencyToMidi(medianPitch);
        const avgVelocity = noteVelocities.reduce((a, b) => a + b, 0) / noteVelocities.length;
        // 归一化力度到 0-1
        const normalizedVelocity = Math.min(1, avgVelocity / (threshold * 5));

        if (midiNote >= 21 && midiNote <= 108) { // 钢琴范围 A0-C8
          notes.push({
            pitch: midiNote,
            frequency: medianPitch,
            startTime,
            duration,
            velocity: normalizedVelocity,
            noteName: midiToNoteName(midiNote),
          });
        }
      }
    }
  }

  // 处理最后一个未关闭的音符
  if (inNote) {
    const startTime = (noteStart * hopSize) / sampleRate;
    const endTime = (pitches.length * hopSize) / sampleRate;
    const duration = endTime - startTime;
    if (duration > 0.05) {
      const sortedPitches = [...notePitches].sort((a, b) => a - b);
      const medianPitch = sortedPitches[Math.floor(sortedPitches.length / 2)];
      const midiNote = frequencyToMidi(medianPitch);
      const avgVelocity = noteVelocities.reduce((a, b) => a + b, 0) / noteVelocities.length;
      const normalizedVelocity = Math.min(1, avgVelocity / (threshold * 5));

      if (midiNote >= 21 && midiNote <= 108) {
        notes.push({
          pitch: midiNote,
          frequency: medianPitch,
          startTime,
          duration,
          velocity: normalizedVelocity,
          noteName: midiToNoteName(midiNote),
        });
      }
    }
  }

  // 合并连续的相同音高（去重）
  const mergedNotes: DetectedNote[] = [];
  for (const note of notes) {
    const last = mergedNotes[mergedNotes.length - 1];
    if (last && last.pitch === note.pitch && note.startTime - (last.startTime + last.duration) < 0.1) {
      // 合并：延长上一个音符
      last.duration = note.startTime + note.duration - last.startTime;
    } else {
      mergedNotes.push({ ...note });
    }
  }

  return mergedNotes;
}
