/**
 * 扒谱状态管理 (Zustand)
 * 管理音频分析流水线状态
 */
import { create } from 'zustand';
import { analyzeAudio, quantizeNotes, type AnalysisStage } from '../lib/audio/analyzer';
import type { DetectedNote } from '../lib/audio/pitch';

interface TranscribeState {
  stage: AnalysisStage;
  progress: number;
  stageMessage: string;
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

  /** 更新音符（手动修正） */
  updateNote: (index: number, updates: Partial<DetectedNote>) => void;

  /** 切换乐器 */
  setInstrument: (instrument: string) => void;

  /** 量化音符 */
  quantize: (bpm?: number) => void;

  /** 重置状态 */
  reset: () => void;
}

export const useTranscribeStore = create<TranscribeState>((set, get) => ({
  stage: 'idle',
  progress: 0,
  stageMessage: '',
  notes: [],
  selectedNote: null,
  selectedNoteIndex: -1,
  instrument: 'piano',
  error: null,
  audioFileName: null,

  startAnalysis: async (file: File) => {
    set({
      stage: 'decoding',
      progress: 0,
      stageMessage: '准备分析...',
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
      onComplete: (notes) => {
        set({ notes, stage: 'done', stageMessage: '分析完成！', progress: 100 });
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
    const notes = [...get().notes];
    if (index >= 0 && index < notes.length) {
      notes[index] = { ...notes[index], ...updates };
      set({ notes });
    }
  },

  setInstrument: (instrument) => {
    set({ instrument });
  },

  quantize: (bpm = 120) => {
    const notes = get().notes;
    const quantized = quantizeNotes(notes, bpm);
    set({ notes: quantized });
  },

  reset: () => {
    set({
      stage: 'idle',
      progress: 0,
      stageMessage: '',
      notes: [],
      selectedNote: null,
      selectedNoteIndex: -1,
      error: null,
      audioFileName: null,
    });
  },
}));
