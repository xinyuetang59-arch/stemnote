/**
 * 导出模块 - MIDI / MusicXML / PNG / PDF 导出
 *
 * MIDI: 使用 @tonejs/midi，带超时保护
 * PNG/PDF: 从页面 VexFlow SVG 抓取，注入字体后转 Canvas 导出
 */
import type { DetectedNote } from './pitch';
import { midiToNoteName } from './pitch';

// ====== MIDI 导出 ======

export async function exportMIDI(notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  // 过滤无效音符
  const valid = notes.filter(
    (n) =>
      n && Number.isFinite(n.pitch) && Number.isFinite(n.startTime) &&
      Number.isFinite(n.duration) && n.pitch >= 21 && n.pitch <= 108 &&
      n.startTime >= 0 && n.duration > 0 && n.duration < 60
  );
  if (valid.length === 0) throw new Error('没有有效音符可导出');

  const { Midi } = await import('@tonejs/midi');
  const midi = new Midi();
  const track = midi.addTrack();

  // 不调用 setTempo（可能不存在），直接设 tempos
  // eslint-disable-next-line
  (midi.header as unknown as { tempos: Array<{ ticks: number; bpm: number }> }).tempos = [{ ticks: 0, bpm: 120 }];

  for (const note of valid) {
    track.addNote({
      midi: Math.round(note.pitch),
      time: note.startTime,
      duration: Math.max(0.05, note.duration),
      velocity: Math.max(0.2, Math.min(1, note.velocity || 0.6)),
    });
  }

  // 用 Promise.race 防卡死（5 秒超时）
  const midiData = await Promise.race([
    (async () => midi.toArray())(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('MIDI 编码超时')), 5000)),
  ]);

  const blob = new Blob([midiData as unknown as BlobPart], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, `${fileName}.mid`);
  URL.revokeObjectURL(url);
}

// ====== MusicXML 导出 ======

export function exportMusicXML(notes: DetectedNote[], fileName: string = 'stemnote'): void {
  const divisions = 4;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>扒谱结果</part-name></score-part>
  </part-list>
  <part id="P1">`;

  const sorted = [...notes].sort((a, b) => a.startTime - b.startTime);
  const beatDuration = 0.5;
  const measureDuration = beatDuration * 4;
  const measures: Map<number, DetectedNote[]> = new Map();

  for (const note of sorted) {
    const mi = Math.floor(note.startTime / measureDuration);
    if (!measures.has(mi)) measures.set(mi, []);
    measures.get(mi)!.push(note);
  }

  for (const mi of [...measures.keys()].sort((a, b) => a - b)) {
    const mNotes = measures.get(mi)!;
    xml += `\n    <measure number="${mi + 1}">
      <attributes>
        <divisions>${divisions}</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>`;

    for (const n of mNotes) {
      const dd = Math.max(1, Math.round(n.duration / beatDuration * divisions));
      const step = midiToNoteName(n.pitch).replace(/[0-9]/g, '').replace('#', '');
      const oct = Math.floor(n.pitch / 12) - 1;
      const sharp = midiToNoteName(n.pitch).includes('#');
      xml += `\n      <note>${sharp
        ? `\n        <pitch><step>${step}</step><alter>1</alter><octave>${oct}</octave></pitch>`
        : `\n        <pitch><step>${step}</step><octave>${oct}</octave></pitch>`}
        <duration>${dd}</duration>
        <type>${getNoteType(dd, divisions)}</type>
      </note>`;
    }
    xml += '\n    </measure>';
  }
  xml += '\n  </part>\n</score-partwise>';

  const blob = new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' });
  downloadFile(URL.createObjectURL(blob), `${fileName}.musicxml`);
}

function getNoteType(d: number, div: number): string {
  const r = d / div;
  if (r >= 4) return 'whole';
  if (r >= 2) return 'half';
  if (r >= 1) return 'quarter';
  if (r >= 0.5) return 'eighth';
  return '16th';
}

// ====== PNG / PDF 导出 ======

/**
 * 从页面 SVG 转 PNG data URL。
 * 关键修复：将 SVG 的所有 `<text>` 元素替换为 Canvas fillText 绘制，
 * 以解决 Image 上下文中 FontFace 字体不渲染的问题。
 */
async function pageSvgToPng(svgEl: SVGElement, scale: number): Promise<string> {
  const rect = svgEl.getBoundingClientRect();
  const w = rect.width || 800;
  const h = rect.height || 400;

  // 方法：把 SVG 作为 Image 绘制到 Canvas，同时手工补绘 text 元素
  const cvs = document.createElement('canvas');
  cvs.width = w * scale;
  cvs.height = h * scale;
  const ctx = cvs.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  ctx.scale(scale, scale);

  // 1. 绘制不含 text 的 SVG 骨架（谱线、符号等 path 元素）
  const clone = svgEl.cloneNode(true) as SVGElement;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  // 移除所有 text 元素（将在 Canvas 上手动补绘）
  const texts = clone.querySelectorAll('text');
  const textData: Array<{ x: string; y: string; content: string; font: string; fill: string }> = [];
  texts.forEach((t) => {
    textData.push({
      x: t.getAttribute('x') || '0',
      y: t.getAttribute('y') || '0',
      content: t.textContent || '',
      font: window.getComputedStyle(t).font || '',
      fill: window.getComputedStyle(t).fill || '#000',
    });
  });
  texts.forEach((t) => t.remove());

  const svgStr = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG 加载失败')); };
    img.src = url;
  });

  // 2. 手动补绘所有 text 元素（字体在当前 document 上下文中可用）
  for (const td of textData) {
    const x = parseFloat(td.x);
    const y = parseFloat(td.y);
    ctx.font = td.font;
    ctx.fillStyle = td.fill;
    ctx.fillText(td.content, x, y);
  }

  return cvs.toDataURL('image/png');
}

export async function exportPNG(_notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  const svg = document.querySelector('.vexflow-container svg') as SVGElement | null;
  if (!svg) throw new Error('未找到乐谱，请确认乐谱已生成');

  try {
    const dataUrl = await pageSvgToPng(svg, 2);
    downloadFile(dataUrl, `${fileName}.png`);
  } catch (error) {
    console.error('PNG 导出失败:', error);
    throw new Error('PNG 导出失败');
  }
}

export async function exportPDF(_notes: DetectedNote[], fileName: string = 'stemnote'): Promise<void> {
  const svg = document.querySelector('.vexflow-container svg') as SVGElement | null;
  if (!svg) throw new Error('未找到乐谱，请确认乐谱已生成');

  try {
    const { default: jsPDF } = await import('jspdf');
    const dataUrl = await pageSvgToPng(svg, 3);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('图片加载失败'));
      el.src = dataUrl;
    });

    const margin = 10;
    const usableW = 190;
    const imgH = (img.height * usableW) / img.width;
    const usableH = 277;
    const pdf = new jsPDF('p', 'mm', 'a4');

    let left = imgH;
    let pos = margin;
    pdf.addImage(dataUrl, 'PNG', margin, pos, usableW, imgH);
    left -= usableH;
    while (left > 0) {
      pos = -(imgH - left) - margin;
      pdf.addPage();
      pdf.addImage(dataUrl, 'PNG', margin, pos, usableW, imgH);
      left -= usableH;
    }
    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error('PDF 导出失败:', error);
    throw new Error('PDF 导出失败');
  }
}

function downloadFile(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
