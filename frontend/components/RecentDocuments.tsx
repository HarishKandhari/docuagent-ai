'use client';

import { useEffect, useState } from 'react';
import { listDocuments } from '@/lib/api';
import type { DocumentListItem } from '@/lib/types';

interface RecentDocumentsProps {
  onSelect: (item: DocumentListItem) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function DocCard({
  item,
  onClick,
}: {
  item: DocumentListItem;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 w-56 text-left rounded-xl border border-[#1e293b] bg-[#0a1120]
        hover:border-opacity-60 transition-all group p-4 flex flex-col gap-2"
      style={{ '--hover-color': item.theme_color } as React.CSSProperties}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = `${item.theme_color}60`;
        (e.currentTarget as HTMLElement).style.backgroundColor = `${item.theme_color}08`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = '#1e293b';
        (e.currentTarget as HTMLElement).style.backgroundColor = '#0a1120';
      }}
    >
      {/* Category pill */}
      <span
        className="self-start px-2 py-0.5 rounded-full text-xs font-medium"
        style={{
          backgroundColor: `${item.theme_color}20`,
          color: item.theme_color,
          border: `1px solid ${item.theme_color}40`,
        }}
      >
        {item.category}
      </span>

      {/* Document type */}
      <p className="text-white text-sm font-medium leading-snug line-clamp-2 group-hover:text-white/90">
        {item.document_type}
      </p>

      {/* Filename */}
      <p className="text-slate-500 text-xs truncate">{item.filename}</p>

      {/* Date */}
      <p className="text-slate-600 text-xs mt-auto">{formatDate(item.created_at)}</p>
    </button>
  );
}

export default function RecentDocuments({ onSelect }: RecentDocumentsProps) {
  const [docs, setDocs]     = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listDocuments()
      .then(setDocs)
      .finally(() => setLoading(false));
  }, []);

  // Hide entirely when nothing to show
  if (!loading && docs.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-8">
      <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-3">
        Recent Documents
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {loading ? (
          // Skeleton placeholders
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-56 h-32 rounded-xl bg-slate-800/40 animate-pulse"
            />
          ))
        ) : (
          docs.map((doc) => (
            <DocCard key={doc.document_id} item={doc} onClick={() => onSelect(doc)} />
          ))
        )}
      </div>
    </div>
  );
}
