'use client';

import { useState } from 'react';

interface ActionBarProps {
  lastAnswer: string;
  extractedFields: Record<string, unknown>;
  onReread: () => void;
  onSummarize: () => void;
  onNewChat: () => void;
  disabled?: boolean;
}

type Toast = { message: string; type: 'success' | 'error' };

export default function ActionBar({
  lastAnswer,
  extractedFields,
  onReread,
  onSummarize,
  onNewChat,
  disabled = false,
}: ActionBarProps) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [showFacts, setShowFacts] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2000);
  };

  const handleCopy = async () => {
    if (!lastAnswer) return;
    try {
      await navigator.clipboard.writeText(lastAnswer);
      showToast('Copied to clipboard');
    } catch {
      showToast('Copy failed', 'error');
    }
  };

  const factEntries = Object.entries(extractedFields ?? {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );

  const btnBase = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
    border transition-all duration-150
    bg-[#0f172a] border-[#1e293b] text-slate-400
    hover:bg-slate-700 hover:border-slate-600 hover:text-slate-200
    disabled:opacity-40 disabled:cursor-not-allowed`;

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={`
          absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-medium
          whitespace-nowrap z-50
          ${toast.type === 'success'
            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
            : 'bg-red-500/20 border border-red-500/40 text-red-400'
          }
        `}>
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">

        {/* Re-read */}
        <button onClick={onReread} disabled={disabled} title="Read answer aloud" className={btnBase}>
          <span>🔊</span> Re-read
        </button>

        {/* Summarize */}
        <button onClick={onSummarize} disabled={disabled} title="Generate full summary" className={btnBase}>
          <span>📝</span> Summarize
        </button>

        {/* Copy Answer */}
        <button onClick={handleCopy} disabled={disabled || !lastAnswer} title="Copy last answer" className={btnBase}>
          <span>📋</span> Copy
        </button>

        {/* Key Facts */}
        {factEntries.length > 0 && (
          <button
            onClick={() => setShowFacts(true)}
            disabled={disabled}
            title="View all extracted fields"
            className={btnBase}
          >
            <span>🔑</span> Key Facts
          </button>
        )}

        {/* New Chat */}
        <button onClick={onNewChat} disabled={disabled} title="Clear chat and start fresh" className={btnBase}>
          <span>↩️</span> New Chat
        </button>
      </div>

      {/* Key Facts modal */}
      {showFacts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowFacts(false)}
        >
          <div
            className="bg-[#0f172a] border border-[#1e293b] rounded-2xl w-full max-w-md max-h-[70vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e293b]">
              <h3 className="text-sm font-semibold text-white">Key Facts</h3>
              <button
                onClick={() => setShowFacts(false)}
                className="text-slate-500 hover:text-slate-300 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {factEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 text-sm">
                  <span className="text-slate-500 capitalize flex-shrink-0">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-slate-200 text-right break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
