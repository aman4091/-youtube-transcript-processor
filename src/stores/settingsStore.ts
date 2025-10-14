import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Settings {
  supaDataApiKey: string;
  deepSeekApiKey: string;
  geminiApiKey: string;
  openRouterApiKey: string;
  youtubeApiKey: string;
  channelUrls: string[]; // Changed from single string to array
  customPrompt: string;
  selectedOpenRouterModel: string;
  // Google Drive settings
  googleDriveAccessToken: string;
  googleDriveFolderId: string;
  enableDriveUpload: boolean;
  // Model enable/disable toggles
  enableDeepSeek: boolean;
  enableGeminiFlash: boolean;
  enableGeminiPro: boolean;
  enableOpenRouter: boolean;
  // Video sort order
  videoSortOrder: 'date' | 'popular';
}

interface SettingsStore {
  settings: Settings;
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  supaDataApiKey: '',
  deepSeekApiKey: '',
  geminiApiKey: '',
  openRouterApiKey: '',
  youtubeApiKey: '',
  channelUrls: [], // Changed to array
  customPrompt: '',
  selectedOpenRouterModel: 'meta-llama/llama-3.1-8b-instruct:free',
  // Google Drive defaults
  googleDriveAccessToken: '',
  googleDriveFolderId: '',
  enableDriveUpload: false,
  // Model toggles - all enabled by default
  enableDeepSeek: true,
  enableGeminiFlash: true,
  enableGeminiPro: true,
  enableOpenRouter: true,
  // Video sort - popular by default
  videoSortOrder: 'popular',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      updateSettings: (newSettings) => {
        console.log('💾 Saving settings to localStorage:', newSettings);
        set((state) => {
          const updatedSettings = { ...state.settings, ...newSettings };
          console.log('✓ Settings updated:', updatedSettings);
          return { settings: updatedSettings };
        });
      },
      resetSettings: () => {
        console.log('🔄 Resetting settings to default');
        set({ settings: defaultSettings });
      },
    }),
    {
      name: 'youtube-processor-settings',
      version: 4,
      migrate: (persistedState: any, version: number) => {
        console.log(`🔧 Migrating settings from version ${version}`);
        // Migrate old channelUrl (string) to channelUrls (array)
        if (version === 0 && persistedState?.settings?.channelUrl) {
          const oldUrl = persistedState.settings.channelUrl;
          delete persistedState.settings.channelUrl;
          persistedState.settings.channelUrls = oldUrl ? [oldUrl] : [];
        }
        // Migrate to version 2 - add Google Drive settings if missing
        if (version < 2) {
          persistedState.settings.googleDriveAccessToken = persistedState.settings.googleDriveAccessToken || '';
          persistedState.settings.googleDriveFolderId = persistedState.settings.googleDriveFolderId || '';
          persistedState.settings.enableDriveUpload = persistedState.settings.enableDriveUpload || false;
        }
        // Migrate to version 3 - add model toggles if missing
        if (version < 3) {
          persistedState.settings.enableDeepSeek = persistedState.settings.enableDeepSeek ?? true;
          persistedState.settings.enableGeminiFlash = persistedState.settings.enableGeminiFlash ?? true;
          persistedState.settings.enableGeminiPro = persistedState.settings.enableGeminiPro ?? true;
          persistedState.settings.enableOpenRouter = persistedState.settings.enableOpenRouter ?? true;
        }
        // Migrate to version 4 - add video sort order
        if (version < 4) {
          persistedState.settings.videoSortOrder = persistedState.settings.videoSortOrder || 'popular';
        }
        console.log('✓ Settings migrated successfully');
        return persistedState;
      },
      onRehydrateStorage: () => {
        console.log('🔄 Loading settings from localStorage...');
        return (state, error) => {
          if (error) {
            console.error('✗ Failed to load settings from localStorage:', error);
          } else {
            console.log('✓ Settings loaded from localStorage:', state?.settings);
          }
        };
      },
    }
  )
);
