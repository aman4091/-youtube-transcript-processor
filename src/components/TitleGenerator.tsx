import { useState, useEffect } from 'react';
import { Sparkles, Download, SkipForward, Loader2, RefreshCw } from 'lucide-react';
import { processWithOpenRouter } from '../services/aiProcessors';
import { useSettingsStore } from '../stores/settingsStore';

interface TitleGeneratorProps {
  script: string;
  onTitleSelected: (title: string) => void;
  onSkip: () => void;
}

export default function TitleGenerator({ script, onTitleSelected, onSkip }: TitleGeneratorProps) {
  const { settings } = useSettingsStore();
  const [titles, setTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateTitles = async () => {
    if (!settings.openRouterApiKey) {
      setError('OpenRouter API key not configured');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setTitles([]); // Clear previous titles

    try {
      // Use custom title prompt from settings
      const userPrompt = settings.titlePrompt || 'Generate 10 catchy, viral YouTube video titles for the following script. Make them engaging and click-worthy.';

      const prompt = `${userPrompt}

Return ONLY the titles in this exact format:
1. [title]
2. [title]
3. [title]
4. [title]
5. [title]
6. [title]
7. [title]
8. [title]
9. [title]
10. [title]

Script:
${script}`;

      console.log('🎬 Generating titles with OpenRouter...');
      console.log(`📝 Using model: ${settings.selectedOpenRouterModel}`);

      const result = await processWithOpenRouter(
        prompt,
        '',
        settings.openRouterApiKey,
        settings.selectedOpenRouterModel
      );

      console.log('✓ OpenRouter response received');
      console.log('Response:', result);

      if (result.error) {
        console.error('✗ OpenRouter returned error:', result.error);
        setError(result.error);
        setLoading(false);
        return;
      }

      if (!result.content) {
        console.error('✗ OpenRouter returned empty content');
        setError('Received empty response from AI. Please try again.');
        setLoading(false);
        return;
      }

      // Extract titles from response
      const extractedTitles = extractTitlesFromResponse(result.content);
      console.log(`✓ Extracted ${extractedTitles.length} titles`);

      if (extractedTitles.length === 0) {
        console.error('✗ Could not extract any titles from response');
        console.error('Response content:', result.content);
        setError('Could not extract titles from response. Please try again.');
        setLoading(false);
        return;
      }

      setTitles(extractedTitles);
      setLoading(false);
    } catch (err) {
      console.error('✗ Title generation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate titles');
      setLoading(false);
    }
  };

  const extractTitlesFromResponse = (response: string): string[] => {
    const lines = response.split('\n');
    const titles: string[] = [];

    for (const line of lines) {
      // Match lines starting with number followed by dot and space
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        // Clean the title - remove quotes, asterisks, etc
        let title = match[1].trim();
        title = title.replace(/^["'`*]+|["'`*]+$/g, ''); // Remove quotes/asterisks from start/end
        title = title.replace(/\*\*/g, ''); // Remove bold markdown
        if (title) {
          titles.push(title);
        }
      }
    }

    return titles;
  };

  const handleTitleSelect = (title: string) => {
    // Just pass the title to parent - download will happen in App.tsx
    onTitleSelected(title);
  };

  // Auto-generate on mount
  useEffect(() => {
    if (settings.openRouterApiKey && script) {
      generateTitles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
            <h2 className="text-xl sm:text-2xl font-bold">Generate Video Titles</h2>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            AI-generated catchy titles for your video
          </p>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Generating titles...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {!loading && titles.length > 0 && (
            <>
              <div className="space-y-3 mb-6">
                {titles.map((title, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-transparent hover:border-blue-500 transition-all group"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <p className="flex-1 text-sm sm:text-base font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {title}
                    </p>
                    <button
                      onClick={() => handleTitleSelect(title)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Final Title</span>
                    </button>
                  </div>
                ))}
              </div>

              {/* Get More Titles Button */}
              <button
                onClick={generateTitles}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-5 h-5" />
                Get 10 More Titles
              </button>
            </>
          )}

          {/* Skip Button */}
          <button
            onClick={onSkip}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium"
          >
            <SkipForward className="w-5 h-5" />
            Skip Title Generation
          </button>
        </div>
      </div>
    </div>
  );
}
