/**
 * 附件上传组件
 * 支持上传 MIDI / MusicXML / PDF 文件
 */
import { useState, useRef } from 'react';
import { Upload, X, File, FileMusic } from 'lucide-react';
import type { Attachment } from '../../lib/db';
import { formatFileSize } from '../../lib/utils';

interface AttachmentUploadProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
}

/** 支持的附件格式 */
const ACCEPTED_TYPES = [
  'audio/midi',
  'audio/x-midi',
  'application/xml',
  'text/xml',
  'application/pdf',
  '.mid',
  '.midi',
  '.musicxml',
  '.xml',
  '.pdf',
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default function AttachmentUpload({ attachments, onAttachmentsChange }: AttachmentUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const validFiles: Attachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > MAX_SIZE) {
        continue; // 跳过过大文件
      }
      validFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        data: file,
      });
    }

    if (validFiles.length > 0) {
      onAttachmentsChange([...attachments, ...validFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    const updated = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  return (
    <div>
      {/* 已上传的附件列表 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm"
            >
              <FileMusic className="w-3.5 h-3.5 text-brand-gold" />
              <span className="text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                {att.name}
              </span>
              <span className="text-xs text-slate-400">{formatFileSize(att.size)}</span>
              <button
                onClick={() => removeAttachment(i)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                aria-label="移除附件"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上传区域 */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-brand-gold bg-brand-gold/5'
            : 'border-slate-300 dark:border-slate-600 hover:border-brand-gold/50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
          multiple
        />
        <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
        <p className="text-xs text-slate-400">
          拖拽或点击上传附件（MIDI / MusicXML / PDF，≤10MB）
        </p>
      </div>
    </div>
  );
}
