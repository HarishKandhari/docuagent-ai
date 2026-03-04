'use client';

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export default function UploadZone({ onFileSelect }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file) onFileSelect(file);
    },
    [onFileSelect]
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center px-4">
      {/* Logo / wordmark */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-2xl font-semibold text-white tracking-tight">DocuAgent AI</span>
        </div>
        <p className="text-slate-400 text-sm">
          Upload any file. Understand it instantly.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative w-full max-w-xl cursor-pointer rounded-2xl border-2 border-dashed
          transition-all duration-200 p-12 text-center group
          ${isDragging
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700 bg-[#0f172a] hover:border-indigo-500/60 hover:bg-[#0f172a]/80'
          }
        `}
      >
        {/* Glow effect when dragging */}
        {isDragging && (
          <div className="absolute inset-0 rounded-2xl bg-indigo-500/5 pointer-events-none" />
        )}

        <div className="flex flex-col items-center gap-4">
          <div className={`
            w-16 h-16 rounded-2xl border flex items-center justify-center transition-all duration-200
            ${isDragging
              ? 'bg-indigo-500/20 border-indigo-400/60'
              : 'bg-slate-800 border-slate-700 group-hover:bg-slate-700 group-hover:border-slate-600'
            }
          `}>
            <svg className={`w-8 h-8 transition-colors ${isDragging ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>

          <div>
            <p className="text-white font-medium text-lg mb-1">
              {isDragging ? 'Drop it here' : 'Drop any file here'}
            </p>
            <p className="text-slate-400 text-sm">
              or <span className="text-indigo-400 hover:text-indigo-300">click to browse</span>
            </p>
          </div>

          <p className="text-slate-600 text-xs">
            PDF, images, screenshots, contracts, receipts — anything
          </p>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={onInputChange}
        />
      </div>

      {/* Camera button for mobile */}
      <div className="mt-4 flex items-center gap-3">
        <div className="h-px w-16 bg-slate-800" />
        <span className="text-slate-600 text-xs">or</span>
        <div className="h-px w-16 bg-slate-800" />
      </div>

      <button
        onClick={() => cameraRef.current?.click()}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700
          text-slate-300 text-sm hover:bg-slate-700 hover:border-slate-600 transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        Take a photo
      </button>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Supported types hint */}
      <div className="mt-8 flex flex-wrap gap-2 justify-center max-w-sm">
        {['PDF', 'Image', 'Screenshot', 'Receipt', 'Contract', 'Handwritten'].map((t) => (
          <span key={t}
            className="px-2.5 py-0.5 rounded-full bg-slate-800/60 border border-slate-700/60 text-slate-500 text-xs">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
