import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ServerPeerInfo {
  id: string;
  alias: string;
  tag: string;
  deviceType: string;
  platform: string;
  room: string;
  requiresPin: boolean;
  quickSave: string;
  joinedAt: number;
}

interface ConnectedClient {
  ws: WebSocket;
  info: ServerPeerInfo;
  isAlive: boolean;
}

const rooms = new Map<string, Map<string, ConnectedClient>>();

function normalizeRoom(room: unknown): string {
  if (typeof room !== 'string') return 'local';
  const cleaned = room.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  if (!cleaned || cleaned === 'LOCAL') return 'local';
  return cleaned;
}

function getRoomMap(room: string): Map<string, ConnectedClient> {
  let map = rooms.get(room);
  if (!map) {
    map = new Map();
    rooms.set(room, map);
  }
  return map;
}

function safeSendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcastToRoom(room: string, payload: unknown, excludePeerId?: string): void {
  const roomMap = rooms.get(room);
  if (!roomMap) return;
  const serialized = JSON.stringify(payload);
  for (const [peerId, client] of roomMap.entries()) {
    if (peerId !== excludePeerId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(serialized);
    }
  }
}

function getPeerListForRoom(room: string, excludePeerId?: string): ServerPeerInfo[] {
  const roomMap = rooms.get(room);
  if (!roomMap) return [];
  const list: ServerPeerInfo[] = [];
  for (const [peerId, client] of roomMap.entries()) {
    if (peerId !== excludePeerId && client.ws.readyState === WebSocket.OPEN) {
      list.push(client.info);
    }
  }
  return list.sort((a, b) => b.joinedAt - a.joinedAt);
}

