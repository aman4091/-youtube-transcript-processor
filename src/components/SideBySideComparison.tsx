import { useState, useEffect } from 'react';
import { Check, FileText, ArrowLeftRight, RefreshCw } from 'lucide-react';
import { formatCharacterCount } from '../utils/characterCounter';

interface SideBySideComparisonProps {
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
  onRewrite?: () => void;
  pendingCount?: number;
  isWaitingForUserAction?: boolean;
}

type ModelType = 'transcript' | 'deepseek' | 'gemini-flash' | 'gemini-pro' | 'openrouter';

export default function SideBySideComparison({ transcript, outputs, onSelectFinal, onRewrite, pendingCount, isWaitingForUserAction }: SideBySideComparisonProps) {
  const [leftModel, setLeftModel] = useState<ModelType>('transcript');
  const [rightModel, setRightModel] = useState<ModelType>('gemini-flash');

  // All possible models
  const allModels = [
    { id: 'transcript' as ModelType, label: 'Original Transcript', content: transcript, error: undefined },
    { id: 'deepseek' as ModelType, label: 'DeepSeek', content: outputs.deepSeek, error: outputs.deepSeekError },
    { id: 'gemini-flash' as ModelType, label: 'Gemini 2.5 Flash', content: outputs.geminiFlash, error: outputs.geminiFlashError },
    { id: 'gemini-pro' as ModelType, label: 'Gemini 2.5 Pro', content: outputs.geminiPro, error: outputs.geminiProError },
    { id: 'openrouter' as ModelType, label: 'OpenRouter', content: outputs.openRouter, error: outputs.openRouterError },
  ];

  // Filter out disabled models (those with no content AND no error)
  const models = allModels.filter(model =>
    model.id === 'transcript' || // Always show transcript
    model.content || // Show if has content
    model.error // Show if has actual error
  );

  // Auto-select first available AI model on right side
  useEffect(() => {
    const firstAiModel = models.find(m => m.id !== 'transcript');
    if (firstAiModel && !models.find(m => m.id === rightModel)) {
      setRightModel(firstAiModel.id);
    }
  }, [models, rightModel]);

  const leftData = models.find(m => m.id === leftModel);
  const rightData = models.find(m => m.id === rightModel);

  const getModelName = (modelId: ModelType): string => {
    const model = models.find(m => m.id === modelId);
    return model?.label || '';
  };

  const swapModels = () => {
    const temp = leftModel;
    setLeftModel(rightModel);
    setRightModel(temp);
  };

  const renderContent = (data: typeof models[0] | undefined, side: 'left' | 'right') => {
    if (!data) return null;

    const currentModel = side === 'left' ? leftModel : rightModel;
    const setModel = side === 'left' ? setLeftModel : setRightModel;
    const borderColor = side === 'left' ? 'border-blue-500' : 'border-green-500';

    return (
      <div className={`flex-1 flex flex-col border-2 ${borderColor} rounded-lg bg-white dark:bg-gray-800 shadow-xl`}>
        {/* Model Selector Dropdown */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <select
            value={currentModel}
            onChange={(e) => setModel(e.target.value as ModelType)}
            className="w-full px-4 py-3 text-lg font-bold border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
                {model.error ? ' (Error)' : model.content ? ` (${formatCharacterCount(model.content.length)} chars)` : ' (No output)'}
              </option>
            ))}
          </select>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className={`w-5 h-5 ${side === 'left' ? 'text-blue-600' : 'text-green-600'}`} />
              <h3 className="text-xl font-bold">{data.label}</h3>
            </div>
            {data.content && !data.error && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatCharacterCount(data.content.length)} characters
              </span>
            )}
          </div>

          {/* Mark as Final Button */}
          {currentModel !== 'transcript' && data.content && !data.error && (
            <button
              onClick={() => onSelectFinal(data.content, getModelName(currentModel))}
              className={`mb-4 flex items-center justify-center gap-2 px-6 py-3 ${
                side === 'left' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'
              } text-white rounded-lg transition-colors font-medium shadow-lg`}
            >
              <Check className="w-5 h-5" />
              Mark as Final
            </button>
          )}

          {/* Error Display */}
          {data.error && (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg border-2 border-red-300 dark:border-red-700">
              <p className="font-semibold mb-1">Error:</p>
              <p className="text-sm">{data.error}</p>
            </div>
          )}

          {/* Content Display */}
          {!data.error && data.content && (
            <div
              className="flex-1 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 overflow-y-auto border border-gray-200 dark:border-gray-700"
              style={{ maxHeight: 'calc(100vh - 350px)' }}
            >
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">{data.content}</pre>
            </div>
          )}

          {/* No Content Display */}
          {!data.error && !data.content && (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <p className="text-lg">No output available</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[98%] mx-auto px-4 pb-12">
      {/* Pending Videos Banner */}
      {pendingCount !== undefined && pendingCount > 0 && isWaitingForUserAction && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-700 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                ⏳ Waiting for your action
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                {pendingCount} video{pendingCount > 1 ? 's' : ''} remaining in queue. Click "Mark as Final" to process the next video.
              </p>
            </div>
            <div className="px-4 py-2 bg-yellow-400 dark:bg-yellow-600 text-yellow-900 dark:text-yellow-100 rounded-lg font-bold text-xl">
              {pendingCount}
            </div>
          </div>
        </div>
      )}

      {/* Rewrite Button */}
      {onRewrite && (
        <div className="mb-6">
          <button
            onClick={() => {
              if (confirm('Regenerate all outputs with the same transcript? This will re-process with all enabled AI models.')) {
                onRewrite();
              }
            }}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 transition-all font-bold text-lg shadow-lg"
          >
            <RefreshCw className="w-6 h-6" />
            Rewrite All Outputs (Same Transcript)
          </button>
        </div>
      )}

      {/* Quick Selection Bar */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Quick Compare:</span>
            <div className="flex gap-2 flex-wrap">
              {/* Only show quick buttons for enabled models */}
              {models.find(m => m.id === 'deepseek') && (
                <button
                  onClick={() => { setLeftModel('transcript'); setRightModel('deepseek'); }}
                  className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                >
                  Transcript ↔ DeepSeek
                </button>
              )}
              {models.find(m => m.id === 'gemini-flash') && (
                <button
                  onClick={() => { setLeftModel('transcript'); setRightModel('gemini-flash'); }}
                  className="px-3 py-1 text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                >
                  Transcript ↔ Gemini Flash
                </button>
              )}
              {models.find(m => m.id === 'deepseek') && models.find(m => m.id === 'gemini-flash') && (
                <button
                  onClick={() => { setLeftModel('deepseek'); setRightModel('gemini-flash'); }}
                  className="px-3 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                >
                  DeepSeek ↔ Gemini Flash
                </button>
              )}
              {models.find(m => m.id === 'gemini-flash') && models.find(m => m.id === 'gemini-pro') && (
                <button
                  onClick={() => { setLeftModel('gemini-flash'); setRightModel('gemini-pro'); }}
                  className="px-3 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                >
                  Flash ↔ Pro
                </button>
              )}
              {models.find(m => m.id === 'gemini-pro') && models.find(m => m.id === 'openrouter') && (
                <button
                  onClick={() => { setLeftModel('gemini-pro'); setRightModel('openrouter'); }}
                  className="px-3 py-1 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                >
                  Gemini Pro ↔ OpenRouter
                </button>
              )}
            </div>
          </div>
          <button
            onClick={swapModels}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Swap Sides
          </button>
        </div>
      </div>

      {/* Side by Side Comparison */}
      <div className="flex gap-6">
        {renderContent(leftData, 'left')}
        {renderContent(rightData, 'right')}
      </div>

      {/* All Models Preview Cards */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {models.map((model) => (
          <div
            key={model.id}
            className={`bg-white dark:bg-gray-800 rounded-lg p-4 border-2 cursor-pointer transition-all hover:shadow-lg ${
              leftModel === model.id || rightModel === model.id
                ? 'border-purple-500 shadow-lg'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
            onClick={() => {
              if (leftModel === model.id) {
                setRightModel(model.id);
              } else if (rightModel === model.id) {
                setLeftModel(model.id);
              } else {
                setRightModel(model.id);
              }
            }}
          >
            <h4 className="font-bold text-sm mb-2 flex items-center justify-between">
              <span className="truncate">{model.label}</span>
              {(leftModel === model.id || rightModel === model.id) && (
                <span className="text-purple-500 ml-1">●</span>
              )}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {model.error ? (
                <span className="text-red-500">Error</span>
              ) : model.content ? (
                `${formatCharacterCount(model.content.length)} chars`
              ) : (
                'No output'
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
