'use client';

import { useEffect, useRef, useState } from 'react';

interface VoiceSelectorProps {
  onVoiceChange: (voice: SpeechSynthesisVoice | null) => void;
  onMuteChange: (muted: boolean) => void;
  muted: boolean;
  themeColor?: string;
}

const STORAGE_KEY = 'docuagent-voice';

// ─── Voice catalogues ─────────────────────────────────────────────────────────
//
// APPLE_ENHANCED — require a one-time download in macOS System Settings →
//   Accessibility → Spoken Content → System Voice → Customize.
//   Sound indistinguishable from a real human.
const APPLE_ENHANCED = ['Ava', 'Nicky', 'Evan', 'Susan', 'Tom', 'Kate'];

// APPLE_STANDARD — ships with every Mac. Samantha is the standout choice.
const APPLE_STANDARD = ['Samantha', 'Alex'];

// Microsoft Neural online voices — excellent quality, available in Edge on any OS.
const MICROSOFT_NATURAL = [
  'Microsoft Aria Online (Natural) - English (United States)',
  'Microsoft Jenny Online (Natural) - English (United States)',
  'Microsoft Guy Online (Natural) - English (United States)',
  'Microsoft Ryan Online (Natural) - English (United Kingdom)',
  'Microsoft Sonia Online (Natural) - English (United Kingdom)',
];

// Google TTS — available everywhere in Chrome, but sounds noticeably robotic.
// Kept as fallback only.
const GOOGLE_VOICES = [
  'Google US English',
  'Google UK English Female',
  'Google UK English Male',
];


// ─── Tier types ───────────────────────────────────────────────────────────────
// 'natural' → Apple Enhanced/Standard or Microsoft Neural
// 'online'  → Google (network, robotic) or any other unlisted network voice
// 'system'  → low-quality local voices
type VoiceTier = 'natural' | 'online' | 'system';
type VoiceEntry = { voice: SpeechSynthesisVoice; tier: VoiceTier };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortName(name: string): string {
  return name
    .replace(' Online (Natural) - English (United States)', '')
    .replace(' Online (Natural) - English (United Kingdom)', ' (UK)')
    .replace(' - English (United States)', '')
    .replace(' - English (United Kingdom)', ' (UK)')
    .trim();
}

/** Small coloured label shown under the voice name. */
function voiceBadge(voice: SpeechSynthesisVoice, isMac: boolean): { text: string; cls: string } | null {
  if (!voice.localService) {
    if (voice.name.startsWith('Microsoft')) return { text: 'Neural',  cls: 'text-violet-400/80' };
    if (voice.name.startsWith('Google'))    return { text: 'Google',  cls: 'text-blue-400/70'   };
    return                                         { text: 'Online',  cls: 'text-slate-400/70'  };
  }
  if (isMac) return { text: 'Apple', cls: 'text-emerald-400/80' };
  return null;
}

// ─── VoiceRow ─────────────────────────────────────────────────────────────────

