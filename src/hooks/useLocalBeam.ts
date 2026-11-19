import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActiveTransfer,
  ActiveTransferFileState,
  BinaryChunkHeader,
  HistoryItem,
  IncomingOffer,
  PeerInfo,
  StagedItem,
  TransferFileMeta,
  TransportUsed,
  UserSettings,
} from '../types/transfer.ts';
import {
  decodeBinaryFrame,
  detectPlatformAndDevice,
  encodeBinaryFrame,
  generateDeviceAlias,
  generateDeviceTag,
} from '../utils/format.ts';
import { triggerFileDownload } from '../utils/filePicker.ts';

const SETTINGS_KEY = 'localbeam_settings_v1';
const FAVORITES_KEY = 'localbeam_favorites_v1';
const HISTORY_KEY = 'localbeam_history_v1';
const PEER_ID_SESSION_KEY = 'localbeam_peer_id';
const PEER_TAG_SESSION_KEY = 'localbeam_peer_tag';

const WS_CHUNK_SIZE = 64 * 1024; // 64 KB
const RTC_CHUNK_SIZE = 32 * 1024; // 32 KB
const RTC_CONNECT_TIMEOUT_MS = 1500;

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface IncomingTransferBuffer {
  transferId: string;
  fromPeer: PeerInfo;
  files: TransferFileMeta[];
  chunksByFile: Uint8Array[][];
  bytesByFile: number[];
  doneByFile: boolean[];
  textByFile: (string | undefined)[];
  blobUrlByFile: (string | undefined)[];
  totalSize: number;
  receivedBytes: number;
  startedAt: number;
  lastTickAt: number;
  lastTickBytes: number;
  speedBytesPerSec: number;
  transport: TransportUsed;
  completed: boolean;
}

interface OutgoingTransferContext {
  transferId: string;
  targetPeer: PeerInfo;
  items: StagedItem[];
  startedAt: number;
}

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(PEER_ID_SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    sessionStorage.setItem(PEER_ID_SESSION_KEY, next);
    return next;
  } catch {
    return crypto.randomUUID();
  }
}

function getOrCreateSessionTag(): string {
  try {
    const existing = sessionStorage.getItem(PEER_TAG_SESSION_KEY);
    if (existing) return existing;
    const next = generateDeviceTag();
    sessionStorage.setItem(PEER_TAG_SESSION_KEY, next);
    return next;
  } catch {
    return generateDeviceTag();
  }
}

function getInitialRoom(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const qRoom = params.get('room');
    if (qRoom && qRoom.trim()) {
      const cleaned = qRoom.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
      if (cleaned && cleaned !== 'LOCAL') return cleaned;
    }
  } catch {
    // Ignore URL parsing issues
  }
  return 'local';
}

function loadInitialSettings(): UserSettings {
  const detected = detectPlatformAndDevice();
  const defaults: UserSettings = {
    alias: generateDeviceAlias(),
    deviceType: detected.deviceType,
    quickSave: 'off',
    pinEnabled: false,
    pinCode: '1234',
    autoDownload: true,
    transportMode: 'auto',
    theme: 'light',
  };

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      alias: typeof parsed.alias === 'string' && parsed.alias.trim() ? parsed.alias.trim() : defaults.alias,
      deviceType: parsed.deviceType || defaults.deviceType,
      quickSave: parsed.quickSave || defaults.quickSave,
      pinEnabled: Boolean(parsed.pinEnabled),
      pinCode: typeof parsed.pinCode === 'string' && parsed.pinCode.length >= 4 ? parsed.pinCode : defaults.pinCode,
      autoDownload: typeof parsed.autoDownload === 'boolean' ? parsed.autoDownload : true,
      transportMode: parsed.transportMode === 'relay' ? 'relay' : 'auto',
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return defaults;
  }
}

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

export function getPeerFavoriteKey(peer: Pick<PeerInfo, 'alias' | 'tag'>): string {
  return `${peer.alias}#${peer.tag}`;
}