async function startServer(): Promise<void> {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  app.get('/api/health', (_req, res) => {
    let totalPeers = 0;
    for (const roomMap of rooms.values()) {
      totalPeers += roomMap.size;
    }
    res.json({ ok: true, rooms: rooms.size, peers: totalPeers });
  });

  const wss = new WebSocketServer({
    server,
    path: '/ws',
    maxPayload: 4 * 1024 * 1024, // 4 MB per frame (chunks are 64 KB)
  });

  const heartbeatInterval = setInterval(() => {
    for (const [roomName, roomMap] of rooms.entries()) {
      for (const [peerId, client] of roomMap.entries()) {
        if (!client.isAlive) {
          roomMap.delete(peerId);
          client.ws.terminate();
          broadcastToRoom(roomName, { type: 'peer:left', peerId });
          continue;
        }
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
      if (roomMap.size === 0) {
        rooms.delete(roomName);
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws) => {
    let currentClient: ConnectedClient | null = null;

    ws.on('pong', () => {
      if (currentClient) {
        currentClient.isAlive = true;
      }
    });

    ws.on('message', (data, isBinary) => {
      // Binary frame relay: [4-byte header length][UTF-8 JSON header][raw file chunk]
      if (isBinary) {
        if (!currentClient) return;
        const buf = Buffer.isBuffer(data)
          ? data
          : Array.isArray(data)
            ? Buffer.concat(data)
            : Buffer.from(data as ArrayBuffer);

        if (buf.length < 4) return;
        const headerLen = buf.readUInt32BE(0);
        if (headerLen <= 0 || 4 + headerLen > buf.length) return;

        try {
          const header = JSON.parse(buf.subarray(4, 4 + headerLen).toString('utf8')) as {
            targetPeerId?: string;
          };
          if (!header.targetPeerId) return;
          const roomMap = rooms.get(currentClient.info.room);
          const target = roomMap?.get(header.targetPeerId);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(buf, { binary: true });
          }
        } catch {
          // Ignore malformed binary frame header
        }
        return;
      }

      // JSON signaling & discovery messages
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString('utf8')) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = typeof msg.type === 'string' ? msg.type : '';

      if (type === 'peer:register') {
        const peerId = typeof msg.id === 'string' && msg.id.trim() ? msg.id.trim().slice(0, 64) : '';
        if (!peerId) return;

        const nextRoom = normalizeRoom(msg.room);

        // Clean up previous registration if switching or re-registering
        if (currentClient) {
          const prevRoom = currentClient.info.room;
          const prevMap = rooms.get(prevRoom);
          if (prevMap) {
            prevMap.delete(currentClient.info.id);
            if (prevMap.size === 0) rooms.delete(prevRoom);
          }
          broadcastToRoom(prevRoom, { type: 'peer:left', peerId: currentClient.info.id });
        }

        const info: ServerPeerInfo = {
          id: peerId,
          alias: typeof msg.alias === 'string' && msg.alias.trim() ? msg.alias.trim().slice(0, 40) : 'Unnamed Device',
          tag: typeof msg.tag === 'string' && msg.tag.trim() ? msg.tag.trim().slice(0, 6) : '000',
          deviceType: typeof msg.deviceType === 'string' ? msg.deviceType : 'desktop',
          platform: typeof msg.platform === 'string' ? msg.platform : 'Web',
          room: nextRoom,
          requiresPin: Boolean(msg.requiresPin),
          quickSave: typeof msg.quickSave === 'string' ? msg.quickSave : 'off',
          joinedAt: Date.now(),
        };

        currentClient = { ws, info, isAlive: true };
        const roomMap = getRoomMap(nextRoom);
        roomMap.set(peerId, currentClient);

        safeSendJson(ws, {
          type: 'room:state',
          self: info,
          room: nextRoom,
          peers: getPeerListForRoom(nextRoom, peerId),
        });

        broadcastToRoom(nextRoom, { type: 'peer:joined', peer: info }, peerId);
        return;
      }

      if (!currentClient) return;
      currentClient.isAlive = true;

      if (type === 'peer:update') {
        if (typeof msg.alias === 'string' && msg.alias.trim()) {
          currentClient.info.alias = msg.alias.trim().slice(0, 40);
        }
        if (typeof msg.deviceType === 'string') {
          currentClient.info.deviceType = msg.deviceType;
        }
        if (typeof msg.requiresPin === 'boolean') {
          currentClient.info.requiresPin = msg.requiresPin;
        }
        if (typeof msg.quickSave === 'string') {
          currentClient.info.quickSave = msg.quickSave;
        }
        broadcastToRoom(
          currentClient.info.room,
          { type: 'peer:updated', peer: currentClient.info },
          currentClient.info.id
        );
        return;
      }

      if (type === 'room:switch') {
        const nextRoom = normalizeRoom(msg.room);
        const oldRoom = currentClient.info.room;
        if (nextRoom === oldRoom) {
          safeSendJson(ws, {
            type: 'room:state',
            self: currentClient.info,
            room: nextRoom,
            peers: getPeerListForRoom(nextRoom, currentClient.info.id),
          });
          return;
        }

        const oldMap = rooms.get(oldRoom);
        if (oldMap) {
          oldMap.delete(currentClient.info.id);
          if (oldMap.size === 0) rooms.delete(oldRoom);
        }
        broadcastToRoom(oldRoom, { type: 'peer:left', peerId: currentClient.info.id });

        currentClient.info.room = nextRoom;
        currentClient.info.joinedAt = Date.now();
        const nextMap = getRoomMap(nextRoom);
        nextMap.set(currentClient.info.id, currentClient);

        safeSendJson(ws, {
          type: 'room:state',
          self: currentClient.info,
          room: nextRoom,
          peers: getPeerListForRoom(nextRoom, currentClient.info.id),
        });
        broadcastToRoom(nextRoom, { type: 'peer:joined', peer: currentClient.info }, currentClient.info.id);
        return;
      }

      if (type === 'room:refresh') {
        safeSendJson(ws, {
          type: 'room:state',
          self: currentClient.info,
          room: currentClient.info.room,
          peers: getPeerListForRoom(currentClient.info.room, currentClient.info.id),
        });
        return;
      }

      // Direct peer-to-peer signaling & transfer control forwarding
      const DIRECT_TYPES = new Set([
        'transfer:offer',
        'transfer:accept',
        'transfer:decline',
        'transfer:pin-error',
        'transfer:cancel',
        'transfer:text-payload',
        'transfer:ack',
        'transfer:complete',
        'rtc:offer',
        'rtc:answer',
        'rtc:ice',
      ]);

      if (DIRECT_TYPES.has(type)) {
        const targetPeerId = typeof msg.targetPeerId === 'string' ? msg.targetPeerId : '';
        if (!targetPeerId) return;
        const roomMap = rooms.get(currentClient.info.room);
        const target = roomMap?.get(targetPeerId);
        if (!target || target.ws.readyState !== WebSocket.OPEN) {
          if (type === 'transfer:offer') {
            safeSendJson(ws, {
              type: 'transfer:peer-offline',
              transferId: msg.transferId,
              targetPeerId,
            });
          }
          return;
        }

        safeSendJson(target.ws, {
          ...msg,
          fromPeerId: currentClient.info.id,
          fromPeer: currentClient.info,
        });
      }
    });

    ws.on('close', () => {
      if (!currentClient) return;
      const roomName = currentClient.info.room;
      const peerId = currentClient.info.id;
      const roomMap = rooms.get(roomName);
      if (roomMap && roomMap.get(peerId) === currentClient) {
        roomMap.delete(peerId);
        if (roomMap.size === 0) {
          rooms.delete(roomName);
        }
        broadcastToRoom(roomName, { type: 'peer:left', peerId });
      }
      currentClient = null;
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`LocalBeam server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start LocalBeam server:', err);
  process.exit(1);
});
