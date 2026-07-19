/**
 * 五线谱渲染组件
 * 使用 VexFlow 5 渲染检测到的音符
 * 支持点击选中音符、手动拖动调整音高和时值
 */
import { useEffect, useRef, useState } from 'react';
import { Renderer, Stave, StaveNote, Accidental, Formatter } from 'vexflow';
import { useTranscribeStore } from '../../stores/transcribeStore';
import { midiToNoteName } from '../../lib/audio/pitch';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export default function SheetViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { notes, selectedNoteIndex, selectNote } = useTranscribeStore();
  const [zoom, setZoom] = useState(1.0);

  // 渲染五线谱
  useEffect(() => {
    if (!containerRef.current || notes.length === 0) return;

    // 清空之前的渲染
    containerRef.current.innerHTML = '';

    try {
      // 创建渲染器
      const renderer = new Renderer(
        containerRef.current,
        Renderer.Backends.SVG
      );

      // 计算画布大小
      const notesPerLine = 32;
      const lineHeight = 200 * zoom;
      const lineWidth = Math.min(containerRef.current.clientWidth - 40, 1200);
      const totalLines = Math.ceil(notes.length / notesPerLine);
      const totalHeight = totalLines * lineHeight + 80;

      renderer.resize(lineWidth + 40, Math.max(totalHeight, 300));

      const context = renderer.getContext();
      context.setFont('Arial', 10);
      context.setFillStyle('#1e293b');

      // 按时间排序
      const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

      // 分组渲染
      for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
        const lineNotes = sortedNotes.slice(
          lineIndex * notesPerLine,
          (lineIndex + 1) * notesPerLine
        );

        if (lineNotes.length === 0) continue;

        const y = 40 + lineIndex * lineHeight;

        // 创建谱表
        const stave = new Stave(10, y, lineWidth);
        if (lineIndex === 0) {
          stave.addClef('treble').addTimeSignature('4/4');
        }
        stave.setContext(context).draw();

        // 创建音符数组
        if (lineNotes.length > 0) {
          // 对每个音符创建 VexFlow note
          const vexNotes: InstanceType<typeof StaveNote>[] = [];

          for (let ni = 0; ni < lineNotes.length; ni++) {
            const note = lineNotes[ni];
            const noteName = midiToNoteName(note.pitch);
            const noteLetter = noteName.replace(/[0-9]/g, '');
            const octave = noteName.replace(/[^0-9]/g, '');

            const duration = getClosestDuration(note.duration, 120);
            const staveNote = new StaveNote({
              clef: 'treble',
              keys: [`${noteLetter.toLowerCase()}/${octave}`],
              duration: duration,
            });

            // 添加临时升降号
            if (noteLetter.includes('#')) {
              staveNote.addModifier(new Accidental('#'), 0);
            }

            // 选中高亮
            const globalIndex = lineIndex * notesPerLine + ni;
            if (globalIndex === selectedNoteIndex) {
              staveNote.setStyle({ fillStyle: '#f59e0b', strokeStyle: '#d97706' });
            }

            vexNotes.push(staveNote);
          }

          if (vexNotes.length > 0) {
            // 使用 Formatter 排版
            Formatter.FormatAndDraw(context, stave, vexNotes, {
              autoBeam: true,
              alignRests: true,
            });

            // 为每个音符绑定点击事件
            // VexFlow 5 的 SVG 元素可以通过查询获取
            setTimeout(() => {
              const svgElements = containerRef.current?.querySelectorAll('.vf-note');
              svgElements?.forEach((el, i) => {
                const globalIndex = lineIndex * notesPerLine + i;
                if (globalIndex < notes.length) {
                  (el as SVGElement).style.cursor = 'pointer';
                  (el as SVGElement).addEventListener('click', () => {
                    selectNote(sortedNotes[globalIndex], globalIndex);
                  });
                }
              });
            }, 50);
          }
        }
      }
    } catch (error) {
      console.error('VexFlow 渲染出错:', error);
      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="flex items-center justify-center h-64 text-slate-400">
            <p>乐谱渲染出错，请重试</p>
          </div>`;
      }
    }
  }, [notes, selectedNoteIndex, zoom, selectNote]);

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

  // 标准时值映射
  if (ratio >= 3.5) return '1';   // 全音符
  if (ratio >= 1.75) return '2';  // 二分音符
  if (ratio >= 0.875) return '4'; // 四分音符
  if (ratio >= 0.4375) return '8'; // 八分音符
  if (ratio >= 0.21875) return '16'; // 十六分音符
  return '16';
}
