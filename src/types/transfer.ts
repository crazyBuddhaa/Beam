export type DeviceType = 'desktop' | 'laptop' | 'tablet' | 'mobile';

export type QuickSaveMode = 'off' | 'favorites' | 'on';

export type TransportPreference = 'auto' | 'relay';

export type TransportUsed = 'p2p' | 'relay' | 'pending';

export type ThemeMode = 'light' | 'dark';

export interface PeerInfo {
  id: string;
  alias: string;
  tag: string;
  deviceType: DeviceType;
  platform: string;
  room: string;
  requiresPin: boolean;
  quickSave: QuickSaveMode;
  joinedAt: number;
}

export interface StagedItem {
  id: string;
  kind: 'file' | 'text';
  name: string;
  relativePath?: string;
  size: number;
  mimeType: string;
  file?: File;
  text?: string;
}

export interface TransferFileMeta {
  id: string;
  kind: 'file' | 'text';
  name: string;
  relativePath?: string;
  size: number;
  mimeType: string;
  textPreview?: string;
}

export interface IncomingOffer {
  transferId: string;
  fromPeer: PeerInfo;
  items: TransferFileMeta[];
  totalSize: number;
  receivedAt: number;
}

export type TransferStatus =
  | 'waiting'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'error';

export interface ActiveTransferFileState {
  meta: TransferFileMeta;
  transferredBytes: number;
  status: 'pending' | 'active' | 'done' | 'error';
  blobUrl?: string;
  textContent?: string;
}

export interface ActiveTransfer {
  transferId: string;
  direction: 'send' | 'receive';
  peer: PeerInfo;
  files: ActiveTransferFileState[];
  totalSize: number;
  transferredBytes: number;
  status: TransferStatus;
  transport: TransportUsed;
  speedBytesPerSec: number;
  startedAt: number;
  finishedAt?: number;
  errorMessage?: string;
}

export interface HistoryItem {
  id: string;
  transferId: string;
  direction: 'send' | 'receive';
  peerAlias: string;
  peerTag: string;
  peerDeviceType: DeviceType;
  kind: 'file' | 'text';
  name: string;
  relativePath?: string;
  size: number;
  mimeType: string;
  timestamp: number;
  transport: TransportUsed;
  blobUrl?: string;
  textContent?: string;
}

export interface UserSettings {
  alias: string;
  deviceType: DeviceType;
  quickSave: QuickSaveMode;
  pinEnabled: boolean;
  pinCode: string;
  autoDownload: boolean;
  transportMode: TransportPreference;
  theme: ThemeMode;
}

export interface BinaryChunkHeader {
  transferId: string;
  targetPeerId: string;
  senderPeerId: string;
  fileIndex: number;
  offset: number;
  isLast: boolean;
}
