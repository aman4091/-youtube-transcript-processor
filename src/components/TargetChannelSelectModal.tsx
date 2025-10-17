import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import { useHistoryStore } from '../stores/historyStore';

interface TargetChannelSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  videoTitle: string;
  onSelectChannel: (channelId: string, channelName: string) => void;
}

export const TargetChannelSelectModal: React.FC<TargetChannelSelectModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  videoTitle,
  onSelectChannel,
}) => {
  const { settings } = useSettingsStore();
  const { getProcessingsForVideo } = useHistoryStore();
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');

  if (!isOpen) return null;

  const targetChannels = settings.targetChannels;
  const processings = getProcessingsForVideo(videoUrl);

  const handleConfirm = () => {
    const selectedChannel = targetChannels.find((ch) => ch.id === selectedChannelId);
    if (selectedChannel) {
      onSelectChannel(selectedChannel.id, selectedChannel.name);
      onClose();
    }
  };

  const isProcessedForChannel = (channelId: string) => {
    return processings.some((p) => p.targetChannelId === channelId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start p-6 border-b border-gray-700">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-white mb-2">Select Target Channel</h2>
            <p className="text-sm text-gray-400 line-clamp-2">{videoTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {targetChannels.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto text-yellow-500 mb-4" />
              <p className="text-gray-400 mb-2">No target channels configured</p>
              <p className="text-sm text-gray-500">
                Please add target channels in Settings first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {targetChannels.map((channel) => {
                const isProcessed = isProcessedForChannel(channel.id);
                const processing = processings.find((p) => p.targetChannelId === channel.id);

                return (
                  <div
                    key={channel.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedChannelId === channel.id
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                    onClick={() => setSelectedChannelId(channel.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium">{channel.name}</h3>
                          {isProcessed && (
                            <div className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">
                              <CheckCircle2 size={12} />
                              <span>Processed</span>
                            </div>
                          )}
                        </div>
                        {channel.description && (
                          <p className="text-sm text-gray-400 mb-2">{channel.description}</p>
                        )}
                        {isProcessed && processing && (
                          <p className="text-xs text-gray-500">
                            Last processed: {new Date(processing.processedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <input
                        type="radio"
                        name="targetChannel"
                        checked={selectedChannelId === channel.id}
                        onChange={() => setSelectedChannelId(channel.id)}
                        className="mt-1 ml-4"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedChannelId}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
