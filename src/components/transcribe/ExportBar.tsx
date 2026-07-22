/**
 * 导出工具栏组件
 * 支持导出 MIDI / MusicXML / PNG / PDF
 * PNG/PDF 使用 VexFlow Canvas 后端直接渲染，解决字体丢失问题
 */
import { Download, FileMusic, FileText, Image } from 'lucide-react';
import { useTranscribeStore } from '../../stores/transcribeStore';
import { useUIStore } from '../../stores/uiStore';
import { exportMIDI, exportMusicXML, exportPNG, exportPDF } from '../../lib/audio/exporter';

export default function ExportBar() {
  const { notes } = useTranscribeStore();
  const addToast = useUIStore((s) => s.addToast);
  const disabled = notes.length === 0;

  const handleExport = async (format: string) => {
    if (disabled) return;

    try {
      switch (format) {
        case 'midi':
          await exportMIDI(notes, 'stemnote-扒谱');
          addToast('MIDI 文件已下载', 'success');
          break;
        case 'musicxml':
          exportMusicXML(notes, 'stemnote-扒谱');
          addToast('MusicXML 文件已下载', 'success');
          break;
        case 'png':
          await exportPNG(notes, 'stemnote-乐谱');
          addToast('PNG 图片已下载', 'success');
          break;
        case 'pdf':
          await exportPDF(notes, 'stemnote-乐谱');
          addToast('PDF 文件已下载', 'success');
          break;
      }
    } catch (error) {
      addToast(`导出失败: ${error instanceof Error ? error.message : '请重试'}`, 'error');
    }
  };

  const buttons = [
    { format: 'midi', label: '导出 MIDI', icon: FileMusic },
    { format: 'musicxml', label: '导出 MusicXML', icon: FileText },
    { format: 'png', label: '导出图片', icon: Image },
    { format: 'pdf', label: '导出 PDF', icon: Download },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((btn) => (
        <button
          key={btn.format}
          onClick={() => handleExport(btn.format)}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <btn.icon className="w-4 h-4 text-brand-gold" />
          {btn.label}
        </button>
      ))}
    </div>
  );
}
