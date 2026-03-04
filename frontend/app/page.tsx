'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import UploadZone from '@/components/UploadZone';
import DocumentCard from '@/components/DocumentCard';
import StreamingChat from '@/components/StreamingChat';
import SuggestionChips from '@/components/SuggestionChips';
import VoiceInput from '@/components/VoiceInput';
import ActionBar from '@/components/ActionBar';
import VoiceSelector from '@/components/VoiceSelector';
import RecentDocuments from '@/components/RecentDocuments';
import { classifyDocument, streamQuery } from '@/lib/api';
import type { AppPhase, ChatMessage, ClassifyResponse, DocumentListItem } from '@/lib/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Converts text to a TTS-friendly string.
 * Key fixes:
 *   $4,845.38  →  "4845 dollars and 38 cents"
 *   $9,690.75  →  "9690 dollars and 75 cents"
 *   1,234      →  "1234"  (commas stripped from numbers)
 *   42%        →  "42 percent"
 */
// ─── Currency helpers ──────────────────────────────────────────────────────────

/** Strip all commas from a numeric string and parse as float */
function parseNum(s: string): number {
  return parseFloat(s.replace(/,/g, ''));
}

/**
 * Convert a plain integer to natural Indian speech.
 * 4899840 → "48 lakh 99 thousand 840"
 */
function toIndianSpeech(n: number): string {
  const int = Math.floor(Math.abs(n));
  const parts: string[] = [];
  let rem = int;

  if (rem >= 10_000_000) {
    parts.push(`${Math.floor(rem / 10_000_000)} crore`);
    rem %= 10_000_000;
  }
  if (rem >= 100_000) {
    parts.push(`${Math.floor(rem / 100_000)} lakh`);
    rem %= 100_000;
  }
  if (rem >= 1_000) {
    parts.push(`${Math.floor(rem / 1_000)} thousand`);
    rem %= 1_000;
  }
  if (rem > 0) parts.push(`${rem}`);
  return parts.length ? parts.join(' ') : '0';
}

