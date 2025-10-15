import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueuedScript {
  id: string;
  content: string;
  modelName: string;
  timestamp: number;
  counter: number;
  videoTitle?: string;
  videoUrl?: string;
  generatedTitle?: string; // The AI-generated title (if user selected one)
}

interface TempQueueStore {
  queuedScripts: QueuedScript[];
  addToQueue: (content: string, modelName: string, counter: number, videoTitle?: string, videoUrl?: string, generatedTitle?: string) => void;
  getQueue: () => QueuedScript[];
  clearQueue: () => void;
  getQueueCount: () => number;
  removeFromQueue: (id: string) => void;
  updateGeneratedTitle: (counter: number, title: string) => void;
}

export const useTempQueueStore = create<TempQueueStore>()(
  persist(
    (set, get) => ({
      queuedScripts: [],

      addToQueue: (content, modelName, counter, videoTitle, videoUrl, generatedTitle) => {
        const newScript: QueuedScript = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content,
          modelName,
          timestamp: Date.now(),
          counter,
          videoTitle,
          videoUrl,
          generatedTitle,
        };

        console.log('📝 Adding script to temp queue:', { modelName, counter, videoTitle, generatedTitle });
        set((state) => ({
          queuedScripts: [...state.queuedScripts, newScript],
        }));
        console.log(`✓ Queue updated. Total items: ${get().queuedScripts.length}`);
      },

      updateGeneratedTitle: (counter, title) => {
        console.log(`📝 Updating generated title for counter: ${counter}`);
        set((state) => ({
          queuedScripts: state.queuedScripts.map((script) =>
            script.counter === counter ? { ...script, generatedTitle: title } : script
          ),
        }));
        console.log('✓ Generated title updated');
      },

      getQueue: () => {
        // Return sorted by timestamp (oldest first)
        return [...get().queuedScripts].sort((a, b) => a.timestamp - b.timestamp);
      },

      clearQueue: () => {
        console.log('🗑️ Clearing temp queue');
        set({ queuedScripts: [] });
        console.log('✓ Queue cleared');
      },

      getQueueCount: () => {
        return get().queuedScripts.length;
      },

      removeFromQueue: (id) => {
        console.log(`🗑️ Removing item from queue: ${id}`);
        set((state) => ({
          queuedScripts: state.queuedScripts.filter((script) => script.id !== id),
        }));
        console.log(`✓ Item removed. Remaining: ${get().queuedScripts.length}`);
      },
    }),
    {
      name: 'youtube-processor-temp-queue',
      version: 1,
      onRehydrateStorage: () => {
        console.log('🔄 Loading temp queue from localStorage...');
        return (state, error) => {
          if (error) {
            console.error('✗ Failed to load temp queue:', error);
          } else {
            console.log(`✓ Temp queue loaded: ${state?.queuedScripts?.length || 0} items`);
          }
        };
      },
    }
  )
);
