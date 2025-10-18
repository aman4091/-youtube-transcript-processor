import React, { useState, useRef } from 'react';
import { Upload, FileText, Sparkles, X, RefreshCw, Home, Loader2 } from 'lucide-react';
import { processUploadedFile, isValidFileType, formatFileSize, FileProcessResult } from '../utils/fileProcessor';
import { formatCharacterCount } from '../utils/characterCounter';
import { useSettingsStore } from '../stores/settingsStore';
import { useTempQueueStore } from '../stores/tempQueueStore';
import { useScriptCounterStore } from '../stores/scriptCounterStore';
import { processWithOpenRouter } from '../services/aiProcessors';

interface TitleCreationPageProps {
  onClose: () => void;
}

export default function TitleCreationPage({ onClose }: TitleCreationPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileProcessResult | null>(null);
  const [scriptContent, setScriptContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { settings } = useSettingsStore();
  const { addToQueue } = useTempQueueStore();
  const { getNextCounter } = useScriptCounterStore();

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setError(null);

    // Validate file type
    if (!isValidFileType(file)) {
      setError('Invalid file type. Please upload .txt, .docx, or .pdf files.');
      return;
    }

    // Process file
    const result = await processUploadedFile(file);

    if (result.error) {
      setError(result.error);
      return;
    }

    setFileInfo(result);
    setScriptContent(result.content);
    setGeneratedTitles([]);
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  // Handle browse button
  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  // Generate titles
  const handleGenerateTitles = async () => {
    if (!scriptContent.trim()) {
      setError('No script content available');
      return;
    }

    if (!settings.openRouterApiKey) {
      setError('OpenRouter API key not configured. Please add it in Settings.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const prompt = settings.titlePrompt || 'Generate 10 catchy, engaging video titles for the following script. Return only a numbered list (1. Title, 2. Title, etc.)';

      const response = await processWithOpenRouter(
        prompt,
        scriptContent,
        settings.openRouterApiKey,
        settings.selectedOpenRouterModel
      );

      const titles = extractTitlesFromResponse(response.content);

      if (titles.length === 0) {
        throw new Error('No titles found in response');
      }

      setGeneratedTitles(titles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate titles');
    } finally {
      setIsGenerating(false);
    }
  };

  // Extract titles from AI response
  const extractTitlesFromResponse = (response: string): string[] => {
    const lines = response.split('\n');
    const titles: string[] = [];

    for (const line of lines) {
      const match = line.match(/^\d+\.\s*(.+)$/);
      if (match) {
        let title = match[1].trim();
        // Remove quotes and asterisks
        title = title.replace(/^["']|["']$/g, '');
        title = title.replace(/^\*+|\*+$/g, '');
        titles.push(title);
      }
    }

    return titles;
  };

  // Handle title selection
  const handleSelectTitle = (title: string) => {
    const counter = getNextCounter();

    addToQueue(
      scriptContent,
      'Manual Upload',
      counter,
      fileInfo?.fileName || 'Uploaded Script',
      undefined,
      title
    );

    alert(`Title selected and added to queue!\n\nScript #${counter}\nTitle: ${title}\n\nClick "Push to Chat" to send to Telegram.`);

    // Reset for next upload
    handleClearAll();
  };

  // Clear all
  const handleClearAll = () => {
    setFileInfo(null);
    setScriptContent('');
    setGeneratedTitles([]);
    setError(null);
    setIsEditing(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Title Creation
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Upload script & generate AI-powered titles
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* File Upload Section */}
        {!fileInfo && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Script File
            </h2>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
                isDragging
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
              }`}
              onClick={handleBrowseClick}
            >
              <div className="flex flex-col items-center gap-4">
                <div className="bg-purple-100 dark:bg-purple-900/50 p-4 rounded-full">
                  <FileText className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Drag & drop your script file here
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    or click to browse
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Supported formats: .txt, .docx, .pdf (Max 10MB)
                  </p>
                </div>
                <button className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium">
                  Browse Files
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* File Info & Script Preview */}
        {fileInfo && (
          <div className="space-y-6">
            {/* File Info */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Uploaded File
                </h2>
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                >
                  <X className="w-4 h-4" />
                  Clear & Upload New
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">File Name</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {fileInfo.fileName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">File Size</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {formatFileSize(fileInfo.fileSize)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Characters</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">
                    {formatCharacterCount(scriptContent.length)}
                  </p>
                </div>
              </div>
            </div>

            {/* Script Preview/Edit */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Script Content
                </h2>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                >
                  {isEditing ? 'Done Editing' : 'Edit Script'}
                </button>
              </div>

              {isEditing ? (
                <textarea
                  value={scriptContent}
                  onChange={(e) => setScriptContent(e.target.value)}
                  className="w-full h-96 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Edit your script here..."
                />
              ) : (
                <div className="h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
                    {scriptContent}
                  </pre>
                </div>
              )}
            </div>

            {/* Title Generation Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Generate Titles
                </h2>
                {!isGenerating && generatedTitles.length === 0 && (
                  <button
                    onClick={handleGenerateTitles}
                    disabled={!scriptContent.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-lg transition-all font-medium disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate 10 Titles
                  </button>
                )}
              </div>

              {isGenerating && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Generating titles with AI...</p>
                </div>
              )}

              {!isGenerating && generatedTitles.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {generatedTitles.map((title, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-shadow"
                      >
                        <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-purple-600 text-white rounded-full text-sm font-bold">
                          {index + 1}
                        </span>
                        <p className="flex-1 text-gray-800 dark:text-white font-medium pt-1">
                          {title}
                        </p>
                        <button
                          onClick={() => handleSelectTitle(title)}
                          className="flex-shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Select
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={handleGenerateTitles}
                      disabled={isGenerating}
                      className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium disabled:cursor-not-allowed"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Get 10 More Titles
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                    >
                      Skip & Start Over
                    </button>
                  </div>
                </div>
              )}

              {!isGenerating && generatedTitles.length === 0 && (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Click "Generate 10 Titles" to create AI-powered titles for your script</p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
