/**
 * 通用工具函数
 */

/** 格式化日期为中文格式 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/** 截断文本 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 支持的音频格式 */
export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg',
  'audio/wav',
  'audio/flac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
];

/** 音频文件大小上限 (50MB) */
export const MAX_AUDIO_SIZE = 50 * 1024 * 1024;

/** 检查文件是否为支持的音频格式 */
export function isAudioFile(file: File): boolean {
  return SUPPORTED_AUDIO_FORMATS.includes(file.type) ||
    file.name.match(/\.(mp3|wav|flac|m4a|ogg)$/i) !== null;
}

/** 国内主要高校列表 */
export const SCHOOLS = [
  '北京大学',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '南京大学',
  '中国科学技术大学',
  '武汉大学',
  '华中科技大学',
  '中山大学',
  '四川大学',
  '西安交通大学',
  '哈尔滨工业大学',
  '同济大学',
  '北京师范大学',
  '南开大学',
  '天津大学',
  '东南大学',
  '中国人民大学',
  '北京航空航天大学',
  '中央音乐学院',
  '上海音乐学院',
  '中国音乐学院',
  '四川音乐学院',
  '武汉音乐学院',
  '星海音乐学院',
  '香港科技大学（广州）',
  '其他高校',
];
