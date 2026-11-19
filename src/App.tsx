import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  QrCode,
  Radio,
  Send,
  Settings,
  Upload,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { PeerInfo, StagedItem } from './types/transfer.ts';
import { useLocalBeam } from './hooks/useLocalBeam.ts';
import { dataTransferToStagedItems } from './utils/filePicker.ts';
import { DeviceIcon } from './components/DeviceIcon.tsx';
import { ReceiveView } from './components/ReceiveView.tsx';
import { SendView } from './components/SendView.tsx';
import { HistoryView } from './components/HistoryView.tsx';
import { SettingsView } from './components/SettingsView.tsx';
import { QrPairModal } from './components/QrPairModal.tsx';
import {
  ActiveTransferModal,
  IncomingOfferModal,
  PinPromptModal,
} from './components/TransferModals.tsx';

type NavTab = 'receive' | 'send' | 'history' | 'settings';

const NAV_ITEMS: { id: NavTab; label: string; icon: typeof Radio }[] = [
  { id: 'receive', label: 'Receive', icon: Radio },
  { id: 'send', label: 'Send', icon: Send },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function App() {
  const {
    selfPeer,
    settings,
    updateSettings,
    room,
    switchRoom,
    connectionState,
    peers,
    refreshPeers,
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
  } = useLocalBeam();

  const [activeTab, setActiveTab] = useState<NavTab>('receive');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [pinTargetPeer, setPinTargetPeer] = useState<PeerInfo | null>(null);
  const [globalDragActive, setGlobalDragActive] = useState(false);

  const addStagedItems = useCallback((items: StagedItem[]) => {
    if (items.length === 0) return;
    setStagedItems((prev) => [...prev, ...items]);
  }, []);

  const removeStagedItem = useCallback((id: string) => {
    setStagedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearStagedItems = useCallback(() => {
    setStagedItems([]);
  }, []);

  const handleSendToPeer = useCallback(
    (peer: PeerInfo) => {
      if (stagedItems.length === 0) return;
      if (peer.requiresPin) {
        setPinTargetPeer(peer);
        return;
      }
      sendItemsToPeer(peer, stagedItems);
    },
    [sendItemsToPeer, stagedItems]
  );

  const handlePinSubmit = useCallback(
    (pin: string) => {
      if (!pinTargetPeer) return;
      const peer = pinTargetPeer;
      setPinTargetPeer(null);
      sendItemsToPeer(peer, stagedItems, pin);
    },
    [pinTargetPeer, sendItemsToPeer, stagedItems]
  );

  // Global window drag & drop files anywhere -> auto-switch to Send tab and stage
  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      dragCounter += 1;
      setGlobalDragActive(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      dragCounter -= 1;
      if (dragCounter <= 0) {
        dragCounter = 0;
        setGlobalDragActive(false);
      }
    };

    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      dragCounter = 0;
      setGlobalDragActive(false);
      const items = await dataTransferToStagedItems(e.dataTransfer);
      if (items.length > 0) {
        addStagedItems(items);
        setActiveTab('send');
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [addStagedItems]);

  const recentReceived = history.filter((item) => item.direction === 'receive');
  const currentOffer = incomingOffers[0] || null;

  const pageTitle = (() => {
    switch (activeTab) {
      case 'receive':
        return 'Receive';
      case 'send':
        return 'Send';
      case 'history':
        return 'Transfer History';
      case 'settings':
        return 'Settings';
    }
  })();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B1117] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-[248px] md:shrink-0 md:flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101720]">
        <div className="h-16 px-6 flex items-center border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('receive')}
            className="text-lg font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            LocalBeam
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </span>
                {item.id === 'send' && stagedItems.length > 0 && (
                  <span className="text-xs font-mono tabular-nums text-teal-700 dark:text-teal-400">
                    {stagedItems.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Live Local Device Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className="w-full text-left flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0">
              <DeviceIcon type={selfPeer.deviceType} className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                {selfPeer.alias}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 truncate">
                #{selfPeer.tag} · {room === 'local' ? 'Nearby' : room}
              </p>
            </div>
          </button>

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
            <span className="inline-flex items-center gap-1.5">
              {connectionState === 'connected' ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              )}
              <span>
                {connectionState === 'connected'
                  ? 'Connected'
                  : connectionState === 'reconnecting'
                    ? 'Reconnecting'
                    : 'Connecting'}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              {peers.length} {peers.length === 1 ? 'peer' : 'peers'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col pb-16 md:pb-0">
        {/* Top Workspace Header */}
        <header className="h-16 px-4 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101720] flex items-center justify-between gap-6 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <span className="md:hidden text-base font-bold font-display tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0">
              LocalBeam
            </span>
            <span className="md:hidden text-slate-300 dark:text-slate-700" aria-hidden="true">
              /
            </span>
            <h1 className="text-base sm:text-lg font-semibold font-display text-slate-900 dark:text-slate-100 truncate">
              {pageTitle}
            </h1>
          </div>

          <button
            type="button"
            onClick={() => setQrModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors whitespace-nowrap shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
            Pair Device
          </button>
        </header>

        {/* Main Workspace Canvas */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {activeTab === 'receive' && (
            <ReceiveView
              selfPeer={selfPeer}
              settings={settings}
              onUpdateSettings={updateSettings}
              room={room}
              peers={peers}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onRefreshPeers={refreshPeers}
              onOpenQr={() => setQrModalOpen(true)}
              onGoToSend={() => setActiveTab('send')}
              recentReceived={recentReceived}
              onGoToHistory={() => setActiveTab('history')}
            />
          )}

          {activeTab === 'send' && (
            <SendView
              stagedItems={stagedItems}
              onAddItems={addStagedItems}
              onRemoveItem={removeStagedItem}
              onClearItems={clearStagedItems}
              peers={peers}
              isFavorite={isFavorite}
              onToggleFavorite={toggleFavorite}
              onRefreshPeers={refreshPeers}
              onSendToPeer={handleSendToPeer}
              onOpenQr={() => setQrModalOpen(true)}
              room={room}
            />
          )}

          {activeTab === 'history' && (
            <HistoryView
              history={history}
              onClearHistory={clearHistory}
              onGoToSend={() => setActiveTab('send')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={updateSettings}
              room={room}
              onSwitchRoom={switchRoom}
              peerTag={selfPeer.tag}
              platform={selfPeer.platform}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#101720] grid grid-cols-4"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global File Drop Overlay */}
      {globalDragActive && (
        <div className="fixed inset-0 z-50 bg-teal-950/35 backdrop-blur-[2px] flex items-center justify-center p-6 pointer-events-none">
          <div className="w-full max-w-md rounded-xl border-2 border-dashed border-teal-500 bg-white dark:bg-[#131B24] p-10 text-center shadow-xl">
            <div className="w-12 h-12 mx-auto rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Upload className="w-6 h-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
              Drop files or folders to send
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Release to add them to your transfer queue
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      <QrPairModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        room={room}
        onSwitchRoom={switchRoom}
        peerCount={peers.length}
      />

      <IncomingOfferModal
        offer={currentOffer}
        onAccept={acceptOffer}
        onDecline={declineOffer}
      />

      <PinPromptModal
        targetPeer={pinTargetPeer}
        onSubmit={handlePinSubmit}
        onClose={() => setPinTargetPeer(null)}
      />

      <ActiveTransferModal
        transfer={activeTransfer}
        onCancel={cancelActiveTransfer}
        onDismiss={dismissActiveTransfer}
      />

      {/* Subtle Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 px-4 py-2.5 rounded-lg border shadow-lg text-xs font-medium ${
            toastMessage.tone === 'error'
              ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
              : 'bg-slate-900 dark:bg-slate-100 border-slate-800 dark:border-slate-200 text-white dark:text-slate-900'
          }`}
        >
          {toastMessage.text}
        </div>
      )}
    </div>
  );
}
