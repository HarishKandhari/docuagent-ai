'use client';

import { useState } from 'react';
import { logAction } from '@/lib/api';

interface ActionBarProps {
  documentId: string;
  onReread: () => void;
  onSummarize: () => void;
  disabled?: boolean;
}

type Toast = { message: string; type: 'success' | 'error' };

const ACTIONS = [
  { id: 'approved', label: 'Approve', emoji: '✅', description: 'Mark as reviewed & approved' },
  { id: 'flagged',  label: 'Flag',    emoji: '🚨', description: 'Flag for follow-up' },
  { id: 'exported', label: 'Export',  emoji: '📄', description: 'Export extracted fields as JSON' },
] as const;

export default function ActionBar({
  documentId,
  onReread,
  onSummarize,
  disabled = false,
}: ActionBarProps) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAction = async (actionId: string) => {
    if (disabled || loading) return;
    setLoading(actionId);
    try {
      if (actionId === 'summarized') {
        onSummarize();
        showToast('Generating summary…');
      } else {
        const res = await logAction({
          document_id: documentId,
          action_type: actionId as 'approved' | 'flagged' | 'exported',
        });

        if (actionId === 'exported' && res.result?.export) {
          // Trigger JSON download
          const blob = new Blob([JSON.stringify(res.result.export, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `docuagent-export-${documentId.slice(0, 8)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast('Exported to JSON');
        } else if (actionId === 'approved') {
          showToast('Document approved ✓');
        } else if (actionId === 'flagged') {
          showToast('Document flagged for review');
        }
      }
    } catch {
      showToast('Action failed — try again', 'error');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div
          className={`
            absolute -top-10 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-medium
            whitespace-nowrap transition-all duration-200 z-50
            ${toast.type === 'success'
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
              : 'bg-red-500/20 border border-red-500/40 text-red-400'
            }
          `}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-600 mr-1">Actions:</span>

        {ACTIONS.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={disabled || !!loading}
            title={action.description}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              border transition-all duration-150
              bg-[#0f172a] border-[#1e293b] text-slate-400
              hover:bg-slate-700 hover:border-slate-600 hover:text-slate-200
              disabled:opacity-40 disabled:cursor-not-allowed
              ${loading === action.id ? 'animate-pulse' : ''}
            `}
          >
            <span>{action.emoji}</span>
            {action.label}
          </button>
        ))}

        {/* Re-read button */}
        <button
          onClick={onReread}
          disabled={disabled}
          title="Read response aloud"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            border transition-all duration-150
            bg-[#0f172a] border-[#1e293b] text-slate-400
            hover:bg-slate-700 hover:border-slate-600 hover:text-slate-200
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>🔊</span>
          Re-read
        </button>

        {/* Summarize */}
        <button
          onClick={() => handleAction('summarized')}
          disabled={disabled || !!loading}
          title="Generate full summary"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
            border transition-all duration-150
            bg-[#0f172a] border-[#1e293b] text-slate-400
            hover:bg-slate-700 hover:border-slate-600 hover:text-slate-200
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span>📝</span>
          Summarize
        </button>
      </div>
    </div>
  );
}
