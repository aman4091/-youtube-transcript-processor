import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { syncCounter } from '../services/userDataSync';

interface ScriptCounterStore {
  counter: number;
  getNextCounter: () => number;
  setCounter: (value: number) => void;
  syncToDatabase: (user_id: string) => Promise<void>;
}

// Helper to auto-sync to database
const autoSyncCounter = (get: () => ScriptCounterStore) => {
  const user_id = localStorage.getItem('user-storage');
  if (user_id) {
    try {
      const userData = JSON.parse(user_id);
      if (userData?.state?.user?.id) {
        syncCounter(userData.state.user.id, get().counter, Date.now()).catch((err) =>
          console.error('Counter sync error:', err)
        );
      }
    } catch (e) {
      // Ignore
    }
  }
};

export const useScriptCounterStore = create<ScriptCounterStore>()(
  persist(
    (set, get) => ({
      counter: 0,

      getNextCounter: () => {
        const current = get().counter + 1;
        set({ counter: current });
        console.log(`📊 Counter incremented: ${current}`);
        autoSyncCounter(get);
        return current;
      },

      setCounter: (value) => {
        set({ counter: value });
        console.log(`📊 Counter set to: ${value}`);
        autoSyncCounter(get);
      },

      syncToDatabase: async (user_id: string) => {
        await syncCounter(user_id, get().counter, Date.now());
      },
    }),
    {
      name: 'youtube-processor-script-counter',
      version: 1,
      onRehydrateStorage: () => {
        console.log('🔄 Loading script counter from localStorage...');
        return (state, error) => {
          if (error) {
            console.error('✗ Failed to load script counter:', error);
          } else {
            console.log(`✓ Script counter loaded: ${state?.counter || 0}`);
          }
        };
      },
    }
  )
);
