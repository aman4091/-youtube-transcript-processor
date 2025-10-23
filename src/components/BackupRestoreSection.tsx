import { useState } from 'react';
import { Download, Upload, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useUserStore } from '../stores/userStore';
import { exportBackup, importBackup, type BackupData } from '../services/userDataSync';

export default function BackupRestoreSection() {
  const user = useUserStore((state) => state.user);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Export backup
  const handleExport = async () => {
    if (!user) {
      setMessage({ type: 'error', text: 'User not logged in' });
      return;
    }

    try {
      setIsExporting(true);
      setMessage(null);

      const result = await exportBackup(user.id);

      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to export backup');
      }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `youtube-processor-backup-${user.username}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({
        type: 'success',
        text: `Backup exported successfully! (${result.data.metadata.total_history} history + ${result.data.metadata.total_queue} queue items)`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to export backup' });
    } finally {
      setIsExporting(false);
    }
  };

  // Import backup
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) {
      setMessage({ type: 'error', text: 'User not logged in' });
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setMessage(null);

      // Read file as JSON
      const text = await file.text();
      const backup: BackupData = JSON.parse(text);

      // Validate backup format
      if (!backup.version || !backup.data) {
        throw new Error('Invalid backup file format');
      }

      // Confirm before importing
      const confirmed = confirm(
        `This will replace all your current data with the backup from ${new Date(backup.exported_at).toLocaleDateString()}.\n\n` +
          `History: ${backup.metadata.total_history} items\n` +
          `Queue: ${backup.metadata.total_queue} items\n\n` +
          `Are you sure you want to continue?`
      );

      if (!confirmed) {
        setIsImporting(false);
        return;
      }

      // Import backup
      const result = await importBackup(user.id, backup, 'replace');

      if (!result.success) {
        throw new Error(result.error || 'Failed to import backup');
      }

      setMessage({
        type: 'success',
        text: `Backup restored successfully! ${result.restored?.history || 0} history + ${result.restored?.queue || 0} queue items restored.`,
      });

      // Reload page to refresh all stores
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Import error:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to import backup' });
    } finally {
      setIsImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">💾 Backup & Restore</h3>

      <div className="space-y-4">
        {/* Export Button */}
        <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
          <div>
            <p className="text-white font-medium">Export Backup</p>
            <p className="text-sm text-gray-400 mt-1">
              Download all your data as a JSON file
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Export
              </>
            )}
          </button>
        </div>

        {/* Import Button */}
        <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
          <div>
            <p className="text-white font-medium">Import Backup</p>
            <p className="text-sm text-gray-400 mt-1">
              Restore data from a previously exported backup
            </p>
          </div>
          <label className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors flex items-center gap-2">
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import
              </>
            )}
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              disabled={isImporting}
              className="hidden"
            />
          </label>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`
              p-4 rounded-lg flex items-start gap-3
              ${
                message.type === 'success'
                  ? 'bg-green-900/20 border border-green-700 text-green-400'
                  : 'bg-red-900/20 border border-red-700 text-red-400'
              }
            `}
          >
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <p className="text-sm">{message.text}</p>
          </div>
        )}

        {/* Warning */}
        <div className="p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
          <p className="text-sm text-yellow-200">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            <strong>Note:</strong> Importing a backup will replace all your current data.
            Make sure to export a backup first if you want to preserve your current state.
          </p>
        </div>
      </div>
    </div>
  );
}
