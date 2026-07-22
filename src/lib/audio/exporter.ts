/**
 * 导出模块 - MIDI / MusicXML / PNG / PDF 导出
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

    // toArray() 返回 Uint8Array，创建独立副本后传给 Blob
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

      const step = midiToNoteName(note.pitch).replace(/[0-9]/g, '').replace('#', '');
      const alter = midiToNoteName(note.pitch).includes('#') ? 1 : 0;
      const octave = Math.floor(note.pitch / 12) - 1;

      xml += `
      <note>`;

      if (alter > 0) {
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

/** 根据 duration 推断音符类型 */
function getNoteType(duration: number, divisions: number): string {
  const ratio = duration / divisions;
  if (ratio >= 4) return 'whole';
  if (ratio >= 2) return 'half';
  if (ratio >= 1) return 'quarter';
  if (ratio >= 0.5) return 'eighth';
  return '16th';
}

// ====== SVG → PNG 转换（VexFlow 5 渲染为 SVG，导出需要先转为 PNG） ======

/**
 * 将 SVG 元素转换为 PNG data URL
 */
function svgToPngDataUrl(svgElement: SVGElement, scale: number = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    // 克隆 SVG 并设置显式宽高（确保渲染正确）
    const clone = svgElement.cloneNode(true) as SVGElement;
    const bbox = svgElement.getBoundingClientRect();
    const width = bbox.width || 800;
    const height = bbox.height || 400;
    clone.setAttribute('width', String(width));
    clone.setAttribute('height', String(height));

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d')!;
      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG 转 PNG 失败'));
    };
    img.src = url;
  });
}

/**
 * 从 SVG 元素导出 PNG 图片
 */
export async function exportPNGFromSVG(svgElement: SVGElement, fileName: string = 'stemnote'): Promise<void> {
  try {
    const dataUrl = await svgToPngDataUrl(svgElement, 2);
    downloadFile(dataUrl, `${fileName}.png`);
  } catch (error) {
    console.error('PNG 导出失败:', error);
    throw new Error('PNG 导出失败');
  }
}

/**
 * 导出 PDF 乐谱（从 SVG 元素）
 */
export async function exportPDFFromSVG(svgElement: SVGElement, fileName: string = 'stemnote'): Promise<void> {
  try {
    const { default: jsPDF } = await import('jspdf');

    const dataUrl = await svgToPngDataUrl(svgElement, 3);

    // 创建临时图片获取尺寸
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

    // 第一页
    pdf.addImage(dataUrl, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= usableHeight;

    // 分页
    while (heightLeft > 0) {
      position = -(imgHeight - (imgHeight - heightLeft) - margin);
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

// 保留旧函数签名兼容性（废弃）
export { svgToPngDataUrl };

/** 通用下载辅助函数 */
function downloadFile(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
