'use client';

import { useEffect, useState } from 'react';

const STAGES = [
  { label: 'Uploading your document',       icon: '📤', pct: 10 },
  { label: 'Reading through the content',   icon: '👁️', pct: 28 },
  { label: 'Spotting key dates & figures',  icon: '📅', pct: 45 },
  { label: 'Extracting important fields',   icon: '🔍', pct: 62 },
  { label: 'Understanding the context',     icon: '🧠', pct: 76 },
  { label: 'Generating smart questions',    icon: '💡', pct: 88 },
  { label: 'Finishing up',                  icon: '✨', pct: 96 },
];

const TIPS = [
  'You can ask questions in plain English — no special commands needed.',
  'Try asking "summarize this" for a quick overview.',
  'Voice mode reads answers aloud — tap the mic to speak your question.',
  'Your document is saved — you can come back to it anytime.',
  'Ask follow-up questions — DocuAgent remembers the conversation.',
];

export default function ClassifyingScreen() {
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [tipIdx, setTipIdx] = useState(0);

  // Advance stages
  useEffect(() => {
    const target = STAGES[stageIdx].pct;

    // Animate progress bar toward target
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= target) return p;
        return Math.min(p + 1, target);
      });
    }, 40);

    // Move to next stage after a delay
    const stageTimer = setTimeout(() => {
      setStageIdx((i) => Math.min(i + 1, STAGES.length - 1));
    }, stageIdx === 0 ? 1200 : 1800);

    return () => { clearInterval(interval); clearTimeout(stageTimer); };
  }, [stageIdx]);

  // Rotate tips every 4 seconds
  useEffect(() => {
    const t = setInterval(() => setTipIdx((i) => (i + 1) % TIPS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const stage = STAGES[stageIdx];

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">

        {/* Animated document icon */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Outer pulse rings */}
          <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-3 rounded-full bg-indigo-500/10 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />

          {/* Spinning gradient ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-blue-400
            opacity-60 blur-[2px] animate-spin" style={{ animationDuration: '3s' }} />

          {/* Inner circle */}
          <div className="absolute inset-2 rounded-full bg-[#020817] flex items-center justify-center">
            <span className="text-3xl transition-all duration-500">{stage.icon}</span>
          </div>
        </div>

        {/* Stage label */}
        <div className="text-center">
          <p className="text-white font-semibold text-lg tracking-tight transition-all duration-300">
            {stage.label}…
          </p>
          <p className="text-slate-500 text-xs mt-1">Claude AI is analysing your document</p>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between text-xs text-slate-600 mb-1.5">
            <span>Processing</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stage dots */}
        <div className="flex gap-2">
          {STAGES.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i < stageIdx
                  ? 'w-2 h-2 bg-indigo-500'
                  : i === stageIdx
                  ? 'w-3 h-2 bg-indigo-400 animate-pulse'
                  : 'w-2 h-2 bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Rotating tip */}
        <div className="w-full rounded-xl bg-slate-900/60 border border-slate-800 px-4 py-3 text-center">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider font-medium">💡 Did you know?</p>
          <p className="text-slate-300 text-sm leading-relaxed transition-all duration-500">
            {TIPS[tipIdx]}
          </p>
        </div>

      </div>
    </div>
  );
}
