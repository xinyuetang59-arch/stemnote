/**
 * 五线谱渲染组件
 * 使用 VexFlow 5 渲染检测到的音符
 * 支持点击选中音符以查看/编辑详情
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Renderer, Stave, StaveNote, Accidental, Formatter } from 'vexflow';
import { useTranscribeStore } from '../../stores/transcribeStore';
import { midiToNoteName } from '../../lib/audio/pitch';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function SheetViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const clickHandlersRef = useRef<Array<{ el: SVGElement; fn: () => void }>>([]);
  const { notes, selectedNoteIndex, selectNote } = useTranscribeStore();
  const [zoom, setZoom] = useState(1.0);

  // 清理旧的事件监听器
  const cleanupHandlers = useCallback(() => {
    clickHandlersRef.current.forEach(({ el, fn }) => {
      el.removeEventListener('click', fn);
    });
    clickHandlersRef.current = [];
  }, []);

  // 渲染五线谱
  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    // 清空之前的渲染和事件
    cleanupHandlers();
    containerRef.current.innerHTML = '';

    try {
      const renderer = new Renderer(
        containerRef.current,
        Renderer.Backends.SVG
      );

      const notesPerLine = 32;
      const lineHeight = 200 * zoom;
      const lineWidth = Math.min(containerRef.current.clientWidth - 40, 1200);
      const totalLines = Math.ceil(notes.length / notesPerLine);
      const totalHeight = totalLines * lineHeight + 80;

      renderer.resize(lineWidth + 40, Math.max(totalHeight, 300));

      const context = renderer.getContext();
      context.setFont('Arial', 10);
      context.setFillStyle('#1e293b');

      const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

      for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
        const lineNotes = sortedNotes.slice(
          lineIndex * notesPerLine,
          (lineIndex + 1) * notesPerLine
        );
        if (lineNotes.length === 0) continue;

        const y = 40 + lineIndex * lineHeight;

        const stave = new Stave(10, y, lineWidth);
        if (lineIndex === 0) {
          stave.addClef('treble').addTimeSignature('4/4');
        }
        stave.setContext(context).draw();

        const vexNotes: InstanceType<typeof StaveNote>[] = [];
        for (const note of lineNotes) {
          const noteName = midiToNoteName(note.pitch);
          const noteLetter = noteName.replace(/[0-9]/g, '');
          const octave = noteName.replace(/[^0-9]/g, '');

          const duration = getClosestDuration(note.duration, 120);
          const staveNote = new StaveNote({
            clef: 'treble',
            keys: [`${noteLetter.toLowerCase()}/${octave}`],
            duration,
          });

          if (noteLetter.includes('#')) {
            staveNote.addModifier(new Accidental('#'), 0);
          }

          // 选中高亮
          const globalIndex = lineIndex * notesPerLine + vexNotes.length;
          if (globalIndex === selectedNoteIndex) {
            staveNote.setStyle({ fillStyle: '#f59e0b', strokeStyle: '#d97706' });
          }

          vexNotes.push(staveNote);
        }

        if (vexNotes.length > 0) {
          Formatter.FormatAndDraw(context, stave, vexNotes, {
            autoBeam: true,
            alignRests: true,
          });
        }
      }

      // VexFlow 5 SVG 渲染是同步的，DOM 已经就绪
      // 使用 requestAnimationFrame 确保浏览器完成布局后再绑事件
      requestAnimationFrame(() => {
        cleanupHandlers();

        // VexFlow 5 中每个音符的 SVG 元素 class 为 vf-stavenote
        const noteElements = containerRef.current?.querySelectorAll('.vf-stavenote');
        if (!noteElements || noteElements.length === 0) return;

        noteElements.forEach((el, i) => {
          if (i < sortedNotes.length) {
            const svgEl = el as SVGElement;
            svgEl.style.cursor = 'pointer';

            const handler = () => {
              selectNote(sortedNotes[i], i);
            };

            svgEl.addEventListener('click', handler);
            clickHandlersRef.current.push({ el: svgEl, fn: handler });
          }
        });
      });
    } catch (error) {
      console.error('VexFlow 渲染出错:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-64 text-slate-400">
            <p>乐谱渲染出错，请重试</p>
          </div>`;
      }
    }
  }, [notes, selectedNoteIndex, zoom, selectNote, cleanupHandlers]);

  // 空状态
  if (notes.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <svg className="w-16 h-16 mb-4 opacity-30" viewBox="0 0 100 100">
            <line x1="10" y1="20" x2="90" y2="20" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="30" x2="90" y2="30" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="40" x2="90" y2="40" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="1" />
            <line x1="10" y1="60" x2="90" y2="60" stroke="currentColor" strokeWidth="1" />
          </svg>
          <p className="text-sm">上传音频并完成分析后，乐谱将在此显示</p>
          <p className="text-xs mt-1 opacity-60">支持点击音符查看和编辑详情</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          共 {notes.length} 个音符
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(2.0, zoom + 0.1))}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
            aria-label="重置缩放"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 五线谱渲染区 */}
      <div
        className="vexflow-container overflow-auto p-5"
        ref={containerRef}
        style={{ minHeight: '300px', maxHeight: '70vh' }}
      />
    </div>
  );
}

/** 根据时长推断最近的音符时值 */
function getClosestDuration(durationSeconds: number, bpm: number): string {
  const beatDuration = 60 / bpm;
  const ratio = durationSeconds / beatDuration;

  if (ratio >= 3.5) return '1';
  if (ratio >= 1.75) return '2';
  if (ratio >= 0.875) return '4';
  if (ratio >= 0.4375) return '8';
  if (ratio >= 0.21875) return '16';
  return '16';
}
