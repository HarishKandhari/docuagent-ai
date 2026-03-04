'use client';

import { ClassifyResponse } from '@/lib/types';

interface DocumentCardProps {
  doc: ClassifyResponse;
}

function humanKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function formatScalar(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  return String(val);
}

/** Renders a single field value — handles scalars, objects, and arrays */
function FieldValue({ val }: { val: unknown }) {
  // null / undefined / empty
  if (val === null || val === undefined || val === '') {
    return <span className="text-slate-500">—</span>;
  }

  // Plain object → render as indented sub-rows
  if (isPlainObject(val)) {
    const entries = Object.entries(val).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length === 0) return <span className="text-slate-500">—</span>;
    return (
      <div className="flex flex-col gap-1 mt-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex gap-1.5 text-xs">
            <span className="text-slate-500 shrink-0">{humanKey(k)}:</span>
            <span className="text-slate-300 break-words">{formatScalar(v)}</span>
          </div>
        ))}
      </div>
    );
  }

  // Array → comma-joined or stacked sub-cards
  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-slate-500">—</span>;

    // Array of objects (e.g. line_items)
    if (isPlainObject(val[0])) {
      return (
        <div className="flex flex-col gap-1.5 mt-1">
          {(val as Record<string, unknown>[]).map((item, i) => (
            <div key={i} className="rounded-md bg-slate-800/60 px-2 py-1.5 text-xs border border-slate-700/60">
              {Object.entries(item)
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <span className="text-slate-500 shrink-0">{humanKey(k)}:</span>
                    <span className="text-slate-300">{formatScalar(v)}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>
      );
    }

    // Array of scalars
    return (
      <span className="text-slate-200 break-words">
        {(val as unknown[]).map(formatScalar).join(', ')}
      </span>
    );
  }

  // Scalar
  return <span className="text-slate-200 font-medium break-words">{formatScalar(val)}</span>;
}

export default function DocumentCard({ doc }: DocumentCardProps) {
  const fields = Object.entries(doc.extracted_fields);
  const confidencePct = Math.round(doc.confidence * 100);

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 custom-scrollbar">

      {/* Header card */}
      <div
        className="rounded-xl border p-4"
        style={{
          backgroundColor: `${doc.theme_color}10`,
          borderColor: `${doc.theme_color}30`,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <div
              className="inline-block px-2 py-0.5 rounded-md text-xs font-medium mb-1"
              style={{ backgroundColor: `${doc.theme_color}20`, color: doc.theme_color }}
            >
              {doc.category}
            </div>
            <h2 className="text-white font-semibold text-base leading-tight">
              {doc.document_type}
            </h2>
          </div>

          {/* Confidence ring */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="none" stroke="#1e293b" strokeWidth="3" />
              <circle
                cx="18" cy="18" r="15" fill="none"
                stroke={doc.theme_color}
                strokeWidth="3"
                strokeDasharray={`${confidencePct * 0.942} 94.2`}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs text-slate-400">{confidencePct}%</span>
          </div>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed">{doc.summary}</p>
      </div>

      {/* Extracted fields */}
      <div>
        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 px-1">
          Extracted Fields
        </h3>
        <div className="flex flex-col gap-2">
          {fields.length === 0 ? (
            <p className="text-slate-600 text-sm px-1">No fields extracted.</p>
          ) : (
            fields.map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg bg-[#0f172a] border border-[#1e293b] px-3 py-2.5
                  hover:border-slate-600 transition-colors"
              >
                <div className="text-xs text-slate-500 mb-0.5">
                  {humanKey(key)}
                </div>
                <FieldValue val={value} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
