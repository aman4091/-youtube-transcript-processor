import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ScriptCounterStore {
  counter: number;
  getNextCounter: () => number;
  setCounter: (value: number) => void;
}

export const useScriptCounterStore = create<ScriptCounterStore>()(
  persist(
    (set, get) => ({
      counter: 0,

      getNextCounter: () => {
        const current = get().counter + 1;
        set({ counter: current });
        console.log(`📊 Counter incremented: ${current}`);
        return current;
      },

      setCounter: (value) => {
        set({ counter: value });
        console.log(`📊 Counter set to: ${value}`);
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
