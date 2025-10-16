import { Settings } from '../stores/settingsStore';
import { ProcessedLink } from '../stores/historyStore';
import { QueuedScript } from '../stores/tempQueueStore';

export interface BackupData {
  version: string;
  timestamp: string;
  settings: Settings;
  history: ProcessedLink[];
  queue: QueuedScript[];
  counter: number;
}

/**
 * Create a backup of all data
 */
export const createBackup = (
  settings: Settings,
  history: ProcessedLink[],
  queue: QueuedScript[],
  counter: number
): BackupData => {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    settings,
    history,
    queue,
    counter,
  };
};

/**
 * Download backup as JSON file
 */
export const downloadBackup = (backup: BackupData) => {
  const dataStr = JSON.stringify(backup, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `youtube-processor-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Read and parse backup file
 */
export const readBackupFile = (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backup = JSON.parse(content) as BackupData;

        // Validate backup structure
        if (!backup.version || !backup.settings) {
          throw new Error('Invalid backup file format');
        }

        resolve(backup);
      } catch (error) {
        reject(new Error('Failed to parse backup file: ' + (error as Error).message));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Create settings-only backup (no channels, no history)
 */
export const createSettingsOnlyBackup = (settings: Settings): Partial<Settings> => {
  const {
    channelUrls,
    channelMinDurations,
    ...settingsWithoutChannels
  } = settings;

  return settingsWithoutChannels;
};

/**
 * Restore settings-only (no channels, no history)
 */
export const restoreSettingsOnly = (
  backup: BackupData,
  currentSettings: Settings
): Settings => {
  const settingsOnly = createSettingsOnlyBackup(backup.settings);

  // Keep current channels and channel min durations
  return {
    ...currentSettings,
    ...settingsOnly,
    channelUrls: currentSettings.channelUrls, // Keep existing channels
    channelMinDurations: currentSettings.channelMinDurations, // Keep existing channel settings
  };
};

/**
 * Restore full backup (everything)
 */
export const restoreFullBackup = (backup: BackupData): {
  settings: Settings;
  history: ProcessedLink[];
  queue: QueuedScript[];
  counter: number;
} => {
  return {
    settings: backup.settings,
    history: backup.history || [],
    queue: backup.queue || [],
    counter: backup.counter || 0,
  };
};
