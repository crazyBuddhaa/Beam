import { useState } from 'react';
import { Dices, Moon, RefreshCw, Sun } from 'lucide-react';
import type {
  DeviceType,
  QuickSaveMode,
  TransportPreference,
  UserSettings,
} from '../types/transfer.ts';
import { generateDeviceAlias, generateRoomCode } from '../utils/format.ts';
import { DeviceIcon } from './DeviceIcon.tsx';

interface SettingsViewProps {
  settings: UserSettings;
  onUpdateSettings: (patch: Partial<UserSettings>) => void;
  room: string;
  onSwitchRoom: (room: string) => void;
  peerTag: string;
  platform: string;
}

const DEVICE_TYPES: { value: DeviceType; label: string }[] = [
  { value: 'desktop', label: 'Desktop' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'mobile', label: 'Mobile' },
];

export function SettingsView({
  settings,
  onUpdateSettings,
  room,
  onSwitchRoom,
  peerTag,
  platform,
}: SettingsViewProps) {
  const [aliasInput, setAliasInput] = useState(settings.alias);
  const [roomInput, setRoomInput] = useState(room === 'local' ? '' : room);

  const handleAliasBlur = () => {
    const trimmed = aliasInput.trim();
    if (trimmed && trimmed !== settings.alias) {
      onUpdateSettings({ alias: trimmed.slice(0, 40) });
    } else {
      setAliasInput(settings.alias);
    }
  };

  return (
    <div className="max-w-3xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] divide-y divide-slate-200 dark:divide-slate-800">
      {/* Device Identity */}
      <section className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Device Identity
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            How this device appears to nearby peers · #{peerTag} · {platform}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label
              htmlFor="settings-alias"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Device Alias
            </label>
            <div className="flex items-center gap-2">
              <input
                id="settings-alias"
                type="text"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                onBlur={handleAliasBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAliasBlur();
                }}
                maxLength={40}
                className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
              />
              <button
                type="button"
                onClick={() => {
                  const next = generateDeviceAlias();
                  setAliasInput(next);
                  onUpdateSettings({ alias: next });
                }}
                title="Randomize alias"
                aria-label="Randomize device alias"
                className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
              >
                <Dices className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Device Type
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {DEVICE_TYPES.map((dt) => {
                const active = settings.deviceType === dt.value;
                return (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => onUpdateSettings({ deviceType: dt.value })}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg border text-xs font-medium transition-colors ${
                      active
                        ? 'border-teal-600 bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <DeviceIcon type={dt.value} className="w-4 h-4" />
                    <span className="text-[11px]">{dt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Receiving & Security */}
      <section className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Receiving & Security
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Control transfer approval, automatic downloads, and PIN protection.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Quick Save</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accept incoming files automatically without confirmation
              </p>
            </div>
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto">
              {(
                [
                  { value: 'off', label: 'Off' },
                  { value: 'favorites', label: 'Favorites' },
                  { value: 'on', label: 'On' },
                ] as { value: QuickSaveMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateSettings({ quickSave: opt.value })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    settings.quickSave === opt.value
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Auto-download received files
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Save files to your downloads folder immediately after transfer completes
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.autoDownload}
              onClick={() => onUpdateSettings({ autoDownload: !settings.autoDownload })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                settings.autoDownload ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.autoDownload ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Require PIN code
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Senders must enter this PIN before offering files to your device
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto">
              {settings.pinEnabled && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={settings.pinCode}
                  onChange={(e) =>
                    onUpdateSettings({
                      pinCode: e.target.value.replace(/[^0-9A-Za-z]/g, '').slice(0, 12),
                    })
                  }
                  aria-label="Transfer PIN code"
                  placeholder="1234"
                  className="w-24 px-3 py-1.5 text-xs font-mono tracking-widest rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
                />
              )}
              <button
                type="button"
                role="switch"
                aria-checked={settings.pinEnabled}
                onClick={() => onUpdateSettings({ pinEnabled: !settings.pinEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ${
                  settings.pinEnabled ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.pinEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Network & Transport */}
      <section className="p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Network & Transport
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Isolate discovery to a private room or choose preferred transfer channel.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Discovery Room
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Current: {room === 'local' ? 'Nearby Network (default)' : room}
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onSwitchRoom(roomInput.trim() || 'local');
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                placeholder="local or code"
                maxLength={20}
                aria-label="Room code"
                className="w-36 px-3 py-1.5 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  const code = generateRoomCode();
                  setRoomInput(code);
                  onSwitchRoom(code);
                }}
                title="Generate private room code"
                aria-label="Generate private room code"
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Transport Mode
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Attempt direct WebRTC peer-to-peer first, with automatic relay fallback
              </p>
            </div>
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto">
              {(
                [
                  { value: 'auto', label: 'Direct P2P + Fallback' },
                  { value: 'relay', label: 'Local Relay' },
                ] as { value: TransportPreference; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdateSettings({ transportMode: opt.value })}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    settings.transportMode === opt.value
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Appearance
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Switch between light and dark workspace surfaces.
          </p>
        </div>

        <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'light' })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              settings.theme === 'light'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            Light
          </button>
          <button
            type="button"
            onClick={() => onUpdateSettings({ theme: 'dark' })}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              settings.theme === 'dark'
                ? 'bg-slate-800 text-slate-100 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            Dark
          </button>
        </div>
      </section>
    </div>
  );
}
