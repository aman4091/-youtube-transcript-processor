import { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon, Send, Video, VideoOff, Terminal } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { fetchOpenRouterModels } from '../services/aiProcessors';
import { verifyTelegramCredentials, sendCommand } from '../services/telegramAPI';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string }>>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [channelUrlsText, setChannelUrlsText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Video and FFmpeg states
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [showFFmpegModal, setShowFFmpegModal] = useState(false);
  const [ffmpegCommand, setFFmpegCommand] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
    setChannelUrlsText(settings.channelUrls.join('\n'));
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      fetchOpenRouterModels().then(setOpenRouterModels);
    }
  }, [isOpen]);

  const handleSave = () => {
    // Parse channel URLs one final time before saving
    const urls = channelUrlsText
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    updateSettings({ ...localSettings, channelUrls: urls });
    onClose();
  };

  const handleTestTelegram = async () => {
    if (!localSettings.telegramBotToken || !localSettings.telegramChatId) {
      setTestResult({
        success: false,
        message: 'Please enter both Bot Token and Chat ID'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await verifyTelegramCredentials(
        localSettings.telegramBotToken,
        localSettings.telegramChatId
      );

      setTestResult({
        success: result.success,
        message: result.success
          ? '✅ Success! Check your Telegram for the test message.'
          : `❌ Failed: ${result.error}`
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleVideo = async () => {
    if (!localSettings.telegramBotToken || !localSettings.telegramChatId) {
      alert('⚠️ Please configure Telegram credentials first!');
      return;
    }

    setIsSendingCommand(true);
    const command = videoEnabled ? '/disable_video' : '/enable_video';

    try {
      const result = await sendCommand(
        localSettings.telegramBotToken,
        localSettings.telegramChatId,
        command
      );

      if (result.success) {
        setVideoEnabled(!videoEnabled);
        console.log(`✓ Sent command: ${command}`);
      } else {
        alert(`❌ Failed to send command: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSendingCommand(false);
    }
  };

  const handleSendFFmpegCommand = async () => {
    if (!ffmpegCommand.trim()) {
      alert('⚠️ Please enter an FFmpeg command!');
      return;
    }

    if (!localSettings.telegramBotToken || !localSettings.telegramChatId) {
      alert('⚠️ Please configure Telegram credentials first!');
      return;
    }

    setIsSendingCommand(true);
    const command = `/set_ffmpeg ${ffmpegCommand.trim()}`;

    try {
      const result = await sendCommand(
        localSettings.telegramBotToken,
        localSettings.telegramChatId,
        command
      );

      if (result.success) {
        console.log(`✓ Sent FFmpeg command: ${command}`);
        setShowFFmpegModal(false);
        setFFmpegCommand('');
        alert('✅ FFmpeg command sent successfully!');
      } else {
        alert(`❌ Failed to send command: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSendingCommand(false);
    }
  };

  const filteredModels = openRouterModels.filter(
    (model) =>
      model.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      model.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            <h2 className="text-xl font-bold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* API Keys Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">API Keys</h3>

            <div>
              <label className="block text-sm font-medium mb-2">
                SupaData API Key
              </label>
              <input
                type="password"
                value={localSettings.supaDataApiKey}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, supaDataApiKey: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter SupaData API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                DeepSeek API Key
              </label>
              <input
                type="password"
                value={localSettings.deepSeekApiKey}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, deepSeekApiKey: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter DeepSeek API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Google Gemini API Key
              </label>
              <input
                type="password"
                value={localSettings.geminiApiKey}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Gemini API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                OpenRouter API Key
              </label>
              <input
                type="password"
                value={localSettings.openRouterApiKey}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, openRouterApiKey: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter OpenRouter API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                YouTube API Key
              </label>
              <input
                type="password"
                value={localSettings.youtubeApiKey}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, youtubeApiKey: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter YouTube Data API v3 key"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get your API key from Google Cloud Console
              </p>
            </div>
          </div>

          {/* Channel Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Channel Configuration</h3>
            <div>
              <label className="block text-sm font-medium mb-2">
                YouTube Channel URLs (one per line)
              </label>
              <textarea
                value={channelUrlsText}
                onChange={(e) => {
                  // Just update the text as-is, don't parse yet
                  setChannelUrlsText(e.target.value);
                }}
                onBlur={() => {
                  // Parse URLs when user finishes editing (clicks away)
                  const urls = channelUrlsText
                    .split('\n')
                    .map(url => url.trim())
                    .filter(url => url.length > 0);
                  setLocalSettings({ ...localSettings, channelUrls: urls });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] font-mono text-sm resize-y"
                placeholder="https://www.youtube.com/@channel1&#10;https://www.youtube.com/@channel2&#10;https://www.youtube.com/@channel3"
                rows={5}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add multiple channel URLs (one per line). Formats: youtube.com/@username, youtube.com/channel/ID, youtube.com/c/name
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                {localSettings.channelUrls.length} channel(s) configured
              </p>
            </div>

            {/* Channel-specific Min Duration */}
            {localSettings.channelUrls.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-3">
                  Minimum Video Duration per Channel (minutes)
                </label>
                <div className="space-y-3">
                  {localSettings.channelUrls.map((channelUrl, index) => {
                    const currentDuration = localSettings.channelMinDurations[channelUrl] || 27;
                    // Extract channel name from URL for display
                    const channelName = channelUrl.split('/').pop() || channelUrl;

                    return (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{channelName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{channelUrl}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <input
                            type="number"
                            min="1"
                            max="180"
                            value={currentDuration}
                            onChange={(e) => {
                              const newDuration = parseInt(e.target.value) || 27;
                              setLocalSettings({
                                ...localSettings,
                                channelMinDurations: {
                                  ...localSettings.channelMinDurations,
                                  [channelUrl]: newDuration,
                                },
                              });
                            }}
                            className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">min</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Set minimum video duration for each channel. Videos shorter than this will not appear in the grid.
                </p>
              </div>
            )}
          </div>

          {/* OpenRouter Model Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">OpenRouter Model</h3>
            <div>
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                placeholder="Search models..."
              />
              <div className="border border-gray-300 dark:border-gray-600 rounded-md max-h-48 overflow-y-auto">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() =>
                      setLocalSettings({ ...localSettings, selectedOpenRouterModel: model.id })
                    }
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                      localSettings.selectedOpenRouterModel === model.id
                        ? 'bg-blue-100 dark:bg-blue-900'
                        : ''
                    }`}
                  >
                    <div className="font-medium text-sm">{model.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{model.id}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Custom Prompt */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Script Processing Prompt</h3>
            <div>
              <textarea
                value={localSettings.customPrompt}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, customPrompt: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px]"
                placeholder="Enter your custom prompt here..."
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This prompt will be prepended to each transcript chunk before processing.
              </p>
            </div>
          </div>

          {/* Title Generation Prompt */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Title Generation Prompt</h3>
            <div>
              <textarea
                value={localSettings.titlePrompt}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, titlePrompt: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
                placeholder="Enter your title generation prompt..."
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                This prompt will be used to generate video titles for your processed scripts.
              </p>
            </div>
          </div>

          {/* AI Models Selection */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold">AI Models to Use</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Enable/disable which AI models to use for processing. Disabling models will make processing faster and save API costs.
            </p>

            <div className="space-y-3">
              {/* DeepSeek */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                <input
                  type="checkbox"
                  id="enableDeepSeek"
                  checked={localSettings.enableDeepSeek}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableDeepSeek: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="enableDeepSeek" className="font-medium cursor-pointer flex-1">
                  DeepSeek
                </label>
                {!localSettings.deepSeekApiKey && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">No API key</span>
                )}
              </div>

              {/* Gemini Flash */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                <input
                  type="checkbox"
                  id="enableGeminiFlash"
                  checked={localSettings.enableGeminiFlash}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableGeminiFlash: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="enableGeminiFlash" className="font-medium cursor-pointer flex-1">
                  Gemini 2.5 Flash
                  <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-semibold">Fastest - Recommended</span>
                </label>
                {!localSettings.geminiApiKey && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">No API key</span>
                )}
              </div>

              {/* Gemini Pro */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                <input
                  type="checkbox"
                  id="enableGeminiPro"
                  checked={localSettings.enableGeminiPro}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableGeminiPro: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="enableGeminiPro" className="font-medium cursor-pointer flex-1">
                  Gemini 2.5 Pro
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Slower but higher quality</span>
                </label>
                {!localSettings.geminiApiKey && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">No API key</span>
                )}
              </div>

              {/* OpenRouter */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-md">
                <input
                  type="checkbox"
                  id="enableOpenRouter"
                  checked={localSettings.enableOpenRouter}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, enableOpenRouter: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="enableOpenRouter" className="font-medium cursor-pointer flex-1">
                  OpenRouter ({localSettings.selectedOpenRouterModel.split('/').pop()})
                </label>
                {!localSettings.openRouterApiKey && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">No API key</span>
                )}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Tip:</strong> For fastest processing, enable only Gemini Flash. This will process 4x faster and save API costs.
              </p>
            </div>
          </div>

          {/* Telegram Settings */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold">Telegram Integration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure your Telegram bot to send notifications or messages.
            </p>

            <div>
              <label className="block text-sm font-medium mb-2">
                Telegram Bot Token
              </label>
              <input
                type="password"
                value={localSettings.telegramBotToken}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, telegramBotToken: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your Telegram bot token"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Get your bot token from @BotFather on Telegram
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Chat ID #1 (Script Only)
              </label>
              <input
                type="text"
                value={localSettings.telegramChatId}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, telegramChatId: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="-1002498890377"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This chat will receive only the script file
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Chat ID #2 (Script + Title) - Optional
              </label>
              <input
                type="text"
                value={localSettings.telegramChatIdWithTitle}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, telegramChatIdWithTitle: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="-1002498890377"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This chat will receive both script and title files
              </p>
            </div>

            <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded">
              <span className="text-yellow-600 dark:text-yellow-400 text-sm font-bold">⚠️</span>
              <div className="text-xs text-yellow-800 dark:text-yellow-200">
                <strong>Channel IDs MUST start with minus sign (-)</strong>
                <br />
                <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">✓ Correct: -1002498890377</code>
                <br />
                <code className="bg-red-100 dark:bg-red-900 px-1 rounded">✗ Wrong: 1002498890377</code> (missing -)
                <br />
                <span className="text-xs mt-1">Get your chat ID from @userinfobot on Telegram</span>
              </div>
            </div>

            {/* Test Button */}
            <button
              onClick={handleTestTelegram}
              disabled={isTesting || !localSettings.telegramBotToken || !localSettings.telegramChatId}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                isTesting || !localSettings.telegramBotToken || !localSettings.telegramChatId
                  ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Send className="w-4 h-4" />
              {isTesting ? 'Testing...' : 'Test Connection'}
            </button>

            {/* Test Result */}
            {testResult && (
              <div className={`p-3 rounded-md border ${
                testResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
              }`}>
                <p className="text-sm font-medium">{testResult.message}</p>
              </div>
            )}

            {/* Bot Command Buttons */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <p className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
                Bot Commands (sent to Chat #1)
              </p>
              <div className="flex gap-3">
                {/* Video Toggle Button */}
                <button
                  onClick={handleToggleVideo}
                  disabled={isSendingCommand || !localSettings.telegramBotToken || !localSettings.telegramChatId}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isSendingCommand || !localSettings.telegramBotToken || !localSettings.telegramChatId
                      ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                      : videoEnabled
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {videoEnabled ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  {isSendingCommand ? 'Sending...' : videoEnabled ? 'Disable Video' : 'Enable Video'}
                </button>

                {/* FFmpeg Command Button */}
                <button
                  onClick={() => setShowFFmpegModal(true)}
                  disabled={isSendingCommand || !localSettings.telegramBotToken || !localSettings.telegramChatId}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
                    isSendingCommand || !localSettings.telegramBotToken || !localSettings.telegramChatId
                      ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  Set FFmpeg Command
                </button>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-bold mb-3">
                🤖 Complete Setup Guide:
              </p>

              <div className="space-y-3">
                {/* Step 1 */}
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">
                    Step 1: Create Bot (if needed)
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5 list-decimal list-inside ml-2">
                    <li>Search for @BotFather on Telegram</li>
                    <li>Send /newbot command</li>
                    <li>Follow instructions to create bot</li>
                    <li>Copy the token (looks like: 123456:ABC-DEF...)</li>
                  </ol>
                </div>

                {/* Step 2 */}
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">
                    Step 2: Start Chat with Your Bot ⚠️ IMPORTANT!
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5 list-decimal list-inside ml-2">
                    <li>Search for your bot (use bot username from BotFather)</li>
                    <li><strong>Click START button or send /start</strong></li>
                    <li>You should see "Start" button at bottom</li>
                  </ol>
                  <p className="text-xs text-red-600 dark:text-red-400 font-bold mt-1 ml-2">
                    ⚠️ "Chat not found" = You didn't start the bot!
                  </p>
                </div>

                {/* Step 3 */}
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">
                    Step 3: Get Your Chat ID
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5 list-decimal list-inside ml-2">
                    <li>Search for @userinfobot on Telegram</li>
                    <li>Send /start to it</li>
                    <li>Copy your ID (e.g., 123456789)</li>
                  </ol>
                </div>

                {/* Step 4 */}
                <div>
                  <p className="text-xs text-blue-700 dark:text-blue-300 font-semibold mb-1">
                    Step 4: For Channels (Optional)
                  </p>
                  <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5 list-decimal list-inside ml-2">
                    <li>Add your bot as channel admin</li>
                    <li>Use @getidsbot to get channel ID</li>
                    <li>Channel IDs start with -100 (e.g., -1001234567890)</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Save Settings
          </button>
        </div>
      </div>

      {/* FFmpeg Command Modal */}
      {showFFmpegModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                <h3 className="text-lg font-bold">Set FFmpeg Command</h3>
              </div>
              <button
                onClick={() => {
                  setShowFFmpegModal(false);
                  setFFmpegCommand('');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium mb-2">
                FFmpeg Command
              </label>
              <input
                type="text"
                value={ffmpegCommand}
                onChange={(e) => setFFmpegCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSendingCommand) {
                    handleSendFFmpegCommand();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                placeholder="your ffmpeg parameters here"
                autoFocus
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                This will send: <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">/set_ffmpeg {ffmpegCommand || '...'}</code>
              </p>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFFmpegModal(false);
                  setFFmpegCommand('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSendFFmpegCommand}
                disabled={isSendingCommand || !ffmpegCommand.trim()}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  isSendingCommand || !ffmpegCommand.trim()
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isSendingCommand ? 'Sending...' : 'Send Command'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
