'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';

interface VoiceInputProps {
  onSubmit: (text: string, voiceUsed: boolean) => void;
  disabled?: boolean;
  themeColor?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
  }
}

export default function VoiceInput({
  onSubmit,
  disabled = false,
  themeColor = '#6366f1',
}: VoiceInputProps) {
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setSupported(true);
      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setText(transcript);
        setIsListening(false);
        // Auto-submit after voice recognition
        setTimeout(() => {
          onSubmit(transcript, true);
          setText('');
        }, 100);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);

      recognitionRef.current = recognition;
    }
  }, [onSubmit]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setText('');
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, false);
    setText('');
    textareaRef.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-2">
      {/* Mic button — primary CTA */}
      {supported && (
        <button
          onClick={toggleListening}
          disabled={disabled}
          title={isListening ? 'Stop listening' : 'Speak your question'}
          className={`
            relative flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
            transition-all duration-200 focus:outline-none
            ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            ${isListening
              ? 'bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/30'
              : 'bg-slate-700 hover:bg-slate-600 border border-slate-600'
            }
          `}
        >
          {/* Pulse ring when listening */}
          {isListening && (
            <span className="absolute inset-0 rounded-xl animate-ping bg-red-400 opacity-30" />
          )}
          <svg
            className={`w-5 h-5 ${isListening ? 'text-white' : 'text-slate-300'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}

      {/* Text input */}
      <div className="flex-1 relative">
        {isListening && (
          <div className="absolute inset-0 rounded-xl border-2 border-red-500/50 pointer-events-none z-10 animate-pulse" />
        )}
        <textarea
          ref={textareaRef}
          value={isListening ? '' : text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || isListening}
          placeholder={isListening ? 'Listening…' : 'Ask anything about this document…'}
          rows={1}
          className={`
            w-full resize-none rounded-xl px-4 py-3 text-sm
            bg-[#0f172a] border border-[#1e293b] text-white placeholder-slate-500
            focus:outline-none focus:border-slate-600
            transition-colors duration-150
            ${isListening ? 'placeholder-red-400/70' : ''}
            disabled:opacity-60
          `}
          style={{ minHeight: '44px', maxHeight: '120px' }}
        />
      </div>

      {/* Send button */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim() || isListening}
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center
          transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: text.trim() && !disabled && !isListening
            ? themeColor
            : undefined,
          background: (!text.trim() || disabled || isListening)
            ? '#1e293b'
            : themeColor,
        }}
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
}
