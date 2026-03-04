'use client';

interface SuggestionChipsProps {
  questions: string[];
  onSelect: (question: string) => void;
  themeColor?: string;
  disabled?: boolean;
}

export default function SuggestionChips({
  questions,
  onSelect,
  themeColor = '#6366f1',
  disabled = false,
}: SuggestionChipsProps) {
  if (!questions.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
        Suggested questions
      </p>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={i}
            onClick={() => !disabled && onSelect(q)}
            disabled={disabled}
            className="text-left px-3 py-2 rounded-xl text-sm border transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed
              hover:scale-[1.01] active:scale-[0.99]"
            style={{
              backgroundColor: `${themeColor}10`,
              borderColor: `${themeColor}30`,
              color: themeColor,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${themeColor}20`;
                (e.currentTarget as HTMLButtonElement).style.borderColor = `${themeColor}50`;
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = `${themeColor}10`;
              (e.currentTarget as HTMLButtonElement).style.borderColor = `${themeColor}30`;
            }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
