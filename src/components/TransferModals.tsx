import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Lock,
  X,
  XCircle,
} from 'lucide-react';
import type { ActiveTransfer, IncomingOffer, PeerInfo } from '../types/transfer.ts';
import { formatBytes, formatEta, formatSpeed } from '../utils/format.ts';
import { triggerFileDownload } from '../utils/filePicker.ts';
import { DeviceIcon, ItemKindIcon } from './DeviceIcon.tsx';

export function IncomingOfferModal({
  offer,
  onAccept,
  onDecline,
}: {
  offer: IncomingOffer | null;
  onAccept: (offer: IncomingOffer) => void;
  onDecline: (offer: IncomingOffer) => void;
}) {
  if (!offer) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-offer-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
              <DeviceIcon type={offer.fromPeer.deviceType} className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2
                id="incoming-offer-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate"
              >
                {offer.fromPeer.alias} wants to send
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                #{offer.fromPeer.tag} · {offer.fromPeer.platform} · {offer.items.length}{' '}
                {offer.items.length === 1 ? 'item' : 'items'} · {formatBytes(offer.totalSize)}
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 px-6">
          {offer.items.map((item) => (
            <div key={item.id} className="py-3 flex items-start gap-3">
              <div className="mt-0.5 text-slate-500 dark:text-slate-400 shrink-0">
                <ItemKindIcon
                  kind={item.kind}
                  mimeType={item.mimeType}
                  name={item.name}
                  className="w-4 h-4"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                  {item.relativePath || item.name}
                </p>
                {item.kind === 'text' && item.textPreview ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {item.textPreview}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                    {formatBytes(item.size)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onDecline(offer)}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => onAccept(offer)}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function PinPromptModal({
  targetPeer,
  onSubmit,
  onClose,
}: {
  targetPeer: PeerInfo | null;
  onSubmit: (pin: string) => void;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');

  if (!targetPeer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    onSubmit(pin.trim());
    setPin('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-prompt-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h2
            id="pin-prompt-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Enter recipient PIN
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close PIN dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-medium text-slate-900 dark:text-slate-100">{targetPeer.alias}</span>{' '}
            requires a PIN code to accept incoming transfers.
          </p>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Enter PIN"
              maxLength={12}
              className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!pin.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 transition-colors"
            >
              Send Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ActiveTransferModal({
  transfer,
  onCancel,
  onDismiss,
}: {
  transfer: ActiveTransfer | null;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!transfer) return null;

  const isTerminal =
    transfer.status === 'completed' ||
    transfer.status === 'cancelled' ||
    transfer.status === 'declined' ||
    transfer.status === 'error';

  const progress =
    transfer.totalSize > 0
      ? Math.min(100, Math.round((transfer.transferredBytes / transfer.totalSize) * 100))
      : transfer.status === 'completed'
        ? 100
        : 0;

  const remainingBytes = Math.max(0, transfer.totalSize - transfer.transferredBytes);

  const statusHeading = (() => {
    switch (transfer.status) {
      case 'waiting':
        return `Waiting for ${transfer.peer.alias} to accept...`;
      case 'connecting':
        return transfer.direction === 'send'
          ? `Connecting to ${transfer.peer.alias}...`
          : `Preparing transfer from ${transfer.peer.alias}...`;
      case 'transferring':
        return transfer.direction === 'send'
          ? `Sending to ${transfer.peer.alias}`
          : `Receiving from ${transfer.peer.alias}`;
      case 'completed':
        return transfer.direction === 'send'
          ? `Sent to ${transfer.peer.alias}`
          : `Received from ${transfer.peer.alias}`;
      case 'declined':
        return `${transfer.peer.alias} declined the transfer`;
      case 'cancelled':
        return 'Transfer cancelled';
      case 'error':
        return transfer.errorMessage || 'Transfer failed';
    }
  })();

  const transportLabel =
    transfer.transport === 'p2p'
      ? 'Direct P2P'
      : transfer.transport === 'relay'
        ? 'Local Relay'
        : 'Negotiating';

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-transfer-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] shadow-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                  transfer.status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : transfer.status === 'error' || transfer.status === 'declined'
                      ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300'
                      : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300'
                }`}
              >
                {transfer.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : transfer.status === 'error' || transfer.status === 'declined' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : transfer.status === 'cancelled' ? (
                  <XCircle className="w-5 h-5" />
                ) : (
                  <DeviceIcon type={transfer.peer.deviceType} className="w-5 h-5" />
                )}
              </div>
              <div className="min-w-0">
                <h2
                  id="active-transfer-title"
                  className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate"
                >
                  {statusHeading}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                  #{transfer.peer.tag} · {transfer.peer.platform} · {transportLabel}
                </p>
              </div>
            </div>
            {isTerminal && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close transfer window"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs font-mono tabular-nums mb-2">
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {formatBytes(transfer.transferredBytes)} / {formatBytes(transfer.totalSize)}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {transfer.status === 'transferring'
                  ? `${formatSpeed(transfer.speedBytesPerSec)} · ${formatEta(
                      remainingBytes,
                      transfer.speedBytesPerSec
                    )}`
                  : `${progress}%`}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-150 ${
                  transfer.status === 'completed'
                    ? 'bg-emerald-600'
                    : transfer.status === 'error' || transfer.status === 'declined'
                      ? 'bg-red-600'
                      : transfer.status === 'cancelled'
                        ? 'bg-slate-400'
                        : 'bg-teal-600'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 px-6">
          {transfer.files.map((fileState) => {
            const filePct =
              fileState.meta.size > 0
                ? Math.min(100, Math.round((fileState.transferredBytes / fileState.meta.size) * 100))
                : fileState.status === 'done'
                  ? 100
                  : 0;

            return (
              <div key={fileState.meta.id} className="py-3 flex items-center gap-3">
                <div className="text-slate-500 dark:text-slate-400 shrink-0">
                  <ItemKindIcon
                    kind={fileState.meta.kind}
                    mimeType={fileState.meta.mimeType}
                    name={fileState.meta.name}
                    className="w-4 h-4"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {fileState.meta.relativePath || fileState.meta.name}
                  </p>
                  {fileState.meta.kind === 'text' && fileState.textContent ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap break-words bg-slate-50 dark:bg-slate-900/70 rounded-md p-2 border border-slate-200 dark:border-slate-800 max-h-24 overflow-y-auto">
                      {fileState.textContent}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      {formatBytes(fileState.meta.size)} ·{' '}
                      {fileState.status === 'done'
                        ? 'Completed'
                        : fileState.status === 'active'
                          ? `${filePct}%`
                          : 'Queued'}
                    </p>
                  )}
                </div>

                {transfer.direction === 'receive' && fileState.status === 'done' && (
                  <div className="shrink-0">
                    {fileState.meta.kind === 'text' && fileState.textContent ? (
                      <button
                        type="button"
                        onClick={() => handleCopyText(fileState.meta.id, fileState.textContent!)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {copiedId === fileState.meta.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedId === fileState.meta.id ? 'Copied' : 'Copy'}
                      </button>
                    ) : fileState.blobUrl ? (
                      <button
                        type="button"
                        onClick={() => triggerFileDownload(fileState.blobUrl!, fileState.meta.name)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          {!isTerminal ? (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel Transfer
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
