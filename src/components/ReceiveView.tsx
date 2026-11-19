import { useState } from 'react';
import {
  Check,
  Copy,
  Dices,
  Lock,
  QrCode,
  RefreshCw,
  Send,
  Star,
} from 'lucide-react';
import type { HistoryItem, PeerInfo, QuickSaveMode, UserSettings } from '../types/transfer.ts';
import { formatBytes, formatTimeAgo, generateDeviceAlias } from '../utils/format.ts';
import { DeviceIcon, ItemKindIcon } from './DeviceIcon.tsx';

interface ReceiveViewProps {
  selfPeer: PeerInfo;
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  room: string;
  peers: PeerInfo[];
  isFavorite: (peer: PeerInfo) => boolean;
  onToggleFavorite: (peer: PeerInfo) => void;
  onRefreshPeers: () => void;
  onOpenQr: () => void;
  onGoToSend: () => void;
  recentReceived: HistoryItem[];
  onGoToHistory: () => void;
}

const QUICK_SAVE_OPTIONS: { value: QuickSaveMode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'on', label: 'On' },
];

export function ReceiveView({
  selfPeer,
  settings,
  onUpdateSettings,
  room,
  peers,
  isFavorite,
  onToggleFavorite,
  onRefreshPeers,
  onOpenQr,
  onGoToSend,
  recentReceived,
  onGoToHistory,
}: ReceiveViewProps) {
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasDraft, setAliasDraft] = useState(settings.alias);
  const [copiedRoom, setCopiedRoom] = useState(false);

  const commitAlias = () => {
    const trimmed = aliasDraft.trim();
    if (trimmed && trimmed !== settings.alias) {
      onUpdateSettings({ alias: trimmed.slice(0, 40) });
    } else {
      setAliasDraft(settings.alias);
    }
    setEditingAlias(false);
  };

  const handleCopyRoomLink = async () => {
    try {
      const url = new URL(window.location.href);
      if (room === 'local') {
        url.searchParams.delete('room');
      } else {
        url.searchParams.set('room', room);
      }
      await navigator.clipboard.writeText(url.toString());
      setCopiedRoom(true);
      window.setTimeout(() => setCopiedRoom(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      {/* Primary Receive Focal Surface */}
      <section className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] p-8 flex flex-col justify-between min-h-[480px]">
        <div className="flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {room === 'local' ? 'Nearby Network' : `Private Room · ${room}`}
            {settings.pinEnabled ? ' · PIN protected' : ''}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyRoomLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {copiedRoom ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedRoom ? 'Link Copied' : 'Copy Link'}
            </button>
            <button
              type="button"
              onClick={onOpenQr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <QrCode className="w-3.5 h-3.5" />
              Pair QR
            </button>
          </div>
        </div>

        {/* Radar Identity Focal Point */}
        <div className="my-10 flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center w-40 h-40">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-teal-500/35 dark:border-teal-400/30 animate-radar"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-teal-500/25 dark:border-teal-400/20 animate-radar-delayed"
            />
            <div className="relative z-10 w-24 h-24 rounded-2xl bg-teal-600 text-white shadow-sm flex items-center justify-center">
              <DeviceIcon type={selfPeer.deviceType} className="w-10 h-10" />
            </div>
          </div>

          <div className="mt-6">
            {editingAlias ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commitAlias();
                }}
                className="flex items-center justify-center gap-2"
              >
                <input
                  type="text"
                  autoFocus
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  onBlur={commitAlias}
                  maxLength={40}
                  aria-label="Edit device alias"
                  className="px-3 py-1.5 text-center text-xl font-semibold font-display rounded-lg border border-teal-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600/30"
                />
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAliasDraft(settings.alias);
                    setEditingAlias(true);
                  }}
                  title="Click to rename this device"
                  className="text-2xl sm:text-3xl font-semibold font-display tracking-tight text-slate-900 dark:text-slate-100 hover:text-teal-700 dark:hover:text-teal-400 transition-colors"
                >
                  {selfPeer.alias}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextAlias = generateDeviceAlias();
                    setAliasDraft(nextAlias);
                    onUpdateSettings({ alias: nextAlias });
                  }}
                  title="Generate random alias"
                  aria-label="Generate random device alias"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Dices className="w-4 h-4" />
                </button>
              </div>
            )}

            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              #{selfPeer.tag} · {selfPeer.platform} ·{' '}
              {selfPeer.deviceType.charAt(0).toUpperCase() + selfPeer.deviceType.slice(1)}
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              Ready to receive files, folders, and text from devices in the same room.
            </p>
          </div>
        </div>

        {/* Quick Save Bar */}
        <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Quick Save</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {settings.quickSave === 'on'
                ? 'Automatically accept incoming transfers from everyone'
                : settings.quickSave === 'favorites'
                  ? 'Automatically accept transfers from starred devices'
                  : 'Ask before accepting incoming transfers'}
            </p>
          </div>

          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0 self-start sm:self-auto"
            role="group"
            aria-label="Quick Save mode"
          >
            {QUICK_SAVE_OPTIONS.map((opt) => {
              const active = settings.quickSave === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateSettings({ quickSave: opt.value })}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Right Column: Live Nearby Devices + Recent Incoming */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Nearby Devices
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                {peers.length} {peers.length === 1 ? 'device' : 'devices'} visible
              </p>
            </div>
            <button
              type="button"
              onClick={onRefreshPeers}
              aria-label="Refresh nearby devices"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {peers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-4">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Looking for nearby devices
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                Open LocalBeam on another device, scan the pairing QR code, or open a second browser tab to transfer right away.
              </p>
              <button
                type="button"
                onClick={onOpenQr}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                Show Pairing QR
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-1">
              {peers.map((peer) => {
                const fav = isFavorite(peer);
                return (
                  <li
                    key={peer.id}
                    className="py-3.5 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                        <DeviceIcon type={peer.deviceType} className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                            {peer.alias}
                          </span>
                          {peer.requiresPin && (
                            <Lock
                              className="w-3 h-3 text-slate-400 shrink-0"
                              aria-label="PIN required"
                            />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          #{peer.tag} · {peer.platform}
                          {peer.quickSave === 'on' ? ' · Quick Save' : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onToggleFavorite(peer)}
                        aria-label={fav ? `Remove ${peer.alias} from favorites` : `Add ${peer.alias} to favorites`}
                        className={`p-2 rounded-lg transition-colors ${
                          fav
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Star className={`w-4 h-4 ${fav ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={onGoToSend}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400 transition-colors whitespace-nowrap"
                      >
                        <Send className="w-3 h-3" />
                        Send
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] p-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Recent Received
            </h2>
            {recentReceived.length > 0 && (
              <button
                type="button"
                onClick={onGoToHistory}
                className="text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
              >
                View all
              </button>
            )}
          </div>

          {recentReceived.length === 0 ? (
            <p className="py-5 text-xs text-slate-500 dark:text-slate-400">
              Incoming files and text snippets received in this session will appear here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800/80 mt-1">
              {recentReceived.slice(0, 3).map((item) => (
                <li key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ItemKindIcon
                      kind={item.kind}
                      mimeType={item.mimeType}
                      name={item.name}
                      className="w-4 h-4 text-slate-400 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {item.peerAlias} · {formatBytes(item.size)} · {formatTimeAgo(item.timestamp)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
