import { useState, useEffect } from 'react';
import { Youtube, Settings as SettingsIcon, Send, Video, VideoOff, Terminal, Plus, Trash2, Edit3, X, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import NavigationBar from './NavigationBar';
import { useSettingsStore, TargetChannel, SupaDataApiKey } from '../stores/settingsStore';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { fetchOpenRouterModels } from '../services/aiProcessors';
import { verifyTelegramCredentials, sendCommand } from '../services/telegramAPI';
import { supabase } from '../services/supabaseClient';
import BackupRestoreSection from './BackupRestoreSection';
import { completeUserSetup } from '../services/userInitialization';
import { useUserStore } from '../stores/userStore';

interface SettingsPageProps {
  onClose: () => void;
  onNavigateHome: () => void;
  onNavigateHistory: () => void;
  onNavigateShorts: () => void;
  onNavigateTitle: () => void;
  onNavigateMonitoring: () => void;
  onNavigateSettings?: () => void;
  onNavigateScheduleToday?: () => void;
  onNavigateScheduleCalendar?: () => void;
  onPushToChat?: () => void;
}

export default function SettingsPage({
  onClose: _onClose,
  onNavigateHome,
  onNavigateHistory,
  onNavigateShorts,
  onNavigateTitle,
  onNavigateMonitoring,
  onNavigateSettings,
  onNavigateScheduleToday,
  onNavigateScheduleCalendar,
  onPushToChat,
}: SettingsPageProps) {
  const { settings, updateSettings } = useSettingsStore();
  const { queuedScripts } = useTempQueueStore();
  const { user } = useUserStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; name: string }>>([]);
  const [modelSearch, setModelSearch] = useState('');
  const [channelUrlsText, setChannelUrlsText] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-setup states
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupMessage, setSetupMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Video and FFmpeg states
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const [showFFmpegModal, setShowFFmpegModal] = useState(false);
  const [ffmpegCommand, setFFmpegCommand] = useState('');


  // Target Channel states
  const [showAddChannelModal, setShowAddChannelModal] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');

  // Multiple SupaData API Keys states
  const [supaDataKeys, setSupaDataKeys] = useState<SupaDataApiKey[]>(settings.supaDataApiKeys || []);
  const [isSyncingKeys, setIsSyncingKeys] = useState(false);
  const [keySyncMessage, setKeySyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
    setChannelUrlsText(settings.channelUrls.join('\n'));
    setSupaDataKeys(settings.supaDataApiKeys || []);
  }, [settings]);

  useEffect(() => {
    fetchOpenRouterModels().then(setOpenRouterModels);
  }, []);

  const handleSave = async () => {
    // Parse channel URLs one final time before saving
    const urls = channelUrlsText
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    // Save settings first
    updateSettings({ ...localSettings, channelUrls: urls });

    // Auto-setup if user is logged in and channels configured
    if (user && urls.length > 0 && localSettings.targetChannels.length > 0) {
      setIsSettingUp(true);
      setSetupMessage({ type: 'info', text: '🔄 Setting up video pools and schedule...' });

      try {
        console.log('🚀 Auto-triggering complete user setup...');

        const result = await completeUserSetup(
          user.id,
          urls,
          localSettings.targetChannels
        );

        if (result.success) {
          setSetupMessage({
            type: 'success',
            text: '✅ Setup complete! Videos will appear in Schedule Today. Check console for details.'
          });

          // Clear message after 5 seconds
          setTimeout(() => setSetupMessage(null), 5000);
        } else {
          setSetupMessage({
            type: 'error',
            text: `❌ Setup failed: ${result.error || 'Unknown error'}`
          });
        }
      } catch (error: any) {
        console.error('❌ Auto-setup error:', error);
        setSetupMessage({
          type: 'error',
          text: `❌ Setup error: ${error.message || 'Unknown error'}`
        });
      } finally {
        setIsSettingUp(false);
      }

      // Don't navigate immediately, let user see the setup message
      setTimeout(() => {
        if (setupMessage?.type === 'success') {
          onNavigateHome();
        }
      }, 3000);
    } else {
      // No auto-setup needed, navigate immediately
      onNavigateHome();
    }
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
      console.error('❌ Please configure Telegram credentials first');
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
        console.error(`❌ Failed to send command: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSendingCommand(false);
    }
  };

  const handleSendFFmpegCommand = async () => {
    if (!ffmpegCommand.trim()) {
      console.log('⚠️ Please enter an FFmpeg command');
      return;
    }

    if (!localSettings.telegramBotToken || !localSettings.telegramChatId) {
      console.error('❌ Please configure Telegram credentials first');
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
        console.log(`✓ FFmpeg command sent successfully: ${command}`);
        setShowFFmpegModal(false);
        setFFmpegCommand('');
      } else {
        console.error(`❌ Failed to send command: ${result.error}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSendingCommand(false);
    }
  };


  // Target Channel handlers
  const handleAddOrEditChannel = () => {
    if (!channelName.trim()) return;

    if (editingChannelId) {
      // Edit existing channel
      const updatedChannels = localSettings.targetChannels.map((ch) =>
        ch.id === editingChannelId
          ? { ...ch, name: channelName.trim(), description: channelDescription.trim() }
          : ch
      );
      setLocalSettings({ ...localSettings, targetChannels: updatedChannels });
    } else {
      // Add new channel
      const newChannel: TargetChannel = {
        id: `channel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: channelName.trim(),
        description: channelDescription.trim(),
      };
      setLocalSettings({
        ...localSettings,
        targetChannels: [...localSettings.targetChannels, newChannel],
      });
    }

    // Reset form
    setShowAddChannelModal(false);
    setEditingChannelId(null);
    setChannelName('');
    setChannelDescription('');
  };

  const handleEditChannel = (channel: TargetChannel) => {
    setEditingChannelId(channel.id);
    setChannelName(channel.name);
    setChannelDescription(channel.description || '');
    setShowAddChannelModal(true);
  };

  const handleDeleteChannel = (channelId: string) => {
    const updatedChannels = localSettings.targetChannels.filter((ch) => ch.id !== channelId);
    setLocalSettings({ ...localSettings, targetChannels: updatedChannels });
  };

  // ==========================================
  // Multiple SupaData API Keys Functions
  // ==========================================

  const addSupaDataKey = () => {
    const newKey: SupaDataApiKey = {
      key: '',
      label: `Key ${supaDataKeys.length + 1}`,
      active: true,
      added_at: new Date().toISOString(),
      error_count: 0,
    };
    setSupaDataKeys([...supaDataKeys, newKey]);
  };

  const removeSupaDataKey = (index: number) => {
    setSupaDataKeys(supaDataKeys.filter((_, i) => i !== index));
  };

  const toggleSupaDataKey = (index: number) => {
    const updated = [...supaDataKeys];
    updated[index].active = !updated[index].active;
    setSupaDataKeys(updated);
  };

  const updateSupaDataKey = (index: number, field: keyof SupaDataApiKey, value: any) => {
    const updated = [...supaDataKeys];
    updated[index] = { ...updated[index], [field]: value };
    setSupaDataKeys(updated);
  };

  const isKeyExhausted = (key: SupaDataApiKey): boolean => {
    // Key is exhausted if it has 3+ errors or specific error messages
    if (key.error_count && key.error_count >= 3) return true;
    if (key.last_error?.includes('invalid') || key.last_error?.includes('expired')) return true;
    if (key.last_error?.includes('rate limit') && key.error_count && key.error_count >= 2) return true;
    return false;
  };

  const syncKeysToSupabase = async () => {
    setIsSyncingKeys(true);
    setKeySyncMessage(null);

    try {
      // Remove empty keys before saving
      const validKeys = supaDataKeys.filter(k => k.key.trim() !== '');

      // Auto-remove exhausted keys if enabled
      const keysToSave = localSettings.autoRemoveExhaustedKeys
        ? validKeys.filter(k => !isKeyExhausted(k))
        : validKeys;

      // Update Supabase
      const { error } = await supabase
        .from('auto_monitor_settings')
        .update({
          supadata_keys: keysToSave.map(k => ({
            key: k.key,
            label: k.label,
            active: k.active,
            added_at: k.added_at || new Date().toISOString(),
          })),
        })
        .eq('user_id', 'default_user');

      if (error) throw error;

      // Update local settings store
      updateSettings({ supaDataApiKeys: keysToSave });
      setSupaDataKeys(keysToSave);

      const removedCount = validKeys.length - keysToSave.length;
      const message = removedCount > 0
        ? `✅ ${keysToSave.length} keys saved! (${removedCount} exhausted keys removed)`
        : `✅ ${keysToSave.length} keys saved to database!`;

      setKeySyncMessage({ type: 'success', text: message });

      // Clear message after 3 seconds
      setTimeout(() => setKeySyncMessage(null), 3000);
    } catch (error: any) {
      console.error('Error syncing keys:', error);
      setKeySyncMessage({ type: 'error', text: `❌ Failed: ${error.message}` });
    } finally {
      setIsSyncingKeys(false);
    }
  };

  const loadKeysFromSupabase = async () => {
    setIsSyncingKeys(true);
    try {
      const { data, error } = await supabase
        .from('auto_monitor_settings')
        .select('supadata_keys')
        .eq('user_id', 'default_user')
        .single();

      if (error) throw error;

      if (data?.supadata_keys && Array.isArray(data.supadata_keys)) {
        setSupaDataKeys(data.supadata_keys);
        updateSettings({ supaDataApiKeys: data.supadata_keys });
        setKeySyncMessage({ type: 'success', text: `✅ Loaded ${data.supadata_keys.length} keys from database` });
        setTimeout(() => setKeySyncMessage(null), 3000);
      }
    } catch (error: any) {
      console.error('Error loading keys:', error);
      setKeySyncMessage({ type: 'error', text: `❌ Failed to load: ${error.message}` });
    } finally {
      setIsSyncingKeys(false);
    }
  };

  const filteredModels = openRouterModels.filter(
    (model) =>
      model.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      model.name.toLowerCase().includes(modelSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Header with Logo */}
      <header className="w-full bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Youtube className="w-8 h-8 sm:w-10 sm:h-10 text-red-600 flex-shrink-0" />
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                YouTube Transcript Processor
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                Process & analyze YouTube transcripts with AI
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <NavigationBar
        currentPage="settings"
        onNavigateHome={onNavigateHome}
        onNavigateHistory={onNavigateHistory}
        onNavigateShorts={onNavigateShorts}
        onNavigateTitle={onNavigateTitle}
        onNavigateMonitoring={onNavigateMonitoring}
        onNavigateSettings={onNavigateSettings || (() => {})} // Already on settings page
        onNavigateScheduleToday={onNavigateScheduleToday}
        onNavigateScheduleCalendar={onNavigateScheduleCalendar}
        onPushToChat={onPushToChat}
        queueCount={queuedScripts.length}
      />

      {/* Page Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <SettingsIcon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">Settings</h2>
              <p className="text-white text-opacity-90 text-sm sm:text-base">
                Configure your API keys and preferences
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
          {/* API Keys Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">API Keys</h3>

            <div>
              <label className="block text-sm font-medium mb-2">
                SupaData API Key (Legacy - Single Key)
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
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚠️ Deprecated: Use "Multiple SupaData Keys" below for automatic rotation
              </p>
            </div>

            {/* Multiple SupaData API Keys - NEW! */}
            <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-semibold flex items-center gap-2">
                    <Key className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    Multiple SupaData API Keys (Recommended)
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Add multiple keys for automatic rotation when rate limits hit. System never stops!
                  </p>
                </div>
                <button
                  onClick={addSupaDataKey}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Key
                </button>
              </div>

              {/* Auto-remove exhausted keys toggle */}
              <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <input
                  type="checkbox"
                  id="autoRemoveKeys"
                  checked={localSettings.autoRemoveExhaustedKeys}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, autoRemoveExhaustedKeys: e.target.checked })
                  }
                  className="w-4 h-4"
                />
                <label htmlFor="autoRemoveKeys" className="text-sm text-gray-700 dark:text-gray-300">
                  🗑️ Auto-remove exhausted keys when saving (keys with 3+ errors or invalid/expired)
                </label>
              </div>

              {/* Keys List */}
              {supaDataKeys.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No API keys added yet. Click "Add Key" to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {supaDataKeys.map((apiKey, index) => {
                    const exhausted = isKeyExhausted(apiKey);
                    return (
                      <div
                        key={index}
                        className={`flex items-center gap-2 p-3 rounded-lg border ${
                          exhausted
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
                        }`}
                      >
                        {/* Active/Inactive Toggle */}
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={apiKey.active}
                            onChange={() => toggleSupaDataKey(index)}
                            className="w-4 h-4"
                            title={apiKey.active ? 'Active' : 'Inactive'}
                          />
                        </div>

                        {/* Label Input */}
                        <input
                          type="text"
                          value={apiKey.label}
                          onChange={(e) => updateSupaDataKey(index, 'label', e.target.value)}
                          placeholder="Label (e.g., Primary Key)"
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded w-32 text-sm bg-white dark:bg-gray-700"
                        />

                        {/* API Key Input */}
                        <input
                          type="password"
                          value={apiKey.key}
                          onChange={(e) => updateSupaDataKey(index, 'key', e.target.value)}
                          placeholder="sk-xxx..."
                          className={`flex-1 px-2 py-1 border rounded text-sm ${
                            exhausted
                              ? 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/30'
                              : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                          }`}
                        />

                        {/* Status Icons */}
                        <div className="flex items-center gap-1">
                          {exhausted ? (
                            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              <span>Exhausted</span>
                            </div>
                          ) : apiKey.active ? (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded text-xs font-medium">
                              <CheckCircle className="w-3 h-3" />
                              <span>Active</span>
                            </div>
                          ) : (
                            <div className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded text-xs font-medium">
                              Inactive
                            </div>
                          )}
                        </div>

                        {/* Error Count Badge */}
                        {apiKey.error_count && apiKey.error_count > 0 && (
                          <div className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400 rounded text-xs font-medium">
                            {apiKey.error_count} errors
                          </div>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={() => removeSupaDataKey(index)}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                          title="Remove key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Error Messages Display */}
              {supaDataKeys.some(k => k.last_error) && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">Recent Errors:</h5>
                  {supaDataKeys
                    .filter(k => k.last_error)
                    .map((k, i) => (
                      <div
                        key={i}
                        className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400"
                      >
                        <span className="font-medium">{k.label}:</span> {k.last_error}
                      </div>
                    ))}
                </div>
              )}

              {/* Sync Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={syncKeysToSupabase}
                  disabled={isSyncingKeys || supaDataKeys.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isSyncingKeys ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      💾 Save Keys to Database
                    </>
                  )}
                </button>

                <button
                  onClick={loadKeysFromSupabase}
                  disabled={isSyncingKeys}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSyncingKeys ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      🔄 Load from DB
                    </>
                  )}
                </button>
              </div>

              {/* Success/Error Messages */}
              {keySyncMessage && (
                <div
                  className={`p-3 rounded-lg border ${
                    keySyncMessage.type === 'success'
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-green-700 dark:text-green-400'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400'
                  }`}
                >
                  {keySyncMessage.text}
                </div>
              )}

              {/* Info Box */}
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400">
                <p className="font-medium mb-1">💡 How it works:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>System tries keys in order until one succeeds</li>
                  <li>Auto-rotates on rate limits (429) or invalid keys (401)</li>
                  <li>Exhausted keys are marked in red (3+ errors or invalid/expired)</li>
                  <li>Enable auto-remove to clean up bad keys automatically</li>
                </ul>
              </div>
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
                  Minimum Video Duration per Channel (HH:MM:SS)
                </label>
                <div className="space-y-3">
                  {localSettings.channelUrls.map((channelUrl, index) => {
                    const currentDurationMinutes = localSettings.channelMinDurations[channelUrl] || 1;
                    // Convert minutes to HH:MM:SS
                    const hours = Math.floor(currentDurationMinutes / 60);
                    const minutes = Math.floor(currentDurationMinutes % 60);
                    const seconds = Math.floor((currentDurationMinutes % 1) * 60);
                    const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

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
                            type="text"
                            value={timeString}
                            placeholder="00:27:00"
                            onChange={(e) => {
                              const value = e.target.value;
                              // Parse HH:MM:SS to minutes
                              const parts = value.split(':').map(p => parseInt(p) || 0);
                              if (parts.length === 3) {
                                const [h, m, s] = parts;
                                const totalMinutes = h * 60 + m + s / 60;
                                setLocalSettings({
                                  ...localSettings,
                                  channelMinDurations: {
                                    ...localSettings.channelMinDurations,
                                    [channelUrl]: totalMinutes > 0 ? totalMinutes : 1,
                                  },
                                });
                              }
                            }}
                            className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Set minimum video duration for each channel (format: HH:MM:SS, e.g., 00:27:00 for 27 minutes). Videos shorter than this will not appear in the grid.
                </p>
              </div>
            )}
          </div>

          {/* Target Channels (Your Own Channels) */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Target Channels</h3>
              <button
                onClick={() => {
                  setEditingChannelId(null);
                  setChannelName('');
                  setChannelDescription('');
                  setShowAddChannelModal(true);
                }}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
              >
                <Plus size={16} />
                Add Channel
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Configure your own YouTube channels where processed videos will be published. You can process the same video for multiple target channels.
            </p>

            {localSettings.targetChannels.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400 mb-2">No target channels configured</p>
                <p className="text-sm text-gray-400 dark:text-gray-500">Add your first target channel to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {localSettings.targetChannels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-start justify-between p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                        {channel.name}
                      </h4>
                      {channel.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {channel.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <button
                        onClick={() => handleEditChannel(channel)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Edit"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
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

          {/* Auto-Monitoring Settings */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">24/7 Auto-Monitoring</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically monitor channels and process new videos every 2 hours
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoMonitoringEnabled}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, autoMonitoringEnabled: e.target.checked })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Check Interval
              </label>
              <select
                value={localSettings.monitoringIntervalHours}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, monitoringIntervalHours: parseInt(e.target.value) })
                }
                disabled={!localSettings.autoMonitoringEnabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="1">Every 1 hour</option>
                <option value="2">Every 2 hours (Recommended)</option>
                <option value="4">Every 4 hours</option>
                <option value="6">Every 6 hours</option>
                <option value="12">Every 12 hours</option>
                <option value="24">Every 24 hours</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                How often to check for new videos
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                AI Model for Auto-Processing
              </label>
              <select
                value={localSettings.monitoringAIModel}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, monitoringAIModel: e.target.value as any })
                }
                disabled={!localSettings.autoMonitoringEnabled}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="deepseek">DeepSeek (Fast & Cheap)</option>
                <option value="gemini-flash">Gemini 2.5 Flash (Balanced)</option>
                <option value="gemini-pro">Gemini 2.5 Pro (Best Quality)</option>
                <option value="openrouter">OpenRouter (Customizable)</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Which AI model to use for automatic processing
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-4">
              <p className="text-sm text-green-800 dark:text-green-200 font-bold mb-2">
                ✨ How Auto-Monitoring Works:
              </p>
              <ol className="text-xs text-green-700 dark:text-green-300 space-y-1 list-decimal list-inside ml-2">
                <li>Checks your source channels automatically every {localSettings.monitoringIntervalHours} hours</li>
                <li>Finds new videos that match your duration/view filters</li>
                <li>Fetches transcripts and processes with {localSettings.monitoringAIModel.replace('-', ' ').toUpperCase()}</li>
                <li>Sends processed scripts to Telegram automatically</li>
                <li>Runs 24/7 in the background - no manual work needed!</li>
              </ol>
            </div>

            {localSettings.autoMonitoringEnabled && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200 font-bold mb-2">
                  📋 Setup Required:
                </p>
                <ol className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-decimal list-inside ml-2">
                  <li>Create a free Supabase account at supabase.com</li>
                  <li>Run the database migration (see README_MONITORING.md)</li>
                  <li>Deploy Edge Functions to Supabase</li>
                  <li>Add environment variables: VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY</li>
                  <li>Click "Sync Settings" button to activate monitoring</li>
                </ol>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  📚 Full setup guide: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">README_MONITORING.md</code>
                </p>
              </div>
            )}
          </div>

          {/* Backup & Restore - Database Sync */}
          <BackupRestoreSection />

        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          {/* Setup Progress/Message */}
          {setupMessage && (
            <div
              className={`mb-4 p-4 rounded-lg border-2 flex items-start gap-3 ${
                setupMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                  : setupMessage.type === 'error'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
              }`}
            >
              {isSettingUp && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />}
              <p
                className={`text-sm font-medium ${
                  setupMessage.type === 'success'
                    ? 'text-green-800 dark:text-green-200'
                    : setupMessage.type === 'error'
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-blue-800 dark:text-blue-200'
                }`}
              >
                {setupMessage.text}
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onNavigateHome}
              disabled={isSettingUp}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSettingUp}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSettingUp && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSettingUp ? 'Setting up...' : 'Save Settings'}
            </button>
          </div>
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

      {/* Add/Edit Target Channel Modal */}
      {showAddChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {editingChannelId ? 'Edit Target Channel' : 'Add Target Channel'}
              </h3>
              <button
                onClick={() => {
                  setShowAddChannelModal(false);
                  setEditingChannelId(null);
                  setChannelName('');
                  setChannelDescription('');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Channel Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && channelName.trim()) {
                      handleAddOrEditChannel();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., My Tech Channel"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px] resize-y"
                  placeholder="Add a description to help identify this channel..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddChannelModal(false);
                  setEditingChannelId(null);
                  setChannelName('');
                  setChannelDescription('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOrEditChannel}
                disabled={!channelName.trim()}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  !channelName.trim()
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {editingChannelId ? 'Update' : 'Add'} Channel
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
