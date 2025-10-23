import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncHistory } from '../services/userDataSync';

export interface TargetChannelProcessing {
  targetChannelId: string;
  targetChannelName: string;
  processedAt: string;
  savedOutput?: string;
  isScheduled?: boolean;
  scheduleDate?: string;
  slotNumber?: number;
}

export interface ProcessedLink {
  url: string;
  videoId?: string;
  title?: string;
  thumbnail?: string;
  channelTitle?: string;
  targetChannelProcessings: TargetChannelProcessing[];
}

interface HistoryStore {
  processedLinks: ProcessedLink[];
  addProcessedLink: (
    url: string,
    targetChannelId: string,
    targetChannelName: string,
    videoId?: string,
    title?: string,
    thumbnail?: string,
    channelTitle?: string,
    isScheduled?: boolean,
    scheduleDate?: string,
    slotNumber?: number
  ) => void;
  isLinkProcessed: (url: string, targetChannelId?: string) => boolean;
  saveOutput: (url: string, targetChannelId: string, output: string) => void;
  clearHistory: () => void;
  removeProcessing: (url: string, targetChannelId: string) => void;
  removeVideoCompletely: (url: string) => void;
  getProcessingsForVideo: (url: string) => TargetChannelProcessing[];
  getAllProcessedVideosForChannel: (targetChannelId: string) => ProcessedLink[];
  restoreHistory: (links: ProcessedLink[]) => void;
  syncToDatabase: (user_id: string) => Promise<void>;
}

// Helper to auto-sync to database
const autoSyncHistory = (get: () => HistoryStore) => {
  const user_id = localStorage.getItem('user-storage');
  if (user_id) {
    try {
      const userData = JSON.parse(user_id);
      if (userData?.state?.user?.id) {
        syncHistory(userData.state.user.id, get().processedLinks).catch((err) =>
          console.error('History sync error:', err)
        );
      }
    } catch (e) {
      // Ignore
    }
  }
};

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      processedLinks: [],

      addProcessedLink: (url, targetChannelId, targetChannelName, videoId, title, thumbnail, channelTitle, isScheduled, scheduleDate, slotNumber) => {
        const existingVideo = get().processedLinks.find((link) => link.url === url);

        if (existingVideo) {
          // Video exists, add/update processing for this target channel
          const existingProcessing = existingVideo.targetChannelProcessings.find(
            (p) => p.targetChannelId === targetChannelId
          );

          if (!existingProcessing) {
            // Add new processing for this target channel
            set((state) => ({
              processedLinks: state.processedLinks.map((link) =>
                link.url === url
                  ? {
                      ...link,
                      targetChannelProcessings: [
                        ...link.targetChannelProcessings,
                        {
                          targetChannelId,
                          targetChannelName,
                          processedAt: new Date().toISOString(),
                          isScheduled,
                          scheduleDate,
                          slotNumber,
                        },
                      ],
                    }
                  : link
              ),
            }));
            autoSyncHistory(get);
          }
        } else {
          // Video doesn't exist, create new entry
          set((state) => ({
            processedLinks: [
              {
                url,
                videoId,
                title,
                thumbnail,
                channelTitle,
                targetChannelProcessings: [
                  {
                    targetChannelId,
                    targetChannelName,
                    processedAt: new Date().toISOString(),
                    isScheduled,
                    scheduleDate,
                    slotNumber,
                  },
                ],
              },
              ...state.processedLinks,
            ],
          }));
          autoSyncHistory(get);
        }
      },

      isLinkProcessed: (url, targetChannelId) => {
        const video = get().processedLinks.find((link) => link.url === url);
        if (!video) return false;

        if (targetChannelId) {
          // Check if processed for specific target channel
          return video.targetChannelProcessings.some((p) => p.targetChannelId === targetChannelId);
        } else {
          // Check if processed for any target channel
          return video.targetChannelProcessings.length > 0;
        }
      },

      saveOutput: (url, targetChannelId, output) => {
        set((state) => ({
          processedLinks: state.processedLinks.map((link) =>
            link.url === url
              ? {
                  ...link,
                  targetChannelProcessings: link.targetChannelProcessings.map((p) =>
                    p.targetChannelId === targetChannelId ? { ...p, savedOutput: output } : p
                  ),
                }
              : link
          ),
        }));
      },

      removeProcessing: (url, targetChannelId) => {
        set((state) => ({
          processedLinks: state.processedLinks
            .map((link) => {
              if (link.url === url) {
                const updatedProcessings = link.targetChannelProcessings.filter(
                  (p) => p.targetChannelId !== targetChannelId
                );

                // If no more processings for any target channel, remove the video completely
                if (updatedProcessings.length === 0) {
                  return null;
                }

                return {
                  ...link,
                  targetChannelProcessings: updatedProcessings,
                };
              }
              return link;
            })
            .filter((link): link is ProcessedLink => link !== null),
        }));
      },

      removeVideoCompletely: (url) => {
        set((state) => ({
          processedLinks: state.processedLinks.filter((link) => link.url !== url),
        }));
      },

      getProcessingsForVideo: (url) => {
        const video = get().processedLinks.find((link) => link.url === url);
        return video?.targetChannelProcessings || [];
      },

      getAllProcessedVideosForChannel: (targetChannelId) => {
        return get().processedLinks.filter((link) =>
          link.targetChannelProcessings.some((p) => p.targetChannelId === targetChannelId)
        );
      },

      clearHistory: () => {
        set({ processedLinks: [] });
        autoSyncHistory(get);
      },

      restoreHistory: (links) => set({ processedLinks: links }),

      syncToDatabase: async (user_id: string) => {
        await syncHistory(user_id, get().processedLinks);
      },
    }),
    {
      name: 'youtube-processor-history',
      version: 3,
      migrate: (persistedState: any, version: number) => {
        console.log(`🔧 Migrating history from version ${version}`);

        // Migrate from version 1 to version 2 - convert old structure to new
        if (version < 2) {
          const oldLinks = persistedState?.processedLinks || [];
          const newLinks = oldLinks.map((oldLink: any) => {
            // If already has targetChannelProcessings, keep it
            if (oldLink.targetChannelProcessings) {
              return oldLink;
            }

            // Convert old structure to new
            const processing: TargetChannelProcessing = {
              targetChannelId: 'default',
              targetChannelName: 'Default Channel',
              processedAt: oldLink.processedAt || new Date().toISOString(),
              savedOutput: oldLink.savedOutput,
            };

            return {
              url: oldLink.url,
              videoId: oldLink.videoId,
              title: oldLink.title,
              thumbnail: oldLink.thumbnail,
              channelTitle: oldLink.channelTitle,
              targetChannelProcessings: [processing],
            };
          });

          persistedState.processedLinks = newLinks;
        }

        console.log('✓ History migrated successfully');
        return persistedState;
      },
    }
  )
);
