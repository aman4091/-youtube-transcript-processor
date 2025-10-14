import { useState, useEffect } from 'react';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { fetchOpenRouterModels } from '../services/aiProcessors';
import axios from 'axios';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOKEN_SERVER_URL = 'http://localhost:5555';

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettingsStore();
  const [localSettings, setLocalSettings] = useState(settings);
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string }>>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [tokenMessage, setTokenMessage] = useState('');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (isOpen) {
      fetchOpenRouterModels().then(setOpenRouterModels);
      // Auto-fetch token from server when modal opens
      autoFetchToken();
    }
  }, [isOpen]);

  // Automatically fetch token from background server
  const autoFetchToken = async () => {
    if (!localSettings.enableDriveUpload) {
      return; // Don't fetch if Drive upload is disabled
    }

    setTokenStatus('loading');
    setTokenMessage('Fetching token from token.pickle...');

    try {
      const response = await axios.get(`${TOKEN_SERVER_URL}/token`, {
        timeout: 3000
      });

      if (response.data.success && response.data.token) {
        setLocalSettings({
          ...localSettings,
          googleDriveAccessToken: response.data.token
        });
        setTokenStatus('success');
        setTokenMessage('✓ Token loaded automatically from token.pickle!');
      } else {
        setTokenStatus('error');
        setTokenMessage('Failed to get token from server');
      }
    } catch (error) {
      setTokenStatus('error');
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        setTokenMessage('Token server not running. Make sure to start with: npm run dev');
      } else if (axios.isAxiosError(error) && error.response?.data?.message) {
        setTokenMessage(error.response.data.message);
      } else {
        setTokenMessage('Could not connect to token server');
      }
    }
  };

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
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
                value={localSettings.channelUrls.join('\n')}
                onChange={(e) => {
                  const urls = e.target.value
                    .split('\n')
                    .map(url => url.trim())
                    .filter(url => url.length > 0);
                  setLocalSettings({ ...localSettings, channelUrls: urls });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] font-mono text-sm"
                placeholder="https://www.youtube.com/@channel1&#10;https://www.youtube.com/@channel2&#10;https://www.youtube.com/@channel3"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Add multiple channel URLs (one per line). Formats: youtube.com/@username, youtube.com/channel/ID, youtube.com/c/name
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                {localSettings.channelUrls.length} channel(s) configured
              </p>
            </div>
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
            <h3 className="text-lg font-semibold">Custom Prompt</h3>
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

          {/* Google Drive Settings */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold">Google Drive Integration (AUTOMATIC!)</h3>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <input
                type="checkbox"
                id="enableDriveUpload"
                checked={localSettings.enableDriveUpload}
                onChange={(e) => {
                  setLocalSettings({ ...localSettings, enableDriveUpload: e.target.checked });
                  if (e.target.checked) {
                    autoFetchToken();
                  }
                }}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="enableDriveUpload" className="font-medium cursor-pointer">
                Enable Google Drive Upload
              </label>
            </div>

            {localSettings.enableDriveUpload && (
              <>
                {/* Automatic Token Status */}
                {tokenStatus !== 'idle' && (
                  <div className={`p-3 rounded-md border ${
                    tokenStatus === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200' :
                    tokenStatus === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200' :
                    'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200'
                  }`}>
                    <p className={`text-sm font-medium ${
                      tokenStatus === 'loading' ? 'text-blue-800 dark:text-blue-200' :
                      tokenStatus === 'success' ? 'text-green-800 dark:text-green-200' :
                      'text-yellow-800 dark:text-yellow-200'
                    }`}>
                      {tokenStatus === 'loading' && '🔄 '}
                      {tokenStatus === 'success' && '✅ '}
                      {tokenStatus === 'error' && '⚠️ '}
                      {tokenMessage}
                    </p>
                  </div>
                )}

                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
                  <p className="text-sm text-green-800 dark:text-green-200 font-bold mb-2">
                    ✨ FULLY AUTOMATIC - NO MANUAL STEPS!
                  </p>
                  <ol className="text-xs text-green-700 dark:text-green-300 space-y-1 list-decimal list-inside">
                    <li>Put <code className="bg-green-100 dark:bg-green-900 px-1 rounded font-mono">token.pickle</code> in project folder</li>
                    <li>Enable "Google Drive Upload" checkbox above</li>
                    <li>Done! Token loads automatically</li>
                  </ol>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-3 font-semibold">
                    🚀 Token auto-refreshes when expired - no manual work!
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    💡 Background server handles everything automatically
                  </p>
                </div>

                {/* Manual Token Field (fallback) */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    Advanced: Manual Token Override (click to expand)
                  </summary>
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-2">
                      Google Drive Access Token (Manual)
                    </label>
                    <input
                      type="password"
                      value={localSettings.googleDriveAccessToken}
                      onChange={(e) =>
                        setLocalSettings({ ...localSettings, googleDriveAccessToken: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                      placeholder="Only needed if automatic fails"
                    />
                  </div>
                </details>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Google Drive Folder ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={localSettings.googleDriveFolderId}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, googleDriveFolderId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave empty for root folder"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Get folder ID from Drive URL: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">drive.google.com/drive/folders/FOLDER_ID</code>
                  </p>
                </div>
              </>
            )}
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
    </div>
  );
}