function cleanForSpeech(text: string): string {
  return text
    // Strip markdown decorators
    .replace(/[*_#`~>]/g, '')

    // ── Currency ranges (must come BEFORE individual patterns) ──────────────
    // ₹12,000-25,000 / ₹12,000–₹25,000 → "12 thousand to 25 thousand rupees"
    .replace(/(Rs\.?|₹|INR)\s*([0-9][0-9,.]*)\s*[-–—]\s*(?:Rs\.?|₹|INR)?\s*([0-9][0-9,.]*)/gi,
      (_, __, a, b) => `${toIndianSpeech(parseNum(a))} to ${toIndianSpeech(parseNum(b))} rupees`)
    // $100-200 / $1,000-$2,000 → "100 to 200 dollars"
    .replace(/\$([0-9,.]+)\s*[-–—]\s*\$?([0-9,.]+)/g,
      (_, a, b) => `${parseNum(a).toLocaleString()} to ${parseNum(b).toLocaleString()} dollars`)
    // €100-200 → "100 to 200 euros"
    .replace(/(€|EUR)\s*([0-9,.]+)\s*[-–—]\s*(?:€|EUR)?\s*([0-9,.]+)/gi,
      (_, __, a, b) => `${parseNum(a).toLocaleString()} to ${parseNum(b).toLocaleString()} euros`)
    // £100-200 → "100 to 200 pounds"
    .replace(/(£|GBP)\s*([0-9,.]+)\s*[-–—]\s*(?:£|GBP)?\s*([0-9,.]+)/gi,
      (_, __, a, b) => `${parseNum(a).toLocaleString()} to ${parseNum(b).toLocaleString()} pounds`)

    // ── Indian Rupee (Rs. / ₹ / INR) ────────────────────────────────────────
    // Rs. 1 crore / ₹1 crore
    .replace(/(Rs\.?|₹|INR)\s*([0-9][0-9,.]*)\s*crores?/gi,
      (_, __, n) => `${parseNum(n)} crore rupees`)
    // Rs. 50 lakhs / ₹50 lakhs
    .replace(/(Rs\.?|₹|INR)\s*([0-9][0-9,.]*)\s*lakhs?/gi,
      (_, __, n) => `${parseNum(n)} lakh rupees`)
    // Rs. 48,99,840 / ₹48,99,840 — Indian comma format → full spoken form
    .replace(/(Rs\.?|₹|INR)\s*([0-9][0-9,.]*)/gi,
      (_, __, n) => `${toIndianSpeech(parseNum(n))} rupees`)

    // Standalone lakh / crore (no currency prefix)
    .replace(/([0-9][0-9,.]*)\s*crores?/gi, (_, n) => `${parseNum(n)} crore`)
    .replace(/([0-9][0-9,.]*)\s*lakhs?/gi,  (_, n) => `${parseNum(n)} lakh`)

    // ── USD ($) ──────────────────────────────────────────────────────────────
    .replace(/\$([0-9,.]+)\s*b\b/gi, (_, n) => (parseNum(n) * 1e9).toLocaleString() + ' dollars')
    .replace(/\$([0-9,.]+)\s*m\b/gi, (_, n) => (parseNum(n) * 1e6).toLocaleString() + ' dollars')
    .replace(/\$([0-9,.]+)\s*k\b/gi, (_, n) => (parseNum(n) * 1e3).toLocaleString() + ' dollars')
    .replace(/\$([0-9,]+)\.(\d{2})/g, (_, whole, cents) =>
      whole.replace(/,/g, '') + ' dollars and ' + parseInt(cents, 10) + ' cents')
    .replace(/\$([0-9,]+)/g, (_, n) => n.replace(/,/g, '') + ' dollars')

    // ── Euro (€ / EUR) ───────────────────────────────────────────────────────
    .replace(/(€|EUR)\s*([0-9,.]+)\s*b\b/gi, (_, __, n) => (parseNum(n) * 1e9).toLocaleString() + ' euros')
    .replace(/(€|EUR)\s*([0-9,.]+)\s*m\b/gi, (_, __, n) => (parseNum(n) * 1e6).toLocaleString() + ' euros')
    .replace(/(€|EUR)\s*([0-9,.]+)\s*k\b/gi, (_, __, n) => (parseNum(n) * 1e3).toLocaleString() + ' euros')
    .replace(/(€|EUR)\s*([0-9,.]+)/gi, (_, __, n) => parseNum(n).toLocaleString() + ' euros')

    // ── British Pound (£ / GBP) ──────────────────────────────────────────────
    .replace(/(£|GBP)\s*([0-9,.]+)\s*b\b/gi, (_, __, n) => (parseNum(n) * 1e9).toLocaleString() + ' pounds')
    .replace(/(£|GBP)\s*([0-9,.]+)\s*m\b/gi, (_, __, n) => (parseNum(n) * 1e6).toLocaleString() + ' pounds')
    .replace(/(£|GBP)\s*([0-9,.]+)\s*k\b/gi, (_, __, n) => (parseNum(n) * 1e3).toLocaleString() + ' pounds')
    .replace(/(£|GBP)\s*([0-9,.]+)/gi, (_, __, n) => parseNum(n).toLocaleString() + ' pounds')

    // ── Japanese Yen (¥ / JPY) ───────────────────────────────────────────────
    .replace(/(¥|JPY)\s*([0-9,.]+)/gi, (_, __, n) => parseNum(n).toLocaleString() + ' yen')

    // ── Middle East ──────────────────────────────────────────────────────────
    .replace(/AED\s*([0-9,.]+)/gi, (_, n) => parseNum(n).toLocaleString() + ' dirhams')
    .replace(/SAR\s*([0-9,.]+)/gi, (_, n) => parseNum(n).toLocaleString() + ' riyals')

    // ── Strip remaining number commas: 1,234 → 1234 ──────────────────────────
    .replace(/(\d),(?=\d)/g, '$1')

    // ── Misc ─────────────────────────────────────────────────────────────────
    .replace(/(\d+(?:\.\d+)?)%/g, '$1 percent')
    .replace(/\bvs\.?\b/gi, 'versus')
    .replace(/&/g, 'and')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const [phase, setPhase] = useState<AppPhase>('upload');
  const [doc, setDoc] = useState<ClassifyResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastAssistantMsg = useRef<string>('');

  // ── Speech tracking (for mid-speech voice switching) ─────────────────────
  // speechTextRef  — original text passed to speak(), used to re-speak after voice change
  // wordIndexRef   — count of word-boundary events fired so far in the CLEANED text
  //                  used to resume from approximately the same word position
  // prevVoiceRef   — last voice value; undefined = not yet initialised
  const speechTextRef = useRef<string>('');
  const wordIndexRef  = useRef<number>(0);
  const prevVoiceRef  = useRef<SpeechSynthesisVoice | null | undefined>(undefined);

  /**
   * speak(text, voice, fromWord?)
   *
   * Cancels any current utterance and starts a new one.
   * fromWord lets us resume mid-text when the user switches voices:
   *   - we clean the full text, split into words, then skip the first `fromWord` words.
   *   - onboundary increments wordIndexRef so the next voice-switch knows where to resume.
   */
  const speak = useCallback(
    (text: string, voice: SpeechSynthesisVoice | null, fromWord = 0) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();

      const cleaned = cleanForSpeech(text);
      const words   = cleaned.split(/\s+/);
      const snippet = fromWord > 0 ? words.slice(fromWord).join(' ') : cleaned;

      // Persist for potential resume
      speechTextRef.current = text;
      wordIndexRef.current  = fromWord;

      const u = new SpeechSynthesisUtterance(snippet);
      if (voice) u.voice = voice;
      u.rate   = 1.08;
      u.pitch  = 0.95;
      u.volume = 1.0;

      // Track word position (Chrome fires per-word boundary events reliably)
      u.onboundary = (e: SpeechSynthesisEvent) => {
        if (e.name === 'word') wordIndexRef.current++;
      };

      u.onend = () => {
        wordIndexRef.current = 0;
        speechTextRef.current = '';
      };

      window.speechSynthesis.speak(u);
    },
    []
  );

  // ── Resume from current word when the user changes voice mid-speech ───────
  useEffect(() => {
    // Skip the very first render (prevVoiceRef starts as undefined)
    if (prevVoiceRef.current === undefined) {
      prevVoiceRef.current = selectedVoice;
      return;
    }
    if (prevVoiceRef.current === selectedVoice) return;
    prevVoiceRef.current = selectedVoice;

    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis?.speaking &&
      speechTextRef.current
    ) {
      // Step back one word so we don't clip mid-word
      speak(speechTextRef.current, selectedVoice, Math.max(0, wordIndexRef.current - 1));
    }
  }, [selectedVoice, speak]);

  // ── Upload → classify ────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (file: File) => {
    setPhase('processing');
    setError(null);
    setMessages([]);

    try {
      const result = await classifyDocument(file);
      setDoc(result);
      setPhase('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Classification failed. Please try again.');
      setPhase('upload');
    }
  }, []);

  // ── Restore a recent document (no re-upload, no re-classify) ─────────────

  const handleRecentSelect = useCallback((item: DocumentListItem) => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setDoc({
      document_id:        item.document_id,
      category:           item.category,
      document_type:      item.document_type,
      confidence:         item.confidence,
      summary:            item.summary,
      extracted_fields:   item.extracted_fields,
      suggested_questions: item.suggested_questions,
      theme_color:        item.theme_color,
    });
    setMessages([]);
    setError(null);
    setPhase('ready');
  }, []);

  // ── Ask a question ────────────────────────────────────────────────────────

  const handleQuestion = useCallback(
    async (question: string, voiceUsed = false) => {
      if (!doc || isStreaming) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        content: question,
        timestamp: new Date(),
      };

      const assistantId = uid();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);
      lastAssistantMsg.current = '';

      try {
        for await (const token of streamQuery({
          document_id: doc.document_id,
          question,
          voice_used: voiceUsed,
        })) {
          lastAssistantMsg.current += token;
          const snapshot = lastAssistantMsg.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: snapshot } : m
            )
          );
        }
      } catch (e) {
        const errText = e instanceof Error ? e.message : 'Something went wrong.';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `⚠️ ${errText}` } : m
          )
        );
      } finally {
        setIsStreaming(false);
        if (!voiceMuted && lastAssistantMsg.current) {
          speak(lastAssistantMsg.current, selectedVoice);
        }
      }
    },
    [doc, isStreaming, voiceMuted, selectedVoice, speak]
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleReread = useCallback(() => {
    if (lastAssistantMsg.current) speak(lastAssistantMsg.current, selectedVoice);
  }, [selectedVoice, speak]);

  const handleSummarize = useCallback(() => {
    handleQuestion('Give me a complete, detailed summary of this document.', false);
  }, [handleQuestion]);

  const handleNewChat = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    speechTextRef.current = '';
    wordIndexRef.current = 0;
    setMessages([]);
    setError(null);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setPhase('upload');
    setDoc(null);
    setMessages([]);
    setError(null);
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    speechTextRef.current = '';
    wordIndexRef.current  = 0;
    setVoiceMuted(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (phase === 'upload') {
    return (
      <div className="min-h-screen bg-[#020817] flex flex-col">
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50
            px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30
            text-red-400 text-sm max-w-sm text-center shadow-lg">
            {error}
          </div>
        )}
        <UploadZone onFileSelect={handleFileSelect} />
        <RecentDocuments onSelect={handleRecentSelect} />
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div className="min-h-screen bg-[#020817] flex flex-col items-center justify-center gap-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500
            opacity-70 blur-sm animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-2 rounded-full bg-[#020817] flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>
        <div className="text-center">
          <p className="text-white font-medium text-lg">Reading your document…</p>
          <p className="text-slate-500 text-sm mt-1">Classifying · Extracting · Analysing</p>
        </div>
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  if (!doc) return null;
  const theme = doc.theme_color;
  const hasReply = messages.some((m) => m.role === 'assistant' && m.content);

  return (
    <div className="min-h-screen bg-[#020817] flex flex-col">

      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-[#1e293b] bg-[#020817]/90 backdrop-blur-sm px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleReset}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-800 border border-slate-700
                flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span
              className="flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${theme}20`, color: theme, border: `1px solid ${theme}40` }}
            >
              {doc.category}
            </span>
            <span className="text-white font-medium text-sm truncate">{doc.document_type}</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <VoiceSelector
              muted={voiceMuted}
              themeColor={theme}
              onVoiceChange={setSelectedVoice}
              onMuteChange={(m) => {
                setVoiceMuted(m);
                if (m && typeof window !== 'undefined') window.speechSynthesis?.cancel();
              }}
            />
            <div className="hidden sm:flex items-center gap-1.5 text-slate-600 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/60" />
              DocuAgent AI
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4">
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 'calc(100vh - 120px)' }}>

          {/* Left: fields */}
          <aside className="lg:w-80 xl:w-96 flex-shrink-0">
            <div className="lg:sticky lg:top-20 max-h-[calc(100vh-96px)] overflow-hidden">
              <DocumentCard doc={doc} />
            </div>
          </aside>

          {/* Right: chat */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">

            {/* Messages */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                      style={{ backgroundColor: `${theme}15`, border: `1px solid ${theme}30` }}>
                      <svg className="w-6 h-6" style={{ color: theme }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <p className="text-slate-400 text-sm">Ask anything about this document</p>
                    <p className="text-slate-600 text-xs mt-1">Use the mic 🎙 or pick a suggestion below</p>
                  </div>
                </div>
              ) : (
                <StreamingChat messages={messages} isStreaming={isStreaming} themeColor={theme} />
              )}
            </div>

            {/* Action bar */}
            {hasReply && (
              <ActionBar
                lastAnswer={lastAssistantMsg.current ?? ''}
                extractedFields={doc.extracted_fields as Record<string, unknown>}
                onReread={handleReread}
                onSummarize={handleSummarize}
                onNewChat={handleNewChat}
                disabled={isStreaming}
              />
            )}

            {/* Suggestions */}
            <SuggestionChips
              questions={doc.suggested_questions}
              onSelect={(q) => handleQuestion(q, false)}
              themeColor={theme}
              disabled={isStreaming}
            />

            {/* Input */}
            <div className="rounded-xl border p-3 bg-[#0f172a] border-[#1e293b]">
              <VoiceInput
                onSubmit={handleQuestion}
                disabled={isStreaming}
                themeColor={theme}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
