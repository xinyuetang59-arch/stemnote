/**
 * 音高检测 + 音符提取 + 后处理模块
 *
 * 后处理流水线（方案 A）：
 *   原始音符 → 噪声过滤 → 八度修正 → 时值量化 → 相邻合并
 * 每一步都针对扒谱错乱的常见根因
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

export function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

function frequencyToMidi(frequency: number): number {
  if (frequency <= 0) return 0;
  return Math.round(12 * Math.log2(frequency / 440) + 69);
}

/**
 * 批量逐帧音高检测（YIN 算法）
 * threshold 降至 0.08 提高灵敏度，减少漏检
 */
export function detectPitches(data: Float32Array, sampleRate: number): Float32Array {
  // chunkSize = sampleRate * 60 / (quantization * tempo)
  // quantization=16, tempo=120 → chunkSize = sampleRate / 32
  // 22050Hz → 689 采样点 = 31.3ms → C4 约 8.4 个周期，YIN 可靠
  const quantization = 16;

  const detector = Pitchfinder.YIN({ sampleRate, threshold: 0.08 });
  let raw: unknown;

  try {
    raw = Pitchfinder.frequencies(detector, data, {
      sampleRate,
      tempo: 120,
      quantization,
    });
  } catch {
    return new Float32Array(0);
  }

  const result = raw as (number | null)[];
  if (!result || !Array.isArray(result) || result.length === 0) {
    return new Float32Array(0);
  }

  const pitches = new Float32Array(result.length);
  for (let i = 0; i < result.length; i++) {
    const v = result[i];
    pitches[i] = typeof v === 'number' && v > 0 ? v : 0;
  }
  return pitches;
}

/**
 * 从音高序列中提取音符段落
 */
export function extractNotes(
  audioData: Float32Array,
  sampleRate: number,
  pitches: Float32Array
): DetectedNote[] {
  const quantization = 16;
  const chunkSize = Math.round((sampleRate * 60) / (quantization * 120));

  const notes: DetectedNote[] = [];
  if (pitches.length === 0) return notes;

  const rmsValues = computeRMS(audioData, chunkSize);
  const frameCount = Math.min(pitches.length, rmsValues.length);
  if (frameCount === 0) return notes;

  // 自适应阈值：使用更合理的统计方法
  const sortedRMS = Float32Array.from(rmsValues.subarray(0, frameCount)).sort();
  const noiseFloor = sortedRMS[Math.max(0, Math.floor(frameCount * 0.1))];
  const peakRMS = sortedRMS[Math.max(0, frameCount - 1)];

  // 阈值取噪声地板×3 和峰值×0.3 中的较大者，确保不遗漏较弱音符
  const threshold = Math.max(
    Math.min(noiseFloor * 3, peakRMS * 0.3),
    0.005  // 绝对下限
  );

  let inNote = false;
  let noteStart = 0;
  let notePitches: number[] = [];
  let noteVelocities: number[] = [];

  for (let i = 0; i < frameCount; i++) {
    const pitch = pitches[i];
    const rms = rmsValues[i];
    const isVoiced = pitch > 0 && rms > threshold;

    if (!isVoiced && inNote) {
      inNote = false;
      emitNote(notes, noteStart, i, chunkSize, sampleRate, notePitches, noteVelocities, threshold);
    } else if (isVoiced) {
      if (!inNote) {
        inNote = true;
        noteStart = i;
        notePitches = [pitch];
        noteVelocities = [rms];
      } else {
        const lastPitch = notePitches[notePitches.length - 1];
        if (lastPitch > 0 && pitch > 0) {
          const lastMIDI = frequencyToMidi(lastPitch);
          const curMIDI = frequencyToMidi(pitch);
          // 音高变化 ≥ 3 个半音才切分（减少因颤音或检测抖动导致的碎片化）
          if (Math.abs(curMIDI - lastMIDI) >= 3) {
            emitNote(notes, noteStart, i, chunkSize, sampleRate, notePitches, noteVelocities, threshold);
            noteStart = i;
            notePitches = [pitch];
            noteVelocities = [rms];
            continue;
          }
        }
        notePitches.push(pitch);
        noteVelocities.push(rms);
      }
    }
  }
  if (inNote) {
    emitNote(notes, noteStart, frameCount, chunkSize, sampleRate, notePitches, noteVelocities, threshold);
  }

  return mergeNotes(notes);
}

/** 滑动窗口 RMS 计算 */
function computeRMS(data: Float32Array, windowSize: number): Float32Array {
  const numFrames = Math.floor(data.length / windowSize);
  const rms = new Float32Array(numFrames);
  if (numFrames === 0) return rms;

  for (let i = 0; i < numFrames; i++) {
    const start = i * windowSize;
    const end = Math.min(start + windowSize, data.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += data[j] * data[j];
    }
    rms[i] = Math.sqrt(sum / (end - start));
  }
  return rms;
}

