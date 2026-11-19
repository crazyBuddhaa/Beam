import { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Search,
  Trash2,
} from 'lucide-react';
import type { HistoryItem } from '../types/transfer.ts';
import { formatBytes, formatTimeAgo } from '../utils/format.ts';
import { triggerFileDownload } from '../utils/filePicker.ts';
import { ItemKindIcon } from './DeviceIcon.tsx';

interface HistoryViewProps {
  history: HistoryItem[];
  onClearHistory: () => void;
  onGoToSend: () => void;
}

type DirectionFilter = 'all' | 'receive' | 'send';

export function HistoryView({
  history,
  onClearHistory,
  onGoToSend,
}: HistoryViewProps) {
  const [filter, setFilter] = useState<DirectionFilter>('all');
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = history.filter((item) => {
    if (filter !== 'all' && item.direction !== filter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      item.peerAlias.toLowerCase().includes(q) ||
      (item.textContent && item.textContent.toLowerCase().includes(q))
    );
  });

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131B24] overflow-hidden">
      {/* Toolbar */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
            role="group"
            aria-label="Filter transfer direction"
          >
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'receive', label: 'Received' },
                { value: 'send', label: 'Sent' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.value
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px] sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search files or devices..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/40"
            />
          </div>
        </div>

        {history.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear History
          </button>
        )}
      </div>

      {/* Table / Empty State */}
      {history.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No transfer history yet
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Files and text snippets sent or received on this device are logged here locally in your browser.
          </p>
          <button
            type="button"
            onClick={onGoToSend}
            className="mt-5 px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors"
          >
            Send a File
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 px-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No transfers match your current filter.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-900/40">
                <th className="py-3 pl-6 pr-4 font-medium">Item</th>
                <th className="py-3 px-4 font-medium">Direction</th>
                <th className="py-3 px-4 font-medium">Device</th>
                <th className="py-3 px-4 font-medium text-right">Size</th>
                <th className="py-3 px-4 font-medium">Transport</th>
                <th className="py-3 px-4 font-medium text-right">Time</th>
                <th className="py-3 pl-4 pr-6 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="py-3.5 pl-6 pr-4 max-w-[280px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <ItemKindIcon
                        kind={item.kind}
                        mimeType={item.mimeType}
                        name={item.name}
                        className="w-4 h-4 text-slate-400 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {item.relativePath || item.name}
                        </p>
                        {item.kind === 'text' && item.textContent && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {item.textContent}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1">
                      {item.direction === 'receive' ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      )}
                      {item.direction === 'receive' ? 'Received' : 'Sent'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-700 dark:text-slate-300">
                    {item.peerAlias}{' '}
                    <span className="font-mono text-slate-400">#{item.peerTag}</span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono tabular-nums text-right text-slate-600 dark:text-slate-300">
                    {formatBytes(item.size)}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                    {item.transport === 'p2p' ? 'Direct P2P' : 'Local Relay'}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-xs font-mono tabular-nums text-right text-slate-500 dark:text-slate-400">
                    {formatTimeAgo(item.timestamp)}
                  </td>
                  <td className="py-3.5 pl-4 pr-6 whitespace-nowrap text-right">
                    {item.kind === 'text' && item.textContent ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(item.id, item.textContent!)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        {copiedId === item.id ? 'Copied' : 'Copy'}
                      </button>
                    ) : item.blobUrl ? (
                      <button
                        type="button"
                        onClick={() => triggerFileDownload(item.blobUrl!, item.name)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
