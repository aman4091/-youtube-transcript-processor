import { useState } from 'react';
import InputSection from './components/InputSection';
import SettingsModal from './components/SettingsModal';
import ProcessingStatus from './components/ProcessingStatus';
import SideBySideComparison from './components/SideBySideComparison';
import VideoGrid from './components/VideoGrid';
import TranscriptApproval from './components/TranscriptApproval';
import { useSettingsStore } from './stores/settingsStore';
import { useHistoryStore } from './stores/historyStore';
import { fetchYouTubeTranscript } from './services/supaDataAPI';
import { fetchMultipleChannelsVideos, YouTubeVideo } from './services/youtubeAPI';
import {
  processWithDeepSeek,
  processWithGeminiFlash,
  processWithGeminiPro,
  processWithOpenRouter,
} from './services/aiProcessors';
import { chunkText } from './utils/chunkingService';
import { uploadToGoogleDrive } from './services/googleDriveAPI';

interface ProcessingState {
  isProcessing: boolean;
  status: string;
  currentChunk?: number;
  totalChunks?: number;
  currentVideoIndex?: number;
  totalVideos?: number;
  currentVideoTitle?: string;
}

interface Results {
  transcript: string;
  deepSeek: string;
  geminiFlash: string;
  geminiPro: string;
  openRouter: string;
  deepSeekError?: string;
  geminiFlashError?: string;
  geminiProError?: string;
  openRouterError?: string;
}

