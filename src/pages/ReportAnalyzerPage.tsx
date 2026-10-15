import React, { useState } from 'react';
import { FileText, Search, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

export const ReportAnalyzerPage: React.FC = () => {
  const [reportText, setReportText] = useState('');

  const [analyzed, setAnalyzed] = useState(true);

  const words = reportText.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const posWords = ['growth', 'profit', 'expansion', 'increase', 'strong', 'optimistic', 'expanding', 'robust', 'beating', 'gain', 'surged'];
  const negWords = ['headwinds', 'volatility', 'decline', 'drop', 'caution', 'risk', 'inflation', 'slowdown', 'debt', 'loss'];

  const lower = reportText.toLowerCase();
  const posHits = posWords.reduce((acc, w) => acc + (lower.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length, 0);
  const negHits = negWords.reduce((acc, w) => acc + (lower.match(new RegExp(`\\b${w}\\b`, 'g')) || []).length, 0);

  const lines = reportText.split('\n');
  const financialLines = lines.filter((l) =>
    /(revenue|ebitda|profit|margin|eps|capex|dividend|crore|billion|million)/i.test(l) &&
    /\d/.test(l)
  );

  let tone = 'Balanced / Neutral';
  if (posHits > negHits * 1.5) tone = 'Bullish & Constructive';
  else if (negHits > posHits) tone = 'Cautionary / Defensive';

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-500" /> AI Financial Report & Investor Deck Analyzer
        </h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Upload or paste quarterly filings, earnings call transcripts, or annual reports for instant heuristic sentiment triage and key financial figure extraction.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold text-slate-500 uppercase">Report Excerpt / Transcript Text</label>
        </div>

        <textarea
          rows={6}
          value={reportText}
          onChange={(e) => setReportText(e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Paste annual report text here..."
        />

        <button
          onClick={() => setAnalyzed(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.98]"
        >
          Analyze Report Text
        </button>
      </div>

      {analyzed && wordCount > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Word Count</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">{wordCount}</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Positive Term Hits</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{posHits}</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Cautionary Term Hits</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400">{negHits}</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[11px] text-slate-500 block font-semibold">Overall Tone</span>
              <span className="text-base font-black text-cyan-600 dark:text-cyan-400">{tone}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-500" /> Key Financial Figures Extracted ({financialLines.length} lines)
            </h4>

            <div className="space-y-2">
              {financialLines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200"
                >
                  • {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
