/**
 * 导出模块 - MIDI / PDF / PNG 导出
 */
import type { DetectedNote } from './pitch';
import { midiToNoteName } from './pitch';

/**
 * 导出 MIDI 文件
 * 使用 @tonejs/midi 库生成标准 MIDI 格式
 */
export async function exportMIDI(notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  try {
    const { Midi } = await import('@tonejs/midi');

    const midi = new Midi();
    const track = midi.addTrack();

    // 设置速度 (120 BPM)
    midi.header.setTempo(120);

    // 添加音符
    for (const note of notes) {
      track.addNote({
        midi: note.pitch,
        time: note.startTime,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
      });
    }

    // 下载
    const midiData = midi.toArray();
    const blob = new Blob([midiData.buffer as ArrayBuffer], { type: 'audio/midi' });
    const dataUrl = URL.createObjectURL(blob);
    downloadFile(dataUrl, `${fileName}.mid`);
    URL.revokeObjectURL(dataUrl);
  } catch (error) {
    console.error('MIDI 导出失败:', error);
    throw new Error('MIDI 导出失败');
  }
}

/**
 * 导出 MusicXML (简化版)
 */
export function exportMusicXML(notes: DetectedNote[], fileName: string = 'stemnote'): void {
  const divisions = 4; // 每四分音符的 divisions
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>扒谱结果</part-name>
    </score-part>
  </part-list>
  <part id="P1">`;

  // 按 startTime 排序
  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  // 将音符分组为小节 (4/4 拍, 120 BPM)
  const beatDuration = 0.5; // 120 BPM 下每拍 = 0.5秒
  const measureDuration = beatDuration * 4; // 每小节 2 秒
  const measures: Map<number, DetectedNote[]> = new Map();

  for (const note of sorted) {
    const measureIndex = Math.floor(note.startTime / measureDuration);
    if (!measures.has(measureIndex)) {
      measures.set(measureIndex, []);
    }
    measures.get(measureIndex)!.push(note);
  }

  const measureIndices = [...measures.keys()].sort((a, b) => a - b);

  for (const mi of measureIndices) {
    const measureNotes = measures.get(mi)!;
    xml += `
    <measure number="${mi + 1}">
      <attributes>
        <divisions>${divisions}</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>`;

    for (const note of measureNotes) {
      const offsetInMeasure = note.startTime - mi * measureDuration;
      const divisionsStart = Math.round(offsetInMeasure / beatDuration * divisions);
      const divisionsDuration = Math.max(1, Math.round(note.duration / beatDuration * divisions));

      xml += `
      <note>
        <pitch>
          <step>${midiToNoteName(note.pitch).replace(/[0-9]/g, '')}</step>
          <octave>${Math.floor(note.pitch / 12) - 1}</octave>
        </pitch>
        <duration>${divisionsDuration}</duration>
        <type>${getNoteType(divisionsDuration, divisions)}</type>
      </note>`;
    }

    xml += `
    </measure>`;
  }

  xml += `
  </part>
</score-part-wise>`;

  const blob = new Blob([xml], { type: 'application/xml' });
  downloadFile(URL.createObjectURL(blob), `${fileName}.musicxml`);
}

/** 根据 duration 推断音符类型 */
function getNoteType(duration: number, divisions: number): string {
  const ratio = duration / divisions;
  if (ratio >= 4) return 'whole';
  if (ratio >= 2) return 'half';
  if (ratio >= 1) return 'quarter';
  if (ratio >= 0.5) return 'eighth';
  return '16th';
}

/**
 * 从 Canvas 导出 PNG 图片
 * @param canvasElement - VexFlow 渲染的 canvas 元素
 * @param fileName - 文件名
 */
export function exportPNG(canvasElement: HTMLCanvasElement, fileName: string = 'stemnote'): void {
  const dataUrl = canvasElement.toDataURL('image/png');
  downloadFile(dataUrl, `${fileName}.png`);
}

/**
 * 导出 PDF 乐谱
 * 使用 jsPDF + html2canvas
 * @param containerElement - 包含五线谱的 DOM 元素
 * @param fileName - 文件名
 */
export async function exportPDF(containerElement: HTMLElement, fileName: string = 'stemnote'): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');
    const { default: html2canvas } = await import('html2canvas');

    const canvas = await html2canvas(containerElement, {
      backgroundColor: '#ffffff',
      scale: 2,
    });

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 宽度 (mm)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageHeight = 297; // A4 高度 (mm)
    let heightLeft = imgHeight;
    let position = 0;

    // 如果内容超过一页，分页处理
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('PDF 导出失败:', error);
    throw new Error('PDF 导出失败');
  }
}

/** 通用下载辅助函数 */
function downloadFile(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
