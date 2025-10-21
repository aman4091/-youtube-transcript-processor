// NEW IMPLEMENTATION - Copy this into process-scheduled-videos/index.ts

// This replaces the current processOldVideo function starting from line ~189

async function processOldVideo(video: any, settings: any, supabase: any) {
  try {
    // Fetch transcript
    const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;
    const transcript = await fetchTranscriptWithRotation(videoUrl, settings);
    console.log(`Transcript: ${transcript.length} chars`);

    // Split into chunks
    const chunks = chunkText(transcript, 7000);
    const totalChunks = chunks.length;
    console.log(`Total chunks: ${totalChunks}`);

    // Get existing results (resume capability)
    const existingResults = video.chunk_results || [];
    const completedSet = new Set(existingResults.map((r: any) => r.index));

    console.log(`📦 Already done: ${existingResults.length} chunks`);
    console.log(`🚀 Processing ${totalChunks - existingResults.length} NEW chunks in parallel!`);

    // Update total in DB
    await supabase.from('scheduled_videos').update({ total_chunks: totalChunks }).eq('id', video.id);

    // Process all chunks (skip completed ones)
    const chunkPromises = chunks.map(async (chunk, i) => {
      // Skip if done
      if (completedSet.has(i)) {
        const existing = existingResults.find((r: any) => r.index === i);
        return { index: i, content: existing.content, status: 'skipped' };
      }

      console.log(`[${i + 1}/${totalChunks}] Start`);

      const prompt = settings.custom_prompt || 'Process this transcript:';
      const fullPrompt = totalChunks > 1 ? `${prompt}\n\n[Part ${i + 1} of ${totalChunks}]` : prompt;

      const process = (async () => {
        let result;
        if (settings.ai_model === 'deepseek') {
          result = await processWithDeepSeek(fullPrompt, chunk, settings.deepseek_api_key);
        } else {
          result = await processWithGeminiFlash(fullPrompt, chunk, settings.gemini_api_key);
        }
        if (result.error) throw new Error(result.error);
        console.log(`✅ [${i + 1}] ${result.content.length} chars`);
        return { index: i, content: result.content };
      })();

      // Timeout wrapper
      try {
        const data = await processChunkWithTimeout(process);
        return { ...data, status: 'fulfilled' };
      } catch (err: any) {
        console.error(`❌ [${i + 1}] FAIL:`, err.message);
        return { index: i, error: err.message, status: 'rejected' };
      }
    });

    // Wait for all (don't fail if one fails)
    console.log(`⏳ Waiting (60s timeout per chunk)...`);
    const results = await Promise.allSettled(chunkPromises);

    // Collect results
    const newSuccess: any[] = [];
    const newFails: number[] = [];

    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        const chunk = r.value;
        if (chunk.status === 'fulfilled' || chunk.status === 'skipped') {
          newSuccess.push({ index: chunk.index, content: chunk.content, processed_at: new Date().toISOString() });
        } else if (chunk.status === 'rejected') {
          newFails.push(chunk.index);
        }
      }
    });

    // Merge with existing (avoid duplicates)
    const merged = [
      ...existingResults.filter((r: any) => !newSuccess.find(s => s.index === r.index)),
      ...newSuccess
    ];
    const done = merged.length;

    console.log(`✅ New: ${newSuccess.length - existingResults.length} | ❌ Failed: ${newFails.length} | Total: ${done}/${totalChunks}`);

    // Save progress
    await supabase.from('scheduled_videos').update({
      chunk_results: merged,
      completed_chunks: done,
      failed_chunks: newFails,
    }).eq('id', video.id);

    // Complete?
    if (done === totalChunks) {
      console.log(`🎉 ALL COMPLETE!`);
      return { success: true, totalChunks, completedChunks: done };
    } else {
      console.log(`⚠️ Partial (${done}/${totalChunks}) - will resume next run`);
      return { success: false, partialSuccess: true, totalChunks, completedChunks: done };
    }
  } catch (error: any) {
    console.error(`💥 Error:`, error.message);
    return { success: false, error: error.message };
  }
}
