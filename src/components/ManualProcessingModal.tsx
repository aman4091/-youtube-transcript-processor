import { useState } from 'react';
import { Copy, CheckCircle, FileText, FileOutput } from 'lucide-react';
import { formatCharacterCount } from '../utils/characterCounter';

interface ManualProcessingModalProps {
  transcript: string;
  prompt: string;
  videoTitle?: string;
  onSubmit: (output: string) => void;
  onCancel: () => void;
}

export default function ManualProcessingModal({
  transcript,
  prompt,
  videoTitle,
  onSubmit,
  onCancel,
}: ManualProcessingModalProps) {
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const inputText = `${prompt}\n\n${transcript}`;
  const inputCharCount = inputText.length;
  const outputCharCount = output.length;

  const handleCopyInput = async () => {
    try {
      await navigator.clipboard.writeText(inputText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('❌ Failed to copy to clipboard:', error);
    }
  };

  const handleSubmit = () => {
    if (!output.trim()) {
      console.log('⚠️ Please paste your output before submitting');
      return;
    }
    onSubmit(output);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-purple-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl md:text-2xl font-bold">Manual Processing</h2>
              {videoTitle && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                  {videoTitle}
                </p>
              )}
            </div>
          </div>

          {/* Info Banner */}
          <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 rounded">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              <strong>Manual Mode:</strong> Copy the input below and process it with your own AI tool.
              Then paste the output and submit to continue.
            </p>
          </div>

          {/* INPUT SECTION */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Input (Prompt + Transcript)</h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  Characters: {formatCharacterCount(inputCharCount)}
                </span>
                <button
                  onClick={handleCopyInput}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm shadow-lg transition-all active:scale-95"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Input</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div
              className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-y-auto border border-gray-200 dark:border-gray-700"
              style={{ maxHeight: '300px' }}
            >
              <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono break-words">
                {inputText}
              </pre>
            </div>
          </div>

          {/* OUTPUT SECTION */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileOutput className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold">Output (Paste Here)</h3>
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                Characters: {formatCharacterCount(outputCharCount)}
              </span>
            </div>

            <textarea
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              placeholder="Paste your AI-generated output here..."
              className="w-full h-64 bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm leading-relaxed font-mono resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold text-base shadow-lg transition-all active:scale-95 sm:hover:scale-105"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-base shadow-lg transition-all active:scale-95 sm:hover:scale-105"
            >
              Submit Output
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
