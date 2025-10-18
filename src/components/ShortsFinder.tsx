import { useState } from 'react';
import { Scissors, Loader2, AlertCircle, X } from 'lucide-react';
import VideoGrid from './VideoGrid';
import ShortsResults from './ShortsResults';
import { YouTubeVideo } from '../services/youtubeAPI';
import { fetchYouTubeTranscript } from '../services/supaDataAPI';
import { analyzeShortsFromTranscript } from '../services/shortsAnalyzer';
import { ShortSegment } from '../types/shorts';
import { useSettingsStore } from '../stores/settingsStore';

interface ShortsFinderProps {
  onClose: () => void;
}

type ViewState = 'videos' | 'processing' | 'results';

export default function ShortsFinder({ onClose }: ShortsFinderProps) {
  const { settings } = useSettingsStore();

  const [currentView, setCurrentView] = useState<ViewState>('videos');
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [shorts, setShorts] = useState<ShortSegment[]>([]);
  const [error, setError] = useState<string>('');
  const [processingStep, setProcessingStep] = useState<string>('');

  const handleVideoClick = async (
    videoUrl: string,
    videoTitle?: string,
    _videoIndex?: number,
    _totalVideos?: number,
    channelTitle?: string
  ) => {
    console.log('🎬 Starting shorts analysis for:', videoTitle);

    // Validate API keys
    if (!settings.supaDataApiKey) {
      setError('SupaData API key not configured. Please add it in Settings.');
      return;
    }

    if (!settings.openRouterApiKey) {
      setError('OpenRouter API key not configured. Please add it in Settings.');
      return;
    }

    // Store video info
    const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : '';

    setSelectedVideo({
      videoId: videoId,
      title: videoTitle || 'Untitled Video',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt: new Date().toISOString(),
      channelTitle: channelTitle || 'Unknown Channel',
      channelId: '',
      description: '',
      duration: '',
      durationSeconds: 0,
      viewCount: '0',
    });

    setError('');
    setCurrentView('processing');

    try {
      // Step 1: Fetch transcript
      setProcessingStep('Fetching video transcript...');
      console.log('📝 Fetching transcript from SupaData...');

      const transcriptResponse = await fetchYouTubeTranscript(videoUrl, settings.supaDataApiKey);

      if (transcriptResponse.error) {
        throw new Error(transcriptResponse.error);
      }

      if (!transcriptResponse.transcript) {
        throw new Error('No transcript available for this video');
      }

      console.log(`✓ Transcript fetched: ${transcriptResponse.transcript.length} characters`);

      // Step 2: Analyze shorts
      setProcessingStep('Analyzing transcript for best shorts...');
      console.log('🤖 Analyzing with AI for best shorts...');

      const analysisResponse = await analyzeShortsFromTranscript(
        transcriptResponse.transcript,
        settings.openRouterApiKey,
        settings.selectedOpenRouterModel
      );

      if (analysisResponse.error) {
        throw new Error(analysisResponse.error);
      }

      if (analysisResponse.shorts.length === 0) {
        throw new Error(
          'No suitable short segments found. This video may not have good 30-60 second viral moments.'
        );
      }

      setShorts(analysisResponse.shorts);
      console.log(`✅ Found ${analysisResponse.shorts.length} potential shorts!`);

      setCurrentView('results');
    } catch (err) {
      console.error('❌ Error processing video:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setCurrentView('videos');
    }
  };

  const handleBackToVideos = () => {
    setCurrentView('videos');
    setSelectedVideo(null);
    setShorts([]);
    setError('');
    setProcessingStep('');
  };

  // Render processing state
  if (currentView === 'processing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-purple-100 dark:bg-purple-900 rounded-full mb-6">
              <Loader2 className="w-10 h-10 text-purple-600 dark:text-purple-400 animate-spin" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Finding Best Shorts
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-6">{processingStep}</p>

            {selectedVideo && (
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">
                  {selectedVideo.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedVideo.channelTitle}
                </p>
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
                <span>This may take 30-60 seconds...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render results state
  if (currentView === 'results' && selectedVideo) {
    return (
      <ShortsResults
        shorts={shorts}
        videoUrl={`https://www.youtube.com/watch?v=${selectedVideo.videoId}`}
        videoTitle={selectedVideo.title}
        onBack={handleBackToVideos}
      />
    );
  }

  // Render videos list state
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-white bg-opacity-20 rounded-xl">
                  <Scissors className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Shorts Finder</h1>
                  <p className="text-white text-opacity-90 text-sm sm:text-base">
                    Find the best 30-60 second viral moments from any video
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900 dark:bg-opacity-20 border-b border-red-200 dark:border-red-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 dark:text-red-200 font-medium">Error</p>
                <p className="text-red-600 dark:text-red-300 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900 dark:bg-opacity-20 border-b border-blue-200 dark:border-blue-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Scissors className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-blue-900 dark:text-blue-100 font-semibold">How it works</p>
              <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                Click on any video below to analyze it. We'll identify the best 30-60 second segments
                based on viral potential, emotional peaks, topics, and storytelling. Each segment gets a
                score, title suggestion, and timestamps!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <VideoGrid
          onVideoSelect={handleVideoClick}
          onBatchSelect={() => {}} // Not needed for shorts finder
        />
      </div>
    </div>
  );
}
