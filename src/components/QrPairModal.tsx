import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Lock, RefreshCw, Users, X } from 'lucide-react';
import { generateRoomCode } from '../utils/format.ts';

interface QrPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: string;
  onSwitchRoom: (nextRoom: string) => void;
  peerCount: number;
}

export function QrPairModal({
  isOpen,
  onClose,
  room,
  onSwitchRoom,
  peerCount,
}: QrPairModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [roomInput, setRoomInput] = useState('');

  const shareUrl = (() => {
    try {
      const url = new URL(window.location.href);
      if (room === 'local') {
        url.searchParams.delete('room');
      } else {
        url.searchParams.set('room', room);
      }
      return url.toString();
    } catch {
      return window.location.href;
    }
  })();

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    QRCode.toDataURL(shareUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback not needed in secure context
    }
  };

  const handleJoinCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomInput.trim()) return;
    onSwitchRoom(roomInput.trim());
    setRoomInput('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2
            id="qr-modal-title"
            className="text-base font-semibold text-slate-900 dark:text-slate-100"
          >
            Pair another device
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pairing dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center text-center">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR code to open LocalBeam on another device"
                  className="w-48 h-48 block"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center text-xs text-slate-500">
                  Generating QR code...
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300 max-w-xs">
              Scan with your phone or open the link on another computer to appear in{' '}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {room === 'local' ? 'Nearby Network' : `Room ${room}`}
              </span>
              .
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {peerCount === 0
                ? 'No other devices connected yet'
                : `${peerCount} ${peerCount === 1 ? 'device' : 'devices'} connected`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Shareable room link"
              className="flex-1 min-w-0 px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Discovery Room
              </span>
              <div className="flex items-center gap-2">
                {room !== 'local' && (
                  <button
                    type="button"
                    onClick={() => onSwitchRoom('local')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors whitespace-nowrap"
                  >
                    <Users className="w-3.5 h-3.5" />
                    Return to Nearby
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSwitchRoom(generateRoomCode())}
                  className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Private Room
                </button>
              </div>
            </div>

            <form onSubmit={handleJoinCustom} className="flex items-center gap-2">
              <div className="relative flex-1">
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                  placeholder="Enter room code (e.g. K7M4P2)"
                  maxLength={20}
                  className="w-full pl-8 pr-3 py-2 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
                />
              </div>
              <button
                type="submit"
                disabled={!roomInput.trim()}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
              >
                Join Room
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
