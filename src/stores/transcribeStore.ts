/**
 * 扒谱状态管理 (Zustand)
 * 管理音频分析流水线 + 多乐器音轨
 *
 * 每个乐器维护独立的音符列表：
 * - 分析完成后，检测到的音符分配到当前选中的乐器
 * - 切换乐器时显示对应乐器的音符
 * - 可在各乐器音轨间独立编辑
 */
import { create } from 'zustand';
import { analyzeAudio, quantizeNotes, type AnalysisStage } from '../lib/audio/analyzer';
import type { DetectedNote } from '../lib/audio/pitch';

/** 支持的乐器 ID 列表 */
const INSTRUMENT_IDS = ['piano', 'guitar', 'bass', 'vocal', 'drums', 'other'];

/** 创建空的乐器音轨映射 */
function emptyTracks(): Record<string, DetectedNote[]> {
  const tracks: Record<string, DetectedNote[]> = {};
  for (const id of INSTRUMENT_IDS) {
    tracks[id] = [];
  }
  return tracks;
}

interface TranscribeState {
  stage: AnalysisStage;
  progress: number;
  stageMessage: string;
  /** 每个乐器独立的音符列表 */
  tracks: Record<string, DetectedNote[]>;
  /** 当前选中乐器音轨的音符（自动同步自 tracks[instrument]） */
  notes: DetectedNote[];
  selectedNote: DetectedNote | null;
  selectedNoteIndex: number;
  instrument: string;
  error: string | null;
  audioFileName: string | null;
  /** 开始分析音频文件 */
  startAnalysis: (file: File) => Promise<void>;
  /** 选中一个音符 */
  selectNote: (note: DetectedNote | null, index: number) => void;
  /** 更新当前乐器音轨中的音符 */
  updateNote: (index: number, updates: Partial<DetectedNote>) => void;
  /** 将当前乐器音轨复制到另一个乐器 */
  copyTrackTo: (targetInstrument: string) => void;
  /** 切换乐器 */
  setInstrument: (instrument: string) => void;
  /** 量化当前乐器音轨 */
  quantize: (bpm?: number) => void;
  /** 重置状态 */
  reset: () => void;
}

export const useTranscribeStore = create<TranscribeState>((set, get) => ({
  stage: 'idle',
  progress: 0,
  stageMessage: '',
  tracks: emptyTracks(),
  notes: [],
  selectedNote: null,
  selectedNoteIndex: -1,
  instrument: 'piano',
  error: null,
  audioFileName: null,

  startAnalysis: async (file: File) => {
    const currentInstrument = get().instrument;

    set({
      stage: 'decoding',
      progress: 0,
      stageMessage: '准备分析...',
      tracks: emptyTracks(),
      notes: [],
      selectedNote: null,
      selectedNoteIndex: -1,
      error: null,
      audioFileName: file.name,
    });

    await analyzeAudio(file, {
      onStageChange: (stage, message) => {
        set({ stage, stageMessage: message });
      },
      onProgress: (percent) => {
        set({ progress: percent });
      },
      onComplete: (detectedNotes) => {
        // 将检测到的音符放入当前选中乐器的音轨
        const tracks = emptyTracks();
        tracks[currentInstrument] = detectedNotes;

        set({
          tracks,
          notes: detectedNotes,
          stage: 'done',
          stageMessage: '分析完成！',
          progress: 100,
        });
      },
      onError: (error) => {
        set({ error, stage: 'error', stageMessage: error });
      },
    });
  },

  selectNote: (note, index) => {
    set({ selectedNote: note, selectedNoteIndex: index });
  },

  updateNote: (index, updates) => {
    const { tracks, instrument } = get();
    const instrumentNotes = [...tracks[instrument]];
    if (index >= 0 && index < instrumentNotes.length) {
      instrumentNotes[index] = { ...instrumentNotes[index], ...updates };
      set({
        tracks: { ...tracks, [instrument]: instrumentNotes },
        notes: instrumentNotes,
      });
    }
  },

  copyTrackTo: (targetInstrument: string) => {
    const { tracks, instrument } = get();
    const sourceNotes = [...tracks[instrument]];
    set({
      tracks: { ...tracks, [targetInstrument]: sourceNotes },
    });

    // 如果当前就在目标乐器上，刷新 notes
    if (get().instrument === targetInstrument) {
      set({ notes: sourceNotes });
    }
  },

  setInstrument: (instrument: string) => {
    set({
      instrument,
      notes: get().tracks[instrument] || [],
      selectedNote: null,
      selectedNoteIndex: -1,
    });
  },

  quantize: (bpm = 120) => {
    const { tracks, instrument } = get();
    const quantized = quantizeNotes(tracks[instrument] || [], bpm);
    set({
      tracks: { ...tracks, [instrument]: quantized },
      notes: quantized,
    });
  },

  reset: () => {
    set({
      stage: 'idle',
      progress: 0,
      stageMessage: '',
      tracks: emptyTracks(),
      notes: [],
      selectedNote: null,
      selectedNoteIndex: -1,
      error: null,
      audioFileName: null,
    });
  },
}));