function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    status: '',
  });
  const [results, setResults] = useState<Results | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pendingVideos, setPendingVideos] = useState<Array<{ url: string; title: string }>>([]);
  const [isWaitingForUserAction, setIsWaitingForUserAction] = useState(false);

  // New states for transcript approval
  const [showTranscriptApproval, setShowTranscriptApproval] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentVideoInfo, setCurrentVideoInfo] = useState<{
    url: string;
    title?: string;
    channelTitle?: string;
    videoIndex?: number;
    totalVideos?: number;
  } | null>(null);
  const [availableVideos, setAvailableVideos] = useState<YouTubeVideo[]>([]);

  const { settings } = useSettingsStore();
  const { addProcessedLink, saveOutput } = useHistoryStore();

  const handleProcess = async (
    url: string,
    videoTitle?: string,
    videoIndex?: number,
    totalVideos?: number,
    channelTitle?: string
  ) => {
    console.log('═'.repeat(60));
    console.log(`🎬 Starting video processing ${videoIndex ? `[${videoIndex}/${totalVideos}]` : ''}`);
    console.log(`📺 Video: ${videoTitle || url}`);
    console.log('═'.repeat(60));

    setCurrentUrl(url);
    setProcessingState({
      isProcessing: true,
      status: 'Fetching transcript...',
      currentVideoIndex: videoIndex,
      totalVideos: totalVideos,
      currentVideoTitle: videoTitle,
    });
    setResults(null);

    try {
      // Validate API keys
      if (!settings.supaDataApiKey) {
        alert('Please set SupaData API key in settings');
        setProcessingState({ isProcessing: false, status: '' });
        return;
      }

      // Fetch transcript
      console.log('📝 Fetching transcript from SupaData API...');
      const transcriptData = await fetchYouTubeTranscript(url, settings.supaDataApiKey);
      const transcript = transcriptData.transcript;
      console.log(`✓ Transcript fetched: ${transcript.length} characters`);

      if (!transcript) {
        throw new Error('No transcript available for this video');
      }

      // Store transcript and video info for approval
      setCurrentTranscript(transcript);
      setCurrentVideoInfo({
        url,
        title: videoTitle,
        channelTitle,
        videoIndex,
        totalVideos,
      });

      // Show transcript approval UI
      setShowTranscriptApproval(true);
      setProcessingState({ isProcessing: false, status: '' });
      console.log('⏸️ Waiting for user to approve/reject transcript...');

      // Don't process further - wait for user approval
      return;
    } catch (error) {
      console.error('Processing error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setProcessingState({ isProcessing: false, status: '' });
    }
  };

  // New function to continue processing after approval
  const continueProcessing = async () => {
    if (!currentVideoInfo || !currentTranscript) {
      console.error('No transcript or video info to process');
      return;
    }

    const { url, title: videoTitle, videoIndex, totalVideos } = currentVideoInfo;
    const transcript = currentTranscript;

    console.log('✅ User approved transcript, continuing with AI processing...');

    setShowTranscriptApproval(false);
    setProcessingState({
      isProcessing: true,
      status: 'Splitting transcript into chunks...',
      currentVideoIndex: videoIndex,
      totalVideos: totalVideos,
      currentVideoTitle: videoTitle,
    });

    try {
      // Add to history
      addProcessedLink(url);

      // Chunk the transcript
      console.log('✂️ Splitting transcript into chunks...');
      const chunks = chunkText(transcript, 7000);
      console.log(`✓ Created ${chunks.length} chunks`);

      // Initialize results
      const initialResults: Results = {
        transcript,
        deepSeek: '',
        geminiFlash: '',
        geminiPro: '',
        openRouter: '',
      };
      setResults(initialResults);

      // Process ALL chunks in parallel (MASSIVE SPEED BOOST!)
      console.log(`\n🚀 Starting PARALLEL processing of ${chunks.length} chunks...`);
      console.log(`   Models enabled: ${[
        settings.enableDeepSeek && settings.deepSeekApiKey && 'DeepSeek',
        settings.enableGeminiFlash && settings.geminiApiKey && 'Gemini Flash',
        settings.enableGeminiPro && settings.geminiApiKey && 'Gemini Pro',
        settings.enableOpenRouter && settings.openRouterApiKey && 'OpenRouter',
      ].filter(Boolean).join(', ')}`);

      setProcessingState({
        isProcessing: true,
        status: `Processing ${chunks.length} chunks in parallel...`,
        currentChunk: 0,
        totalChunks: chunks.length,
        currentVideoIndex: videoIndex,
        totalVideos: totalVideos,
        currentVideoTitle: videoTitle,
      });

      const prompt = settings.customPrompt || 'Summarize the following text:';

      // Track completed chunks for UI updates
      let completedChunks = 0;

      // Process each chunk (with all enabled models) in parallel
      const chunkPromises = chunks.map(async (chunk, i) => {
        console.log(`\n🔄 Processing chunk ${i + 1}/${chunks.length} (parallel)`);

        const modelPromises: Promise<any>[] = [];

        if (settings.enableDeepSeek && settings.deepSeekApiKey) {
          modelPromises.push(processWithDeepSeek(prompt, chunk, settings.deepSeekApiKey));
        }
        if (settings.enableGeminiFlash && settings.geminiApiKey) {
          modelPromises.push(processWithGeminiFlash(prompt, chunk, settings.geminiApiKey));
        }
        if (settings.enableGeminiPro && settings.geminiApiKey) {
          modelPromises.push(processWithGeminiPro(prompt, chunk, settings.geminiApiKey));
        }
        if (settings.enableOpenRouter && settings.openRouterApiKey) {
          modelPromises.push(
            processWithOpenRouter(
              prompt,
              chunk,
              settings.openRouterApiKey,
              settings.selectedOpenRouterModel
            )
          );
        }

        const modelResults = await Promise.all(modelPromises);

        // Map results back to named models
        let resultIndex = 0;
        const chunkResults = {
          deepSeek: { content: '', model: 'DeepSeek', error: undefined as string | undefined },
          geminiFlash: { content: '', model: 'Gemini 2.5 Flash', error: undefined as string | undefined },
          geminiPro: { content: '', model: 'Gemini 2.5 Pro', error: undefined as string | undefined },
          openRouter: { content: '', model: 'OpenRouter', error: undefined as string | undefined },
        };

        if (settings.enableDeepSeek && settings.deepSeekApiKey) {
          chunkResults.deepSeek = modelResults[resultIndex++];
        }
        if (settings.enableGeminiFlash && settings.geminiApiKey) {
          chunkResults.geminiFlash = modelResults[resultIndex++];
        }
        if (settings.enableGeminiPro && settings.geminiApiKey) {
          chunkResults.geminiPro = modelResults[resultIndex++];
        }
        if (settings.enableOpenRouter && settings.openRouterApiKey) {
          chunkResults.openRouter = modelResults[resultIndex++];
        }

        // Update UI with completed chunk count
        completedChunks++;
        setProcessingState({
          isProcessing: true,
          status: `Processing ${chunks.length} chunks in parallel...`,
          currentChunk: completedChunks,
          totalChunks: chunks.length,
          currentVideoIndex: videoIndex,
          totalVideos: totalVideos,
          currentVideoTitle: videoTitle,
        });

        console.log(`✓ Chunk ${i + 1}/${chunks.length} completed (${completedChunks}/${chunks.length} total)`);
        return chunkResults;
      });

      // Wait for ALL chunks to complete
      const allChunkResults = await Promise.allSettled(chunkPromises);

      // Accumulate results from all chunks
      const allDeepSeek: string[] = [];
      const allGeminiFlash: string[] = [];
      const allGeminiPro: string[] = [];
      const allOpenRouter: string[] = [];

      let deepSeekErr: string | undefined;
      let geminiFlashErr: string | undefined;
      let geminiProErr: string | undefined;
      let openRouterErr: string | undefined;

      allChunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const chunkResults = result.value;

          if (chunkResults.deepSeek.content) allDeepSeek.push(chunkResults.deepSeek.content);
          if (chunkResults.deepSeek.error && !deepSeekErr) deepSeekErr = chunkResults.deepSeek.error;

          if (chunkResults.geminiFlash.content) allGeminiFlash.push(chunkResults.geminiFlash.content);
          if (chunkResults.geminiFlash.error && !geminiFlashErr) geminiFlashErr = chunkResults.geminiFlash.error;

          if (chunkResults.geminiPro.content) allGeminiPro.push(chunkResults.geminiPro.content);
          if (chunkResults.geminiPro.error && !geminiProErr) geminiProErr = chunkResults.geminiPro.error;

          if (chunkResults.openRouter.content) allOpenRouter.push(chunkResults.openRouter.content);
          if (chunkResults.openRouter.error && !openRouterErr) openRouterErr = chunkResults.openRouter.error;
        } else {
          console.error(`✗ Chunk ${index + 1} failed:`, result.reason);
        }
      });

      console.log(`\n✅ All ${chunks.length} chunks processed in parallel!`);

      // Combine all chunk results
      const finalResults: Results = {
        transcript,
        deepSeek: allDeepSeek.join('\n\n---\n\n'),
        geminiFlash: allGeminiFlash.join('\n\n---\n\n'),
        geminiPro: allGeminiPro.join('\n\n---\n\n'),
        openRouter: allOpenRouter.join('\n\n---\n\n'),
        deepSeekError: deepSeekErr,
        geminiFlashError: geminiFlashErr,
        geminiProError: geminiProErr,
        openRouterError: openRouterErr,
      };

      setResults(finalResults);
      setProcessingState({ isProcessing: false, status: 'Processing complete!' });

      console.log('\n✅ Video processing complete!');
      console.log(`   DeepSeek: ${allDeepSeek.length > 0 ? '✓' : '✗'}`);
      console.log(`   Gemini Flash: ${allGeminiFlash.length > 0 ? '✓' : '✗'}`);
      console.log(`   Gemini Pro: ${allGeminiPro.length > 0 ? '✓' : '✗'}`);
      console.log(`   OpenRouter: ${allOpenRouter.length > 0 ? '✓' : '✗'}`);

      console.log(`\n📋 Checking pending videos...`);
      console.log(`   pendingVideos.length: ${pendingVideos.length}`);
      console.log(`   pendingVideos:`, pendingVideos);

      // If there are pending videos, wait for user to mark as final
      if (pendingVideos.length > 0) {
        console.log(`\n⏸️ Waiting for user to select final output before processing next video...`);
        console.log(`   Remaining videos: ${pendingVideos.length}`);
        setIsWaitingForUserAction(true);
      } else {
        console.log(`\n✓ No pending videos. This was the last or only video.`);
      }
    } catch (error) {
      console.error('Processing error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setProcessingState({ isProcessing: false, status: '' });
    }
  };

  // Handler for transcript approval
  const handleTranscriptAccept = async () => {
    console.log('✅ User accepted transcript');
    await continueProcessing();
  };

  // Handler for transcript rejection - get another random video from same channel
  const handleTranscriptReject = async () => {
    console.log('🔄 User rejected transcript, trying another video from same channel...');

    if (!currentVideoInfo?.channelTitle) {
      alert('Cannot find another video - channel information not available');
      return;
    }

    const channelTitle = currentVideoInfo.channelTitle;

    // Fetch videos from the same channel
    try {
      setProcessingState({
        isProcessing: true,
        status: 'Finding another video from the same channel...',
      });

      // Find videos from the same channel
      const channelVideos = availableVideos.filter(
        (v) => v.channelTitle === channelTitle
      );

      if (channelVideos.length === 0) {
        // No videos cached, fetch from API
        console.log('No cached videos, fetching from YouTube API...');

        if (!settings.youtubeApiKey || settings.channelUrls.length === 0) {
          alert('Cannot fetch more videos - YouTube API key or channel URLs not configured');
          setProcessingState({ isProcessing: false, status: '' });
          return;
        }

        // Fetch videos from all channels
        const result = await fetchMultipleChannelsVideos(
          settings.channelUrls,
          settings.youtubeApiKey,
          new Map(),
          50,
          27
        );

        setAvailableVideos(result.videos);

        const sameChannelVideos = result.videos.filter(
          (v) => v.channelTitle === channelTitle
        );

        if (sameChannelVideos.length === 0) {
          alert('No more videos found from this channel');
          setProcessingState({ isProcessing: false, status: '' });
          return;
        }

        // Pick a random video
        const randomIndex = Math.floor(Math.random() * sameChannelVideos.length);
        const randomVideo = sameChannelVideos[randomIndex];
        const randomVideoUrl = `https://www.youtube.com/watch?v=${randomVideo.videoId}`;

        console.log(`🎲 Selected random video: ${randomVideo.title}`);

        // Process the new video
        await handleProcess(
          randomVideoUrl,
          randomVideo.title,
          currentVideoInfo.videoIndex,
          currentVideoInfo.totalVideos,
          randomVideo.channelTitle
        );
      } else {
        // Pick a random video from cached ones
        const randomIndex = Math.floor(Math.random() * channelVideos.length);
        const randomVideo = channelVideos[randomIndex];
        const randomVideoUrl = `https://www.youtube.com/watch?v=${randomVideo.videoId}`;

        console.log(`🎲 Selected random video from cache: ${randomVideo.title}`);

        // Process the new video
        await handleProcess(
          randomVideoUrl,
          randomVideo.title,
          currentVideoInfo.videoIndex,
          currentVideoInfo.totalVideos,
          randomVideo.channelTitle
        );
      }
    } catch (error) {
      console.error('Error fetching another video:', error);
      alert(`Failed to fetch another video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setProcessingState({ isProcessing: false, status: '' });
    }
  };

  // Handler for canceling the process
  const handleTranscriptCancel = () => {
    console.log('❌ User canceled the process');
    setShowTranscriptApproval(false);
    setCurrentTranscript('');
    setCurrentVideoInfo(null);
    setProcessingState({ isProcessing: false, status: '' });
    alert('Process canceled');
  };

  // Handler for rewriting outputs with same transcript
  const handleRewrite = async () => {
    if (!results?.transcript) {
      console.error('No transcript available to rewrite');
      return;
    }

    console.log('🔄 Rewriting all outputs with same transcript...');

    // Use the existing transcript
    const transcript = results.transcript;

    setShowTranscriptApproval(false);
    setProcessingState({
      isProcessing: true,
      status: 'Rewriting outputs...',
    });

    try {
      // Chunk the transcript
      console.log('✂️ Splitting transcript into chunks...');
      const chunks = chunkText(transcript, 7000);
      console.log(`✓ Created ${chunks.length} chunks`);

      // Initialize results with transcript (keep it)
      const initialResults: Results = {
        transcript,
        deepSeek: '',
        geminiFlash: '',
        geminiPro: '',
        openRouter: '',
      };
      setResults(initialResults);

      // Process ALL chunks in parallel
      console.log(`\n🚀 Starting PARALLEL processing of ${chunks.length} chunks...`);
      console.log(`   Models enabled: ${[
        settings.enableDeepSeek && settings.deepSeekApiKey && 'DeepSeek',
        settings.enableGeminiFlash && settings.geminiApiKey && 'Gemini Flash',
        settings.enableGeminiPro && settings.geminiApiKey && 'Gemini Pro',
        settings.enableOpenRouter && settings.openRouterApiKey && 'OpenRouter',
      ].filter(Boolean).join(', ')}`);

      setProcessingState({
        isProcessing: true,
        status: `Processing ${chunks.length} chunks in parallel...`,
        currentChunk: 0,
        totalChunks: chunks.length,
      });

      const prompt = settings.customPrompt || 'Summarize the following text:';

      // Track completed chunks for UI updates
      let completedChunks = 0;

      // Process each chunk (with all enabled models) in parallel
      const chunkPromises = chunks.map(async (chunk, i) => {
        console.log(`\n🔄 Processing chunk ${i + 1}/${chunks.length} (parallel)`);

        const modelPromises: Promise<any>[] = [];

        if (settings.enableDeepSeek && settings.deepSeekApiKey) {
          modelPromises.push(processWithDeepSeek(prompt, chunk, settings.deepSeekApiKey));
        }
        if (settings.enableGeminiFlash && settings.geminiApiKey) {
          modelPromises.push(processWithGeminiFlash(prompt, chunk, settings.geminiApiKey));
        }
        if (settings.enableGeminiPro && settings.geminiApiKey) {
          modelPromises.push(processWithGeminiPro(prompt, chunk, settings.geminiApiKey));
        }
        if (settings.enableOpenRouter && settings.openRouterApiKey) {
          modelPromises.push(
            processWithOpenRouter(
              prompt,
              chunk,
              settings.openRouterApiKey,
              settings.selectedOpenRouterModel
            )
          );
        }

        const modelResults = await Promise.all(modelPromises);

        // Map results back to named models
        let resultIndex = 0;
        const chunkResults = {
          deepSeek: { content: '', model: 'DeepSeek', error: undefined as string | undefined },
          geminiFlash: { content: '', model: 'Gemini 2.5 Flash', error: undefined as string | undefined },
          geminiPro: { content: '', model: 'Gemini 2.5 Pro', error: undefined as string | undefined },
          openRouter: { content: '', model: 'OpenRouter', error: undefined as string | undefined },
        };

        if (settings.enableDeepSeek && settings.deepSeekApiKey) {
          chunkResults.deepSeek = modelResults[resultIndex++];
        }
        if (settings.enableGeminiFlash && settings.geminiApiKey) {
          chunkResults.geminiFlash = modelResults[resultIndex++];
        }
        if (settings.enableGeminiPro && settings.geminiApiKey) {
          chunkResults.geminiPro = modelResults[resultIndex++];
        }
        if (settings.enableOpenRouter && settings.openRouterApiKey) {
          chunkResults.openRouter = modelResults[resultIndex++];
        }

        // Update UI with completed chunk count
        completedChunks++;
        setProcessingState({
          isProcessing: true,
          status: `Processing ${chunks.length} chunks in parallel...`,
          currentChunk: completedChunks,
          totalChunks: chunks.length,
        });

        console.log(`✓ Chunk ${i + 1}/${chunks.length} completed (${completedChunks}/${chunks.length} total)`);
        return chunkResults;
      });

      // Wait for ALL chunks to complete
      const allChunkResults = await Promise.allSettled(chunkPromises);

      // Accumulate results from all chunks
      const allDeepSeek: string[] = [];
      const allGeminiFlash: string[] = [];
      const allGeminiPro: string[] = [];
      const allOpenRouter: string[] = [];

      let deepSeekErr: string | undefined;
      let geminiFlashErr: string | undefined;
      let geminiProErr: string | undefined;
      let openRouterErr: string | undefined;

      allChunkResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const chunkResults = result.value;

          if (chunkResults.deepSeek.content) allDeepSeek.push(chunkResults.deepSeek.content);
          if (chunkResults.deepSeek.error && !deepSeekErr) deepSeekErr = chunkResults.deepSeek.error;

          if (chunkResults.geminiFlash.content) allGeminiFlash.push(chunkResults.geminiFlash.content);
          if (chunkResults.geminiFlash.error && !geminiFlashErr) geminiFlashErr = chunkResults.geminiFlash.error;

          if (chunkResults.geminiPro.content) allGeminiPro.push(chunkResults.geminiPro.content);
          if (chunkResults.geminiPro.error && !geminiProErr) geminiProErr = chunkResults.geminiPro.error;

          if (chunkResults.openRouter.content) allOpenRouter.push(chunkResults.openRouter.content);
          if (chunkResults.openRouter.error && !openRouterErr) openRouterErr = chunkResults.openRouter.error;
        } else {
          console.error(`✗ Chunk ${index + 1} failed:`, result.reason);
        }
      });

      console.log(`\n✅ All ${chunks.length} chunks reprocessed!`);

      // Combine all chunk results
      const finalResults: Results = {
        transcript,
        deepSeek: allDeepSeek.join('\n\n---\n\n'),
        geminiFlash: allGeminiFlash.join('\n\n---\n\n'),
        geminiPro: allGeminiPro.join('\n\n---\n\n'),
        openRouter: allOpenRouter.join('\n\n---\n\n'),
        deepSeekError: deepSeekErr,
        geminiFlashError: geminiFlashErr,
        geminiProError: geminiProErr,
        openRouterError: openRouterErr,
      };

      setResults(finalResults);
      setProcessingState({ isProcessing: false, status: 'Rewrite complete!' });

      console.log('\n✅ Rewrite complete!');
      console.log(`   DeepSeek: ${allDeepSeek.length > 0 ? '✓' : '✗'}`);
      console.log(`   Gemini Flash: ${allGeminiFlash.length > 0 ? '✓' : '✗'}`);
      console.log(`   Gemini Pro: ${allGeminiPro.length > 0 ? '✓' : '✗'}`);
      console.log(`   OpenRouter: ${allOpenRouter.length > 0 ? '✓' : '✗'}`);
    } catch (error) {
      console.error('Rewrite error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setProcessingState({ isProcessing: false, status: '' });
    }
  };

  const handleSelectFinal = async (output: string, modelName: string) => {
    console.log(`\n💾 User selected ${modelName} as final output`);

    if (currentUrl) {
      // Save to localStorage history
      saveOutput(currentUrl, output);
      console.log('✓ Saved to localStorage history');

      // Create filename from model name and timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const sanitizedModel = modelName.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${sanitizedModel}_output_${timestamp}.txt`;

      // Download as text file
      const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Upload to Google Drive if enabled
      if (settings.enableDriveUpload && settings.googleDriveAccessToken) {
        console.log('☁️ Uploading to Google Drive...');
        try {
          const driveResult = await uploadToGoogleDrive(
            output,
            filename,
            settings.googleDriveAccessToken,
            settings.googleDriveFolderId || undefined
          );

          if (driveResult.error) {
            console.error('✗ Drive upload failed:', driveResult.error);
            alert(`Local save successful, but Drive upload failed: ${driveResult.error}`);
          } else {
            console.log('✓ Successfully uploaded to Google Drive');
            alert(`${modelName} output saved locally and uploaded to Google Drive!`);
          }
        } catch (error) {
          console.error('✗ Drive upload error:', error);
          alert(`${modelName} output saved locally, but Drive upload failed.`);
        }
      } else {
        console.log('✓ File downloaded locally');
        alert(`${modelName} output saved and downloaded!`);
      }

      // If there are pending videos, process the next one
      if (pendingVideos.length > 0) {
        console.log('\n▶️ Moving to next video...');
        setIsWaitingForUserAction(false);
        const nextVideo = pendingVideos[0];
        const remainingVideos = pendingVideos.slice(1);

        // Calculate correct index (we just finished 1 video, and there are pendingVideos.length remaining)
        const totalVideosOriginal = 1 + pendingVideos.length; // 1 completed + remaining
        const currentIndex = totalVideosOriginal - pendingVideos.length + 1; // Next video index

        setPendingVideos(remainingVideos);
        console.log(`📋 Remaining videos in queue: ${remainingVideos.length}`);

        // Process next video
        await handleProcess(nextVideo.url, nextVideo.title, currentIndex, totalVideosOriginal);
      } else {
        console.log('\n🎉 All videos processed successfully!');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <InputSection
        onProcess={handleProcess}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isProcessing={processingState.isProcessing}
      />

      {processingState.isProcessing && (
        <div className="max-w-4xl mx-auto px-6">
          <ProcessingStatus
            status={processingState.status}
            currentChunk={processingState.currentChunk}
            totalChunks={processingState.totalChunks}
            currentVideoIndex={processingState.currentVideoIndex}
            totalVideos={processingState.totalVideos}
            currentVideoTitle={processingState.currentVideoTitle}
          />
        </div>
      )}

      {showTranscriptApproval && currentTranscript && (
        <TranscriptApproval
          transcript={currentTranscript}
          videoTitle={currentVideoInfo?.title}
          onAccept={handleTranscriptAccept}
          onReject={handleTranscriptReject}
          onCancel={handleTranscriptCancel}
        />
      )}

      {!showTranscriptApproval && results ? (
        <SideBySideComparison
          transcript={results.transcript}
          outputs={{
            deepSeek: results.deepSeek,
            geminiFlash: results.geminiFlash,
            geminiPro: results.geminiPro,
            openRouter: results.openRouter,
            deepSeekError: results.deepSeekError,
            geminiFlashError: results.geminiFlashError,
            geminiProError: results.geminiProError,
            openRouterError: results.openRouterError,
          }}
          onSelectFinal={handleSelectFinal}
          onRewrite={handleRewrite}
          pendingCount={pendingVideos.length}
          isWaitingForUserAction={isWaitingForUserAction}
        />
      ) : !showTranscriptApproval ? (
        <VideoGrid
          onVideoSelect={handleProcess}
          onBatchSelect={(videos) => {
            console.log(`\n📥 Received batch videos from VideoGrid:`, videos);
            console.log(`   Total videos in batch: ${videos.length}`);
            setPendingVideos(videos);
            console.log(`✓ Pending videos state updated`);
          }}
          onVideosLoaded={(videos) => {
            setAvailableVideos(videos);
            console.log(`📦 Cached ${videos.length} videos for random selection`);
          }}
        />
      ) : null}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

export default App;
