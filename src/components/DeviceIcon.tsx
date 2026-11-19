import {
  Archive,
  File,
  FileCode,
  FileSpreadsheet,
  FileText,
  Film,
  Image,
  Laptop,
  MessageSquareText,
  Monitor,
  Music,
  Smartphone,
  Tablet,
} from 'lucide-react';
import type { DeviceType } from '../types/transfer.ts';

export function DeviceIcon({
  type,
  className = 'w-5 h-5',
}: {
  type: DeviceType;
  className?: string;
}) {
  switch (type) {
    case 'mobile':
      return <Smartphone className={className} />;
    case 'tablet':
      return <Tablet className={className} />;
    case 'laptop':
      return <Laptop className={className} />;
    case 'desktop':
    default:
      return <Monitor className={className} />;
  }
}

export function ItemKindIcon({
  kind,
  mimeType,
  name,
  className = 'w-4 h-4',
}: {
  kind: 'file' | 'text';
  mimeType: string;
  name: string;
  className?: string;
}) {
  if (kind === 'text') {
    return <MessageSquareText className={className} />;
  }
  const lower = (mimeType || '').toLowerCase();
  const ext = name.split('.').pop()?.toLowerCase() || '';

  if (lower.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'heic'].includes(ext)) {
    return <Image className={className} />;
  }
  if (lower.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) {
    return <Film className={className} />;
  }
  if (lower.startsWith('audio/') || ['mp3', 'wav', 'flac', 'm4a', 'ogg'].includes(ext)) {
    return <Music className={className} />;
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext) || lower.includes('zip') || lower.includes('archive')) {
    return <Archive className={className} />;
  }
  if (['csv', 'xls', 'xlsx'].includes(ext)) {
    return <FileSpreadsheet className={className} />;
  }
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'go', 'rs', 'html', 'css', 'md'].includes(ext)) {
    return <FileCode className={className} />;
  }
  if (lower.includes('pdf') || lower.startsWith('text/') || ['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
    return <FileText className={className} />;
  }
  return <File className={className} />;
}
