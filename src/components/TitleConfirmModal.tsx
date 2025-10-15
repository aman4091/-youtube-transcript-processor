import { X } from 'lucide-react';

interface TitleConfirmModalProps {
  onConfirm: () => void;
  onSkip: () => void;
}

export default function TitleConfirmModal({ onConfirm, onSkip }: TitleConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            Generate Video Titles?
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Do you want to generate video titles for this script?
          </p>

          <div className="flex gap-3">
            <button
              onClick={onConfirm}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Yes, Generate Titles
            </button>
            <button
              onClick={onSkip}
              className="flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