/** 生成单个音符并加入列表 */
function emitNote(
  notes: DetectedNote[],
  start: number, end: number,
  chunkSize: number, sampleRate: number,
  pitches: number[], velocities: number[],
  threshold: number
) {
  const startTime = (start * chunkSize) / sampleRate;
  const endTime = (end * chunkSize) / sampleRate;
  const duration = endTime - startTime;
  if (duration < 0.06) return; // 最短 60ms，过滤噪音碎片

  const sorted = [...pitches].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const midi = frequencyToMidi(median);
  if (midi < 21 || midi > 108) return;

  const avgVel = velocities.reduce((a, b) => a + b, 0) / velocities.length;
  const velocity = Math.min(1, avgVel / Math.max(threshold * 4, 0.01));

  notes.push({ pitch: midi, frequency: median, startTime, duration, velocity, noteName: midiToNoteName(midi) });
}

/** 合并连续相同/相近音高的音符（间隔 < 100ms 且音高相同则合并） */
function mergeNotes(notes: DetectedNote[]): DetectedNote[] {
  const merged: DetectedNote[] = [];
  for (const note of notes) {
    const last = merged[merged.length - 1];
    if (last && last.pitch === note.pitch && note.startTime - (last.startTime + last.duration) < 0.1) {
      last.duration = note.startTime + note.duration - last.startTime;
    } else {
      merged.push({ ...note });
    }
  }
  return merged;
}

// ====== 后处理流水线 ======

/**
 * 对提取的音符进行后处理
 *   1. 噪声过滤  2. 八度修正  3. 时值量化  4. 相邻合并
 */
export function postProcessNotes(notes: DetectedNote[], bpm: number = 120): DetectedNote[] {
  if (notes.length === 0) return notes;
  if (notes.length === 1) return notes;

  // 1. 过滤噪声碎片：时长 < 80ms 且力度低于平均 30% 的音符
  const avgVelocity = notes.reduce((s, n) => s + n.velocity, 0) / notes.length;
  let processed = notes.filter(
    (n) => !(n.duration < 0.08 && n.velocity < avgVelocity * 0.3 && n.velocity < 0.15)
  );
  if (processed.length === 0) return notes; // 不要全删了

  // 2. 八度修正
  processed = correctOctaveErrors(processed);
  if (processed.length <= 1) return processed;

  // 3. 时值量化
  processed = quantizeToGrid(processed, bpm);

  // 4. 合并量化后相邻相同音高的音符
  processed = mergeAdjacent(processed);

  return processed;
}

/**
 * 八度错误修正
 *
 * YIN 最常见的错误是将基频误判为高八度（2×f0）或低八度（0.5×f0）。
 * 策略：计算所有音符的中位数音高，将偏离 ±11~13 半音（即一个八度）的孤立音
 * 拉回到主流音域。
 */
function correctOctaveErrors(notes: DetectedNote[]): DetectedNote[] {
  // 按音高建立分布
  const pitches = notes.map((n) => n.pitch);
  const sorted = [...pitches].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // 统计最常见八度
  const octaves = pitches.map((p) => Math.floor(p / 12));
  const octaveCounts = new Map<number, number>();
  for (const o of octaves) {
    octaveCounts.set(o, (octaveCounts.get(o) || 0) + 1);
  }
  let dominantOctave = Math.floor(median / 12);
  let maxCount = 0;
  for (const [oct, count] of octaveCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantOctave = oct;
    }
  }

  return notes.map((note) => {
    const noteOctave = Math.floor(note.pitch / 12);
    const diff = noteOctave - dominantOctave;
    // 偏离 1~2 个八度且不在主流八度的音符，拉回
    if (Math.abs(diff) === 1 || Math.abs(diff) === 2) {
      const corrected = note.pitch - diff * 12;
      if (corrected >= 21 && corrected <= 108) {
        return {
          ...note,
          pitch: corrected,
          frequency: 440 * Math.pow(2, (corrected - 69) / 12),
          noteName: midiToNoteName(corrected),
        };
      }
    }
    return note;
  });
}

/**
 * 时值量化到节拍网格
 * 默认 120 BPM → 四分音符=0.5s，网格精度=十六分音符=0.125s
 */
function quantizeToGrid(notes: DetectedNote[], bpm: number): DetectedNote[] {
  const beatDuration = 60 / bpm;      // 一拍时长 (秒)
  const grid = beatDuration / 4;       // 十六分音符网格

  return notes.map((note) => {
    const qStart = Math.round(note.startTime / grid) * grid;
    const qEnd = Math.round((note.startTime + note.duration) / grid) * grid;
    const qDuration = Math.max(grid, qEnd - qStart); // 至少保持一格时长

    return {
      ...note,
      startTime: qStart,
      duration: qDuration,
    };
  });
}

/**
 * 合并相邻相同音高音符（量化后可能出现多个相邻相同音高的碎片）
 */
function mergeAdjacent(notes: DetectedNote[]): DetectedNote[] {
  if (notes.length <= 1) return notes;

  // 按 startTime 排序
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
  const merged: DetectedNote[] = [];

  for (const note of sorted) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.pitch === note.pitch &&
      note.startTime - (last.startTime + last.duration) <= 0.02
    ) {
      // 合并到前一个音符
      last.duration = note.startTime + note.duration - last.startTime;
    } else {
      merged.push({ ...note });
    }
  }

  return merged;
}
