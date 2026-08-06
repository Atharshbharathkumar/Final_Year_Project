import React from 'react';
import { CheckCircle2, HelpCircle } from 'lucide-react';

export const QuestionCard = ({
  question,
  index,
  total,
  selectedAnswer,
  onSelectAnswer,
}) => {
  if (!question) return null;

  const isMcq = question.type === 'MCQ';
  const options = [
    { key: 'A', text: question.optionA },
    { key: 'B', text: question.optionB },
    { key: 'C', text: question.optionC },
    { key: 'D', text: question.optionD },
  ].filter((o) => o.text);

  return (
    <div className="p-6 rounded-2xl glass-card border border-dark-border space-y-6">
      <div className="flex items-center justify-between border-b border-dark-border pb-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-bold text-sm flex items-center justify-center font-mono">
            {index + 1}
          </span>
          <span className="text-xs text-slate-400 font-medium">
            Question {index + 1} of {total}
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-indigo-400 font-semibold text-xs border border-slate-700">
          {question.marks || 5} Marks
        </span>
      </div>

      <div className="space-y-2">
        <h3 className="text-base sm:text-lg font-bold text-slate-100 leading-relaxed">
          {question.questionText}
        </h3>
      </div>

      {isMcq ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {options.map((option) => {
            const isSelected = selectedAnswer === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelectAnswer(option.key)}
                className={`p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  isSelected
                    ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-lg text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5 ${
                    isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {option.key}
                </span>
                <span className="text-sm font-medium leading-normal">{option.text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="pt-2">
          <textarea
            rows={5}
            value={selectedAnswer || ''}
            onChange={(e) => onSelectAnswer(e.target.value)}
            placeholder="Type your explanation or short answer response here..."
            className="w-full p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      )}
    </div>
  );
};
