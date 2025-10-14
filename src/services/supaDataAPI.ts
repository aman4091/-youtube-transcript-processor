import axios from 'axios';

export interface TranscriptResponse {
  transcript: string;
  videoId?: string;
  title?: string;
  error?: string;
}

interface JobStatusResponse {
  status: 'queued' | 'active' | 'completed' | 'failed';
  content?: string;
  error?: string;
}

/**
 * Poll for job results when SupaData returns a job ID
 */
async function pollJobResult(jobId: string, apiKey: string): Promise<string> {
  const pollUrl = `https://api.supadata.ai/v1/transcript/${jobId}`;
  const maxAttempts = 60; // 5 minutes max
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      const response = await axios.get<JobStatusResponse>(pollUrl, {
        headers: {
          'x-api-key': apiKey,
          'Accept': 'application/json',
        },
      });

      const { status, content, error } = response.data;

      if (status === 'completed') {
        if (!content) {
          throw new Error('Job completed but no transcript content returned');
        }
        return content;
      } else if (status === 'failed') {
        throw new Error(`SupaData job failed: ${error || 'Unknown error'}`);
      } else if (status === 'queued' || status === 'active') {
        console.log(`[SupaData] Job status: ${status}, waiting...`);
        await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
        attempt++;
        continue;
      } else {
        throw new Error(`Unknown job status: ${status}`);
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('SupaData API key is invalid or expired. Please check your API key in settings.');
      }
      if (error instanceof Error && error.message.includes('job failed')) {
        throw error;
      }
      console.error(`[SupaData] Poll attempt ${attempt + 1} failed:`, error);
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Job polling timeout - the video may be too large or processing failed');
}

/**
 * Fetch YouTube transcript using SupaData API
 */
export async function fetchYouTubeTranscript(
  youtubeUrl: string,
  apiKey: string
): Promise<TranscriptResponse> {
  try {
    if (!apiKey) {
      throw new Error('SupaData API key is missing. Please add it in settings.');
    }

    // Correct endpoint according to SupaData docs
    const url = 'https://api.supadata.ai/v1/transcript';

    // Parameters according to docs
    const params = {
      url: youtubeUrl,
      text: true, // Return plain text instead of timestamped chunks
      mode: 'auto', // Try native first, fallback to AI generation
    };

    console.log('[SupaData] Requesting transcript for:', youtubeUrl);

    const response = await axios.get(url, {
      params,
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json',
      },
      timeout: 120000, // 120 second timeout
    });

    console.log('[SupaData] Response status:', response.status);

    // Handle async job (HTTP 202)
    if (response.status === 202) {
      const jobId = response.data.jobId;
      if (!jobId) {
        throw new Error('SupaData returned 202 but no job ID');
      }
      console.log('[SupaData] Large file detected, polling job:', jobId);
      const transcript = await pollJobResult(jobId, apiKey);
      return {
        transcript,
        videoId: extractVideoId(youtubeUrl),
      };
    }

    // Direct response (HTTP 200)
    const content = response.data.content || response.data.text || response.data.transcript || '';

    if (!content) {
      throw new Error('SupaData returned no transcript text. The video may not have captions available.');
    }

    return {
      transcript: content.trim(),
      videoId: extractVideoId(youtubeUrl),
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new Error('SupaData API key is invalid or expired. Please check your API key in settings.');
      }
      if (error.response?.status === 429) {
        throw new Error('SupaData API rate limit exceeded. Please wait and try again later, or upgrade your plan.');
      }
      if (error.response?.status === 403) {
        throw new Error('SupaData API access forbidden. Your API key may have insufficient permissions or credits.');
      }
      if (error.response && error.response.status >= 500) {
        throw new Error('SupaData server error. Please try again later.');
      }
      throw new Error(
        `Failed to fetch transcript: ${error.response?.data?.error || error.response?.data?.message || error.message}`
      );
    }
    throw error;
  }
}

/**
 * Extract video ID from YouTube URL
 */
function extractVideoId(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname === 'youtu.be') {
      return urlObj.pathname.substring(1);
    }

    if (hostname.includes('youtube.com')) {
      const videoId = urlObj.searchParams.get('v');
      if (videoId) return videoId;

      const embedMatch = urlObj.pathname.match(/\/embed\/([^/?]+)/);
      if (embedMatch) return embedMatch[1];

      const vMatch = urlObj.pathname.match(/\/v\/([^/?]+)/);
      if (vMatch) return vMatch[1];
    }

    return '';
  } catch {
    return '';
  }
}
