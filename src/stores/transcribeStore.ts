/**
 * 扒谱状态管理 (Zustand)
 * 管理音频分析流水线 + 多乐器音轨 + 扒谱历史持久化
 *
 * 持久化：
 * - 分析完成后自动保存到 IndexedDB
 * - 刷新页面或重新打开后可从历史中恢复
 */
import { create } from 'zustand';
import { analyzeAudio, quantizeNotes, type AnalysisStage } from '../lib/audio/analyzer';
import type { DetectedNote } from '../lib/audio/pitch';
import {
  getAllTranscriptions,
  saveTranscription as saveToDB,
  updateTranscription,
  deleteTranscription as deleteFromDB,
  type TranscriptionRecord,
} from '../lib/db';

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
  tracks: Record<string, DetectedNote[]>;
  notes: DetectedNote[];
  selectedNote: DetectedNote | null;
  selectedNoteIndex: number;
  instrument: string;
  error: string | null;
  audioFileName: string | null;
  /** 扒谱历史记录列表 */
  history: TranscriptionRecord[];
  /** 当前加载的历史记录 ID（null = 新分析） */
  currentHistoryId: number | null;

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
  /** 加载扒谱历史列表 */
  loadHistory: () => Promise<void>;
  /** 从历史记录加载扒谱结果 */
  loadFromHistory: (record: TranscriptionRecord) => void;
  /** 删除历史记录 */
  removeHistory: (id: number) => Promise<void>;
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
  history: [],
  currentHistoryId: null,

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
      currentHistoryId: null,
    });

    await analyzeAudio(file, {
      onStageChange: (stage, message) => {
        set({ stage, stageMessage: message });
      },
      onProgress: (percent) => {
        set({ progress: percent });
      },
      onComplete: async (detectedNotes) => {
        const tracks = emptyTracks();
        tracks[currentInstrument] = detectedNotes;

        // 保存到 IndexedDB
        let historyId: number | null = null;
        try {
          historyId = await saveToDB({
            fileName: file.name,
            tracksJson: JSON.stringify(tracks),
            instrument: currentInstrument,
            noteCount: detectedNotes.length,
            createdAt: Date.now(),
          });
        } catch (e) {
          console.error('保存扒谱记录失败:', e);
        }

        set({
          tracks,
          notes: detectedNotes,
          stage: 'done',
          stageMessage: '分析完成！',
          progress: 100,
          currentHistoryId: historyId,
        });

        // 刷新历史列表
        get().loadHistory();
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
    const { tracks, instrument, currentHistoryId } = get();
    const instrumentNotes = [...tracks[instrument]];
    if (index >= 0 && index < instrumentNotes.length) {
      instrumentNotes[index] = { ...instrumentNotes[index], ...updates };
      const newTracks = { ...tracks, [instrument]: instrumentNotes };
      set({ tracks: newTracks, notes: instrumentNotes });

      // 更新 IndexedDB 中的记录
      if (currentHistoryId != null) {
        updateTranscription(currentHistoryId, {
          tracksJson: JSON.stringify(newTracks),
          noteCount: instrumentNotes.length,
        }).catch(() => {});
      }
    }
  },

  copyTrackTo: (targetInstrument: string) => {
    const { tracks, instrument } = get();
    const sourceNotes = [...tracks[instrument]];
    set({
      tracks: { ...tracks, [targetInstrument]: sourceNotes },
    });

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
      currentHistoryId: null,
    });
  },

  loadHistory: async () => {
    try {
      const records = await getAllTranscriptions();
      set({ history: records });
    } catch (e) {
      console.error('加载扒谱历史失败:', e);
    }
  },

  loadFromHistory: (record: TranscriptionRecord) => {
    try {
      const tracks = JSON.parse(record.tracksJson) as Record<string, DetectedNote[]>;
      const notes = tracks[record.instrument] || [];

      set({
        tracks,
        notes,
        instrument: record.instrument,
        audioFileName: record.fileName,
        stage: 'done',
        progress: 100,
        stageMessage: '已加载历史记录',
        currentHistoryId: record.id!,
        selectedNote: null,
        selectedNoteIndex: -1,
        error: null,
      });
    } catch (e) {
      console.error('加载历史记录失败:', e);
    }
  },

  removeHistory: async (id: number) => {
    try {
      await deleteFromDB(id);
      const { currentHistoryId } = get();
      if (currentHistoryId === id) {
        get().reset();
      }
      await get().loadHistory();
    } catch (e) {
      console.error('删除历史记录失败:', e);
    }
  },
}));
