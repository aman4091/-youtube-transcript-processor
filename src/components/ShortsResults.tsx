import { useState } from 'react';
import {
  ArrowLeft,
  Trophy,
  Clock,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Heart,
  Lightbulb,
  BookOpen,
  CheckCircle,
  Send,
  CheckSquare,
  Square,
} from 'lucide-react';
import { ShortSegment } from '../types/shorts';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { useScriptCounterStore } from '../stores/scriptCounterStore';

interface ShortsResultsProps {
  shorts: ShortSegment[];
  videoUrl: string;
  videoTitle: string;
  onBack: () => void;
}

export default function ShortsResults({ shorts, videoUrl, videoTitle, onBack }: ShortsResultsProps) {
  const { addToQueue } = useTempQueueStore();
  const { getNextCounter } = useScriptCounterStore();

  const [expandedShorts, setExpandedShorts] = useState<Set<number>>(new Set());
  const [selectedShorts, setSelectedShorts] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const toggleExpand = (index: number) => {
    const newExpanded = new Set(expandedShorts);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedShorts(newExpanded);
  };

  const copyTimestamps = (short: ShortSegment, index: number) => {
    const text = `${short.startTime} - ${short.endTime}\n${short.title}\n${short.description}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleSelection = (index: number) => {
    const newSelected = new Set(selectedShorts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedShorts(newSelected);
  };

  const selectAllHighScores = () => {
    const highScoreIndices = shorts
      .map((short, index) => (short.score >= 8 ? index : -1))
      .filter((index) => index !== -1);
    setSelectedShorts(new Set(highScoreIndices));
  };

  const clearSelection = () => {
    setSelectedShorts(new Set());
  };

  const formatShortForQueue = (short: ShortSegment): string => {
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏱️ TIMESTAMP: ${short.startTime} - ${short.endTime} (${short.durationSeconds}s)
🏆 SCORE: ${short.score}/10 | 📂 CATEGORY: ${short.category.toUpperCase()}

📌 TITLE:
${short.title}

📝 DESCRIPTION:
${short.description}

💡 WHY THIS WORKS:
${short.reason}

📄 TRANSCRIPT:
${short.transcript}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
  };

  const handleAddToQueue = () => {
    if (selectedShorts.size === 0) {
      return;
    }

    // Get selected shorts
    const selectedShortsData = Array.from(selectedShorts)
      .map((index) => shorts[index])
      .sort((a, b) => b.score - a.score); // Sort by score descending

    // Format content
    let content = `🎬 VIDEO: ${videoTitle}\n`;
    content += `🔗 URL: ${videoUrl}\n`;
    content += `✂️ TOTAL SHORTS: ${selectedShortsData.length}\n`;
    content += `\n\n`;

    selectedShortsData.forEach((short, idx) => {
      content += `SHORT #${idx + 1}\n`;
      content += formatShortForQueue(short);
    });

    // Get next counter and add to queue with counter-based filename
    const nextCounter = getNextCounter();
    const filename = `${nextCounter}_shorts.txt`;
    addToQueue(content, 'Shorts Collection', nextCounter, filename);

    // Show success message
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);

    // Clear selection
    clearSelection();

    console.log(`✅ Added ${selectedShortsData.length} shorts to queue as ${filename}`);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 9) return 'from-yellow-400 to-yellow-600'; // Gold
    if (score >= 8) return 'from-gray-300 to-gray-500'; // Silver
    if (score >= 7) return 'from-orange-400 to-orange-600'; // Bronze
    return 'from-blue-400 to-blue-600';
  };

  const getScoreBadgeText = (score: number): string => {
    if (score >= 9) return '🏆 BEST';
    if (score >= 8) return '⭐ GREAT';
    if (score >= 7) return '✨ GOOD';
    return '👍 OK';
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Success Notification */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-5 h-5" />
          <span className="font-medium">Shorts added to queue!</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4">
            {/* Top Row: Back Button + Title */}
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline">Back to Videos</span>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {videoTitle}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Found {shorts.length} potential short{shorts.length !== 1 ? 's' : ''} (30-60 seconds)
                  {selectedShorts.size > 0 && (
                    <span className="ml-2 text-purple-600 dark:text-purple-400 font-semibold">
                      • {selectedShorts.size} selected
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Bottom Row: Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={selectAllHighScores}
                className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-lg transition-colors text-sm font-medium"
              >
                <Sparkles className="w-4 h-4" />
                <span>Select Best (8+)</span>
              </button>

              {selectedShorts.size > 0 && (
                <>
                  <button
                    onClick={clearSelection}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm font-medium"
                  >
                    <Square className="w-4 h-4" />
                    <span>Clear Selection</span>
                  </button>

                  <button
                    onClick={handleAddToQueue}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium shadow-md"
                  >
                    <Send className="w-4 h-4" />
                    <span>Add to Queue ({selectedShorts.size})</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Shorts Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {shorts.map((short, index) => {
            const isExpanded = expandedShorts.has(index);
            const isCopied = copiedIndex === index;
            const isSelected = selectedShorts.has(index);

            return (
              <div
                key={index}
                className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-2 ${
                  isSelected
                    ? 'border-purple-600 ring-4 ring-purple-200 dark:ring-purple-900'
                    : 'border-transparent hover:border-purple-500 dark:hover:border-purple-400'
                }`}
              >
                {/* Card Header */}
                <div className={`bg-gradient-to-r ${getScoreColor(short.score)} p-4 text-white relative`}>
                  {/* Selection Checkbox */}
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={() => toggleSelection(index)}
                      className="p-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition-all"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-6 h-6 text-white" />
                      ) : (
                        <Square className="w-6 h-6 text-white" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-2 pr-12">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      <span className="font-bold text-lg">{short.score}/10</span>
                    </div>
                    <span className="px-3 py-1 bg-white bg-opacity-20 rounded-full text-sm font-semibold">
                      {getScoreBadgeText(short.score)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-white text-opacity-90">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {short.startTime} - {short.endTime} ({short.durationSeconds}s)
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 sm:p-5">
                  {/* Category Badge */}
                  <div className="mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getCategoryColor(
                        short.category
                      )}`}
                    >
                      {getCategoryIcon(short.category)}
                      {short.category.toUpperCase()}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2">
                    {short.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                    {short.description}
                  </p>

                  {/* Why Great */}
                  <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 p-3 rounded-lg mb-4">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">Why Great: </span>
                        {short.reason}
                      </p>
                    </div>
                  </div>

                  {/* Transcript Expand/Collapse */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                    <button
                      onClick={() => toggleExpand(index)}
                      className="flex items-center justify-between w-full text-left text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Transcript
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-48 overflow-y-auto">
                        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {short.transcript}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="mt-4">
                    <button
                      onClick={() => copyTimestamps(short, index)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      {isCopied ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          Copy Details
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {shorts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              No shorts found that meet the criteria.
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Try a different video or adjust the analysis settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
