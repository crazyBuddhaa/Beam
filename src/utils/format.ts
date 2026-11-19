import type { DeviceType } from '../types/transfer.ts';

const ADJECTIVES = [
  'Swift', 'Calm', 'Crisp', 'Bright', 'Amber', 'Cedar', 'Quiet', 'Solar',
  'North', 'Clear', 'Silver', 'Harbor', 'Linen', 'Maple', 'Stone', 'Breeze',
  'Cobalt', 'Slate', 'River', 'Signal', 'Frost', 'Meadow', 'Cinder', 'Ochre',
];

const NOUNS = [
  'Falcon', 'Otter', 'Birch', 'Heron', 'Finch', 'Fox', 'Pebble', 'Pine',
  'Badger', 'Crane', 'Wren', 'Spruce', 'Gull', 'Lynx', 'Cove', 'Alder',
  'Marten', 'Osprey', 'Reed', 'Brook', 'Lark', 'Kestrel', 'Fern', 'Ridge',
];

export function generateDeviceAlias(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun}`;
}

export function generateDeviceTag(): string {
  return String(Math.floor(100 + Math.random() * 900));
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function detectPlatformAndDevice(): { platform: string; deviceType: DeviceType } {
  if (typeof navigator === 'undefined') {
    return { platform: 'Web', deviceType: 'desktop' };
  }
  const ua = navigator.userAgent || '';
  const platformStr = (navigator.platform || '').toLowerCase();

  let platform = 'Web';
  if (/iphone|ipad|ipod/i.test(ua)) {
    platform = 'iOS';
  } else if (/android/i.test(ua)) {
    platform = 'Android';
  } else if (/mac/i.test(platformStr) || /macintosh/i.test(ua)) {
    platform = 'macOS';
  } else if (/win/i.test(platformStr) || /windows/i.test(ua)) {
    platform = 'Windows';
  } else if (/linux/i.test(platformStr) || /linux/i.test(ua)) {
    platform = 'Linux';
  }

  let deviceType: DeviceType = 'desktop';
  if (/ipad|tablet/i.test(ua) || (platform === 'macOS' && navigator.maxTouchPoints > 1)) {
    deviceType = 'tablet';
  } else if (/mobi|iphone|android/i.test(ua)) {
    deviceType = 'mobile';
  } else if (platform === 'macOS' || /laptop/i.test(ua)) {
    deviceType = 'laptop';
  }

  return { platform, deviceType };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 || i === 0 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(remainingBytes: number, speedBytesPerSec: number): string {
  if (remainingBytes <= 0) return 'Done';
  if (!Number.isFinite(speedBytesPerSec) || speedBytesPerSec < 1024) return 'Calculating...';
  const sec = Math.ceil(remainingBytes / speedBytesPerSec);
  if (sec < 60) return `${sec}s left`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s left`;
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return 'FILE';
  return name.slice(idx + 1, idx + 7).toUpperCase();
}

export function encodeBinaryFrame(
  header: Record<string, unknown>,
  payload: Uint8Array
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const headerBytes = encoder.encode(JSON.stringify(header));
  const buffer = new ArrayBuffer(4 + headerBytes.length + payload.byteLength);
  const frame = new Uint8Array(buffer);
  const view = new DataView(buffer);
  view.setUint32(0, headerBytes.length, false);
  frame.set(headerBytes, 4);
  frame.set(payload, 4 + headerBytes.length);
  return frame;
}

export function decodeBinaryFrame<T>(buffer: ArrayBuffer): { header: T; payload: Uint8Array } | null {
  if (buffer.byteLength < 4) return null;
  const view = new DataView(buffer);
  const headerLen = view.getUint32(0, false);
  if (headerLen <= 0 || 4 + headerLen > buffer.byteLength) return null;
  const decoder = new TextDecoder();
  const headerJson = decoder.decode(new Uint8Array(buffer, 4, headerLen));
  const header = JSON.parse(headerJson) as T;
  const payload = new Uint8Array(buffer, 4 + headerLen);
  return { header, payload };
}
