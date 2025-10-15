import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProcessedLink {
  url: string;
  processedAt: string;
  savedOutput?: string;
  videoId?: string;
  title?: string;
  thumbnail?: string;
  channelTitle?: string;
}

interface HistoryStore {
  processedLinks: ProcessedLink[];
  addProcessedLink: (url: string, videoId?: string, title?: string, thumbnail?: string, channelTitle?: string) => void;
  isLinkProcessed: (url: string) => boolean;
  saveOutput: (url: string, output: string) => void;
  clearHistory: () => void;
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      processedLinks: [],
      addProcessedLink: (url, videoId, title, thumbnail, channelTitle) => {
        const exists = get().processedLinks.find((link) => link.url === url);
        if (!exists) {
          set((state) => ({
            processedLinks: [
              { url, processedAt: new Date().toISOString(), videoId, title, thumbnail, channelTitle },
              ...state.processedLinks,
            ],
          }));
        }
      },
      isLinkProcessed: (url) => {
        return get().processedLinks.some((link) => link.url === url);
      },
      saveOutput: (url, output) => {
        set((state) => ({
          processedLinks: state.processedLinks.map((link) =>
            link.url === url ? { ...link, savedOutput: output } : link
          ),
        }));
      },
      clearHistory: () => set({ processedLinks: [] }),
    }),
    {
      name: 'youtube-processor-history',
    }
  )
);
