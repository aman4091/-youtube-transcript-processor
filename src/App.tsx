import { useState } from 'react';
import InputSection from './components/InputSection';
import SettingsModal from './components/SettingsModal';
import ProcessingStatus from './components/ProcessingStatus';
import SideBySideComparison from './components/SideBySideComparison';
import VideoGrid from './components/VideoGrid';
import TranscriptApproval from './components/TranscriptApproval';
import ProcessedVideos from './components/ProcessedVideos';
import TitleGenerator from './components/TitleGenerator';
import TitleConfirmModal from './components/TitleConfirmModal';
import ManualProcessingModal from './components/ManualProcessingModal';
import TitleCreationPage from './components/TitleCreationPage';
import { useSettingsStore } from './stores/settingsStore';
import { useHistoryStore } from './stores/historyStore';
import { useTempQueueStore } from './stores/tempQueueStore';
import { useScriptCounterStore } from './stores/scriptCounterStore';
import { fetchYouTubeTranscript } from './services/supaDataAPI';
import { fetchMultipleChannelsVideos, YouTubeVideo } from './services/youtubeAPI';
import {
  processWithDeepSeek,
  processWithGeminiFlash,
  processWithGeminiPro,
  processWithOpenRouter,
} from './services/aiProcessors';
import { chunkText } from './utils/chunkingService';
import { cleanMarkdown } from './utils/markdownCleaner';
import { sendToTelegram } from './services/telegramAPI';

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
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showTitleCreationPage, setShowTitleCreationPage] = useState(false);
  const [processingState, setProcessingState] = useState<ProcessingState>({
    isProcessing: false,
    status: '',
  });
  const [results, setResults] = useState<Results | null>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [pendingVideos, setPendingVideos] = useState<Array<{
    url: string;
    title: string;
    channelTitle?: string;
    targetChannelId?: string;
    targetChannelName?: string;
  }>>([]);
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
    targetChannelId?: string;
    targetChannelName?: string;
  } | null>(null);
  const [availableVideos, setAvailableVideos] = useState<YouTubeVideo[]>([]);

  // Title generation states
  const [showTitleGenerator, setShowTitleGenerator] = useState(false);
  const [showTitleConfirm, setShowTitleConfirm] = useState(false);
  const [currentScript, setCurrentScript] = useState('');
  const [currentCounter, setCurrentCounter] = useState(0);

  // Manual processing state
  const [showManualModal, setShowManualModal] = useState(false);

  const { settings } = useSettingsStore();
  const { addProcessedLink, saveOutput } = useHistoryStore();
  const { addToQueue, getQueue, clearQueue, getQueueCount, updateGeneratedTitle } = useTempQueueStore();
  const { getNextCounter } = useScriptCounterStore();

  const handleProcess = async (
    url: string,
    videoTitle?: string,
    videoIndex?: number,
    totalVideos?: number,
    channelTitle?: string,
    targetChannelId?: string,
    targetChannelName?: string
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
        console.error('❌ SupaData API key not configured');
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
        targetChannelId,
        targetChannelName,
      });

      // Show transcript approval UI
      setShowTranscriptApproval(true);
      setProcessingState({ isProcessing: false, status: '' });
      console.log('⏸️ Waiting for user to approve/reject transcript...');

      // Don't process further - wait for user approval
      return;
    } catch (error) {
      console.error('❌ Processing error:', error);
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
      // Add to history with metadata
      const videoIdMatch = url.match(/(?:v=|\/)([\w-]{11})/);
      const videoId = videoIdMatch ? videoIdMatch[1] : undefined;
      const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;

      // Add to history with target channel info
      const targetChannelId = currentVideoInfo?.targetChannelId || 'default';
      const targetChannelName = currentVideoInfo?.targetChannelName || 'Default Channel';
      addProcessedLink(url, targetChannelId, targetChannelName, videoId, videoTitle, thumbnailUrl, currentVideoInfo?.channelTitle);

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

          if (chunkResults.deepSeek.content) allDeepSeek.push(cleanMarkdown(chunkResults.deepSeek.content));
          if (chunkResults.deepSeek.error && !deepSeekErr) deepSeekErr = chunkResults.deepSeek.error;

          if (chunkResults.geminiFlash.content) allGeminiFlash.push(cleanMarkdown(chunkResults.geminiFlash.content));
          if (chunkResults.geminiFlash.error && !geminiFlashErr) geminiFlashErr = chunkResults.geminiFlash.error;

          if (chunkResults.geminiPro.content) allGeminiPro.push(cleanMarkdown(chunkResults.geminiPro.content));
          if (chunkResults.geminiPro.error && !geminiProErr) geminiProErr = chunkResults.geminiPro.error;

          if (chunkResults.openRouter.content) allOpenRouter.push(cleanMarkdown(chunkResults.openRouter.content));
          if (chunkResults.openRouter.error && !openRouterErr) openRouterErr = chunkResults.openRouter.error;
        } else {
          console.error(`✗ Chunk ${index + 1} failed:`, result.reason);
        }
      });

      console.log(`\n✅ All ${chunks.length} chunks processed in parallel!`);

      // Combine all chunk results
      const finalResults: Results = {
        transcript,
        deepSeek: allDeepSeek.join('\n\n'),
        geminiFlash: allGeminiFlash.join('\n\n'),
        geminiPro: allGeminiPro.join('\n\n'),
        openRouter: allOpenRouter.join('\n\n'),
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
      console.error('❌ Processing error:', error);
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
      console.error('❌ Cannot find another video - channel information not available');
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
          console.error('❌ Cannot fetch more videos - YouTube API key or channel URLs not configured');
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
          console.log('⚠️ No more videos found from this channel');
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
          randomVideo.channelTitle,
          currentVideoInfo.targetChannelId,
          currentVideoInfo.targetChannelName
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
          randomVideo.channelTitle,
          currentVideoInfo.targetChannelId,
          currentVideoInfo.targetChannelName
        );
      }
    } catch (error) {
      console.error('❌ Error fetching another video:', error);
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
  };

  // Handler for manual processing mode
  const handleManualMode = () => {
    console.log('✍️ User selected Manual mode');
    setShowTranscriptApproval(false);
    setShowManualModal(true);
  };

  // Handler for manual processing submit
  const handleManualSubmit = (output: string) => {
    console.log('✅ User submitted manual output');
    console.log(`   Output length (before cleaning): ${output.length} characters`);

    if (!currentUrl || !currentVideoInfo) {
      console.error('No video info available for manual processing');
      return;
    }

    // Clean the output - remove markdown formatting (lines, asterisks, etc.)
    const cleanedOutput = cleanMarkdown(output);
    console.log(`   Output length (after cleaning): ${cleanedOutput.length} characters`);
    console.log('✓ Removed markdown formatting (lines, asterisks, etc.)');

    // Close manual modal
    setShowManualModal(false);

    // Add to history with metadata and target channel
    const videoIdMatch = currentUrl.match(/(?:v=|\/)([\w-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : undefined;
    const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined;

    const targetChannelId = currentVideoInfo.targetChannelId || 'default';
    const targetChannelName = currentVideoInfo.targetChannelName || 'Default Channel';
    addProcessedLink(currentUrl, targetChannelId, targetChannelName, videoId, currentVideoInfo.title, thumbnailUrl, currentVideoInfo.channelTitle);

    // Save to localStorage history (cleaned version)
    saveOutput(currentUrl, targetChannelId, cleanedOutput);
    console.log('✓ Saved cleaned output to localStorage history');

    // Get next sequential counter
    const counter = getNextCounter();

    // Add to queue for Telegram push (cleaned version)
    addToQueue(
      cleanedOutput,
      'Manual',
      counter,
      currentVideoInfo.title,
      currentUrl
    );
    console.log(`📝 Added cleaned output to Telegram queue (${getQueueCount()} items total) - Counter: ${counter}`);

    // Store current script and counter for later use (cleaned version)
    setCurrentScript(cleanedOutput);
    setCurrentCounter(counter);

    // Clear transcript data
    setCurrentTranscript('');

    // Show title confirmation modal
    setShowTitleConfirm(true);
  };

  // Handler for manual processing cancel
  const handleManualCancel = () => {
    console.log('❌ User canceled manual processing');
    setShowManualModal(false);
    // Return to transcript approval
    setShowTranscriptApproval(true);
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

          if (chunkResults.deepSeek.content) allDeepSeek.push(cleanMarkdown(chunkResults.deepSeek.content));
          if (chunkResults.deepSeek.error && !deepSeekErr) deepSeekErr = chunkResults.deepSeek.error;

          if (chunkResults.geminiFlash.content) allGeminiFlash.push(cleanMarkdown(chunkResults.geminiFlash.content));
          if (chunkResults.geminiFlash.error && !geminiFlashErr) geminiFlashErr = chunkResults.geminiFlash.error;

          if (chunkResults.geminiPro.content) allGeminiPro.push(cleanMarkdown(chunkResults.geminiPro.content));
          if (chunkResults.geminiPro.error && !geminiProErr) geminiProErr = chunkResults.geminiPro.error;

          if (chunkResults.openRouter.content) allOpenRouter.push(cleanMarkdown(chunkResults.openRouter.content));
          if (chunkResults.openRouter.error && !openRouterErr) openRouterErr = chunkResults.openRouter.error;
        } else {
          console.error(`✗ Chunk ${index + 1} failed:`, result.reason);
        }
      });

      console.log(`\n✅ All ${chunks.length} chunks reprocessed!`);

      // Combine all chunk results
      const finalResults: Results = {
        transcript,
        deepSeek: allDeepSeek.join('\n\n'),
        geminiFlash: allGeminiFlash.join('\n\n'),
        geminiPro: allGeminiPro.join('\n\n'),
        openRouter: allOpenRouter.join('\n\n'),
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
      console.error('❌ Rewrite error:', error);
      setProcessingState({ isProcessing: false, status: '' });
    }
  };

  const handleSelectFinal = async (output: string, modelName: string) => {
    console.log(`\n💾 User selected ${modelName} as final output`);

    if (currentUrl && currentVideoInfo) {
      // Save to localStorage history with target channel
      const targetChannelId = currentVideoInfo.targetChannelId || 'default';
      saveOutput(currentUrl, targetChannelId, output);
      console.log('✓ Saved to localStorage history');

      // Get next sequential counter
      const counter = getNextCounter();

      // NO LOCAL DOWNLOAD - just add to queue
      // ADD TO QUEUE for Telegram push
      addToQueue(
        output,
        modelName,
        counter,
        currentVideoInfo?.title,
        currentUrl
      );
      console.log(`📝 Added to Telegram queue (${getQueueCount()} items total) - Counter: ${counter}`);

      // Store current script and counter for later use
      setCurrentScript(output);
      setCurrentCounter(counter);

      // THEN show title modal
      setShowTitleConfirm(true);
    }
  };

  const handleTitleConfirm = () => {
    console.log('✨ User wants to generate titles');
    setShowTitleConfirm(false);
    setShowTitleGenerator(true);
  };

  const handleTitleSkipFromConfirm = async () => {
    console.log('⏭️ User skipped title generation from confirm');
    setShowTitleConfirm(false);

    // Clear results to go back to homepage (VideoGrid)
    setResults(null);
    setCurrentUrl('');

    // Script already downloaded, just process next video
    await processNextVideo();
  };

  const processNextVideo = async () => {
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
      await handleProcess(
        nextVideo.url,
        nextVideo.title,
        currentIndex,
        totalVideosOriginal,
        nextVideo.channelTitle,
        nextVideo.targetChannelId,
        nextVideo.targetChannelName
      );
    } else {
      console.log('\n🎉 All videos processed successfully!');
    }
  };

  const handleTitleSelected = async (title: string) => {
    console.log(`✓ Title selected: ${title}`);
    setShowTitleGenerator(false);

    // Save title to queue
    updateGeneratedTitle(currentCounter, title);
    console.log(`📝 Title saved to queue for counter: ${currentCounter}`);

    // Clear results to go back to homepage (VideoGrid)
    setResults(null);
    setCurrentUrl('');

    // NO LOCAL DOWNLOAD - title will be sent via Telegram only
    await processNextVideo();
  };

  const handleSkipTitle = async () => {
    console.log('⏭️ Title generation skipped');
    setShowTitleGenerator(false);

    // Clear results to go back to homepage (VideoGrid)
    setResults(null);
    setCurrentUrl('');

    await processNextVideo();
  };

  // Handler for pushing queued scripts to Telegram
  const handlePushToChat = async () => {
    console.log('\n📤 Starting push to Telegram...');

    // Check Telegram credentials
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      console.error('❌ Telegram not configured! Please add your Bot Token and Chat ID #1 in Settings.');
      return;
    }

    // Get queued scripts
    const queue = getQueue();

    if (queue.length === 0) {
      console.log('📭 No scripts in queue to push');
      return;
    }

    console.log(`📦 Found ${queue.length} scripts in queue`);

    // NO CONFIRMATION - just send directly

    // Show processing status
    setProcessingState({
      isProcessing: true,
      status: `Pushing to Telegram (0/${queue.length})...`,
    });

    let successCount = 0;
    let failCount = 0;
    let errors: string[] = [];

    // Send each script (oldest to newest)
    for (let i = 0; i < queue.length; i++) {
      const script = queue[i];
      console.log(`\n📤 Sending script ${i + 1}/${queue.length}: ${script.modelName}`);

      setProcessingState({
        isProcessing: true,
        status: `Pushing to Telegram (${i + 1}/${queue.length})...`,
      });

      try {
        // Send to Chat ID #1 (script only)
        console.log(`📤 Sending to Chat #1 (script only)...`);
        const result1 = await sendToTelegram(
          settings.telegramBotToken,
          settings.telegramChatId,
          script.content,
          script.modelName,
          script.videoTitle,
          script.videoUrl,
          script.counter
        );

        if (result1.success) {
          console.log('✓ Sent to Chat #1 successfully');
        } else {
          failCount++;
          errors.push(`Chat #1 - ${script.modelName}: ${result1.error}`);
          console.error(`✗ Failed Chat #1: ${result1.error}`);
        }

        // Send to Chat ID #2 (script + title) if configured and title exists
        if (settings.telegramChatIdWithTitle && script.generatedTitle) {
          console.log(`📤 Sending to Chat #2 (script + title)...`);

          // Send script first
          const result2Script = await sendToTelegram(
            settings.telegramBotToken,
            settings.telegramChatIdWithTitle,
            script.content,
            script.modelName,
            script.videoTitle,
            script.videoUrl,
            script.counter
          );

          if (result2Script.success) {
            console.log('✓ Script sent to Chat #2');
          } else {
            failCount++;
            errors.push(`Chat #2 Script - ${script.modelName}: ${result2Script.error}`);
            console.error(`✗ Failed Chat #2 Script: ${result2Script.error}`);
          }

          // Small delay between script and title
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Send title
          const result2Title = await sendToTelegram(
            settings.telegramBotToken,
            settings.telegramChatIdWithTitle,
            script.generatedTitle,
            `${script.modelName} - Title`,
            script.videoTitle,
            script.videoUrl,
            script.counter
          );

          if (result2Title.success) {
            console.log('✓ Title sent to Chat #2');
            successCount++;
          } else {
            failCount++;
            errors.push(`Chat #2 Title - ${script.modelName}: ${result2Title.error}`);
            console.error(`✗ Failed Chat #2 Title: ${result2Title.error}`);
          }
        } else if (settings.telegramChatIdWithTitle) {
          console.log(`⚠️ Chat #2 configured but no title for ${script.modelName}, skipping`);
        }

        if (result1.success) {
          successCount++;
        }

        // Add delay between scripts to avoid rate limiting
        if (i < queue.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (error) {
        failCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${script.modelName}: ${errorMsg}`);
        console.error(`✗ Error sending script:`, error);
      }
    }

    // Clear processing status
    setProcessingState({ isProcessing: false, status: '' });

    // Show results - NO SUCCESS ALERT, only log errors
    if (failCount === 0) {
      console.log(`\n✅ All scripts sent successfully!`);
      // Just clear queue silently
      clearQueue();
      console.log('🗑️ Queue cleared');
    } else if (successCount > 0) {
      console.log(`\n⚠️ Partial success: ${successCount} succeeded, ${failCount} failed`);
      const errorSummary = errors.join('\n');
      console.error(`Errors:\n${errorSummary}`);
      // Don't clear queue if some failed
    } else {
      console.log(`\n✗ All scripts failed`);
      const errorSummary = errors.join('\n');
      console.error(`Errors:\n${errorSummary}`);
      // Don't clear queue if all failed
    }
  };

  // If title creation page is open, show only title page
  if (showTitleCreationPage) {
    return (
      <TitleCreationPage
        onClose={() => setShowTitleCreationPage(false)}
      />
    );
  }

  // If history view is open, show only history page
  if (isHistoryOpen) {
    return (
      <ProcessedVideos
        onVideoSelect={handleProcess}
        onClose={() => setIsHistoryOpen(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <InputSection
        onProcess={handleProcess}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenTitlePage={() => setShowTitleCreationPage(true)}
        onGoHome={() => {
          // Clear all processing states and go back to homepage
          setResults(null);
          setCurrentUrl('');
          setShowTranscriptApproval(false);
          setShowTitleConfirm(false);
          setShowTitleGenerator(false);
          setShowManualModal(false);
          setShowTitleCreationPage(false);
          setProcessingState({ isProcessing: false, status: '' });
        }}
        onPushToChat={handlePushToChat}
        queueCount={getQueueCount()}
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
          onManual={handleManualMode}
        />
      )}

      {/* Manual Processing Modal */}
      {showManualModal && currentTranscript && (
        <ManualProcessingModal
          transcript={currentTranscript}
          prompt={settings.customPrompt || 'Summarize the following text:'}
          videoTitle={currentVideoInfo?.title}
          onSubmit={handleManualSubmit}
          onCancel={handleManualCancel}
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
          queueCount={getQueueCount()}
          onPushToChat={handlePushToChat}
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
          onPushToChat={handlePushToChat}
        />
      ) : null}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Title Confirmation Modal */}
      {showTitleConfirm && (
        <TitleConfirmModal
          onConfirm={handleTitleConfirm}
          onSkip={handleTitleSkipFromConfirm}
        />
      )}

      {/* Title Generator Modal */}
      {showTitleGenerator && (
        <TitleGenerator
          script={currentScript}
          onTitleSelected={handleTitleSelected}
          onSkip={handleSkipTitle}
        />
      )}
    </div>
  );
}

export default App;