export function useLocalBeam() {
  const [peerId] = useState<string>(() => getOrCreateSessionId());
  const [peerTag] = useState<string>(() => getOrCreateSessionTag());
  const [platform] = useState<string>(() => detectPlatformAndDevice().platform);
  const [settings, setSettings] = useState<UserSettings>(() => loadInitialSettings());
  const [room, setRoom] = useState<string>(() => getInitialRoom());
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [incomingOffers, setIncomingOffers] = useState<IncomingOffer[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory());
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; tone: 'info' | 'error' } | null>(null);
  const [pinErrorTransferId, setPinErrorTransferId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const roomRef = useRef(room);
  roomRef.current = room;
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  const outgoingContextsRef = useRef<Map<string, OutgoingTransferContext>>(new Map());
  const incomingBuffersRef = useRef<Map<string, IncomingTransferBuffer>>(new Map());
  const cancelledTransfersRef = useRef<Set<string>>(new Set());
  const rtcPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const rtcChannelsRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const rtcResolversRef = useRef<Map<string, (dc: RTCDataChannel | null) => void>>(new Map());
  const lastUiSyncRef = useRef<number>(0);

  const showToast = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setToastMessage({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = window.setTimeout(() => setToastMessage(null), 3600);
    return () => window.clearTimeout(t);
  }, [toastMessage]);

  // Apply light/dark theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // Ignore storage errors
    }
  }, [favorites]);

  const appendHistoryItems = useCallback((newItems: HistoryItem[]) => {
    setHistory((prev) => {
      const merged = [...newItems, ...prev].slice(0, 80);
      try {
        // Persist metadata without ephemeral blob URLs
        const serializable = merged.map((item) => ({
          ...item,
          blobUrl: undefined,
        }));
        localStorage.setItem(HISTORY_KEY, JSON.stringify(serializable));
      } catch {
        // Ignore storage errors
      }
      return merged;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory((prev) => {
      for (const item of prev) {
        if (item.blobUrl) {
          URL.revokeObjectURL(item.blobUrl);
        }
      }
      return [];
    });
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // Ignore
    }
    showToast('Transfer history cleared');
  }, [showToast]);

  const sendJson = useCallback((payload: Record<string, unknown>): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(payload));
    return true;
  }, []);

  const cleanupRtc = useCallback((transferId: string) => {
    const dc = rtcChannelsRef.current.get(transferId);
    if (dc) {
      try {
        dc.close();
      } catch {
        // Ignore
      }
      rtcChannelsRef.current.delete(transferId);
    }
    const pc = rtcPeersRef.current.get(transferId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // Ignore
      }
      rtcPeersRef.current.delete(transferId);
    }
    const resolver = rtcResolversRef.current.get(transferId);
    if (resolver) {
      rtcResolversRef.current.delete(transferId);
      resolver(null);
    }
  }, []);

  const syncIncomingUi = useCallback((buf: IncomingTransferBuffer, force = false) => {
    const now = performance.now();
    if (!force && now - lastUiSyncRef.current < 80) return;
    lastUiSyncRef.current = now;

    const elapsedSec = Math.max((now - buf.lastTickAt) / 1000, 0.05);
    if (elapsedSec >= 0.25 || force) {
      const deltaBytes = buf.receivedBytes - buf.lastTickBytes;
      const instant = deltaBytes / elapsedSec;
      buf.speedBytesPerSec = buf.speedBytesPerSec > 0 ? buf.speedBytesPerSec * 0.6 + instant * 0.4 : instant;
      buf.lastTickAt = now;
      buf.lastTickBytes = buf.receivedBytes;
    }

    const filesState: ActiveTransferFileState[] = buf.files.map((meta, idx) => ({
      meta,
      transferredBytes: buf.bytesByFile[idx] || 0,
      status: buf.doneByFile[idx] ? 'done' : buf.bytesByFile[idx] > 0 ? 'active' : 'pending',
      blobUrl: buf.blobUrlByFile[idx],
      textContent: buf.textByFile[idx],
    }));

    setActiveTransfer({
      transferId: buf.transferId,
      direction: 'receive',
      peer: buf.fromPeer,
      files: filesState,
      totalSize: buf.totalSize,
      transferredBytes: buf.receivedBytes,
      status: buf.completed ? 'completed' : 'transferring',
      transport: buf.transport,
      speedBytesPerSec: buf.completed ? 0 : buf.speedBytesPerSec,
      startedAt: buf.startedAt,
      finishedAt: buf.completed ? Date.now() : undefined,
    });
  }, []);

  const finalizeIncomingIfDone = useCallback(
    (buf: IncomingTransferBuffer) => {
      if (buf.completed) return;
      const allDone = buf.doneByFile.every(Boolean);
      if (!allDone) return;

      buf.completed = true;
      syncIncomingUi(buf, true);
      cleanupRtc(buf.transferId);

      const newHistory: HistoryItem[] = buf.files.map((meta, idx) => ({
        id: crypto.randomUUID(),
        transferId: buf.transferId,
        direction: 'receive',
        peerAlias: buf.fromPeer.alias,
        peerTag: buf.fromPeer.tag,
        peerDeviceType: buf.fromPeer.deviceType,
        kind: meta.kind,
        name: meta.name,
        relativePath: meta.relativePath,
        size: meta.size,
        mimeType: meta.mimeType,
        timestamp: Date.now(),
        transport: buf.transport,
        blobUrl: buf.blobUrlByFile[idx],
        textContent: buf.textByFile[idx],
      }));
      appendHistoryItems(newHistory);

      const label =
        buf.files.length === 1
          ? `Received "${buf.files[0].name}" from ${buf.fromPeer.alias}`
          : `Received ${buf.files.length} items from ${buf.fromPeer.alias}`;
      showToast(label);
    },
    [appendHistoryItems, cleanupRtc, showToast, syncIncomingUi]
  );

  const handleIncomingBinaryFrame = useCallback(
    (arrayBuffer: ArrayBuffer, transport: TransportUsed) => {
      const decoded = decodeBinaryFrame<BinaryChunkHeader>(arrayBuffer);
      if (!decoded) return;
      const { header, payload } = decoded;

      const buf = incomingBuffersRef.current.get(header.transferId);
      if (!buf || cancelledTransfersRef.current.has(header.transferId)) return;

      buf.transport = transport;
      const idx = header.fileIndex;
      const meta = buf.files[idx];
      if (!meta || buf.doneByFile[idx]) return;

      if (payload.byteLength > 0) {
        // Copy chunk out of the larger ArrayBuffer so GC can release the frame buffer
        const chunkCopy = new Uint8Array(payload.byteLength);
        chunkCopy.set(payload);
        buf.chunksByFile[idx].push(chunkCopy);
        buf.bytesByFile[idx] += payload.byteLength;
        buf.receivedBytes += payload.byteLength;
      }

      if (header.isLast || buf.bytesByFile[idx] >= meta.size) {
        const blob = new Blob(buf.chunksByFile[idx] as BlobPart[], {
          type: meta.mimeType || 'application/octet-stream',
        });
        const blobUrl = URL.createObjectURL(blob);
        buf.blobUrlByFile[idx] = blobUrl;
        buf.doneByFile[idx] = true;
        buf.chunksByFile[idx] = []; // Free chunk arrays once Blob holds data

        if (settingsRef.current.autoDownload) {
          triggerFileDownload(blobUrl, meta.name);
        }
        syncIncomingUi(buf, true);
        finalizeIncomingIfDone(buf);
      } else {
        syncIncomingUi(buf, false);
      }
    },
    [finalizeIncomingIfDone, syncIncomingUi]
  );

  const acceptOffer = useCallback(
    (offer: IncomingOffer) => {
      setIncomingOffers((prev) => prev.filter((o) => o.transferId !== offer.transferId));
      cancelledTransfersRef.current.delete(offer.transferId);

      const now = performance.now();
      const buf: IncomingTransferBuffer = {
        transferId: offer.transferId,
        fromPeer: offer.fromPeer,
        files: offer.items,
        chunksByFile: offer.items.map(() => []),
        bytesByFile: offer.items.map(() => 0),
        doneByFile: offer.items.map(() => false),
        textByFile: offer.items.map(() => undefined),
        blobUrlByFile: offer.items.map(() => undefined),
        totalSize: offer.totalSize,
        receivedBytes: 0,
        startedAt: Date.now(),
        lastTickAt: now,
        lastTickBytes: 0,
        speedBytesPerSec: 0,
        transport: 'pending',
        completed: false,
      };
      incomingBuffersRef.current.set(offer.transferId, buf);

      setActiveTransfer({
        transferId: offer.transferId,
        direction: 'receive',
        peer: offer.fromPeer,
        files: offer.items.map((meta) => ({
          meta,
          transferredBytes: 0,
          status: 'pending',
        })),
        totalSize: offer.totalSize,
        transferredBytes: 0,
        status: 'connecting',
        transport: 'pending',
        speedBytesPerSec: 0,
        startedAt: Date.now(),
      });

      sendJson({
        type: 'transfer:accept',
        targetPeerId: offer.fromPeer.id,
        transferId: offer.transferId,
      });
    },
    [sendJson]
  );

  const declineOffer = useCallback(
    (offer: IncomingOffer) => {
      setIncomingOffers((prev) => prev.filter((o) => o.transferId !== offer.transferId));
      sendJson({
        type: 'transfer:decline',
        targetPeerId: offer.fromPeer.id,
        transferId: offer.transferId,
      });
    },
    [sendJson]
  );

  const attemptWebRtcChannel = useCallback(
    async (transferId: string, targetPeerId: string): Promise<RTCDataChannel | null> => {
      if (settingsRef.current.transportMode === 'relay') return null;
      if (typeof RTCPeerConnection === 'undefined') return null;

      return new Promise((resolve) => {
        let settled = false;
        const finish = (dc: RTCDataChannel | null) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          rtcResolversRef.current.delete(transferId);
          if (!dc) {
            cleanupRtc(transferId);
          }
          resolve(dc);
        };

        const timer = window.setTimeout(() => finish(null), RTC_CONNECT_TIMEOUT_MS);
        rtcResolversRef.current.set(transferId, finish);

        try {
          const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
          });
          rtcPeersRef.current.set(transferId, pc);

          const dc = pc.createDataChannel('localbeam', { ordered: true });
          dc.binaryType = 'arraybuffer';
          dc.bufferedAmountLowThreshold = 256 * 1024;
          rtcChannelsRef.current.set(transferId, dc);

          dc.onopen = () => finish(dc);
          dc.onerror = () => finish(null);

          pc.onicecandidate = (ev) => {
            if (ev.candidate) {
              sendJson({
                type: 'rtc:ice',
                targetPeerId,
                transferId,
                candidate: ev.candidate.toJSON(),
              });
            }
          };

          pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
              finish(null);
            }
          };

          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer).then(() => offer))
            .then((offer) => {
              sendJson({
                type: 'rtc:offer',
                targetPeerId,
                transferId,
                sdp: offer,
              });
            })
            .catch(() => finish(null));
        } catch {
          finish(null);
        }
      });
    },
    [cleanupRtc, sendJson]
  );

  const streamOutgoingTransfer = useCallback(
    async (ctx: OutgoingTransferContext) => {
      const { transferId, targetPeer, items } = ctx;
      const hasFiles = items.some((i) => i.kind === 'file');

      setActiveTransfer((prev) =>
        prev && prev.transferId === transferId
          ? { ...prev, status: 'connecting' }
          : prev
      );

      let dc: RTCDataChannel | null = null;
      if (hasFiles) {
        dc = await attemptWebRtcChannel(transferId, targetPeer.id);
      }

      if (cancelledTransfersRef.current.has(transferId)) {
        cleanupRtc(transferId);
        return;
      }

      const transport: TransportUsed = dc && dc.readyState === 'open' ? 'p2p' : 'relay';
      const chunkSize = transport === 'p2p' ? RTC_CHUNK_SIZE : WS_CHUNK_SIZE;

      const totalSize = items.reduce((sum, item) => sum + item.size, 0);
      let transferredTotal = 0;
      let lastTickAt = performance.now();
      let lastTickBytes = 0;
      let smoothedSpeed = 0;
      const fileBytes = items.map(() => 0);
      const fileStatus: ActiveTransferFileState['status'][] = items.map(() => 'pending');

      const pushUi = (force = false, completed = false) => {
        const now = performance.now();
        if (!force && now - lastUiSyncRef.current < 80) return;
        lastUiSyncRef.current = now;

        const dt = Math.max((now - lastTickAt) / 1000, 0.05);
        if (dt >= 0.25 || force) {
          const instant = (transferredTotal - lastTickBytes) / dt;
          smoothedSpeed = smoothedSpeed > 0 ? smoothedSpeed * 0.6 + instant * 0.4 : instant;
          lastTickAt = now;
          lastTickBytes = transferredTotal;
        }

        setActiveTransfer((prev) => {
          if (!prev || prev.transferId !== transferId) return prev;
          return {
            ...prev,
            status: completed ? 'completed' : 'transferring',
            transport,
            transferredBytes: transferredTotal,
            speedBytesPerSec: completed ? 0 : smoothedSpeed,
            finishedAt: completed ? Date.now() : undefined,
            files: prev.files.map((f, idx) => ({
              ...f,
              transferredBytes: fileBytes[idx],
              status: fileStatus[idx],
            })),
          };
        });
      };

      pushUi(true, false);

      try {
        for (let fileIndex = 0; fileIndex < items.length; fileIndex++) {
          if (cancelledTransfersRef.current.has(transferId)) {
            cleanupRtc(transferId);
            return;
          }

          const item = items[fileIndex];
          fileStatus[fileIndex] = 'active';
          pushUi(true, false);

          if (item.kind === 'text') {
            const textContent = item.text || '';
            sendJson({
              type: 'transfer:text-payload',
              targetPeerId: targetPeer.id,
              transferId,
              fileIndex,
              text: textContent,
            });
            fileBytes[fileIndex] = item.size;
            transferredTotal += item.size;
            fileStatus[fileIndex] = 'done';
            pushUi(true, false);
            continue;
          }

          const file = item.file;
          if (!file) {
            fileStatus[fileIndex] = 'done';
            continue;
          }

          if (file.size === 0) {
            const frame = encodeBinaryFrame(
              {
                transferId,
                targetPeerId: targetPeer.id,
                senderPeerId: peerId,
                fileIndex,
                offset: 0,
                isLast: true,
              },
              new Uint8Array(0)
            );
            if (transport === 'p2p' && dc && dc.readyState === 'open') {
              dc.send(frame.buffer as ArrayBuffer);
            } else {
              wsRef.current?.send(frame);
            }
            fileStatus[fileIndex] = 'done';
            pushUi(true, false);
            continue;
          }

          let offset = 0;
          while (offset < file.size) {
            if (cancelledTransfersRef.current.has(transferId)) {
              cleanupRtc(transferId);
              return;
            }

            const sliceEnd = Math.min(offset + chunkSize, file.size);
            const sliceBuffer = await file.slice(offset, sliceEnd).arrayBuffer();
            const isLast = sliceEnd >= file.size;

            const frame = encodeBinaryFrame(
              {
                transferId,
                targetPeerId: targetPeer.id,
                senderPeerId: peerId,
                fileIndex,
                offset,
                isLast,
              },
              new Uint8Array(sliceBuffer)
            );

            if (transport === 'p2p' && dc && dc.readyState === 'open') {
              while (dc.bufferedAmount > 1024 * 1024) {
                if (cancelledTransfersRef.current.has(transferId) || dc.readyState !== 'open') break;
                await new Promise<void>((res) => {
                  const onLow = () => {
                    dc?.removeEventListener('bufferedamountlow', onLow);
                    res();
                  };
                  dc?.addEventListener('bufferedamountlow', onLow);
                  window.setTimeout(onLow, 40);
                });
              }
              if (dc.readyState === 'open') {
                dc.send(frame.buffer as ArrayBuffer);
              } else {
                // Seamless mid-stream fallback to WebSocket relay if P2P drops
                wsRef.current?.send(frame);
              }
            } else {
              const ws = wsRef.current;
              if (!ws || ws.readyState !== WebSocket.OPEN) {
                throw new Error('Connection lost during transfer');
              }
              while (ws.bufferedAmount > 1024 * 1024) {
                if (cancelledTransfersRef.current.has(transferId)) break;
                await new Promise((res) => window.setTimeout(res, 15));
              }
              ws.send(frame);
            }

            const sentLen = sliceEnd - offset;
            offset = sliceEnd;
            fileBytes[fileIndex] = offset;
            transferredTotal += sentLen;
            pushUi(false, false);
          }

          fileStatus[fileIndex] = 'done';
          pushUi(true, false);
        }

        // Wait briefly for WebSocket/DataChannel send buffer to drain before completing
        if (dc && dc.readyState === 'open') {
          let waitCount = 0;
          while (dc.bufferedAmount > 0 && waitCount < 60) {
            await new Promise((res) => window.setTimeout(res, 25));
            waitCount++;
          }
        }

        sendJson({
          type: 'transfer:complete',
          targetPeerId: targetPeer.id,
          transferId,
          transport,
        });

        pushUi(true, true);
        cleanupRtc(transferId);
        outgoingContextsRef.current.delete(transferId);

        const newHistory: HistoryItem[] = items.map((item) => ({
          id: crypto.randomUUID(),
          transferId,
          direction: 'send',
          peerAlias: targetPeer.alias,
          peerTag: targetPeer.tag,
          peerDeviceType: targetPeer.deviceType,
          kind: item.kind,
          name: item.name,
          relativePath: item.relativePath,
          size: item.size,
          mimeType: item.mimeType,
          timestamp: Date.now(),
          transport,
          textContent: item.text,
        }));
        appendHistoryItems(newHistory);

        showToast(
          items.length === 1
            ? `Sent "${items[0].name}" to ${targetPeer.alias}`
            : `Sent ${items.length} items to ${targetPeer.alias}`
        );
      } catch (err) {
        cleanupRtc(transferId);
        outgoingContextsRef.current.delete(transferId);
        setActiveTransfer((prev) =>
          prev && prev.transferId === transferId
            ? {
                ...prev,
                status: 'error',
                errorMessage: err instanceof Error ? err.message : 'Transfer failed',
              }
            : prev
        );
        showToast('Transfer interrupted due to connection error', 'error');
      }
    },
    [appendHistoryItems, attemptWebRtcChannel, cleanupRtc, peerId, sendJson, showToast]
  );

  // Connect & maintain WebSocket lifecycle
  useEffect(() => {
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      setConnectionState(reconnectAttemptsRef.current > 0 ? 'reconnecting' : 'connecting');

      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmounted) return;
        reconnectAttemptsRef.current = 0;
        setConnectionState('connected');
        const current = settingsRef.current;
        ws.send(
          JSON.stringify({
            type: 'peer:register',
            id: peerId,
            alias: current.alias,
            tag: peerTag,
            deviceType: current.deviceType,
            platform,
            room: roomRef.current,
            requiresPin: current.pinEnabled,
            quickSave: current.quickSave,
          })
        );
      };

      ws.onmessage = async (event) => {
        if (unmounted) return;

        if (event.data instanceof ArrayBuffer) {
          handleIncomingBinaryFrame(event.data, 'relay');
          return;
        }
        if (event.data instanceof Blob) {
          const ab = await event.data.arrayBuffer();
          handleIncomingBinaryFrame(ab, 'relay');
          return;
        }

        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = typeof msg.type === 'string' ? msg.type : '';

        if (type === 'room:state') {
          const peerList = Array.isArray(msg.peers) ? (msg.peers as PeerInfo[]) : [];
          setPeers(peerList.filter((p) => p.id !== peerId));
          return;
        }

        if (type === 'peer:joined') {
          const joined = msg.peer as PeerInfo | undefined;
          if (!joined || joined.id === peerId) return;
          setPeers((prev) => {
            const exists = prev.some((p) => p.id === joined.id);
            if (exists) {
              return prev.map((p) => (p.id === joined.id ? joined : p));
            }
            return [joined, ...prev];
          });
          return;
        }

        if (type === 'peer:updated') {
          const updated = msg.peer as PeerInfo | undefined;
          if (!updated || updated.id === peerId) return;
          setPeers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          return;
        }

        if (type === 'peer:left') {
          const leftId = typeof msg.peerId === 'string' ? msg.peerId : '';
          if (!leftId) return;
          setPeers((prev) => prev.filter((p) => p.id !== leftId));
          setIncomingOffers((prev) => prev.filter((o) => o.fromPeer.id !== leftId));
          return;
        }

        if (type === 'transfer:offer') {
          const fromPeer = msg.fromPeer as PeerInfo | undefined;
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const items = Array.isArray(msg.items) ? (msg.items as TransferFileMeta[]) : [];
          const totalSize = typeof msg.totalSize === 'number' ? msg.totalSize : 0;
          const suppliedPin = typeof msg.pin === 'string' ? msg.pin : '';

          if (!fromPeer || !transferId || items.length === 0) return;

          const current = settingsRef.current;
          if (current.pinEnabled && suppliedPin !== current.pinCode) {
            ws.send(
              JSON.stringify({
                type: 'transfer:pin-error',
                targetPeerId: fromPeer.id,
                transferId,
              })
            );
            return;
          }

          const offer: IncomingOffer = {
            transferId,
            fromPeer,
            items,
            totalSize,
            receivedAt: Date.now(),
          };

          const favKey = getPeerFavoriteKey(fromPeer);
          const isFav = favoritesRef.current.includes(favKey);

          if (current.quickSave === 'on' || (current.quickSave === 'favorites' && isFav)) {
            acceptOffer(offer);
          } else {
            setIncomingOffers((prev) => {
              if (prev.some((o) => o.transferId === transferId)) return prev;
              return [...prev, offer];
            });
          }
          return;
        }

        if (type === 'transfer:accept') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const ctx = outgoingContextsRef.current.get(transferId);
          if (ctx) {
            void streamOutgoingTransfer(ctx);
          }
          return;
        }

        if (type === 'transfer:decline') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          outgoingContextsRef.current.delete(transferId);
          setActiveTransfer((prev) =>
            prev && prev.transferId === transferId ? { ...prev, status: 'declined' } : prev
          );
          showToast('Transfer declined by recipient', 'error');
          return;
        }

        if (type === 'transfer:pin-error') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          outgoingContextsRef.current.delete(transferId);
          setPinErrorTransferId(transferId);
          setActiveTransfer((prev) =>
            prev && prev.transferId === transferId
              ? { ...prev, status: 'error', errorMessage: 'Incorrect PIN code' }
              : prev
          );
          showToast('Incorrect recipient PIN code', 'error');
          return;
        }

        if (type === 'transfer:peer-offline') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          outgoingContextsRef.current.delete(transferId);
          setActiveTransfer((prev) =>
            prev && prev.transferId === transferId
              ? { ...prev, status: 'error', errorMessage: 'Recipient is no longer available' }
              : prev
          );
          return;
        }

        if (type === 'transfer:cancel') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          cancelledTransfersRef.current.add(transferId);
          outgoingContextsRef.current.delete(transferId);
          incomingBuffersRef.current.delete(transferId);
          cleanupRtc(transferId);
          setIncomingOffers((prev) => prev.filter((o) => o.transferId !== transferId));
          setActiveTransfer((prev) =>
            prev && prev.transferId === transferId ? { ...prev, status: 'cancelled' } : prev
          );
          showToast('Transfer cancelled');
          return;
        }

        if (type === 'transfer:text-payload') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const fileIndex = typeof msg.fileIndex === 'number' ? msg.fileIndex : -1;
          const text = typeof msg.text === 'string' ? msg.text : '';
          const buf = incomingBuffersRef.current.get(transferId);
          if (!buf || fileIndex < 0 || !buf.files[fileIndex]) return;

          buf.transport = 'relay';
          buf.textByFile[fileIndex] = text;
          buf.bytesByFile[fileIndex] = buf.files[fileIndex].size;
          buf.receivedBytes += buf.files[fileIndex].size;
          buf.doneByFile[fileIndex] = true;
          syncIncomingUi(buf, true);
          finalizeIncomingIfDone(buf);
          return;
        }

        if (type === 'transfer:complete') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const buf = incomingBuffersRef.current.get(transferId);
          if (buf) {
            finalizeIncomingIfDone(buf);
          }
          return;
        }

        if (type === 'rtc:offer') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const fromPeerId = typeof msg.fromPeerId === 'string' ? msg.fromPeerId : '';
          const sdp = msg.sdp as RTCSessionDescriptionInit | undefined;
          if (!transferId || !fromPeerId || !sdp || typeof RTCPeerConnection === 'undefined') return;
          if (!incomingBuffersRef.current.has(transferId)) return;

          try {
            const pc = new RTCPeerConnection({
              iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            });
            rtcPeersRef.current.set(transferId, pc);

            pc.ondatachannel = (ev) => {
              const dc = ev.channel;
              dc.binaryType = 'arraybuffer';
              rtcChannelsRef.current.set(transferId, dc);
              dc.onmessage = async (dcEv) => {
                if (dcEv.data instanceof ArrayBuffer) {
                  handleIncomingBinaryFrame(dcEv.data, 'p2p');
                } else if (dcEv.data instanceof Blob) {
                  handleIncomingBinaryFrame(await dcEv.data.arrayBuffer(), 'p2p');
                }
              };
            };

            pc.onicecandidate = (ev) => {
              if (ev.candidate) {
                ws.send(
                  JSON.stringify({
                    type: 'rtc:ice',
                    targetPeerId: fromPeerId,
                    transferId,
                    candidate: ev.candidate.toJSON(),
                  })
                );
              }
            };

            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            ws.send(
              JSON.stringify({
                type: 'rtc:answer',
                targetPeerId: fromPeerId,
                transferId,
                sdp: answer,
              })
            );
          } catch {
            cleanupRtc(transferId);
          }
          return;
        }

        if (type === 'rtc:answer') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const sdp = msg.sdp as RTCSessionDescriptionInit | undefined;
          const pc = rtcPeersRef.current.get(transferId);
          if (pc && sdp) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            } catch {
              // Fallback will trigger automatically on timeout
            }
          }
          return;
        }

        if (type === 'rtc:ice') {
          const transferId = typeof msg.transferId === 'string' ? msg.transferId : '';
          const candidate = msg.candidate as RTCIceCandidateInit | undefined;
          const pc = rtcPeersRef.current.get(transferId);
          if (pc && candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {
              // Ignore stale ICE candidates
            }
          }
        }
      };

      ws.onclose = () => {
        if (unmounted) return;
        setConnectionState('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 8000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will handle reconnect cleanly
      };
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      for (const tid of Array.from(rtcPeersRef.current.keys())) {
        cleanupRtc(tid);
      }
    };
  }, [
    acceptOffer,
    cleanupRtc,
    finalizeIncomingIfDone,
    handleIncomingBinaryFrame,
    peerId,
    peerTag,
    platform,
    showToast,
    streamOutgoingTransfer,
    syncIncomingUi,
  ]);

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        sendJson({
          type: 'peer:update',
          alias: next.alias,
          deviceType: next.deviceType,
          requiresPin: next.pinEnabled,
          quickSave: next.quickSave,
        });
        return next;
      });
    },
    [sendJson]
  );

  const switchRoom = useCallback(
    (nextRoomRaw: string) => {
      const cleaned = nextRoomRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
      const normalized = !cleaned || cleaned === 'LOCAL' ? 'local' : cleaned;
      setRoom(normalized);
      roomRef.current = normalized;

      try {
        const url = new URL(window.location.href);
        if (normalized === 'local') {
          url.searchParams.delete('room');
        } else {
          url.searchParams.set('room', normalized);
        }
        window.history.replaceState({}, '', url.toString());
      } catch {
        // Ignore history restrictions
      }

      sendJson({ type: 'room:switch', room: normalized });
      showToast(normalized === 'local' ? 'Switched to Nearby Network' : `Joined room ${normalized}`);
    },
    [sendJson, showToast]
  );

  const refreshPeers = useCallback(() => {
    sendJson({ type: 'room:refresh' });
  }, [sendJson]);

  const toggleFavorite = useCallback((peer: PeerInfo) => {
    const key = getPeerFavoriteKey(peer);
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }, []);

  const isFavorite = useCallback(
    (peer: PeerInfo) => favorites.includes(getPeerFavoriteKey(peer)),
    [favorites]
  );

  const sendItemsToPeer = useCallback(
    (targetPeer: PeerInfo, items: StagedItem[], pin?: string): boolean => {
      if (items.length === 0) return false;
      if (connectionState !== 'connected') {
        showToast('Not connected to discovery server yet', 'error');
        return false;
      }

      const transferId = crypto.randomUUID();
      cancelledTransfersRef.current.delete(transferId);
      setPinErrorTransferId(null);

      const metaList: TransferFileMeta[] = items.map((item) => ({
        id: item.id,
        kind: item.kind,
        name: item.name,
        relativePath: item.relativePath,
        size: item.size,
        mimeType: item.mimeType,
        textPreview:
          item.kind === 'text' && item.text
            ? item.text.slice(0, 140)
            : undefined,
      }));

      const totalSize = items.reduce((acc, item) => acc + item.size, 0);

      outgoingContextsRef.current.set(transferId, {
        transferId,
        targetPeer,
        items,
        startedAt: Date.now(),
      });

      setActiveTransfer({
        transferId,
        direction: 'send',
        peer: targetPeer,
        files: metaList.map((meta) => ({
          meta,
          transferredBytes: 0,
          status: 'pending',
        })),
        totalSize,
        transferredBytes: 0,
        status: 'waiting',
        transport: 'pending',
        speedBytesPerSec: 0,
        startedAt: Date.now(),
      });

      const ok = sendJson({
        type: 'transfer:offer',
        targetPeerId: targetPeer.id,
        transferId,
        items: metaList,
        totalSize,
        pin: pin || undefined,
      });

      if (!ok) {
        outgoingContextsRef.current.delete(transferId);
        setActiveTransfer(null);
        showToast('Unable to reach server. Reconnecting...', 'error');
        return false;
      }

      return true;
    },
    [connectionState, sendJson, showToast]
  );

  const cancelActiveTransfer = useCallback(() => {
    if (!activeTransfer) return;
    const { transferId, peer, status } = activeTransfer;
    if (status === 'completed' || status === 'cancelled' || status === 'declined' || status === 'error') {
      setActiveTransfer(null);
      return;
    }

    cancelledTransfersRef.current.add(transferId);
    outgoingContextsRef.current.delete(transferId);
    incomingBuffersRef.current.delete(transferId);
    cleanupRtc(transferId);

    sendJson({
      type: 'transfer:cancel',
      targetPeerId: peer.id,
      transferId,
    });

    setActiveTransfer((prev) => (prev ? { ...prev, status: 'cancelled' } : null));
  }, [activeTransfer, cleanupRtc, sendJson]);

  const dismissActiveTransfer = useCallback(() => {
    setActiveTransfer(null);
  }, []);

  const selfPeer: PeerInfo = {
    id: peerId,
    alias: settings.alias,
    tag: peerTag,
    deviceType: settings.deviceType,
    platform,
    room,
    requiresPin: settings.pinEnabled,
    quickSave: settings.quickSave,
    joinedAt: Date.now(),
  };

  return {
    selfPeer,
    settings,
    updateSettings,
    room,
    switchRoom,
    connectionState,
    peers,
    refreshPeers,
    favorites,
    toggleFavorite,
    isFavorite,
    incomingOffers,
    acceptOffer,
    declineOffer,
    activeTransfer,
    sendItemsToPeer,
    cancelActiveTransfer,
    dismissActiveTransfer,
    history,
    clearHistory,
    toastMessage,
    showToast,
    pinErrorTransferId,
  };
}
