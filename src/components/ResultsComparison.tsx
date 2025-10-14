import { useState } from 'react';
import { Check, FileText, Sparkles } from 'lucide-react';
import { formatCharacterCount } from '../utils/characterCounter';

interface ResultsComparisonProps {
  transcript: string;
  outputs: {
    deepSeek: string;
    geminiFlash: string;
    geminiPro: string;
    openRouter: string;
    deepSeekError?: string;
    geminiFlashError?: string;
    geminiProError?: string;
    openRouterError?: string;
  };
  onSelectFinal: (output: string, modelName: string) => void;
}

type TabType = 'deepseek' | 'gemini-flash' | 'gemini-pro' | 'openrouter';

export default function ResultsComparison({ transcript, outputs, onSelectFinal }: ResultsComparisonProps) {
  const [activeTab, setActiveTab] = useState<TabType>('deepseek');

  const tabs: Array<{ id: TabType; label: string; content: string; error?: string }> = [
    { id: 'deepseek', label: 'DeepSeek', content: outputs.deepSeek, error: outputs.deepSeekError },
    { id: 'gemini-flash', label: 'Gemini 2.5 Flash', content: outputs.geminiFlash, error: outputs.geminiFlashError },
    { id: 'gemini-pro', label: 'Gemini 2.5 Pro', content: outputs.geminiPro, error: outputs.geminiProError },
    { id: 'openrouter', label: 'OpenRouter', content: outputs.openRouter, error: outputs.openRouterError },
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);

  const getModelName = (tabId: TabType): string => {
    const tabMap = {
      'deepseek': 'DeepSeek',
      'gemini-flash': 'Gemini 2.5 Flash',
      'gemini-pro': 'Gemini 2.5 Pro',
      'openrouter': 'OpenRouter'
    };
    return tabMap[tabId];
  };

  return (
    <div className="max-w-[98%] mx-auto px-4 pb-12">
      {/* Transcript Section - Full Width at Top */}
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 border-2 border-blue-500 dark:border-blue-400">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <h3 className="text-2xl font-bold">Original Transcript</h3>
            <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
              {formatCharacterCount(transcript.length)} characters
            </span>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 overflow-y-auto border border-gray-200 dark:border-gray-700" style={{ maxHeight: '300px' }}>
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">{transcript}</pre>
          </div>
        </div>
      </div>

      {/* AI Outputs Section with Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border-2 border-green-500 dark:border-green-400">
        {/* Tab Headers */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-semibold text-sm transition-all whitespace-nowrap flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-b-2 border-green-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {tab.label}
                {tab.error && <span className="text-red-500 text-xs">(Error)</span>}
                {tab.content && !tab.error && <span className="text-green-500 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTabData && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold">{activeTabData.label}</h3>
                  {activeTabData.content && !activeTabData.error && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatCharacterCount(activeTabData.content.length)} characters
                    </span>
                  )}
                </div>
                {activeTabData.content && !activeTabData.error && (
                  <button
                    onClick={() => onSelectFinal(activeTabData.content, getModelName(activeTab))}
                    className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg"
                  >
                    <Check className="w-5 h-5" />
                    Mark as Final
                  </button>
                )}
              </div>

              {activeTabData.error && (
                <div className="p-6 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border-2 border-red-300 dark:border-red-700">
                  <p className="font-semibold mb-2">Error:</p>
                  <p>{activeTabData.error}</p>
                </div>
              )}

              {!activeTabData.error && activeTabData.content && (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg p-6 overflow-y-auto border-2 border-gray-200 dark:border-gray-700 shadow-inner" style={{ maxHeight: '600px' }}>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">{activeTabData.content}</pre>
                </div>
              )}

              {!activeTabData.error && !activeTabData.content && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="text-lg">No output available</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Comparison View */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-2 cursor-pointer transition-all hover:shadow-lg ${
              activeTab === tab.id
                ? 'border-green-500 shadow-lg scale-105'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <h4 className="font-bold mb-2 flex items-center justify-between">
              {tab.label}
              {activeTab === tab.id && <span className="text-green-500">●</span>}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {tab.error ? (
                <span className="text-red-500">Error occurred</span>
              ) : tab.content ? (
                `${formatCharacterCount(tab.content.length)} chars`
              ) : (
                'No output'
              )}
            </p>
            {tab.content && !tab.error && (
              <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 line-clamp-3">
                {tab.content.substring(0, 100)}...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
