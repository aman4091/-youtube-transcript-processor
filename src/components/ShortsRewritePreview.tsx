import { useState } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
  AlertCircle,
  CheckCircle,
  Trophy,
  Clock,
  Sparkles,
  Heart,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { RewriteResult } from '../services/shortsRewriter';

interface ShortsRewritePreviewProps {
  isOpen: boolean;
  rewriteResults: RewriteResult[];
  videoTitle: string;
  onClose: () => void;
  onApprove: (editedScripts: Map<number, string>) => void;
}

export default function ShortsRewritePreview({
  isOpen,
  rewriteResults,
  videoTitle,
  onClose,
  onApprove,
}: ShortsRewritePreviewProps) {
  const [editedScripts, setEditedScripts] = useState<Map<number, string>>(() => {
    const map = new Map<number, string>();
    rewriteResults.forEach((result) => {
      map.set(result.index, result.rewrittenScript);
    });
    return map;
  });

  const [expandedShorts, setExpandedShorts] = useState<Set<number>>(() => {
    // Expand first short by default
    return new Set([0]);
  });

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedShorts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedShorts(newExpanded);
  };

  const handleScriptEdit = (index: number, newScript: string) => {
    const newEdited = new Map(editedScripts);
    newEdited.set(index, newScript);
    setEditedScripts(newEdited);
  };

  const handleReset = (index: number) => {
    const newEdited = new Map(editedScripts);
    newEdited.set(index, rewriteResults[index].rewrittenScript);
    setEditedScripts(newEdited);
  };

  const handleResetAll = () => {
    const newEdited = new Map<number, string>();
    rewriteResults.forEach((result) => {
      newEdited.set(result.index, result.rewrittenScript);
    });
    setEditedScripts(newEdited);
  };

  const handleApprove = () => {
    onApprove(editedScripts);
  };

  const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).length;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'viral':
        return <Sparkles className="w-4 h-4" />;
      case 'emotional':
        return <Heart className="w-4 h-4" />;
      case 'topic':
        return <Lightbulb className="w-4 h-4" />;
      case 'story':
        return <BookOpen className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'viral':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'emotional':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'topic':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'story':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 9) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 8) return 'text-gray-600 dark:text-gray-400';
    if (score >= 7) return 'text-orange-600 dark:text-orange-400';
    return 'text-blue-600 dark:text-blue-400';
  };

  const getWordCountStatus = (wordCount: number): { color: string; message: string } => {
    if (wordCount < 75) {
      return { color: 'text-orange-600', message: 'Too short - aim for 75-150 words' };
    } else if (wordCount > 150) {
      return { color: 'text-red-600', message: 'Too long - may exceed 60 seconds' };
    } else {
      return { color: 'text-green-600', message: 'Perfect length!' };
    }
  };

  if (!isOpen) return null;

  const hasErrors = rewriteResults.some((r) => r.error);

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🎬 Viral Scripts Ready
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              ✓ {rewriteResults.filter((r) => !r.error).length} shorts rewritten for {videoTitle}
              {hasErrors && (
                <span className="ml-2 text-red-600">• {rewriteResults.filter((r) => r.error).length} failed</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {rewriteResults.map((result, index) => {
              const isExpanded = expandedShorts.has(index);
              const currentScript = editedScripts.get(index) || '';
              const wordCount = getWordCount(currentScript);
              const wordCountStatus = getWordCountStatus(wordCount);
              const short = result.originalShort;

              return (
                <div
                  key={index}
                  className="bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Card Header - Always Visible */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
                    onClick={() => toggleExpand(index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          #{index + 1}
                        </span>

                        <div className="flex items-center gap-2">
                          <Trophy className={`w-4 h-4 ${getScoreColor(short.score)}`} />
                          <span className={`font-semibold ${getScoreColor(short.score)}`}>
                            {short.score}/10
                          </span>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${getCategoryColor(
                            short.category
                          )}`}
                        >
                          {getCategoryIcon(short.category)}
                          {short.category.toUpperCase()}
                        </span>

                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <Clock className="w-4 h-4" />
                          <span>
                            {short.startTime}-{short.endTime}
                          </span>
                        </div>

                        <div className="hidden sm:block text-sm text-gray-900 dark:text-gray-100 font-medium truncate">
                          {short.title}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {result.error && (
                          <div className="flex items-center gap-1 text-red-600 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">Error</span>
                          </div>
                        )}

                        {!result.error && (
                          <div className="flex items-center gap-1 text-green-600 text-sm">
                            <CheckCircle className="w-4 h-4" />
                            <span className="hidden sm:inline">{wordCount} words</span>
                          </div>
                        )}

                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Mobile title */}
                    <div className="sm:hidden mt-2 text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {short.title}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                      {/* Error Message */}
                      {result.error && (
                        <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-red-800 dark:text-red-200 font-semibold">Rewrite Failed</p>
                              <p className="text-red-600 dark:text-red-300 text-sm mt-1">{result.error}</p>
                              <p className="text-red-500 dark:text-red-400 text-xs mt-2">
                                Fallback: Using original transcript
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Original Info */}
                      <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-3 rounded-lg">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
                          ORIGINAL DESCRIPTION:
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">{short.description}</p>
                      </div>

                      {/* Editable Script */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Viral Script (Editable):
                        </label>
                        <textarea
                          value={currentScript}
                          onChange={(e) => handleScriptEdit(index, e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-colors resize-y min-h-[200px] font-mono text-sm leading-relaxed"
                          placeholder="Enter your viral script here..."
                        />

                        {/* Word Count Status */}
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-sm font-medium ${wordCountStatus.color}`}>
                            {wordCount} words • {wordCountStatus.message}
                          </span>

                          <button
                            onClick={() => handleReset(index)}
                            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900 dark:hover:bg-opacity-20 rounded-md transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>

            <button
              onClick={handleResetAll}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
            >
              <RotateCcw className="w-4 h-4" />
              Reset All
            </button>
          </div>

          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-semibold shadow-lg"
          >
            <Send className="w-5 h-5" />
            Approve & Send ({rewriteResults.length})
          </button>
        </div>
      </div>
    </div>
  );
}
