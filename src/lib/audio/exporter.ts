/**
 * 导出模块 - MIDI / MusicXML / PNG / PDF 导出
 *
 * PNG/PDF 使用 VexFlow Canvas 后端直接渲染，避免 SVG→图片转换时字体丢失
 */
import type { DetectedNote } from './pitch';
import { midiToNoteName } from './pitch';

// ====== MIDI 导出 ======

/**
 * 导出 MIDI 文件
 * 使用 @tonejs/midi 库生成标准 MIDI 格式
 * 注意：@tonejs/midi 的 velocity 参数接受 0-1 归一化值（内部会自行 ×127）
 */
export async function exportMIDI(notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  try {
    const { Midi } = await import('@tonejs/midi');

    const midi = new Midi();
    const track = midi.addTrack();

    // 设置速度 (120 BPM) — 用 tempos 数组更可靠
    midi.header.tempos = [{ ticks: 0, bpm: 120 }];

    // 添加音符（velocity 传 0-1 归一化值）
    for (const note of notes) {
      track.addNote({
        midi: note.pitch,
        time: note.startTime,
        duration: Math.max(note.duration, 0.05),
        velocity: Math.max(0, Math.min(1, note.velocity)),
      });
    }

    const midiData = midi.toArray();
    const blob = new Blob([new Uint8Array(midiData) as BlobPart], { type: 'audio/midi' });
    const midiUrl = URL.createObjectURL(blob);
    downloadFile(midiUrl, `${fileName}.mid`);
    URL.revokeObjectURL(midiUrl);
  } catch (error) {
    console.error('MIDI 导出失败:', error);
    throw new Error('MIDI 导出失败');
  }
}

// ====== MusicXML 导出 ======

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

  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);

  const beatDuration = 0.5;
  const measureDuration = beatDuration * 4;
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
      const divisionsDuration = Math.max(1, Math.round(note.duration / beatDuration * divisions));

      const step = midiToNoteName(note.pitch).replace(/[0-9]/g, '').replace('#', '');
      const hasSharp = midiToNoteName(note.pitch).includes('#');
      const octave = Math.floor(note.pitch / 12) - 1;

      xml += `
      <note>`;

      if (hasSharp) {
        xml += `
        <pitch>
          <step>${step}</step>
          <alter>1</alter>
          <octave>${octave}</octave>
        </pitch>`;
      } else {
        xml += `
        <pitch>
          <step>${step}</step>
          <octave>${octave}</octave>
        </pitch>`;
      }

      xml += `
        <duration>${divisionsDuration}</duration>
        <type>${getNoteType(divisionsDuration, divisions)}</type>
      </note>`;
    }

    xml += `
    </measure>`;
  }

  xml += `
  </part>
</score-partwise>`;

  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
  downloadFile(URL.createObjectURL(blob), `${fileName}.musicxml`);
}

function getNoteType(duration: number, divisions: number): string {
  const ratio = duration / divisions;
  if (ratio >= 4) return 'whole';
  if (ratio >= 2) return 'half';
  if (ratio >= 1) return 'quarter';
  if (ratio >= 0.5) return 'eighth';
  return '16th';
}

// ====== PNG / PDF 导出（VexFlow Canvas 后端） ======

/**
 * 根据时长推断 VexFlow 时值字符串
 */
function getDurationString(durationSeconds: number): string {
  const beatDuration = 60 / 120; // 120 BPM
  const ratio = durationSeconds / beatDuration;
  if (ratio >= 3.5) return '1';
  if (ratio >= 1.75) return '2';
  if (ratio >= 0.875) return '4';
  if (ratio >= 0.4375) return '8';
  if (ratio >= 0.21875) return '16';
  return '16';
}

/**
 * 使用 VexFlow Canvas 后端将音符渲染到 Canvas
 * Canvas 后端直接访问浏览器已加载的 Bravura 字体，无需 SVG→图片转换
 */
async function renderScoreToCanvas(notes: DetectedNote[]): Promise<HTMLCanvasElement> {
  const { Renderer, Stave, StaveNote, Accidental, Formatter } = await import('vexflow');

  // 创建临时 DOM 容器（必须在 DOM 中 Canvas 才能渲染）
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.appendChild(container);

  try {
    const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);
    const notesPerLine = 32;
    const lineHeight = 200;
    const lineWidth = 800;
    const totalLines = Math.ceil(sortedNotes.length / notesPerLine);
    const totalHeight = Math.max(totalLines * lineHeight + 80, 300);

    const renderer = new Renderer(container, Renderer.Backends.CANVAS);
    renderer.resize(lineWidth + 40, totalHeight);
    const ctx = renderer.getContext();
    ctx.setFont('Arial', 10);

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
      stave.setContext(ctx).draw();

      const vexNotes: InstanceType<typeof StaveNote>[] = [];
      for (const note of lineNotes) {
        const noteName = midiToNoteName(note.pitch);
        const noteLetter = noteName.replace(/[0-9]/g, '');
        const octave = noteName.replace(/[^0-9]/g, '');

        const staveNote = new StaveNote({
          clef: 'treble',
          keys: [`${noteLetter.toLowerCase()}/${octave}`],
          duration: getDurationString(note.duration),
        });

        if (noteLetter.includes('#')) {
          staveNote.addModifier(new Accidental('#'), 0);
        }
        vexNotes.push(staveNote);
      }

      if (vexNotes.length > 0) {
        Formatter.FormatAndDraw(ctx, stave, vexNotes, {
          autoBeam: true,
          alignRests: true,
        });
      }
    }

    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('乐谱渲染失败，请重试');
    return canvas;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 导出 PNG 图片（VexFlow Canvas 直接渲染）
 */
export async function exportPNG(notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  try {
    const canvas = await renderScoreToCanvas(notes);
    const dataUrl = canvas.toDataURL('image/png');
    downloadFile(dataUrl, `${fileName}.png`);
  } catch (error) {
    console.error('PNG 导出失败:', error);
    throw new Error('PNG 导出失败');
  }
}

/**
 * 导出 PDF 乐谱（VexFlow Canvas → jsPDF）
 */
export async function exportPDF(notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');

    const canvas = await renderScoreToCanvas(notes);
    const dataUrl = canvas.toDataURL('image/png');

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('图片加载失败'));
      el.src = dataUrl;
    });

    // A4: 210mm x 297mm
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (img.height * usableWidth) / img.width;
    const usableHeight = pageHeight - margin * 2;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(dataUrl, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft) - margin;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= usableHeight;
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
