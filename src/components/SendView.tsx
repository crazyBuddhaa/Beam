import { useRef, useState } from 'react';
import {
  Check,
  Copy,
  FilePlus2,
  FolderPlus,
  Lock,
  MessageSquarePlus,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { PeerInfo, StagedItem } from '../types/transfer.ts';
import { formatBytes, getFileExtension } from '../utils/format.ts';
import { dataTransferToStagedItems, filesToStagedItems } from '../utils/filePicker.ts';
import { DeviceIcon, ItemKindIcon } from './DeviceIcon.tsx';

interface SendViewProps {
  stagedItems: StagedItem[];
  onAddItems: (items: StagedItem[]) => void;
  onRemoveItem: (id: string) => void;
  onClearItems: () => void;
  peers: PeerInfo[];
  isFavorite: (peer: PeerInfo) => boolean;
  onToggleFavorite: (peer: PeerInfo) => void;
  onRefreshPeers: () => void;
  onSendToPeer: (peer: PeerInfo) => void;
  onOpenQr: () => void;
  room: string;
}

export function SendView({
  stagedItems,
  onAddItems,
  onRemoveItem,
  onClearItems,
  peers,
  isFavorite,
  onToggleFavorite,
  onRefreshPeers,
  onSendToPeer,
  onOpenQr,
  room,
}: SendViewProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showTextComposer, setShowTextComposer] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [peerQuery, setPeerQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const totalSize = stagedItems.reduce((sum, item) => sum + item.size, 0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddItems(filesToStagedItems(e.target.files));
      e.target.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const items = await dataTransferToStagedItems(e.dataTransfer);
    if (items.length > 0) {
      onAddItems(items);
    }
  };

  const handleAddText = (e: React.FormEvent) => {
    e.preventDefault();
    const content = textDraft.trim();
    if (!content) return;
    const byteSize = new TextEncoder().encode(content).byteLength;
    const firstLine = content.split(/\r?\n/)[0].slice(0, 42);
    const title = firstLine.length < content.length ? `${firstLine}...` : firstLine;

    onAddItems([
      {
        id: crypto.randomUUID(),
        kind: 'text',
        name: title || 'Text snippet',
        size: byteSize,
        mimeType: 'text/plain',
        text: content,
      },
    ]);
    setTextDraft('');
    setShowTextComposer(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore
    }
  };

  const filteredPeers = peers
    .filter((p) => {
      if (!peerQuery.trim()) return true;
      const q = peerQuery.toLowerCase();
      return (
        p.alias.toLowerCase().includes(q) ||
        p.tag.includes(q) ||
        p.platform.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => Number(isFavorite(b)) - Number(isFavorite(a)));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Hidden native inputs */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory is supported across Chromium, Safari, and Firefox
        webkitdirectory=""
        directory=""
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Left Column: Selection Stage */}
      <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Selection
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {stagedItems.length === 0
                ? 'No items selected'
                : `${stagedItems.length} ${stagedItems.length === 1 ? 'item' : 'items'} · ${formatBytes(totalSize)}`}
            </p>
          </div>
          {stagedItems.length > 0 && (
            <button
              type="button"
              onClick={onClearItems}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {/* Action Strip */}
        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-colors whitespace-nowrap"
          >
            <FilePlus2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            Add Files
          </button>
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-colors whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            Add Folder
          </button>
          <button
            type="button"
            onClick={() => setShowTextComposer((v) => !v)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              showTextComposer
                ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200'
                : 'border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-teal-600 hover:bg-teal-50/50 dark:hover:bg-teal-950/30'
            }`}
          >
            <MessageSquarePlus className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            Add Text
          </button>
        </div>

        {/* Inline Text Composer */}
        {showTextComposer && (
          <form
            onSubmit={handleAddText}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-4 space-y-3"
          >
            <label
              htmlFor="text-snippet-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Message, URL, or code snippet
            </label>
            <textarea
              id="text-snippet-input"
              rows={3}
              autoFocus
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Paste text or a link to send..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/40 resize-y"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowTextComposer(false);
                  setTextDraft('');
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!textDraft.trim()}
                className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors"
              >
                Stage Text
              </button>
            </div>
          </form>
        )}

        {/* Drag & Drop Zone / Staged List */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={`rounded-xl border border-dashed transition-colors ${
            isDraggingOver
              ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/30'
              : 'border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30'
          }`}
        >
          {stagedItems.length === 0 ? (
            <div className="py-14 px-6 flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <p className="mt-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                Drop files or folders here
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                Any file type or directory structure. Files stream directly without cloud storage.
              </p>
            </div>
          ) : (
            <div className="p-2">
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800 max-h-[360px] overflow-y-auto">
                {stagedItems.map((item) => (
                  <li
                    key={item.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white/80 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                        <ItemKindIcon
                          kind={item.kind}
                          mimeType={item.mimeType}
                          name={item.name}
                          className="w-4 h-4"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.relativePath || item.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          {formatBytes(item.size)} ·{' '}
                          {item.kind === 'text' ? 'TEXT' : getFileExtension(item.name)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.id)}
                      aria-label={`Remove ${item.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="px-3 pt-2.5 pb-1 text-xs text-slate-400 dark:text-slate-500 text-center">
                Drop additional files or folders here to append
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Right Column: Nearby Devices */}
      <section className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Nearby Devices
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
              {room === 'local' ? 'Nearby Network' : `Room ${room}`} · {peers.length}{' '}
              {peers.length === 1 ? 'online' : 'online'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenQr}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" />
              Pair Device
            </button>
            <button
              type="button"
              onClick={onRefreshPeers}
              aria-label="Scan for nearby devices"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {peers.length > 2 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={peerQuery}
              onChange={(e) => setPeerQuery(e.target.value)}
              placeholder="Filter devices by alias, tag, or platform..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
        )}

        {peers.length === 0 ? (
          <div className="py-12 px-4 flex flex-col items-center text-center border border-slate-200/70 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              No other devices found in {room === 'local' ? 'Nearby Network' : `Room ${room}`}
            </p>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Open LocalBeam on a phone, tablet, or second browser tab using the QR code or room link. Devices appear here automatically in real time.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onOpenQr}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap"
              >
                <QrCode className="w-3.5 h-3.5" />
                Open Pairing QR
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                {copiedLink ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedLink ? 'Copied Link' : 'Copy Room Link'}
              </button>
            </div>
          </div>
        ) : filteredPeers.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No devices match "{peerQuery}".
          </p>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
            {filteredPeers.map((peer) => {
              const fav = isFavorite(peer);
              return (
                <li
                  key={peer.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
                      <DeviceIcon type={peer.deviceType} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {peer.alias}
                        </span>
                        {peer.requiresPin && (
                          <Lock
                            className="w-3.5 h-3.5 text-slate-400 shrink-0"
                            aria-label="Requires PIN"
                          />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                        #{peer.tag} · {peer.platform} ·{' '}
                        {peer.deviceType.charAt(0).toUpperCase() + peer.deviceType.slice(1)}
                        {peer.quickSave === 'on' ? ' · Quick Save' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(peer)}
                      aria-label={fav ? `Remove ${peer.alias} from favorites` : `Star ${peer.alias}`}
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
                      onClick={() => {
                        if (stagedItems.length === 0) {
                          fileInputRef.current?.click();
                        } else {
                          onSendToPeer(peer);
                        }
                      }}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                        stagedItems.length > 0
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-teal-600 hover:text-teal-700 dark:hover:text-teal-400'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {stagedItems.length > 0 ? 'Send' : 'Select Files'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