function VoiceRow({
  voice,
  selected,
  themeColor,
  isMac,
  onSelect,
  onPreview,
}: {
  voice: SpeechSynthesisVoice;
  selected: boolean;
  themeColor: string;
  isMac: boolean;
  onSelect: () => void;
  onPreview: (e: React.MouseEvent) => void;
}) {
  const badge = voiceBadge(voice, isMac);

  return (
    <div
      onClick={onSelect}
      className="flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer transition-colors group"
      style={{ backgroundColor: selected ? `${themeColor}15` : 'transparent' }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = '#1e293b';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Radio indicator */}
        <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
          {selected ? (
            <svg className="w-3.5 h-3.5" style={{ color: themeColor }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd" />
            </svg>
          ) : (
            <div className="w-2.5 h-2.5 rounded-full border border-slate-600" />
          )}
        </div>

        <div className="min-w-0">
          <span className={`text-sm truncate block ${selected ? 'text-white font-medium' : 'text-slate-300'}`}>
            {shortName(voice.name)}
          </span>
          {badge && (
            <span className={`text-xs ${badge.cls}`}>{badge.text}</span>
          )}
        </div>
      </div>

      {/* Preview button — visible on hover */}
      <button
        onClick={onPreview}
        className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center
          text-slate-500 hover:text-white hover:bg-slate-700 transition-colors
          opacity-0 group-hover:opacity-100"
        title="Preview voice"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
    </div>
  );
}

// ─── VoiceSelector ────────────────────────────────────────────────────────────

export default function VoiceSelector({
  onVoiceChange,
  onMuteChange,
  muted,
  themeColor = '#6366f1',
}: VoiceSelectorProps) {
  const [open, setOpen]               = useState(false);
  const [voices, setVoices]           = useState<VoiceEntry[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [isMac, setIsMac]             = useState(false);
  const containerRef                  = useRef<HTMLDivElement>(null);

  // ── Load & curate voices ──────────────────────────────────────────────────
  useEffect(() => {
    const mac =
      /mac/i.test(navigator.platform ?? '') ||
      /macintosh/i.test(navigator.userAgent);
    setIsMac(mac);

    const load = () => {
      const all    = window.speechSynthesis.getVoices();
      const seen   = new Set<string>();
      const result: VoiceEntry[] = [];

      const add = (name: string, tier: VoiceTier) => {
        const v = all.find((v) => v.name === name);
        if (v && !seen.has(v.name)) {
          result.push({ voice: v, tier });
          seen.add(v.name);
        }
      };

      if (mac) {
        // ── macOS: only the good ones ────────────────────────────────────
        // Enhanced Apple (if downloaded via System Settings → Accessibility → Spoken Content)
        APPLE_ENHANCED.forEach((n) => add(n, 'natural'));
        // Standard Apple — Samantha is the default star
        APPLE_STANDARD.forEach((n) => add(n, 'natural'));
        // Microsoft Neural (available in Edge on Mac)
        MICROSOFT_NATURAL.forEach((n) => add(n, 'natural'));
        // Deliberately NO catch-all loop — avoids joke voices like
        // Albert, Bad News, Bahh, Boing, Bubbles, Cellos, etc.
      } else {
        // ── Windows / Linux / ChromeOS ───────────────────────────────────
        MICROSOFT_NATURAL.forEach((n) => add(n, 'natural'));
        GOOGLE_VOICES.forEach((n) => add(n, 'natural'));
        // Apple voices (sometimes available in Edge on Windows)
        APPLE_ENHANCED.forEach((n) => add(n, 'natural'));
        APPLE_STANDARD.forEach((n) => add(n, 'natural'));
        // NO catch-all — keeps the list tight and avoids low-quality noise
      }

      const curated = result.slice(0, 12);
      setVoices(curated);

      // Restore saved preference or pick best available
      const saved      = localStorage.getItem(STORAGE_KEY);
      const savedVoice = saved ? all.find((v) => v.name === saved) : null;
      const initial    = savedVoice ?? curated[0]?.voice ?? null;

      if (initial) {
        setSelectedName(initial.name);
        onVoiceChange(initial);
      }
    };

    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelect = (voice: SpeechSynthesisVoice) => {
    setSelectedName(voice.name);
    localStorage.setItem(STORAGE_KEY, voice.name);
    onVoiceChange(voice);
    setOpen(false);
  };

  const handlePreview = (voice: SpeechSynthesisVoice, e: React.MouseEvent) => {
    e.stopPropagation();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance('Hi, this is how I sound when reading your documents.');
    u.voice = voice;
    u.rate  = 1.08;
    u.pitch = 0.95;
    window.speechSynthesis.speak(u);
  };

  // ── Group by tier ─────────────────────────────────────────────────────────
  const naturalVoices = voices.filter((v) => v.tier === 'natural');
  const onlineVoices  = voices.filter((v) => v.tier === 'online');
  const systemVoices  = voices.filter((v) => v.tier === 'system');
  const displayName   = shortName(selectedName);

  // Section header wording depends on platform
  const naturalLabel = isMac ? 'Natural' : 'Neural';

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-all"
        style={
          muted
            ? { backgroundColor: '#1e293b', borderColor: '#334155', color: '#64748b' }
            : { backgroundColor: `${themeColor}15`, borderColor: `${themeColor}40`, color: themeColor }
        }
        title="Voice settings"
      >
        <span>{muted ? '🔇' : '🔊'}</span>
        {!muted && displayName && (
          <span className="hidden sm:block max-w-[110px] truncate">{displayName}</span>
        )}
        <svg
          className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-[#1e293b]
          bg-[#0a1120] shadow-2xl shadow-black/60 z-50 overflow-hidden">

          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1e293b] flex items-center justify-between">
            <span className="text-white text-sm font-medium">Voice</span>
            <button
              onClick={() => { onMuteChange(!muted); if (!muted) setOpen(false); }}
              className={`text-xs px-2.5 py-1 rounded-md border transition-all
                ${muted
                  ? 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20'
                }`}
            >
              {muted ? '🔊 Unmute' : '🔇 Mute'}
            </button>
          </div>

          {/* Voice list */}
          <div className="py-2 max-h-72 overflow-y-auto custom-scrollbar">
            {voices.length === 0 && (
              <p className="text-slate-500 text-sm px-4 py-3 text-center">
                No voices found.<br />
                <span className="text-slate-600 text-xs">Open in Chrome or Edge for better voices.</span>
              </p>
            )}

            {/* Natural / Apple / Neural — best voices */}
            {naturalVoices.length > 0 && (
              <div className="px-3">
                <p className="text-xs text-slate-600 uppercase tracking-wider font-medium mb-1 px-2">
                  {naturalLabel}
                </p>
                {naturalVoices.map(({ voice }) => (
                  <VoiceRow
                    key={voice.name}
                    voice={voice}
                    selected={selectedName === voice.name}
                    themeColor={themeColor}
                    isMac={isMac}
                    onSelect={() => handleSelect(voice)}
                    onPreview={(e) => handlePreview(voice, e)}
                  />
                ))}
              </div>
            )}

            {/* Online — Google etc. */}
            {onlineVoices.length > 0 && (
              <div className="px-3 mt-1">
                {naturalVoices.length > 0 && <div className="border-t border-[#1e293b] my-2" />}
                <p className="text-xs text-slate-600 uppercase tracking-wider font-medium mb-1 px-2">
                  Online
                </p>
                {onlineVoices.map(({ voice }) => (
                  <VoiceRow
                    key={voice.name}
                    voice={voice}
                    selected={selectedName === voice.name}
                    themeColor={themeColor}
                    isMac={isMac}
                    onSelect={() => handleSelect(voice)}
                    onPreview={(e) => handlePreview(voice, e)}
                  />
                ))}
              </div>
            )}

            {/* System — lower quality fallbacks */}
            {systemVoices.length > 0 && (
              <div className="px-3 mt-1">
                {(naturalVoices.length > 0 || onlineVoices.length > 0) && (
                  <div className="border-t border-[#1e293b] my-2" />
                )}
                <p className="text-xs text-slate-600 uppercase tracking-wider font-medium mb-1 px-2">
                  System
                </p>
                {systemVoices.map(({ voice }) => (
                  <VoiceRow
                    key={voice.name}
                    voice={voice}
                    selected={selectedName === voice.name}
                    themeColor={themeColor}
                    isMac={isMac}
                    onSelect={() => handleSelect(voice)}
                    onPreview={(e) => handlePreview(voice, e)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[#1e293b]">
            <p className="text-slate-600 text-xs">Hover a voice → click ▶ to preview</p>
          </div>
        </div>
      )}
    </div>
  );
}
