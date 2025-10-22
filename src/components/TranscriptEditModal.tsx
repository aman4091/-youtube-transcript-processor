import { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { getGoogleDriveFile, updateProcessedScript } from '../services/googleDriveService';
import { useSettingsStore } from '../stores/settingsStore';

interface TranscriptEditModalProps {
  videoId: number;
  videoTitle: string;
  rawTranscriptPath: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TranscriptEditModal({
  videoId,
  videoTitle,
  rawTranscriptPath,
  onClose,
  onSuccess,
}: TranscriptEditModalProps) {
  const { settings } = useSettingsStore();
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Fetch raw transcript on mount
  useEffect(() => {
    async function fetchTranscript() {
      if (!rawTranscriptPath) {
        setError('Raw transcript path not found for this video');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');

        // Get Supabase token
        const token = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Fetch raw transcript from Google Drive
        const content = await getGoogleDriveFile(rawTranscriptPath, token);
        setRawTranscript(content);
      } catch (err: any) {
        console.error('Error fetching transcript:', err);
        setError(err.message || 'Failed to load transcript');
      } finally {
        setLoading(false);
      }
    }

    fetchTranscript();
  }, [rawTranscriptPath]);

  // Copy prompt + transcript to clipboard
  const handleCopy = async () => {
    try {
      const customPrompt = settings.customPrompt || 'Process this transcript:';
      const textToCopy = `${customPrompt}\n\n${rawTranscript}`;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
    }
  };

  // Clean text: remove asterisks, lines, and double quotes
  const cleanText = (text: string): string => {
    return text
      // Remove asterisks
      .replace(/\*/g, '')
      // Remove horizontal lines (---, ===, ___, etc.)
      .replace(/^[-=_]{3,}$/gm, '')
      // Remove double quotes
      .replace(/"/g, '')
      // Remove multiple blank lines (keep max 2 newlines)
      .replace(/\n{3,}/g, '\n\n')
      // Trim whitespace
      .trim();
  };

  // Submit edited output to update Google Drive
  const handleSubmit = async () => {
    if (!outputText.trim()) {
      setError('Please paste the output text');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMessage('');

      const token = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // Clean the text before uploading
      const cleanedText = cleanText(outputText);

      // Update processed script in Google Drive
      await updateProcessedScript(videoId, cleanedText, token);

      setSuccessMessage('✅ Script updated successfully!');

      // Close modal and refresh parent component after 1.5 seconds
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error updating script:', err);
      setError(err.message || 'Failed to update script');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Edit Video Script
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 truncate">
              {videoTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={submitting}
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transcript...</span>
            </div>
          ) : error && !rawTranscript ? (
            <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
              {error}
            </div>
          ) : (
            <>
              {/* Original Transcript Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Original Transcript (SupaData)
                  </label>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Characters: {rawTranscript.length.toLocaleString()}
                  </span>
                </div>
                <div className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono">
                    {rawTranscript}
                  </pre>
                </div>
              </div>

              {/* Copy Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleCopy}
                  disabled={!rawTranscript || copied}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
                >
                  {copied ? (
                    <>
                      <Check className="w-5 h-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copy Prompt + Transcript
                    </>
                  )}
                </button>
              </div>

              {/* Output Input Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Paste AI Output Here
                  </label>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Characters: {outputText.length.toLocaleString()}
                  </span>
                </div>
                <textarea
                  value={outputText}
                  onChange={(e) => setOutputText(e.target.value)}
                  placeholder="Paste the processed output from your AI tool here..."
                  className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                  disabled={submitting}
                />
              </div>

              {/* Error Message */}
              {error && rawTranscript && (
                <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">
                  {successMessage}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !outputText.trim() || loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Submit & Update'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
