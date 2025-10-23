import { useState } from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';

interface ConflictModalProps {
  storeType: 'settings' | 'counter';
  localData: any;
  serverData: any;
  onResolve: (choice: 'local' | 'server') => void;
  onClose: () => void;
}

export default function ConflictModal({
  storeType,
  localData,
  serverData,
  onResolve,
  onClose,
}: ConflictModalProps) {
  const [selectedChoice, setSelectedChoice] = useState<'local' | 'server' | null>(null);

  const handleConfirm = () => {
    if (selectedChoice) {
      onResolve(selectedChoice);
      onClose();
    }
  };

  const renderDataPreview = (data: any, label: string) => {
    if (storeType === 'counter') {
      return (
        <div className="p-4 bg-gray-700 rounded-lg">
          <div className="text-center">
            <div className="text-3xl font-bold text-white mb-2">{data}</div>
            <div className="text-sm text-gray-400">{label}</div>
          </div>
        </div>
      );
    }

    // For settings, show a summary
    return (
      <div className="p-4 bg-gray-700 rounded-lg space-y-2 max-h-64 overflow-y-auto">
        <div className="text-sm text-gray-300 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-400">Source Channels:</span>
            <span className="font-medium">{data.source_channels?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target Channels:</span>
            <span className="font-medium">{data.target_channels?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">SupaData Keys:</span>
            <span className="font-medium">{data.api_keys?.supaDataApiKeys?.length || 0}</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">{label}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-yellow-600">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700 bg-gradient-to-r from-yellow-900/50 to-orange-900/50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="text-xl font-bold text-white">Data Conflict Detected</h2>
              <p className="text-sm text-gray-300 mt-1">
                Your local data differs from server. Choose which version to keep.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Local Data */}
            <button
              onClick={() => setSelectedChoice('local')}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${
                  selectedChoice === 'local'
                    ? 'border-blue-500 bg-blue-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  💻 Local Data (This Device)
                  {selectedChoice === 'local' && (
                    <Check className="w-5 h-5 text-blue-400" />
                  )}
                </h3>
              </div>
              {renderDataPreview(localData, 'Currently on this device')}
            </button>

            {/* Server Data */}
            <button
              onClick={() => setSelectedChoice('server')}
              className={`
                p-4 rounded-lg border-2 transition-all
                ${
                  selectedChoice === 'server'
                    ? 'border-green-500 bg-green-900/20'
                    : 'border-gray-600 hover:border-gray-500'
                }
              `}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  ☁️ Server Data (Database)
                  {selectedChoice === 'server' && (
                    <Check className="w-5 h-5 text-green-400" />
                  )}
                </h3>
              </div>
              {renderDataPreview(serverData, 'Latest from database')}
            </button>
          </div>

          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
            <p className="text-sm text-yellow-200">
              <AlertTriangle className="w-4 h-4 inline mr-2" />
              <strong>Warning:</strong> The version you don't choose will be permanently overwritten.
              Make sure to select the correct one.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-700 bg-gray-900">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedChoice}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-400 transition-colors flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Confirm Choice
          </button>
        </div>
      </div>
    </div>
  );
}
