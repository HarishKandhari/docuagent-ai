'use client';

import { useEffect, useRef } from 'react';
import { ChatMessage } from '@/lib/types';

interface StreamingChatProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  themeColor?: string;
}

export default function StreamingChat({
  messages,
  isStreaming,
  themeColor = '#6366f1',
}: StreamingChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar py-1">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          {msg.role === 'assistant' && (
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mr-2 mt-0.5"
              style={{ backgroundColor: `${themeColor}20`, border: `1px solid ${themeColor}40` }}
            >
              <svg className="w-3.5 h-3.5" style={{ color: themeColor }} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
              </svg>
            </div>
          )}

          <div
            className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-slate-700 text-white rounded-tr-sm'
                : 'bg-[#0f172a] border border-[#1e293b] text-slate-200 rounded-tl-sm'
            }`}
          >
            {msg.content || (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" />
              </span>
            )}

            {/* Streaming cursor */}
            {isStreaming && msg.role === 'assistant' && msg === messages[messages.length - 1] && msg.content && (
              <span
                className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom animate-pulse rounded-full"
                style={{ backgroundColor: themeColor }}
              />
            )}
          </div>

          {msg.role === 'user' && (
            <div className="w-6 h-6 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 ml-2 mt-0.5">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
